import { lyeve } from './lyeve';

/**
 * A review assignee is an engine user, not a content record.
 *
 * The newsroom's bylines live in `news_reporters`, which is content this app
 * declared. An assignment's `assignee_id` is a `sys_users` row, so the two sets
 * are unrelated and the plugin validates neither: it stores whatever uuid it is
 * handed. This resolves real users so the desk cannot invent an assignee.
 */
export interface EngineUser {
	id: string;
	email: string;
	roles: string[];
}

/** Bare array, no envelope. */
export async function listUsers(): Promise<EngineUser[]> {
	const rows = await lyeve.request<EngineUser[]>('admin', '/api/admin/users?limit=100');
	return Array.isArray(rows) ? rows : [];
}

/** The account this app authenticates as, which is the default assignee. */
export async function currentUser(): Promise<EngineUser> {
	return lyeve.request<EngineUser>('admin', '/api/admin/auth/me');
}

/** Labels an actor id from the stage log or the audit trail. */
export function userLabel(users: EngineUser[], id: string): string {
	return users.find((u) => u.id === id)?.email ?? shortId(id);
}

function shortId(id: string): string {
	return id && id !== '00000000-0000-0000-0000-000000000000' ? id.slice(0, 8) : 'system';
}
