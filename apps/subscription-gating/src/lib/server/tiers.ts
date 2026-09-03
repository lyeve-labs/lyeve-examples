/**
 * The two vocabularies the example gates on, kept in one place so a page and
 * the webhook cannot disagree about what "member" spells.
 */
export type Tier = 'free' | 'member';
export type MemberStatus = 'active' | 'past_due' | 'canceled';

export function isTier(value: unknown): value is Tier {
	return value === 'free' || value === 'member';
}

export function isMemberStatus(value: unknown): value is MemberStatus {
	return value === 'active' || value === 'past_due' || value === 'canceled';
}

export interface Reader {
	id: string;
	name: string;
	email: string;
	tier: Tier;
	status: MemberStatus;
}

/**
 * Decides access.
 *
 * Both halves matter. A subscriber whose card failed keeps `tier: member`
 * until the provider says otherwise, so tier alone would keep serving paid
 * articles through a failed billing cycle.
 */
export function canRead(articleTier: Tier, reader: Reader | null): boolean {
	if (articleTier === 'free') return true;
	return reader?.tier === 'member' && reader.status === 'active';
}

/** Why a reader was refused, so the page can say something useful. */
export type Refusal = 'anonymous' | 'not_subscribed' | 'payment_failed' | 'canceled';

export function refusalFor(reader: Reader | null): Refusal {
	if (!reader) return 'anonymous';
	if (reader.status === 'past_due') return 'payment_failed';
	if (reader.status === 'canceled') return 'canceled';
	return 'not_subscribed';
}
