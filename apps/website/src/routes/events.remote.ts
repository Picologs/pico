import { query } from '$app/server';
import { db, schema, type LogPattern } from '$lib/db';
import { computeGapAnalysis, type PatternInput } from '$lib/gap-analysis';

export const getTrackedEvents = query(async () => {
	// Fetch patterns from database
	const patterns = await db.select().from(schema.logPatterns);

	// Convert to PatternInput format
	const patternInputs: PatternInput[] = patterns.map((p: LogPattern) => ({
		id: p.id,
		eventName: p.eventName,
		signature: p.signature,
		category: p.category,
		priorityScore: p.priorityScore,
		totalOccurrences: p.totalOccurrences,
		lastSeenAt: p.lastSeenAt,
		severity: p.severity
	}));

	// Compute gap analysis (no baseline needed)
	const gapAnalysis = computeGapAnalysis(patternInputs, null);

	// Currently tracked (matched patterns) - get unique event types
	const currentTypes = new Set<string>();
	for (const p of gapAnalysis.matched) {
		if (p.matchedLogFeedType && !p.matchedLogFeedType.includes('_group')) {
			currentTypes.add(p.matchedLogFeedType.replace(/_/g, ' '));
		}
	}
	const current = Array.from(currentTypes).sort();

	// Previously supported but no longer seen (deprecated)
	const deprecated = gapAnalysis.missingDeprecated
		.filter((m) => !m.eventType.includes('_group'))
		.map((m) => m.eventType.replace(/_/g, ' '))
		.sort();

	return { current, deprecated };
});
