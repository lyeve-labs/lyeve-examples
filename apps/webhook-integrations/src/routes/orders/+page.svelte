<script lang="ts">
	import { clock, money } from '$lib/format';

	let { data, form } = $props();
</script>

<svelte:head><title>Orders</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Orders</h1>
<p class="mt-1 text-sm text-slate-500">
	Writing an order is the trigger. The engine publishes the lifecycle event, the webhook plugin
	signs a payload and posts it to this app, and the receiver writes down what it decided.
</p>

{#if form?.error}
	<p class="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
		{form.error}
	</p>
{/if}
{#if form?.placed}
	<p class="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
		Order written. The delivery is already on its way; see
		<a class="underline" href="/receipts">receipts</a>.
	</p>
{/if}
{#if form?.moved}
	<p class="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
		{form.moved} is now {form.status}.
	</p>
{/if}

<form method="POST" action="?/place" class="mt-8 grid gap-4 rounded-lg border border-slate-200 p-5 sm:grid-cols-2">
	<label class="text-sm">
		<span class="text-slate-600">Customer</span>
		<input
			name="customer"
			value={form?.customer ?? ''}
			placeholder="Marisa Okonjo"
			class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
		/>
	</label>
	<label class="text-sm">
		<span class="text-slate-600">Email</span>
		<input
			name="email"
			value={form?.email ?? ''}
			placeholder="m.okonjo@example.com"
			class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
		/>
	</label>
	<label class="text-sm">
		<span class="text-slate-600">Total, in pounds</span>
		<input
			name="amount"
			value={form?.amount ?? ''}
			placeholder="149.50"
			class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
		/>
	</label>
	<label class="text-sm">
		<span class="text-slate-600">Note</span>
		<input
			name="note"
			value={form?.note ?? ''}
			placeholder="Leave with the neighbor at 14b"
			class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
		/>
	</label>
	<div class="sm:col-span-2">
		<button class="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
			Place the order
		</button>
	</div>
</form>

{#if data.orders.length === 0}
	<p class="mt-8 text-slate-500">
		No orders yet. Run <code class="rounded bg-slate-100 px-1.5 py-0.5">pnpm run setup</code> to seed a
		few, or place one above.
	</p>
{:else}
	<div class="mt-8 overflow-x-auto">
		<table class="w-full text-sm">
			<thead class="border-b border-slate-200 text-left text-slate-500">
				<tr>
					<th class="py-2 pr-4 font-medium">Reference</th>
					<th class="py-2 pr-4 font-medium">Customer</th>
					<th class="py-2 pr-4 font-medium">Total</th>
					<th class="py-2 pr-4 font-medium">Status</th>
					<th class="py-2 pr-4 font-medium">Placed</th>
					<th class="py-2 font-medium">Move</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.orders as order (order.id)}
					<tr>
						<td class="py-3 pr-4">
							<a class="font-medium underline" href="/receipts?order={order.slug}">
								{order.reference}
							</a>
						</td>
						<td class="py-3 pr-4">
							{order.customer}
							<span class="block text-xs text-slate-500">{order.email}</span>
						</td>
						<td class="py-3 pr-4">{money(order.totalCents, order.currency)}</td>
						<td class="py-3 pr-4">
							<span class="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs">{order.status}</span>
						</td>
						<td class="py-3 pr-4 text-slate-500">{clock(order.placedAt)}</td>
						<td class="py-3">
							<div class="flex gap-2">
								{#if order.next}
									<form method="POST" action="?/move">
										<input type="hidden" name="slug" value={order.slug} />
										<input type="hidden" name="status" value={order.next} />
										<button class="rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50">
											Mark {order.next}
										</button>
									</form>
								{/if}
								{#if order.status !== 'canceled' && order.status !== 'shipped'}
									<form method="POST" action="?/move">
										<input type="hidden" name="slug" value={order.slug} />
										<input type="hidden" name="status" value="canceled" />
										<button class="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50">
											Cancel
										</button>
									</form>
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<p class="mt-6 text-sm text-slate-500">
	An order's own status lives one level down, in the entry's <code>body</code>. The entry also has a
	status of its own, which is the draft and publish flag, and the two are different words for
	different things in the same payload. Only a JSONPath filter can see into the body. The plugin's
	field filters compare top-level keys.
</p>
