<script lang="ts">
	import { REQUEST_STATES, STATE_LABELS, TYPE_LABELS } from '$lib/desk';

	let { data, form } = $props();

	// The action union gives every key to every member, so the presence check
	// alone leaves these possibly undefined. Narrowing to the real shape here
	// keeps the markup free of the same two guards on every line.
	const bundle = $derived(form && 'bundle' in form && form.bundle ? form.bundle : null);
	const holds = $derived(form && 'holds' in form && Array.isArray(form.holds) ? form.holds : []);
	const req = $derived(data.request);
</script>

<svelte:head><title>{req.title}</title></svelte:head>

<p class="text-sm text-slate-500"><a href="/requests" class="hover:underline">Register</a></p>
<h1 class="mt-2 text-2xl font-semibold tracking-tight">{req.title}</h1>
<p class="mt-2 text-slate-600">
	{TYPE_LABELS[req.type]} · {STATE_LABELS[req.state]} · received
	{new Date(req.receivedAt).toLocaleDateString()} · due
	{new Date(req.dueAt).toLocaleDateString()}
</p>

{#if form?.message}
	<p class="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
		{form.message}
	</p>
{/if}

<div class="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
	<div>
		<section class="rounded-lg border border-slate-200 bg-white p-6">
			<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">The request</h2>
			<dl class="mt-4 grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
				<dt class="text-slate-500">Subject</dt>
				<dd>{req.subjectName || 'Not given'}</dd>
				<dt class="text-slate-500">Address on file</dt>
				<dd>{req.subjectEmail || 'None'}</dd>
				<dt class="text-slate-500">Account id on file</dt>
				<dd class="break-all">{req.subjectAccountId || 'None'}</dd>
				<dt class="text-slate-500">Handler</dt>
				<dd>{req.handlerName ?? 'Unassigned'}</dd>
				{#if req.resolutionNote}
					<dt class="text-slate-500">Resolution</dt>
					<dd>{req.resolutionNote}</dd>
				{/if}
			</dl>
			{#if req.details}
				<p class="mt-4 whitespace-pre-line border-t border-slate-100 pt-4 text-slate-700">
					{req.details}
				</p>
			{/if}
		</section>

		<section class="mt-6 rounded-lg border border-slate-200 bg-white p-6">
			<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
				Identifier this desk would send
			</h2>
			{#if data.identifier.problem}
				<p class="mt-3 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
					{data.identifier.problem}
				</p>
			{:else}
				<p class="mt-3 text-sm">
					<code class="rounded bg-slate-100 px-2 py-1">{data.identifier.value}</code>
					<span class="text-slate-500">
						taken from the {data.identifier.source}, classified as {data.identifier.kind}
					</span>
				</p>
				<p class="mt-2 text-sm text-slate-500">
					Log reference <code class="text-xs">{data.identifier.digest}</code>. The engine writes the
					same digest beside every line it logs about this subject.
				</p>
				{#if data.identifier.eraseBlock}
					<p
						class="mt-3 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
					>
						{data.identifier.eraseBlock}
					</p>
				{/if}
			{/if}

			<form method="POST" action="?/export" class="mt-5 flex flex-wrap items-center gap-3">
				<button
					class="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
					disabled={!data.identifier.value}
				>
					Run export
				</button>
				<span class="text-sm text-slate-500">
					Reads only. The engine files a <code>gdpr.export</code> audit entry for it.
				</span>
			</form>
		</section>

		{#if bundle}
			<section class="mt-6 rounded-lg border border-slate-200 bg-white p-6">
				<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">The bundle</h2>
				<p class="mt-3 text-sm text-slate-600">
					{bundle.records} record(s) from {bundle.withData} of {bundle.queried} registered
					exporters. Scope {bundle.scope.mode}, covering {bundle.scope.tenants_covered} of
					{bundle.scope.tenants_requested} tenant(s){bundle.matchedTenants.length > 0
						? `, matched in ${bundle.matchedTenants.join(', ')}`
						: ''}.
				</p>
				{#if bundle.incomplete}
					<ul class="mt-3 space-y-1 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm">
						{#each bundle.errors as err (err.index)}
							<li class="text-red-800">exporter {err.index}: {err.error}</li>
						{/each}
					</ul>
				{/if}
				{#if bundle.sections.length === 0}
					<p class="mt-3 text-sm text-slate-500">
						No registered exporter held anything for this identifier. That is not proof nothing is
						held about the subject: five exporters are registered, and content, media and the audit
						trail are not among them.
					</p>
				{:else}
					<ul class="mt-3 divide-y divide-slate-100 rounded border border-slate-200 text-sm">
						{#each bundle.sections as section (section.name)}
							<li class="flex justify-between px-4 py-2">
								<code>{section.name}</code>
								<span>{section.rows} row(s)</span>
							</li>
						{/each}
					</ul>
					<pre
						class="mt-4 max-h-96 overflow-auto rounded bg-slate-900 p-4 text-xs text-slate-100">{bundle.json}</pre>
				{/if}
			</section>
		{/if}

		{#if holds.length > 0}
			<section class="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-6">
				<h2 class="text-sm font-semibold uppercase tracking-wide text-amber-900">Legal holds</h2>
				<ul class="mt-3 space-y-1 text-sm text-amber-900">
					{#each holds as hold (hold.id)}
						<li><code>{hold.id}</code> {hold.reason ?? ''}</li>
					{/each}
				</ul>
				<p class="mt-3 text-sm text-amber-900">
					Nothing was erased. Art. 17(3)(e) carves out processing needed to defend a legal claim, so
					deferring and saying so is the lawful answer rather than a conflict between two
					obligations.
				</p>
			</section>
		{/if}

		<section class="mt-6 rounded-lg border border-red-200 bg-white p-6">
			<h2 class="text-sm font-semibold uppercase tracking-wide text-red-700">Erasure</h2>

			{#if !data.confirming}
				<p class="mt-3 text-sm text-slate-600">
					Erasure anonymizes the account row, revokes its sessions and deletes or blanks
					plugin-owned records. It is not reversible and there is no undo anywhere in the product.
				</p>
				{#if data.priorExport}
					<p class="mt-3 text-sm text-slate-500">
						Exported {new Date(data.priorExport.ranAt).toLocaleString()}: {data.priorExport
							.records} record(s).
					</p>
				{:else}
					<p class="mt-3 text-sm text-slate-500">
						No export has been run for this subject yet, so erasure is closed. Read the data before
						destroying it.
					</p>
				{/if}
				<a
					href="/requests/{req.slug}?confirm=erase"
					class="mt-5 inline-block rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
				>
					Continue to the confirm step
				</a>
			{:else}
				<p class="mt-3 text-sm text-slate-600">
					About to erase <code class="rounded bg-slate-100 px-2 py-1">{data.identifier.value}</code>
					across every registered eraser.
				</p>

				{#if data.guard && data.guard.refusals.length > 0}
					<ul class="mt-4 space-y-2">
						{#each data.guard.refusals as refusal (refusal)}
							<li class="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
								{refusal}
							</li>
						{/each}
					</ul>
					<p class="mt-4 text-sm text-slate-500">
						Refused. The same checks run again in the action, so skipping this page changes nothing.
					</p>
				{:else}
					{#if data.guard}
						{#each data.guard.notes as note (note)}
							<p class="mt-3 rounded border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
								{note}
							</p>
						{/each}
						{#if data.guard.account}
							<p class="mt-3 text-sm text-slate-600">
								Resolves to account <code class="text-xs">{data.guard.account.id}</code> with
								role(s) {data.guard.account.roles.join(', ') || 'none'}.
							</p>
						{/if}
					{/if}

					{#if !data.priorExport}
						<p class="mt-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
							Run the export first. The action refuses without one.
						</p>
					{/if}

					<form method="POST" action="?/erase" class="mt-5 space-y-4">
						<label class="block text-sm">
							<span class="text-slate-600">Type the identifier to confirm</span>
							<input
								name="confirm_identifier"
								autocomplete="off"
								class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
								placeholder={data.identifier.kind === 'email' ? 'name@example.com' : 'account id'}
							/>
						</label>
						<label class="flex items-start gap-2 text-sm text-slate-600">
							<input type="checkbox" name="identity_verified" value="yes" class="mt-1" />
							<span>
								The subject identity was verified before this request was actioned, and the
								verification is recorded outside this desk.
							</span>
						</label>
						<div class="flex flex-wrap items-center gap-3">
							<button
								class="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
							>
								Erase permanently
							</button>
							<a href="/requests/{req.slug}" class="text-sm text-slate-500 hover:underline">
								Cancel
							</a>
						</div>
					</form>
				{/if}
			{/if}
		</section>
	</div>

	<aside class="space-y-6">
		<section class="rounded-lg border border-slate-200 bg-white p-5">
			<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Assign</h2>
			<form method="POST" action="?/assign" class="mt-3 space-y-3">
				<select name="officer_id" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
					{#each data.officers as officer (officer.id)}
						<option value={officer.id} selected={officer.id === req.handlerId}>
							{officer.name}
						</option>
					{/each}
				</select>
				<button
					class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
				>
					Save handler
				</button>
			</form>
		</section>

		<section class="rounded-lg border border-slate-200 bg-white p-5">
			<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Move</h2>
			<form method="POST" action="?/state" class="mt-3 space-y-3">
				<select name="state" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
					{#each REQUEST_STATES as state (state)}
						<option value={state} selected={state === req.state}>{STATE_LABELS[state]}</option>
					{/each}
				</select>
				<input
					name="resolution_note"
					placeholder="Note (optional)"
					class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
				/>
				<button
					class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
				>
					Save state
				</button>
			</form>
		</section>

		<section class="rounded-lg border border-slate-200 bg-white p-5">
			<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
				Filed against this request
			</h2>
			{#if data.actions.length === 0}
				<p class="mt-3 text-sm text-slate-400">Nothing yet.</p>
			{:else}
				<ul class="mt-3 space-y-3 text-sm">
					{#each data.actions as action (action.id)}
						<li>
							<p class="font-medium">{action.kind} · {action.outcome}</p>
							<p class="text-slate-500">{new Date(action.ranAt).toLocaleString()}</p>
							{#if action.notes}<p class="text-slate-500">{action.notes}</p>{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</aside>
</div>
