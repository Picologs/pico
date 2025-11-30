import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import * as schema from '$lib/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import {
	computeGapAnalysis,
	createBaselineSnapshot,
	type BaselineSnapshot
} from '$lib/gap-analysis';

export const load: PageServerLoad = async ({ url }) => {
	const selectedBaselineId = url.searchParams.get('baseline');

	// Get all baselines for dropdown (gracefully handle if table doesn't exist)
	let baselines: Array<{
		id: string;
		name: string;
		description: string | null;
		createdAt: Date;
	}> = [];

	let selectedBaseline: {
		id: string;
		name: string;
		description: string | null;
		createdAt: Date;
		snapshotData: unknown;
	} | null = null;

	try {
		baselines = await db
			.select({
				id: schema.gapAnalysisBaselines.id,
				name: schema.gapAnalysisBaselines.name,
				description: schema.gapAnalysisBaselines.description,
				createdAt: schema.gapAnalysisBaselines.createdAt
			})
			.from(schema.gapAnalysisBaselines)
			.orderBy(desc(schema.gapAnalysisBaselines.createdAt));

		if (selectedBaselineId) {
			const [found] = await db
				.select()
				.from(schema.gapAnalysisBaselines)
				.where(eq(schema.gapAnalysisBaselines.id, selectedBaselineId))
				.limit(1);
			selectedBaseline = found || null;
		} else if (baselines.length > 0) {
			// Auto-select most recent baseline
			const [found] = await db
				.select()
				.from(schema.gapAnalysisBaselines)
				.where(eq(schema.gapAnalysisBaselines.id, baselines[0].id))
				.limit(1);
			selectedBaseline = found || null;
		}
	} catch {
		// Table might not exist yet - continue without baselines
		console.warn('gap_analysis_baselines table not found, continuing without baselines');
	}

	// Get all patterns
	const patterns = await db
		.select({
			id: schema.logPatterns.id,
			eventName: schema.logPatterns.eventName,
			signature: schema.logPatterns.signature,
			category: schema.logPatterns.category,
			priorityScore: schema.logPatterns.priorityScore,
			totalOccurrences: schema.logPatterns.totalOccurrences,
			lastSeenAt: schema.logPatterns.lastSeenAt,
			severity: schema.logPatterns.severity
		})
		.from(schema.logPatterns);

	// Get examples for all patterns
	const patternIds = patterns.map((p: { id: string }) => p.id);
	const examples =
		patternIds.length > 0
			? await db
					.select({
						patternId: schema.logPatternExamples.patternId,
						exampleLine: schema.logPatternExamples.exampleLine
					})
					.from(schema.logPatternExamples)
					.where(inArray(schema.logPatternExamples.patternId, patternIds))
			: [];

	// Get tags for all patterns
	const tags =
		patternIds.length > 0
			? await db
					.select({
						patternId: schema.logTags.patternId,
						tagType: schema.logTags.tagType,
						tagValue: schema.logTags.tagValue
					})
					.from(schema.logTags)
					.where(inArray(schema.logTags.patternId, patternIds))
			: [];

	// Group examples and tags by pattern ID
	const examplesByPattern: Record<string, string[]> = {};
	for (const example of examples) {
		if (!examplesByPattern[example.patternId]) {
			examplesByPattern[example.patternId] = [];
		}
		if (examplesByPattern[example.patternId].length < 5) {
			examplesByPattern[example.patternId].push(example.exampleLine);
		}
	}

	const tagsByPattern: Record<string, Array<{ tagType: string; tagValue: string }>> = {};
	for (const tag of tags) {
		if (!tagsByPattern[tag.patternId]) {
			tagsByPattern[tag.patternId] = [];
		}
		tagsByPattern[tag.patternId].push({ tagType: tag.tagType, tagValue: tag.tagValue });
	}

	// Enrich patterns with examples and tags
	const enrichedPatterns = patterns.map((p: typeof patterns[number]) => ({
		...p,
		examples: examplesByPattern[p.id] || [],
		tags: tagsByPattern[p.id] || []
	}));

	// Compute gap analysis
	const gapAnalysis = computeGapAnalysis(
		enrichedPatterns,
		selectedBaseline?.snapshotData as BaselineSnapshot | null
	);

	// Set baseline info
	if (selectedBaseline) {
		gapAnalysis.baseline.id = selectedBaseline.id;
		gapAnalysis.baseline.name = selectedBaseline.name;
		gapAnalysis.baseline.createdAt = selectedBaseline.createdAt;
	}

	return {
		gapAnalysis,
		baselines,
		selectedBaselineId: selectedBaseline?.id || null
	};
};

export const actions: Actions = {
	// Create new baseline snapshot
	createBaseline: async ({ request, locals }) => {
		if (!locals.user) {
			return { success: false, error: 'Unauthorized' };
		}

		const formData = await request.formData();
		const name = (formData.get('name') as string) || `Baseline ${new Date().toISOString().split('T')[0]}`;
		const description = formData.get('description') as string;

		// Get all current patterns
		const patterns = await db
			.select({
				signature: schema.logPatterns.signature,
				eventName: schema.logPatterns.eventName,
				category: schema.logPatterns.category,
				priorityScore: schema.logPatterns.priorityScore,
				totalOccurrences: schema.logPatterns.totalOccurrences
			})
			.from(schema.logPatterns);

		// Create snapshot
		const snapshot = createBaselineSnapshot(patterns);

		// Save to database
		await db.insert(schema.gapAnalysisBaselines).values({
			name,
			description: description || null,
			createdBy: locals.user.id,
			snapshotData: snapshot
		});

		return { success: true };
	},

	// Mark pattern as added to LogFeed
	markAsAdded: async ({ request }) => {
		const formData = await request.formData();
		const patternId = formData.get('patternId') as string;

		if (!patternId) {
			return { success: false, error: 'Missing patternId' };
		}

		await db
			.update(schema.logPatterns)
			.set({
				reviewStatus: 'added',
				isHandled: true
			})
			.where(eq(schema.logPatterns.id, patternId));

		return { success: true };
	},

	// Delete baseline
	deleteBaseline: async ({ request }) => {
		const formData = await request.formData();
		const baselineId = formData.get('baselineId') as string;

		if (!baselineId) {
			return { success: false, error: 'Missing baselineId' };
		}

		await db
			.delete(schema.gapAnalysisBaselines)
			.where(eq(schema.gapAnalysisBaselines.id, baselineId));

		return { success: true };
	}
};
