/**
 * Vocabulary shared by the server modules and the pages.
 *
 * Nothing here talks to the engine, which is why it sits outside
 * `lib/server/`: the pages need these labels and the type guards, and a
 * component that imported `lib/server` would fail the build.
 */

export const REQUEST_TYPES = ['access', 'erasure', 'portability', 'rectification'] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_STATES = [
	'received',
	'verifying',
	'in_progress',
	'completed',
	'refused'
] as const;
export type RequestState = (typeof REQUEST_STATES)[number];

export const ACTION_KINDS = ['export', 'erase', 'refusal', 'note'] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

export function isRequestType(v: string): v is RequestType {
	return (REQUEST_TYPES as readonly string[]).includes(v);
}

export function isRequestState(v: string): v is RequestState {
	return (REQUEST_STATES as readonly string[]).includes(v);
}

export const TYPE_LABELS: Record<RequestType, string> = {
	access: 'Access (Art. 15)',
	erasure: 'Erasure (Art. 17)',
	portability: 'Portability (Art. 20)',
	rectification: 'Rectification (Art. 16)'
};

export const STATE_LABELS: Record<RequestState, string> = {
	received: 'Received',
	verifying: 'Verifying identity',
	in_progress: 'In progress',
	completed: 'Completed',
	refused: 'Refused'
};

/**
 * Art. 12(3) gives the controller one month from receipt. The deadline is
 * computed once when the request is filed and stored, rather than derived on
 * every read, so a request keeps the deadline it was given even if this rule
 * later changes.
 */
export const RESPONSE_DAYS = 30;

export function daysBetween(from: string, to: string): number {
	const ms = Date.parse(to) - Date.parse(from);
	return Math.round(ms / 86_400_000);
}

export function isOpen(state: RequestState): boolean {
	return state !== 'completed' && state !== 'refused';
}
