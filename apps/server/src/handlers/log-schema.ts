/**
 * Log Schema Discovery Handlers
 *
 * Handles WebSocket messages for crowdsourced log pattern discovery.
 * Receives patterns from desktop clients and stores them in the database.
 */

import { eq, sql, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import {
  logPatterns,
  logPatternExamples,
  logTags,
  users,
  type RawLogPattern,
} from "@pico/types";
import { send } from "../lib/utils";

/**
 * Maximum number of examples to store per pattern
 */
const MAX_EXAMPLES_PER_PATTERN = 5;

/**
 * Handle report_log_patterns message
 *
 * Upserts log patterns to the database:
 * - If pattern exists: updates last_seen_at and increments total_occurrences
 * - If new: inserts pattern with is_handled based on event name
 *
 * Also inserts examples (up to 5) and tags (team/subsystem) for each pattern.
 *
 * @param ws - WebSocket connection
 * @param userId - User's Discord ID
 * @param data - Message data containing patterns array
 * @param requestId - Optional request ID for response correlation
 */
export async function reportLogPatterns(
  ws: any,
  userId: string,
  data: { patterns: RawLogPattern[] },
  requestId?: string,
) {
  const { patterns } = data || {};

  if (!Array.isArray(patterns) || patterns.length === 0) {
    return send(ws, "error", undefined, "No patterns provided", requestId);
  }

  try {
    // Check if user is a beta tester
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { betaTester: true },
    });

    if (!user?.betaTester) {
      // Silently acknowledge without processing for non-beta users
      return send(
        ws,
        "log_patterns_received",
        {
          acknowledged: true,
          newCount: 0,
          updatedCount: 0,
          errorCount: 0,
          total: patterns.length,
        },
        undefined,
        requestId,
      );
    }

    // Step 1: Filter valid patterns and get all signatures
    const validPatterns = patterns.filter((p) => p.signature);
    const signatures = validPatterns.map((p) => p.signature);
    const errorCount = patterns.length - validPatterns.length;

    if (signatures.length === 0) {
      return send(
        ws,
        "log_patterns_received",
        { newCount: 0, updatedCount: 0, errorCount, total: patterns.length },
        undefined,
        requestId,
      );
    }

    // Step 2: Fetch all existing patterns in one query
    const existingPatterns = await db
      .select()
      .from(logPatterns)
      .where(inArray(logPatterns.signature, signatures));

    const existingMap = new Map(existingPatterns.map((p) => [p.signature, p]));

    // Step 3: Separate new vs existing patterns
    const toInsert: {
      eventName: string;
      severity: string | undefined;
      signature: string;
      isHandled: boolean;
      totalOccurrences: number;
    }[] = [];
    const toUpdateIds: string[] = [];

    for (const pattern of validPatterns) {
      const existing = existingMap.get(pattern.signature);
      if (existing) {
        toUpdateIds.push(existing.id);
      } else {
        toInsert.push({
          eventName: pattern.eventName || "unknown",
          severity: pattern.severity,
          signature: pattern.signature,
          isHandled: false,
          totalOccurrences: 1,
        });
      }
    }

    // Step 4: Batch insert new patterns
    const inserted =
      toInsert.length > 0
        ? await db.insert(logPatterns).values(toInsert).returning()
        : [];

    // Step 5: Batch update existing patterns
    if (toUpdateIds.length > 0) {
      await db
        .update(logPatterns)
        .set({
          lastSeenAt: new Date(),
          totalOccurrences: sql`${logPatterns.totalOccurrences} + 1`,
        })
        .where(inArray(logPatterns.id, toUpdateIds));
    }

    const newCount = inserted.length;
    const updatedCount = toUpdateIds.length;

    // Step 6: Build signature→patternId map
    const signatureToId = new Map<string, string>([
      ...existingPatterns.map((p) => [p.signature, p.id] as [string, string]),
      ...inserted.map((p) => [p.signature, p.id] as [string, string]),
    ]);

    // Step 7: Get example counts for all patterns in one query
    const allPatternIds = Array.from(signatureToId.values());
    const exampleCounts =
      allPatternIds.length > 0
        ? await db
            .select({
              patternId: logPatternExamples.patternId,
              count: sql<number>`count(*)`,
            })
            .from(logPatternExamples)
            .where(inArray(logPatternExamples.patternId, allPatternIds))
            .groupBy(logPatternExamples.patternId)
        : [];

    const countMap = new Map(
      exampleCounts.map((e) => [e.patternId, Number(e.count)]),
    );

    // Step 8: Batch insert examples (respecting limit)
    const examplesToInsert = validPatterns
      .filter((p) => p.exampleLine)
      .map((p) => ({
        patternId: signatureToId.get(p.signature)!,
        exampleLine: p.exampleLine!,
      }))
      .filter(
        (e) => (countMap.get(e.patternId) ?? 0) < MAX_EXAMPLES_PER_PATTERN,
      );

    if (examplesToInsert.length > 0) {
      await db
        .insert(logPatternExamples)
        .values(examplesToInsert)
        .onConflictDoNothing();
    }

    // Step 9: Batch insert tags
    const tagsToInsert: {
      patternId: string;
      tagType: string;
      tagValue: string;
    }[] = [];

    for (const pattern of validPatterns) {
      const patternId = signatureToId.get(pattern.signature);
      if (!patternId) continue;

      for (const team of pattern.teams ?? []) {
        tagsToInsert.push({ patternId, tagType: "team", tagValue: team });
      }
      for (const subsystem of pattern.subsystems ?? []) {
        tagsToInsert.push({
          patternId,
          tagType: "subsystem",
          tagValue: subsystem,
        });
      }
    }

    if (tagsToInsert.length > 0) {
      await db.insert(logTags).values(tagsToInsert).onConflictDoNothing();
    }

    // Send acknowledgment
    return send(
      ws,
      "log_patterns_received",
      { newCount, updatedCount, errorCount, total: patterns.length },
      undefined,
      requestId,
    );
  } catch (error) {
    console.error("[LogSchema] Error processing patterns:", error);
    return send(
      ws,
      "error",
      undefined,
      "Failed to process patterns",
      requestId,
    );
  }
}

/**
 * Get statistics about log patterns
 *
 * Returns counts of handled/unhandled patterns and top unhandled patterns.
 *
 * @param ws - WebSocket connection
 * @param userId - User's Discord ID
 * @param data - Message data (optional filters)
 * @param requestId - Optional request ID for response correlation
 */
export async function getLogPatternStats(
  ws: any,
  userId: string,
  data: { limit?: number } | undefined,
  requestId?: string,
) {
  const limit = data?.limit ?? 20;

  try {
    // Count handled vs unhandled
    const [handled] = await db
      .select({ count: sql<number>`count(*)` })
      .from(logPatterns)
      .where(eq(logPatterns.isHandled, true));

    const [unhandled] = await db
      .select({ count: sql<number>`count(*)` })
      .from(logPatterns)
      .where(eq(logPatterns.isHandled, false));

    // Get top unhandled patterns by occurrence
    const topUnhandled = await db
      .select({
        eventName: logPatterns.eventName,
        severity: logPatterns.severity,
        totalOccurrences: logPatterns.totalOccurrences,
        lastSeenAt: logPatterns.lastSeenAt,
      })
      .from(logPatterns)
      .where(eq(logPatterns.isHandled, false))
      .orderBy(sql`${logPatterns.totalOccurrences} DESC`)
      .limit(limit);

    return send(
      ws,
      "log_pattern_stats",
      {
        handledCount: handled?.count ?? 0,
        unhandledCount: unhandled?.count ?? 0,
        topUnhandled,
      },
      undefined,
      requestId,
    );
  } catch (error) {
    console.error("[LogSchema] Error getting stats:", error);
    return send(
      ws,
      "error",
      undefined,
      "Failed to get pattern stats",
      requestId,
    );
  }
}
