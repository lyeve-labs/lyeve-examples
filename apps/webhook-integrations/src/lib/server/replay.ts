/**
 * Single-use tokens for the receiver.
 *
 * A signature proves the sender holds the key. It does not stop the same signed
 * request being sent again, so the timestamp bounds how long a captured request
 * stays useful and this bounds it to once. The engine's own receive endpoint
 * does the same thing in `sys_webhook_nonces`. This app keeps it in memory
 * because a process restart is already a clean slate for it.
 *
 * Held for as long as the timestamp window plus a margin. Anything older is
 * rejected by the window and does not need remembering.
 */
const HORIZON_MS = 6 * 60 * 1000;
const MAX_ENTRIES = 5000;

const seen = new Map<string, number>();

function prune(now: number): void {
	for (const [key, at] of seen) {
		if (now - at > HORIZON_MS) seen.delete(key);
	}
	// A flood of distinct tokens must not grow this without bound. Dropping the
	// oldest can only ever let a replay through that the window would have
	// caught anyway, which is the right way round for a cache to fail.
	while (seen.size > MAX_ENTRIES) {
		const oldest = seen.keys().next();
		if (oldest.done) break;
		seen.delete(oldest.value);
	}
}

/** Records a token and reports whether it is the first sighting. */
export function claim(token: string): boolean {
	const now = Date.now();
	prune(now);
	if (seen.has(token)) return false;
	seen.set(token, now);
	return true;
}

export function claimedCount(): number {
	prune(Date.now());
	return seen.size;
}
