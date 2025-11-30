/**
 * Pattern Analysis Utilities
 *
 * Provides category classification and priority scoring for log patterns
 * to help identify which patterns should be added to LogFeed.
 */

export type PatternCategory =
	| 'player_action'
	| 'combat'
	| 'social'
	| 'navigation'
	| 'economy'
	| 'mission'
	| 'environment'
	| 'system'
	| 'uncategorized';

export type ReviewStatus = 'pending' | 'reviewed' | 'skipped' | 'added';

export type PriorityTier = 'critical' | 'high' | 'medium' | 'low';

export interface PatternForScoring {
	totalOccurrences: number;
	category: PatternCategory | string | null;
	lastSeenAt: Date | string;
	severity: string | null;
	reportCount?: number;
}

export interface PatternForCategorization {
	eventName: string;
	severity: string | null;
	tags: Array<{ tagType: string; tagValue: string }>;
}

/**
 * Category weights for priority scoring
 * Higher weights = more likely to be user-facing and valuable for LogFeed
 */
const CATEGORY_WEIGHTS: Record<PatternCategory, number> = {
	player_action: 25,
	combat: 25,
	social: 22,
	mission: 20,
	navigation: 18,
	economy: 15,
	environment: 12,
	system: 0,
	uncategorized: 5
};

/**
 * Tag-to-category mappings based on Star Citizen team tags
 */
const TAG_CATEGORY_MAP: Record<string, PatternCategory> = {
	// Vehicle/Navigation
	Team_Vehicle: 'navigation',
	Team_Ships: 'navigation',
	Team_Flight: 'navigation',
	Vehicles: 'navigation',
	Vehicle: 'navigation',

	// Combat
	Team_Combat: 'combat',
	Combat: 'combat',
	Weapons: 'combat',
	FPS: 'combat',

	// Missions
	Team_Missions: 'mission',
	Missions: 'mission',
	Mission: 'mission',

	// Social
	Team_Social: 'social',
	Team_Chat: 'social',
	Social: 'social',
	Chat: 'social',
	Voice: 'social',
	Party: 'social',

	// Economy
	Team_Economy: 'economy',
	Economy: 'economy',
	Shopping: 'economy',
	Trade: 'economy',

	// Environment
	Team_VFX: 'environment',
	Team_Environment: 'environment',
	Environment: 'environment',
	Weather: 'environment',
	Atmosphere: 'environment',

	// System/Debug
	Network: 'system',
	Debug: 'system',
	Performance: 'system',
	Memory: 'system'
};

/**
 * Event name patterns for category detection
 * Order matters - first match wins
 */
const EVENT_NAME_PATTERNS: Array<{ patterns: string[]; category: PatternCategory }> = [
	// Combat (most specific first)
	{
		patterns: ['Death', 'Kill', 'Damage', 'Weapon', 'Destroy', 'Combat', 'Attack', 'Hit', 'Armor'],
		category: 'combat'
	},
	// Player Actions
	{
		patterns: ['Actor', 'Player', 'Character', 'Spawn', 'Equip', 'Inventory', 'Item', 'Pickup'],
		category: 'player_action'
	},
	// Social/Multiplayer
	{
		patterns: ['Chat', 'Party', 'Voice', 'Social', 'Friend', 'Group', 'Invite', 'Message'],
		category: 'social'
	},
	// Navigation
	{
		patterns: [
			'Quantum',
			'Travel',
			'Location',
			'Zone',
			'Vehicle',
			'Ship',
			'Landing',
			'Dock',
			'Hangar',
			'Spline'
		],
		category: 'navigation'
	},
	// Economy
	{
		patterns: ['Shop', 'Purchase', 'Trade', 'Insurance', 'Claim', 'aUEC', 'Wallet', 'Transaction'],
		category: 'economy'
	},
	// Mission
	{
		patterns: ['Mission', 'Objective', 'Contract', 'Bounty', 'Quest', 'Task'],
		category: 'mission'
	},
	// Environment
	{
		patterns: ['Weather', 'Atmosphere', 'Hazard', 'Temperature', 'Oxygen', 'Pressure'],
		category: 'environment'
	}
];

/**
 * Calculate priority score for a pattern (0-100)
 *
 * Scoring breakdown:
 * - 0-40 pts: Occurrence count (log scale)
 * - 0-25 pts: Category weight (combat/player_action highest)
 * - 0-15 pts: Recency (seen in last 24h = max)
 * - 0-10 pts: User report count
 * - -10 pts: Error severity penalty (system logs less useful)
 */
export function calculatePriorityScore(pattern: PatternForScoring): number {
	let score = 0;

	// OCCURRENCE WEIGHT (0-40 points) - Log scale
	const occurrences = pattern.totalOccurrences;
	if (occurrences >= 100000) score += 40;
	else if (occurrences >= 10000) score += 35;
	else if (occurrences >= 1000) score += 30;
	else if (occurrences >= 100) score += 20;
	else if (occurrences >= 10) score += 10;
	else score += 5;

	// CATEGORY WEIGHT (0-25 points)
	const category = (pattern.category as PatternCategory) || 'uncategorized';
	score += CATEGORY_WEIGHTS[category] ?? 5;

	// RECENCY WEIGHT (0-15 points)
	const lastSeen = new Date(pattern.lastSeenAt);
	const daysSinceSeen = (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24);
	if (daysSinceSeen <= 1) score += 15;
	else if (daysSinceSeen <= 7) score += 10;
	else if (daysSinceSeen <= 30) score += 5;

	// USER INTEREST WEIGHT (0-10 points)
	const reportCount = pattern.reportCount || 0;
	if (reportCount >= 100) score += 10;
	else if (reportCount >= 50) score += 7;
	else if (reportCount >= 10) score += 4;
	else if (reportCount >= 1) score += 2;

	// ERROR SEVERITY PENALTY (-10 points)
	// Error/Trace logs are usually system/debug, less useful for LogFeed
	if (pattern.severity === 'Error' || pattern.severity === 'Trace') {
		score -= 10;
	}

	return Math.max(0, Math.min(100, score));
}

/**
 * Get priority tier from score
 */
export function getPriorityTier(score: number): PriorityTier {
	if (score >= 80) return 'critical';
	if (score >= 60) return 'high';
	if (score >= 40) return 'medium';
	return 'low';
}

/**
 * Auto-categorize a pattern based on tags and event name
 */
export function autoCategorize(pattern: PatternForCategorization): PatternCategory {
	// 1. Check tags first (most reliable)
	for (const tag of pattern.tags) {
		const category = TAG_CATEGORY_MAP[tag.tagValue];
		if (category) return category;
	}

	// 2. Check event name patterns
	const eventNameUpper = pattern.eventName.toUpperCase();
	for (const { patterns, category } of EVENT_NAME_PATTERNS) {
		if (patterns.some((p) => eventNameUpper.includes(p.toUpperCase()))) {
			return category;
		}
	}

	// 3. Severity-based fallback
	if (pattern.severity === 'Error' || pattern.severity === 'Trace') {
		return 'system';
	}

	return 'uncategorized';
}

/**
 * Batch auto-categorize multiple patterns
 */
export function autoCategorizeMany(
	patterns: PatternForCategorization[]
): Map<string, PatternCategory> {
	const result = new Map<string, PatternCategory>();
	for (const pattern of patterns) {
		result.set(pattern.eventName, autoCategorize(pattern));
	}
	return result;
}

/**
 * Category display information
 */
export const CATEGORY_INFO: Record<
	PatternCategory,
	{ label: string; color: string; description: string }
> = {
	player_action: {
		label: 'Player Action',
		color: 'bg-blue-500/30 text-blue-300',
		description: 'Direct player-initiated events'
	},
	combat: {
		label: 'Combat',
		color: 'bg-red-500/30 text-red-300',
		description: 'PvP, kills, deaths, damage'
	},
	social: {
		label: 'Social',
		color: 'bg-pink-500/30 text-pink-300',
		description: 'Multiplayer interactions, chat, party'
	},
	navigation: {
		label: 'Navigation',
		color: 'bg-cyan-500/30 text-cyan-300',
		description: 'Travel, location changes, vehicles'
	},
	economy: {
		label: 'Economy',
		color: 'bg-green-500/30 text-green-300',
		description: 'Shopping, trading, insurance'
	},
	mission: {
		label: 'Mission',
		color: 'bg-purple-500/30 text-purple-300',
		description: 'Mission system events'
	},
	environment: {
		label: 'Environment',
		color: 'bg-amber-500/30 text-amber-300',
		description: 'Weather, hazards, world state'
	},
	system: {
		label: 'System',
		color: 'bg-gray-500/30 text-gray-300',
		description: 'Debug, errors, internal'
	},
	uncategorized: {
		label: 'Uncategorized',
		color: 'bg-white/10 text-white/50',
		description: 'Not yet classified'
	}
};

/**
 * Priority tier display information
 */
export const PRIORITY_TIER_INFO: Record<
	PriorityTier,
	{ label: string; color: string; minScore: number }
> = {
	critical: { label: 'Critical', color: 'bg-red-500/30 text-red-300', minScore: 80 },
	high: { label: 'High', color: 'bg-orange-500/30 text-orange-300', minScore: 60 },
	medium: { label: 'Medium', color: 'bg-yellow-500/30 text-yellow-300', minScore: 40 },
	low: { label: 'Low', color: 'bg-gray-500/30 text-gray-300', minScore: 0 }
};

/**
 * Review status display information
 */
export const REVIEW_STATUS_INFO: Record<ReviewStatus, { label: string; color: string }> = {
	pending: { label: 'Pending', color: 'bg-white/10 text-white/50' },
	reviewed: { label: 'Reviewed', color: 'bg-blue-500/30 text-blue-300' },
	skipped: { label: 'Skipped', color: 'bg-gray-500/30 text-gray-300' },
	added: { label: 'Added', color: 'bg-green-500/30 text-green-300' }
};
