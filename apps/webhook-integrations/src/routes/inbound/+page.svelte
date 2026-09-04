<script lang="ts">
	import { clock } from '$lib/format';

	let { data, form } = $props();
</script>

<svelte:head><title>Inbound events</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Inbound events</h1>
<p class="mt-1 text-sm text-slate-500">
	The other direction. A vendor signs, the engine verifies, and the mapped payload becomes a row.
	This page plays the vendor: it signs from the server with the same key the endpoint was created
	with.
</p>

{#if form?.error}
	<p class="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
		{form.error}
	</p>
{/if}
{#if form?.created}
	<p class="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
		Inbound endpoint created.
	</p>
{/if}

{#if !data.endpoint}
	<section class="mt-8 rounded-lg border border-slate-200 p-5">
		<p class="text-sm text-slate-600">
			No inbound endpoint yet. It is created by provisioning, by the register button on the
			endpoints page, or here.
		</p>
		<form method="POST" action="?/create" class="mt-4">
			<button class="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
				Create it
			</button>
		</form>
	</section>
{:else}
	<section class="mt-8 rounded-lg border border-slate-200 p-5">
		<h2 class="font-semibold tracking-tight">{data.name}</h2>
		<dl class="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
			<div class="sm:col-span-2">
				<dt class="text-slate-500">Receive URL</dt>
				<dd class="font-mono text-xs break-all">
					POST /api/v1/webhooks/in/{data.endpoint.id}
				</dd>
			</div>
			<div>
				<dt class="text-slate-500">Writes into</dt>
				<dd class="font-mono text-xs">{data.endpoint.schema}</dd>
			</div>
			<div>
				<dt class="text-slate-500">IP allowlist</dt>
				<dd class="text-xs">
					{#if data.endpoint.allowedIps.length === 0}
						empty, so any address may post a correctly signed request
					{:else}
						{data.endpoint.allowedIps.join(', ')}
					{/if}
				</dd>
			</div>
			<div class="sm:col-span-2">
				<dt class="text-slate-500">Field map</dt>
				<dd class="mt-1">
					<ul class="grid gap-1 font-mono text-xs sm:grid-cols-2">
						{#each data.endpoint.fieldMap as [external, column] (external)}
							<li>{external} &rarr; {column}</li>
						{/each}
					</ul>
				</dd>
			</div>
		</dl>
		<p class="mt-3 text-xs text-slate-500">
			The map is mandatory and rejected when empty. It is what makes the endpoint safe to publish:
			a key the map does not name is dropped, so a caller cannot reach a column by inventing a
			JSON key for it.
		</p>
	</section>

	<section class="mt-8">
		<h2 class="text-lg font-semibold tracking-tight">Send a sample</h2>
		<p class="mt-1 text-sm text-slate-500">
			Each of these breaks exactly one rule, so the engine's answer says which rule it was.
		</p>
		<form method="POST" action="?/send" class="mt-4 flex flex-wrap items-end gap-3 text-sm">
			<label>
				<span class="block text-slate-600">Order reference</span>
				<input
					name="reference"
					value={data.suggestedReference}
					class="mt-1 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
				/>
			</label>
			<label>
				<span class="block text-slate-600">Sample</span>
				<select name="mode" class="mt-1 rounded-md border border-slate-300 px-3 py-2">
					{#each data.modes as mode (mode)}
						<option value={mode}>{mode}</option>
					{/each}
				</select>
			</label>
			<button class="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">
				Post it
			</button>
		</form>

		<ul class="mt-4 space-y-1 text-sm text-slate-600">
			<li><strong>valid</strong>: signed over the timestamp, the nonce and the body. 201.</li>
			<li><strong>tampered</strong>: one word changed after signing. 401.</li>
			<li><strong>unsigned</strong>: no headers at all. 400, on the missing timestamp.</li>
			<li><strong>stale</strong>: correctly signed, ten minutes old. 400.</li>
			<li><strong>replayed</strong>: the previous valid request, sent again. 409.</li>
		</ul>
	</section>

	{#if form?.status}
		<section class="mt-8 rounded-lg border border-slate-300 p-5">
			<h3 class="font-semibold tracking-tight">
				{form.mode}: the engine answered HTTP {form.status}
			</h3>
			<p class="mt-1 text-sm text-slate-500">Expected {form.expectation}</p>
			<pre class="mt-3 overflow-x-auto rounded bg-slate-50 p-3 text-xs">{form.response}</pre>
			<details class="mt-3">
				<summary class="cursor-pointer text-xs text-slate-500">What was sent</summary>
				<ul class="mt-2 space-y-0.5 font-mono text-xs">
					{#each form.sentHeaders ?? [] as [name, value] (name)}
						<li>{name}: {value}</li>
					{/each}
				</ul>
				<pre class="mt-2 overflow-x-auto rounded bg-slate-50 p-3 text-xs">{form.sentBody}</pre>
			</details>
		</section>
	{/if}
{/if}

<section class="mt-10">
	<h2 class="text-lg font-semibold tracking-tight">Shipments</h2>
	<p class="mt-1 text-sm text-slate-500">
		Rows the inbound endpoint wrote. It inserts into the content type's generated table directly,
		not through the entries table, so a shipment is readable through the content API and is
		invisible to search and to the admin content list. That is the same trade the public content
		write makes.
	</p>
	{#if data.shipments.length === 0}
		<p class="mt-3 text-sm text-slate-500">None yet. Send a valid sample above.</p>
	{:else}
		<div class="mt-3 overflow-x-auto">
			<table class="w-full text-sm">
				<thead class="border-b border-slate-200 text-left text-slate-500">
					<tr>
						<th class="py-2 pr-4 font-medium">Shipment</th>
						<th class="py-2 pr-4 font-medium">Order</th>
						<th class="py-2 pr-4 font-medium">Carrier</th>
						<th class="py-2 pr-4 font-medium">Tracking</th>
						<th class="py-2 pr-4 font-medium">State</th>
						<th class="py-2 font-medium">Recorded</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each data.shipments as shipment (shipment.id)}
						<tr>
							<td class="py-2 pr-4 font-mono text-xs">{shipment.shipmentId}</td>
							<td class="py-2 pr-4">{shipment.reference}</td>
							<td class="py-2 pr-4">{shipment.carrier}</td>
							<td class="py-2 pr-4 font-mono text-xs">{shipment.trackingCode}</td>
							<td class="py-2 pr-4">{shipment.state}</td>
							<td class="py-2 text-slate-500">{clock(shipment.recordedAt)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
	<p class="mt-3 text-xs text-slate-500">
		The inbound insert runs no schema validation: it puts the mapped values straight into the
		columns. Every field on this content type is text for that reason, because a value a
		timestamp column cannot parse comes back as a database error rather than a 422.
	</p>
</section>
