<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		SEVERITY_LABEL,
		STATE_LABEL,
		applyOverlay,
		serviceSeverity,
		sortIncidents,
		type Incident,
		type IncidentUpdate,
		type Severity
	} from '$lib/board';

	let { data } = $props();

	/**
	 * Live events are an overlay over the loaded board, keyed by id, rather than
	 * a replacement for it. A dropped event costs one stale row until the next
	 * resync. It cannot leave a hole in the list.
	 */
	let incidentOverlay = $state<Record<string, Incident>>({});
	let updateOverlay = $state<Record<string, IncidentUpdate>>({});

	let connection = $state<'connecting' | 'live' | 'reconnecting' | 'stalled'>('connecting');
	let lastEventAt = $state<number | null>(null);
	let refetching = $state(false);

	const incidents = $derived(sortIncidents(applyOverlay(data.incidents, incidentOverlay)));
	const updates = $derived(applyOverlay(data.updates, updateOverlay));
	const openIncidents = $derived(incidents.filter((i) => i.state !== 'resolved'));
	const recentlyResolved = $derived(incidents.filter((i) => i.state === 'resolved').slice(0, 5));

	const serviceState = $derived(
		data.services.map((service) => ({
			...service,
			severity: serviceSeverity(incidents, service.id)
		}))
	);

	const timelines = $derived(groupTimelines(updates));
	const lastEventLabel = $derived(
		lastEventAt === null ? null : clock(new Date(lastEventAt).toISOString())
	);

	function groupTimelines(rows: IncidentUpdate[]): Record<string, IncidentUpdate[]> {
		const byIncident: Record<string, IncidentUpdate[]> = {};
		for (const row of rows) {
			if (!row.incidentId) continue;
			(byIncident[row.incidentId] ??= []).push(row);
		}
		for (const list of Object.values(byIncident)) {
			list.sort((a, b) => Date.parse(a.postedAt) - Date.parse(b.postedAt));
		}
		return byIncident;
	}

	/**
	 * Refetches the board and retires the overlay entries the server now agrees
	 * with. An entry the server has not caught up on stays, so a resync racing a
	 * write does not flicker the row back to its previous state.
	 */
	async function resync() {
		if (refetching) return;
		refetching = true;
		try {
			await invalidateAll();
			const fresh = new Map(data.incidents.map((i) => [i.id, i]));
			for (const [id, row] of Object.entries(incidentOverlay)) {
				const server = fresh.get(id);
				if (server && server.state === row.state && server.severity === row.severity) {
					delete incidentOverlay[id];
				}
			}
			const known = new Set(data.updates.map((u) => u.id));
			for (const id of Object.keys(updateOverlay)) {
				if (known.has(id)) delete updateOverlay[id];
			}
		} finally {
			refetching = false;
		}
	}

	$effect(() => {
		const source = new EventSource('/live');
		let opened = false;

		source.addEventListener('ready', () => {
			connection = 'live';
			// A reconnect means events were missed while the socket was down.
			if (opened) void resync();
			opened = true;
		});
		source.addEventListener('incident', (event) => {
			const incident = JSON.parse((event as MessageEvent).data) as Incident;
			incidentOverlay[incident.id] = incident;
			lastEventAt = Date.now();
		});
		source.addEventListener('update', (event) => {
			const update = JSON.parse((event as MessageEvent).data) as IncidentUpdate;
			updateOverlay[update.id] = update;
			lastEventAt = Date.now();
		});
		source.addEventListener('resync', () => void resync());
		source.addEventListener('stalled', () => {
			connection = 'stalled';
		});
		source.onerror = () => {
			connection = 'reconnecting';
		};

		return () => source.close();
	});

	const DOT: Record<Severity | 'ok', string> = {
		ok: 'bg-emerald-400',
		minor: 'bg-amber-400',
		major: 'bg-orange-400',
		critical: 'bg-rose-500'
	};

	const CONNECTION_LABEL = {
		connecting: 'Connecting',
		live: 'Live',
		reconnecting: 'Reconnecting',
		stalled: 'Stream interrupted'
	};

	function clock(iso: string): string {
		return new Date(iso).toLocaleString([], {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head><title>Meridian Platform Status</title></svelte:head>

<div class="flex items-baseline justify-between">
	<h1 class="text-2xl font-semibold tracking-tight">
		{openIncidents.length === 0 ? 'All systems operational' : 'Incident in progress'}
	</h1>
	<p class="flex items-center gap-2 text-xs text-slate-400">
		<span
			class="h-2 w-2 rounded-full {connection === 'live'
				? 'bg-emerald-400'
				: connection === 'stalled'
					? 'bg-rose-500'
					: 'bg-amber-400'}"
		></span>
		{CONNECTION_LABEL[connection]}{#if lastEventLabel}
			&middot; last event {lastEventLabel}{/if}
	</p>
</div>

{#if data.services.length === 0}
	<p class="mt-6 text-slate-400">
		Nothing provisioned yet. Run <code class="rounded bg-slate-800 px-1.5 py-0.5">pnpm run setup</code>
		to create the content types and seed the board.
	</p>
{:else}
	<ul class="mt-8 divide-y divide-slate-800 rounded-lg ring-1 ring-slate-800">
		{#each serviceState as service (service.id)}
			<li class="flex items-center justify-between gap-4 px-5 py-4">
				<div class="min-w-0">
					<p class="font-medium">{service.name}</p>
					{#if service.description}
						<p class="mt-0.5 truncate text-sm text-slate-400">{service.description}</p>
					{/if}
				</div>
				<p class="flex shrink-0 items-center gap-2 text-sm">
					<span class="h-2.5 w-2.5 rounded-full {DOT[service.severity ?? 'ok']}"></span>
					<span class={service.severity ? 'text-slate-200' : 'text-slate-400'}>
						{service.severity ? SEVERITY_LABEL[service.severity] : 'Operational'}
					</span>
				</p>
			</li>
		{/each}
	</ul>
{/if}

<h2 class="mt-12 text-lg font-semibold tracking-tight">Open incidents</h2>
{#if openIncidents.length === 0}
	<p class="mt-3 text-slate-400">No open incidents. The last five resolved are below.</p>
{:else}
	<div class="mt-4 space-y-6">
		{#each openIncidents as incident (incident.id)}
			<article class="rounded-lg bg-slate-900 p-5 ring-1 ring-slate-800">
				<div class="flex items-baseline justify-between gap-4">
					<h3 class="font-medium">{incident.title}</h3>
					<span class="shrink-0 text-xs uppercase tracking-wide text-slate-400">
						{STATE_LABEL[incident.state]} &middot; {SEVERITY_LABEL[incident.severity]}
					</span>
				</div>
				<p class="mt-1 text-xs text-slate-500">Opened {clock(incident.openedAt)}</p>

				<ol class="mt-4 space-y-3 border-l border-slate-800 pl-4">
					{#each timelines[incident.id] ?? [] as entry (entry.id)}
						<li>
							<p class="text-xs font-medium uppercase tracking-wide text-slate-400">
								{STATE_LABEL[entry.state]} &middot; {clock(entry.postedAt)}
							</p>
							<p class="mt-1 text-sm text-slate-200">{entry.summary}</p>
						</li>
					{:else}
						<li class="text-sm text-slate-500">
							No timeline entry yet. The incident and its first update are two separate writes.
						</li>
					{/each}
				</ol>
			</article>
		{/each}
	</div>
{/if}

{#if recentlyResolved.length > 0}
	<h2 class="mt-12 text-lg font-semibold tracking-tight">Recently resolved</h2>
	<ul class="mt-4 divide-y divide-slate-800">
		{#each recentlyResolved as incident (incident.id)}
			<li class="flex items-baseline justify-between gap-4 py-3">
				<p class="text-sm text-slate-300">{incident.title}</p>
				<p class="shrink-0 text-xs text-slate-500">
					{incident.resolvedAt ? clock(incident.resolvedAt) : clock(incident.openedAt)}
				</p>
			</li>
		{/each}
	</ul>
{/if}
