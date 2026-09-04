import { WATCHED } from '$lib/server/lyeve';
import { watchAll, type BoardEvent, type UpstreamHandle } from '$lib/server/stream';
import type { RequestHandler } from './$types';

/** Long enough to be cheap, short enough that a dropped event is a blink. */
const RESYNC_MS = 30_000;

/**
 * The engine's content stream sends nothing between events, so an idle board
 * looks identical to a dead connection to anything counting bytes. This route
 * adds the keepalive the engine does not.
 */
const HEARTBEAT_MS = 15_000;

/**
 * The browser's half of the live board.
 *
 * The engine's stream is authenticated like every other route, so this is the
 * only place the two ends meet: one EventSource in, one upstream connection per
 * watched content type out, and the credential never leaves this process.
 *
 * The stream is best effort in both directions. The engine buffers sixteen
 * events per connection and silently drops anything that does not fit, and
 * there is no event id to replay from, so this route also emits a `resync` on a
 * timer and the page refetches the whole board when it arrives. Every event is
 * a hint that arrives early, never the only copy of a fact.
 */
export const GET: RequestHandler = async ({ request }) => {
	let upstream: UpstreamHandle | null = null;
	let heartbeat: ReturnType<typeof setInterval> | undefined;
	let resync: ReturnType<typeof setInterval> | undefined;
	let finished = false;

	/**
	 * Releases everything this request holds.
	 *
	 * Canceling the upstream body is what ends the engine's request, which is
	 * what unregisters its per-connection hooks. Dropping the reference without
	 * canceling leaks a subscription and a goroutine per browser that ever
	 * loaded the page. The handle is taken and cleared so that a second call,
	 * or a call that lands before the connection finished opening, still closes
	 * whatever exists by then.
	 */
	const teardown = async () => {
		finished = true;
		clearInterval(heartbeat);
		clearInterval(resync);
		const handle = upstream;
		upstream = null;
		await handle?.close();
	};

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const encoder = new TextEncoder();
			let open = true;

			const send = (chunk: string) => {
				if (!open) return;
				try {
					controller.enqueue(encoder.encode(chunk));
				} catch {
					// The browser went away between the check and the write.
					open = false;
				}
			};
			const frame = (event: string, data: unknown) =>
				send(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

			const stop = async (reason: string) => {
				frame('stalled', { reason });
				open = false;
				await teardown();
				try {
					controller.close();
				} catch {
					// Already closed by the cancel path.
				}
			};

			// Registered before the upstreams are opened. A browser that leaves
			// during the connect would otherwise leave engine connections open
			// with nobody holding a handle to cancel them.
			request.signal.addEventListener('abort', () => {
				open = false;
				void teardown();
			});
			if (request.signal.aborted) return teardown();

			// EventSource reconnects on its own, and this is how long it waits.
			send('retry: 3000\n\n');

			try {
				upstream = await watchAll(
					WATCHED,
					(event: BoardEvent) => {
						if (event.kind === 'unmapped') {
							// Something changed in a watched type that this board
							// does not model. Ask for the board rather than guess.
							frame('resync', { reason: `${event.schema} ${event.action}` });
							return;
						}
						if (event.action === 'delete') {
							// A removal cannot be folded into an overlay keyed by
							// id, so it is a refetch.
							frame('resync', { reason: `${event.kind} deleted` });
							return;
						}
						if (event.kind === 'incident') frame('incident', event.incident);
						else frame('update', event.update);
					},
					(reason) => void stop(reason)
				);
			} catch (err) {
				await stop(
					err instanceof Error ? err.message : 'the engine stream refused the connection'
				);
				return;
			}

			// The abort may have landed while the upstreams were connecting, in
			// which case teardown ran before there was anything to close.
			if (finished) return teardown();

			frame('ready', { watching: WATCHED });
			heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);
			resync = setInterval(() => frame('resync', { reason: 'periodic' }), RESYNC_MS);
		},

		async cancel() {
			await teardown();
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache, no-transform',
			connection: 'keep-alive',
			// Nginx buffers a proxied response by default, which holds every
			// event until its buffer fills. This is the header that turns it off.
			'x-accel-buffering': 'no'
		}
	});
};
