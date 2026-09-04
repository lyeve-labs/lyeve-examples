import { RECEIVER_SECRET } from './lyeve';

/**
 * How long a replaced signing key keeps verifying.
 *
 * Rotation is not atomic and cannot be: the engine has deliveries in flight,
 * and its retry worker will re-fire a delivery minutes after the rotation. A
 * receiver that accepts only the newest key rejects every one of them. Keeping
 * the previous key for an overlap window is what makes a rotation a
 * non-event, and it is the part a rotate button usually leaves out.
 */
const OVERLAP_MS = 10 * 60 * 1000;

interface Held {
	secret: string;
	/** Null for the active key. A deadline for the one it replaced. */
	retiresAt: number | null;
	addedAt: number;
}

let ring: Held[] = [{ secret: RECEIVER_SECRET, retiresAt: null, addedAt: Date.now() }];

function live(now = Date.now()): Held[] {
	ring = ring.filter((held) => held.retiresAt === null || held.retiresAt > now);
	return ring;
}

/** The key a new registration is created with. */
export function activeSecret(): string {
	return live()[0]?.secret ?? RECEIVER_SECRET;
}

/** Every key a delivery may still be signed with, newest first. */
export function acceptedSecrets(): string[] {
	const held = live();
	return held.length > 0 ? held.map((h) => h.secret) : [RECEIVER_SECRET];
}

/**
 * Accepts a new key and puts the old one on notice.
 *
 * Called before the engine is told to rotate, never after. If the engine's
 * rotate call fails the receiver is left accepting one key too many, which
 * costs nothing. The other order leaves it accepting one too few, which drops
 * live traffic until the process restarts.
 */
export function rotateTo(secret: string): void {
	const now = Date.now();
	const previous = live(now).map((held) => ({
		...held,
		retiresAt: held.retiresAt ?? now + OVERLAP_MS
	}));
	ring = [{ secret, retiresAt: null, addedAt: now }, ...previous.filter((h) => h.secret !== secret)];
}

export interface RingEntry {
	fingerprintOf: string;
	active: boolean;
	retiresInSeconds: number | null;
}

export function ringState(): RingEntry[] {
	const now = Date.now();
	return live(now).map((held) => ({
		fingerprintOf: held.secret,
		active: held.retiresAt === null,
		retiresInSeconds: held.retiresAt === null ? null : Math.round((held.retiresAt - now) / 1000)
	}));
}

/**
 * True when the ring is still the value from the environment.
 *
 * The ring lives in this process and nowhere else, so a restart returns to the
 * environment's key. The dashboard says so, because after a rotation the engine
 * holds a key that no restart of this app can recover.
 */
export function isEnvironmentKey(): boolean {
	return activeSecret() === RECEIVER_SECRET;
}
