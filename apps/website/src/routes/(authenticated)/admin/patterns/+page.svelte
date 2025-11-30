<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import {
		GitCompare,
		CheckCircle,
		AlertTriangle,
		XCircle,
		Plus,
		Trash2,
		ChevronDown,
		ChevronUp,
		Calendar,
		TrendingUp,
		TrendingDown,
		Sparkles,
		Tag
	} from '@lucide/svelte';
	import type { GapAnalysisPattern, MissingMapping } from '$lib/gap-analysis';

	let { data } = $props();

	type TabId = 'new' | 'missing' | 'matched';
	let activeTab = $state<TabId>('new');
	let expandedRow = $state<string | null>(null);
	let showCreateBaseline = $state(false);
	let isProcessing = $state(false);

	function formatDate(date: Date | string | null): string {
		if (!date) return 'Never';
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function formatNumber(num: number): string {
		return new Intl.NumberFormat().format(num);
	}

	function getPriorityColor(score: number | null): string {
		if (!score) return 'bg-white/10 text-white/40';
		if (score >= 80) return 'bg-red-500/30 text-red-300';
		if (score >= 60) return 'bg-orange-500/30 text-orange-300';
		if (score >= 40) return 'bg-yellow-500/30 text-yellow-300';
		return 'bg-gray-500/30 text-gray-300';
	}

	function getSeverityColor(severity: string | null): string {
		switch (severity) {
			case 'Error':
				return 'bg-red-500/20 text-red-400';
			case 'Warning':
				return 'bg-amber-500/20 text-amber-400';
			case 'Notice':
				return 'bg-blue-500/20 text-blue-400';
			case 'Trace':
				return 'bg-gray-500/20 text-gray-400';
			default:
				return 'bg-white/10 text-white/60';
		}
	}

	function getConfidenceColor(confidence: 'high' | 'medium' | 'low'): string {
		switch (confidence) {
			case 'high':
				return 'bg-green-500/20 text-green-400';
			case 'medium':
				return 'bg-yellow-500/20 text-yellow-400';
			case 'low':
				return 'bg-white/10 text-white/50';
		}
	}

	function toggleExpand(id: string) {
		expandedRow = expandedRow === id ? null : id;
	}

	function selectBaseline(baselineId: string) {
		goto(`/admin/patterns?baseline=${baselineId}`);
	}

	const tabs: Array<{ id: TabId; label: string; count: number; color: string }> = $derived([
		{
			id: 'new',
			label: 'New / Unhandled',
			count: data.gapAnalysis.newUnhandledCount,
			color: 'text-amber-400'
		},
		{
			id: 'missing',
			label: 'Missing / Deprecated',
			count: data.gapAnalysis.missingDeprecatedCount,
			color: 'text-red-400'
		},
		{
			id: 'matched',
			label: 'Matched',
			count: data.gapAnalysis.matchedCount,
			color: 'text-green-400'
		}
	]);
</script>

<div class="p-6 space-y-6">
	<!-- Header with Baseline Selector -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-white flex items-center gap-2">
				<GitCompare size={24} class="text-blue-400" />
				Gap Analysis
			</h1>
			<p class="text-white/60 mt-1">Compare LogFeed mappings against beta tester patterns</p>
		</div>

		<div class="flex items-center gap-3">
			<!-- Baseline Selector -->
			<div class="flex items-center gap-2">
				<span class="text-sm text-white/60">Baseline:</span>
				<select
					class="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/20 text-sm min-w-48"
					value={data.selectedBaselineId || ''}
					onchange={(e) => {
						const value = e.currentTarget.value;
						if (value) {
							selectBaseline(value);
						} else {
							goto('/admin/patterns');
						}
					}}
				>
					<option value="">No baseline (show all)</option>
					{#each data.baselines as baseline (baseline.id)}
						<option value={baseline.id}>
							{baseline.name} ({formatDate(baseline.createdAt)})
						</option>
					{/each}
				</select>
			</div>

			<!-- Create Baseline Button -->
			<button
				onclick={() => (showCreateBaseline = !showCreateBaseline)}
				class="flex items-center gap-2 px-3 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors"
			>
				<Plus size={16} />
				New Baseline
			</button>
		</div>
	</div>

	<!-- Create Baseline Form -->
	{#if showCreateBaseline}
		<form
			method="POST"
			action="?/createBaseline"
			use:enhance={() => {
				isProcessing = true;
				return async ({ update }) => {
					await update();
					isProcessing = false;
					showCreateBaseline = false;
				};
			}}
			class="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 space-y-3"
		>
			<h3 class="text-sm font-medium text-blue-400">Create New Baseline Snapshot</h3>
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="baseline-name" class="block text-xs text-white/60 mb-1">Name</label>
					<input
						id="baseline-name"
						type="text"
						name="name"
						placeholder="e.g., v4.0 Release"
						class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/20 text-sm"
					/>
				</div>
				<div>
					<label for="baseline-description" class="block text-xs text-white/60 mb-1">Description (optional)</label>
					<input
						id="baseline-description"
						type="text"
						name="description"
						placeholder="Notes about this baseline"
						class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/20 text-sm"
					/>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<button
					type="submit"
					disabled={isProcessing}
					class="px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors text-sm disabled:opacity-50"
				>
					Create Snapshot
				</button>
				<button
					type="button"
					onclick={() => (showCreateBaseline = false)}
					class="px-4 py-2 text-white/60 hover:text-white text-sm"
				>
					Cancel
				</button>
			</div>
		</form>
	{/if}

	<!-- Baseline Info (if selected) -->
	{#if data.gapAnalysis.baseline.id}
		<div class="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between">
			<div class="flex items-center gap-4">
				<div class="p-2 bg-purple-500/20 rounded-lg">
					<Calendar size={20} class="text-purple-400" />
				</div>
				<div>
					<p class="text-white font-medium">{data.gapAnalysis.baseline.name}</p>
					<p class="text-sm text-white/60">Created {formatDate(data.gapAnalysis.baseline.createdAt)}</p>
				</div>
				{#if data.gapAnalysis.baseline.newPatternsSinceBaseline > 0}
					<div class="flex items-center gap-1 px-2 py-1 bg-green-500/20 rounded-lg">
						<TrendingUp size={14} class="text-green-400" />
						<span class="text-sm text-green-400">+{data.gapAnalysis.baseline.newPatternsSinceBaseline} new</span>
					</div>
				{/if}
				{#if data.gapAnalysis.baseline.removedPatternsSinceBaseline > 0}
					<div class="flex items-center gap-1 px-2 py-1 bg-red-500/20 rounded-lg">
						<TrendingDown size={14} class="text-red-400" />
						<span class="text-sm text-red-400">-{data.gapAnalysis.baseline.removedPatternsSinceBaseline} removed</span>
					</div>
				{/if}
			</div>
			<form
				method="POST"
				action="?/deleteBaseline"
				use:enhance={() => {
					isProcessing = true;
					return async ({ update }) => {
						await update();
						isProcessing = false;
						goto('/admin/patterns');
					};
				}}
			>
				<input type="hidden" name="baselineId" value={data.gapAnalysis.baseline.id} />
				<button
					type="submit"
					disabled={isProcessing}
					class="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
					title="Delete baseline"
				>
					<Trash2 size={16} />
				</button>
			</form>
		</div>
	{/if}

	<!-- Stats Cards -->
	<div class="grid grid-cols-4 gap-4">
		<div class="bg-white/5 rounded-lg p-4 border border-white/10">
			<div class="flex items-center gap-3">
				<div class="p-2 bg-blue-500/20 rounded-lg">
					<GitCompare size={20} class="text-blue-400" />
				</div>
				<div>
					<p class="text-2xl font-bold text-white">{data.gapAnalysis.coveragePercent.toFixed(1)}%</p>
					<p class="text-sm text-white/60">Coverage</p>
				</div>
			</div>
		</div>
		<div class="bg-white/5 rounded-lg p-4 border border-amber-500/30">
			<div class="flex items-center gap-3">
				<div class="p-2 bg-amber-500/20 rounded-lg">
					<AlertTriangle size={20} class="text-amber-400" />
				</div>
				<div>
					<p class="text-2xl font-bold text-amber-300">{formatNumber(data.gapAnalysis.newUnhandledCount)}</p>
					<p class="text-sm text-white/60">Unhandled</p>
				</div>
			</div>
		</div>
		<div class="bg-white/5 rounded-lg p-4 border border-red-500/30">
			<div class="flex items-center gap-3">
				<div class="p-2 bg-red-500/20 rounded-lg">
					<XCircle size={20} class="text-red-400" />
				</div>
				<div>
					<p class="text-2xl font-bold text-red-300">{formatNumber(data.gapAnalysis.missingDeprecatedCount)}</p>
					<p class="text-sm text-white/60">Missing</p>
				</div>
			</div>
		</div>
		<div class="bg-white/5 rounded-lg p-4 border border-green-500/30">
			<div class="flex items-center gap-3">
				<div class="p-2 bg-green-500/20 rounded-lg">
					<CheckCircle size={20} class="text-green-400" />
				</div>
				<div>
					<p class="text-2xl font-bold text-green-300">{formatNumber(data.gapAnalysis.matchedCount)}</p>
					<p class="text-sm text-white/60">Matched</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Tabs -->
	<div class="border-b border-white/10">
		<div class="flex gap-1">
			{#each tabs as tab (tab.id)}
				<button
					onclick={() => (activeTab = tab.id)}
					class="px-4 py-3 text-sm font-medium transition-colors relative
						{activeTab === tab.id ? 'text-white' : 'text-white/60 hover:text-white'}"
				>
					<span class={tab.color}>{tab.label}</span>
					<span class="ml-2 px-2 py-0.5 rounded-full text-xs bg-white/10">
						{tab.count}
					</span>
					{#if activeTab === tab.id}
						<div class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	<!-- Tab Content -->
	<div class="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
		{#if activeTab === 'new'}
			<!-- New/Unhandled Patterns -->
			{#if data.gapAnalysis.newUnhandled.length === 0}
				<div class="text-center py-12">
					<CheckCircle size={48} class="mx-auto text-green-400/40 mb-4" />
					<p class="text-white/60">All patterns are handled!</p>
				</div>
			{:else}
				<table class="w-full">
					<thead class="bg-white/5">
						<tr>
							<th class="w-8"></th>
							<th class="text-center px-2 py-3 text-sm font-medium text-white/60 w-16">Pri</th>
							<th class="text-left px-4 py-3 text-sm font-medium text-white/60">Event Name</th>
							<th class="text-left px-4 py-3 text-sm font-medium text-white/60">Category</th>
							<th class="text-left px-4 py-3 text-sm font-medium text-white/60">Severity</th>
							<th class="text-right px-4 py-3 text-sm font-medium text-white/60">Occurs</th>
							<th class="text-left px-4 py-3 text-sm font-medium text-white/60">Suggested Type</th>
							<th class="text-left px-4 py-3 text-sm font-medium text-white/60">Status</th>
							<th class="w-24"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-white/5">
						{#each data.gapAnalysis.newUnhandled as pattern (pattern.id)}
							<tr class="hover:bg-white/5 transition-colors">
								<td class="px-2 py-3 text-center cursor-pointer" onclick={() => toggleExpand(pattern.id)}>
									{#if expandedRow === pattern.id}
										<ChevronUp size={16} class="text-white/40" />
									{:else}
										<ChevronDown size={16} class="text-white/40" />
									{/if}
								</td>
								<td class="px-2 py-3 text-center">
									<span
										class="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold {getPriorityColor(pattern.priorityScore)}"
										title="Priority Score: {pattern.priorityScore || 0}"
									>
										{pattern.priorityScore || 0}
									</span>
								</td>
								<td class="px-4 py-3 cursor-pointer" onclick={() => toggleExpand(pattern.id)}>
									<div class="flex items-center gap-2">
										<p class="text-white font-mono text-sm truncate max-w-xs" title={pattern.eventName}>
											{pattern.eventName}
										</p>
										{#if pattern.isNewSinceBaseline}
											<span class="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">NEW</span>
										{/if}
									</div>
								</td>
								<td class="px-4 py-3">
									<span class="inline-flex px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/70">
										{pattern.category || 'uncategorized'}
									</span>
								</td>
								<td class="px-4 py-3">
									<span class="inline-flex px-2 py-0.5 rounded-full text-xs {getSeverityColor(pattern.severity)}">
										{pattern.severity ?? 'None'}
									</span>
								</td>
								<td class="px-4 py-3 text-right">
									<span class="text-white font-mono text-sm">{formatNumber(pattern.totalOccurrences)}</span>
								</td>
								<td class="px-4 py-3">
									{#if pattern.suggestedType}
										<span
											class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs {getConfidenceColor(pattern.suggestedType.confidence)}"
											title="{pattern.suggestedType.confidence} confidence"
										>
											<Sparkles size={12} />
											{pattern.suggestedType.type}
										</span>
									{:else}
										<span class="text-xs text-white/40">New type needed</span>
									{/if}
								</td>
								<td class="px-4 py-3">
									{#if pattern.isNewSinceBaseline}
										<span class="text-xs text-green-400">New since baseline</span>
									{:else}
										<span class="text-xs text-white/40">Existing</span>
									{/if}
								</td>
								<td class="px-4 py-3">
									<form
										method="POST"
										action="?/markAsAdded"
										use:enhance={() => {
											return async ({ update }) => {
												await update();
											};
										}}
									>
										<input type="hidden" name="patternId" value={pattern.id} />
										<button
											type="submit"
											class="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded hover:bg-green-500/30 transition-colors"
										>
											Mark Added
										</button>
									</form>
								</td>
							</tr>
							{#if expandedRow === pattern.id}
								<tr class="bg-white/5">
									<td colspan="9" class="px-4 py-4">
										<div class="grid grid-cols-2 gap-6">
											<div class="space-y-4">
												<!-- Signature -->
												<div>
													<p class="text-xs text-white/40 uppercase tracking-wider mb-1">Signature</p>
													<code class="text-xs text-white/80 bg-black/20 px-2 py-1 rounded block overflow-x-auto">
														{pattern.signature}
													</code>
												</div>
												<!-- Last Seen -->
												<div>
													<p class="text-xs text-white/40 uppercase tracking-wider mb-1">Last Seen</p>
													<p class="text-sm text-white/80">{formatDate(pattern.lastSeenAt)}</p>
												</div>
												<!-- Tags -->
												{#if pattern.tags.length > 0}
													<div>
														<p class="text-xs text-white/40 uppercase tracking-wider mb-1">Tags</p>
														<div class="flex flex-wrap gap-1">
															{#each pattern.tags as tag, i (i)}
																<span
																	class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs {tag.tagType === 'team'
																		? 'bg-purple-500/20 text-purple-400'
																		: 'bg-cyan-500/20 text-cyan-400'}"
																>
																	<Tag size={10} />
																	{tag.tagType}: {tag.tagValue}
																</span>
															{/each}
														</div>
													</div>
												{/if}
											</div>
											<div class="space-y-4">
												<!-- Examples -->
												{#if pattern.examples.length > 0}
													<div>
														<p class="text-xs text-white/40 uppercase tracking-wider mb-1">
															Example Lines ({pattern.examples.length})
														</p>
														<div class="space-y-1 max-h-32 overflow-y-auto">
															{#each pattern.examples as example, i (i)}
																<code
																	class="text-xs text-white/70 bg-black/20 px-2 py-1 rounded block overflow-x-auto whitespace-nowrap"
																>
																	{example}
																</code>
															{/each}
														</div>
													</div>
												{/if}
											</div>
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			{/if}
		{:else if activeTab === 'missing'}
			<!-- Missing/Deprecated Mappings -->
			{#if data.gapAnalysis.missingDeprecated.length === 0}
				<div class="text-center py-12">
					<CheckCircle size={48} class="mx-auto text-green-400/40 mb-4" />
					<p class="text-white/60">All LogFeed mappings are active!</p>
				</div>
			{:else}
				<table class="w-full">
					<thead class="bg-white/5">
						<tr>
							<th class="text-left px-4 py-3 text-sm font-medium text-white/60">LogFeed Type</th>
							<th class="text-left px-4 py-3 text-sm font-medium text-white/60">Category</th>
							<th class="text-left px-4 py-3 text-sm font-medium text-white/60">Description</th>
							<th class="text-left px-4 py-3 text-sm font-medium text-white/60">Event Patterns</th>
							<th class="text-left px-4 py-3 text-sm font-medium text-white/60">Status</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-white/5">
						{#each data.gapAnalysis.missingDeprecated as mapping (mapping.eventType)}
							<tr class="hover:bg-white/5 transition-colors">
								<td class="px-4 py-3">
									<span class="text-white font-mono text-sm">{mapping.eventType}</span>
								</td>
								<td class="px-4 py-3">
									<span class="inline-flex px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/70">
										{mapping.category}
									</span>
								</td>
								<td class="px-4 py-3">
									<p class="text-sm text-white/70">{mapping.description}</p>
								</td>
								<td class="px-4 py-3">
									<div class="flex flex-wrap gap-1">
										{#each mapping.eventNamePatterns.slice(0, 3) as eventPattern, i (i)}
											<code class="text-xs text-white/60 bg-black/20 px-1.5 py-0.5 rounded">
												{eventPattern}
											</code>
										{/each}
										{#if mapping.eventNamePatterns.length > 3}
											<span class="text-xs text-white/40">+{mapping.eventNamePatterns.length - 3}</span>
										{/if}
									</div>
								</td>
								<td class="px-4 py-3">
									{#if mapping.wasInBaseline}
										<span class="text-xs text-red-400">Was in baseline</span>
									{:else}
										<span class="text-xs text-amber-400">Never seen</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		{:else if activeTab === 'matched'}
			<!-- Matched Patterns -->
			{#if data.gapAnalysis.matched.length === 0}
				<div class="text-center py-12">
					<AlertTriangle size={48} class="mx-auto text-amber-400/40 mb-4" />
					<p class="text-white/60">No patterns are matched yet</p>
				</div>
			{:else}
				<table class="w-full">
					<thead class="bg-white/5">
						<tr>
							<th class="w-8"></th>
							<th class="text-center px-2 py-3 text-sm font-medium text-white/60 w-16">Pri</th>
							<th class="text-left px-4 py-3 text-sm font-medium text-white/60">Event Name</th>
							<th class="text-left px-4 py-3 text-sm font-medium text-white/60">LogFeed Type</th>
							<th class="text-left px-4 py-3 text-sm font-medium text-white/60">Category</th>
							<th class="text-right px-4 py-3 text-sm font-medium text-white/60">Occurs</th>
							<th class="text-left px-4 py-3 text-sm font-medium text-white/60">Last Seen</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-white/5">
						{#each data.gapAnalysis.matched as pattern (pattern.id)}
							<tr class="hover:bg-white/5 transition-colors">
								<td class="px-2 py-3 text-center cursor-pointer" onclick={() => toggleExpand(pattern.id)}>
									{#if expandedRow === pattern.id}
										<ChevronUp size={16} class="text-white/40" />
									{:else}
										<ChevronDown size={16} class="text-white/40" />
									{/if}
								</td>
								<td class="px-2 py-3 text-center">
									<span
										class="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold {getPriorityColor(pattern.priorityScore)}"
									>
										{pattern.priorityScore || 0}
									</span>
								</td>
								<td class="px-4 py-3 cursor-pointer" onclick={() => toggleExpand(pattern.id)}>
									<p class="text-white font-mono text-sm truncate max-w-xs" title={pattern.eventName}>
										{pattern.eventName}
									</p>
								</td>
								<td class="px-4 py-3">
									<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">
										<CheckCircle size={12} />
										{pattern.matchedLogFeedType}
									</span>
								</td>
								<td class="px-4 py-3">
									<span class="inline-flex px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/70">
										{pattern.category || 'uncategorized'}
									</span>
								</td>
								<td class="px-4 py-3 text-right">
									<span class="text-white font-mono text-sm">{formatNumber(pattern.totalOccurrences)}</span>
								</td>
								<td class="px-4 py-3">
									<span class="text-sm text-white/60">{formatDate(pattern.lastSeenAt)}</span>
								</td>
							</tr>
							{#if expandedRow === pattern.id}
								<tr class="bg-white/5">
									<td colspan="7" class="px-4 py-4">
										<div class="grid grid-cols-2 gap-6">
											<div class="space-y-4">
												<!-- Signature -->
												<div>
													<p class="text-xs text-white/40 uppercase tracking-wider mb-1">Signature</p>
													<code class="text-xs text-white/80 bg-black/20 px-2 py-1 rounded block overflow-x-auto">
														{pattern.signature}
													</code>
												</div>
												<!-- Tags -->
												{#if pattern.tags.length > 0}
													<div>
														<p class="text-xs text-white/40 uppercase tracking-wider mb-1">Tags</p>
														<div class="flex flex-wrap gap-1">
															{#each pattern.tags as tag, i (i)}
																<span
																	class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs {tag.tagType === 'team'
																		? 'bg-purple-500/20 text-purple-400'
																		: 'bg-cyan-500/20 text-cyan-400'}"
																>
																	<Tag size={10} />
																	{tag.tagType}: {tag.tagValue}
																</span>
															{/each}
														</div>
													</div>
												{/if}
											</div>
											<div class="space-y-4">
												<!-- Examples -->
												{#if pattern.examples.length > 0}
													<div>
														<p class="text-xs text-white/40 uppercase tracking-wider mb-1">
															Example Lines ({pattern.examples.length})
														</p>
														<div class="space-y-1 max-h-32 overflow-y-auto">
															{#each pattern.examples as example, i (i)}
																<code
																	class="text-xs text-white/70 bg-black/20 px-2 py-1 rounded block overflow-x-auto whitespace-nowrap"
																>
																	{example}
																</code>
															{/each}
														</div>
													</div>
												{/if}
											</div>
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			{/if}
		{/if}
	</div>

	<!-- Summary Footer -->
	<div class="text-center text-sm text-white/40">
		{formatNumber(data.gapAnalysis.totalBetaTesterPatterns)} beta tester patterns &middot;
		{formatNumber(data.gapAnalysis.totalLogFeedMappings)} LogFeed mappings
	</div>
</div>
