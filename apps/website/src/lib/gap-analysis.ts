/**
 * Gap Analysis Service
 *
 * Compares LogFeed mappings against beta tester patterns to identify:
 * - New patterns not yet in LogFeed (candidates to add)
 * - Missing mappings (LogFeed types not seen in logs)
 * - Matched patterns (successfully tracked)
 */

import {
	LOG_FEED_MAPPINGS,
	findMatchingLogFeedType,
	suggestLogFeedType,
	type LogEventType
} from './pattern-mapping';
import type { PatternCategory } from './pattern-utils';

// ============================================================================
// Types
// ============================================================================

export interface GapAnalysisPattern {
	id: string;
	eventName: string;
	signature: string;
	category: PatternCategory | string | null;
	priorityScore: number | null;
	totalOccurrences: number;
	lastSeenAt: Date;
	severity: string | null;
	matchedLogFeedType: LogEventType | null;
	suggestedType: { type: LogEventType; confidence: 'high' | 'medium' | 'low' } | null;
	isNewSinceBaseline: boolean;
	examples: string[];
	tags: Array<{ tagType: string; tagValue: string }>;
}

export interface MissingMapping {
	eventType: LogEventType;
	category: PatternCategory;
	eventNamePatterns: string[];
	description: string;
	lastSeenInLogs: Date | null;
	wasInBaseline: boolean;
}

export interface BaselineSnapshot {
	logFeedPatterns: string[];
	betaTesterPatterns: Array<{
		signature: string;
		eventName: string;
		category: string | null;
		priorityScore: number | null;
		totalOccurrences: number;
	}>;
	logFeedMappingCount: number;
	betaTesterPatternCount: number;
	matchedCount: number;
	unmatchedCount: number;
	createdAt: string;
}

export interface GapAnalysisResult {
	newUnhandled: GapAnalysisPattern[];
	newUnhandledCount: number;
	missingDeprecated: MissingMapping[];
	missingDeprecatedCount: number;
	matched: GapAnalysisPattern[];
	matchedCount: number;
	baseline: {
		id: string | null;
		name: string | null;
		createdAt: Date | null;
		newPatternsSinceBaseline: number;
		removedPatternsSinceBaseline: number;
	};
	coveragePercent: number;
	totalBetaTesterPatterns: number;
	totalLogFeedMappings: number;
}

export interface PatternInput {
	id: string;
	eventName: string;
	signature: string;
	category: string | null;
	priorityScore: number | null;
	totalOccurrences: number;
	lastSeenAt: Date | string;
	severity: string | null;
	examples?: string[];
	tags?: Array<{ tagType: string; tagValue: string }>;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Compute gap analysis comparing LogFeed mappings vs beta tester patterns
 */
export function computeGapAnalysis(
	betaTesterPatterns: PatternInput[],
	baseline?: BaselineSnapshot | null
): GapAnalysisResult {
	const baselineSignatures = new Set(
		baseline?.betaTesterPatterns.map((p) => p.signature) || []
	);

	const newUnhandled: GapAnalysisPattern[] = [];
	const matched: GapAnalysisPattern[] = [];

	// Categorize each pattern
	for (const pattern of betaTesterPatterns) {
		const matchedType = findMatchingLogFeedType(pattern.eventName);
		const isNewSinceBaseline = baseline ? !baselineSignatures.has(pattern.signature) : false;
		const patternCategory = (pattern.category as PatternCategory) || 'uncategorized';

		const enrichedPattern: GapAnalysisPattern = {
			id: pattern.id,
			eventName: pattern.eventName,
			signature: pattern.signature,
			category: pattern.category,
			priorityScore: pattern.priorityScore,
			totalOccurrences: pattern.totalOccurrences,
			lastSeenAt: new Date(pattern.lastSeenAt),
			severity: pattern.severity,
			matchedLogFeedType: matchedType,
			suggestedType:
				matchedType || patternCategory === 'uncategorized'
					? null
					: suggestLogFeedType(pattern.eventName, patternCategory),
			isNewSinceBaseline,
			examples: pattern.examples || [],
			tags: pattern.tags || []
		};

		if (matchedType) {
			matched.push(enrichedPattern);
		} else {
			newUnhandled.push(enrichedPattern);
		}
	}

	// Sort by priority score descending
	newUnhandled.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
	matched.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

	// Find missing mappings
	const missingDeprecated = findMissingMappings(betaTesterPatterns, baseline);

	// Calculate baseline comparison stats
	let newPatternsSinceBaseline = 0;
	let removedPatternsSinceBaseline = 0;

	if (baseline) {
		const currentSignatures = new Set(betaTesterPatterns.map((p) => p.signature));
		newPatternsSinceBaseline = betaTesterPatterns.filter(
			(p) => !baselineSignatures.has(p.signature)
		).length;
		removedPatternsSinceBaseline = baseline.betaTesterPatterns.filter(
			(p) => !currentSignatures.has(p.signature)
		).length;
	}

	const totalBetaTesterPatterns = betaTesterPatterns.length;
	const coveragePercent =
		totalBetaTesterPatterns > 0 ? (matched.length / totalBetaTesterPatterns) * 100 : 0;

	return {
		newUnhandled,
		newUnhandledCount: newUnhandled.length,
		missingDeprecated,
		missingDeprecatedCount: missingDeprecated.length,
		matched,
		matchedCount: matched.length,
		baseline: {
			id: null, // Set by caller
			name: null,
			createdAt: null,
			newPatternsSinceBaseline,
			removedPatternsSinceBaseline
		},
		coveragePercent,
		totalBetaTesterPatterns,
		totalLogFeedMappings: LOG_FEED_MAPPINGS.length
	};
}

/**
 * Check which LogFeed mappings have NO matching patterns in beta tester logs
 */
export function findMissingMappings(
	betaTesterPatterns: Array<{ eventName: string; lastSeenAt: Date | string }>,
	baseline?: BaselineSnapshot | null
): MissingMapping[] {
	const missing: MissingMapping[] = [];
	const baselinePatterns = new Set(baseline?.logFeedPatterns || []);

	for (const mapping of LOG_FEED_MAPPINGS) {
		if (mapping.eventNamePatterns.length === 0) continue;

		// Check if ANY pattern matches this LogFeed mapping
		let lastSeen: Date | null = null;
		let hasMatch = false;

		for (const pattern of betaTesterPatterns) {
			const eventNameLower = pattern.eventName.toLowerCase();
			for (const namePattern of mapping.eventNamePatterns) {
				if (eventNameLower.includes(namePattern.toLowerCase())) {
					hasMatch = true;
					const patternDate = new Date(pattern.lastSeenAt);
					if (!lastSeen || patternDate > lastSeen) {
						lastSeen = patternDate;
					}
					break;
				}
			}
			if (hasMatch) break;
		}

		if (!hasMatch) {
			missing.push({
				eventType: mapping.eventType,
				category: mapping.category,
				eventNamePatterns: mapping.eventNamePatterns,
				description: mapping.description,
				lastSeenInLogs: lastSeen,
				wasInBaseline: mapping.eventNamePatterns.some((p) => baselinePatterns.has(p))
			});
		}
	}

	return missing;
}

/**
 * Create a baseline snapshot from current state
 */
export function createBaselineSnapshot(
	betaTesterPatterns: Array<{
		signature: string;
		eventName: string;
		category: string | null;
		priorityScore: number | null;
		totalOccurrences: number;
	}>
): BaselineSnapshot {
	// Collect all eventNamePatterns from LOG_FEED_MAPPINGS
	const logFeedPatterns: string[] = [];
	for (const mapping of LOG_FEED_MAPPINGS) {
		logFeedPatterns.push(...mapping.eventNamePatterns);
	}

	// Count matches
	let matchedCount = 0;
	for (const pattern of betaTesterPatterns) {
		if (findMatchingLogFeedType(pattern.eventName)) {
			matchedCount++;
		}
	}

	return {
		logFeedPatterns,
		betaTesterPatterns: betaTesterPatterns.map((p) => ({
			signature: p.signature,
			eventName: p.eventName,
			category: p.category,
			priorityScore: p.priorityScore,
			totalOccurrences: p.totalOccurrences
		})),
		logFeedMappingCount: LOG_FEED_MAPPINGS.length,
		betaTesterPatternCount: betaTesterPatterns.length,
		matchedCount,
		unmatchedCount: betaTesterPatterns.length - matchedCount,
		createdAt: new Date().toISOString()
	};
}
