/**
 * The plumbing every step in this example shares.
 *
 * Nothing here is specific to a framework. It is the small amount of glue the
 * published SDK deliberately leaves to the caller: where the engine lives, who
 * is calling, and how a bare path becomes a URL.
 */
import { ApiError, createClient, type HttpClient, type SchemaField } from '@lyeve-labs/client';
import { isMFAChallenge, login } from '@lyeve-labs/client-rest';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Content type names carry the example's own prefix.
 *
 * Every example in this repo shares one engine, and a content type name is
 * global. So is a content slug: the engine indexes (slug, tenant_id) as unique
 * across every type at once, so two examples that both seed "welcome" collide
 * with a 409.
 */
export const AUTHORS = 'headless_authors';
export const ARTICLES = 'headless_articles';
export const SLUG_PREFIX = 'headless-';

export interface Endpoints {
	/** Public v1 router. Content reads and POST /api/v1/auth/token. */
	apiUrl: string;
	/** Admin router. Schemas, content writes, search, media. */
	adminUrl: string;
}

export interface Credentials {
	email: string;
	password: string;
}

loadEnv();

/**
 * Reads .env without a dependency. Node applies the first definition of a key
 * and leaves anything already in the environment alone, so the app's own file
 * wins over the repo-wide one and a shell variable wins over both.
 */
function loadEnv(): void {
	for (const candidate of ['../.env', '../../../.env']) {
		try {
			process.loadEnvFile(fileURLToPath(new URL(candidate, import.meta.url)));
		} catch {
			// Both files are optional. The repo-wide one appears when the stack boots.
		}
	}
}

export function endpoints(): Endpoints {
	return { apiUrl: required('LYEVE_API_URL'), adminUrl: required('LYEVE_ADMIN_URL') };
}

export function credentials(): Credentials {
	return { email: required('LYEVE_EMAIL'), password: required('LYEVE_PASSWORD') };
}

function required(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`${key} is not set. Copy .env.example to .env, then boot the stack from the repo root.`);
	}
	return value;
}

/**
 * Turns the SDK's bare paths into URLs, and picks which engine port each one
 * belongs to.
 *
 * This is the single thing that stops people using the SDK. `createClient`
 * takes a fetch and a header bag, and no base URL at all. Every function in
 * @lyeve-labs/client-rest then calls something like
 * `/api/v1/content/headless_articles`, which is a path and not a URL: in a
 * browser the page's origin completes it, and in Node nothing does. The call
 * fails on a URL parse, one layer below anything the SDK can report.
 *
 * The prefix decides the host because the engine is two servers. It builds one
 * router for /api/admin and another for /api/v1 and binds them to separate
 * listeners, so a client that reads content and writes it, which is every real
 * client, is talking to two ports. Routing on the path prefix keeps that fact
 * in one function instead of at every call site.
 */
export function routedFetch(hosts: Endpoints): typeof fetch {
	return (input, init) => {
		if (typeof input === 'string' || input instanceof URL) {
			return fetch(absolute(String(input), hosts), init);
		}
		// The SDK only ever passes a string, but fetch's own contract allows a
		// Request, and silently dropping one here would be a trap for anyone
		// reusing this wrapper.
		return fetch(new Request(absolute(input.url, hosts), input), init);
	};
}

function absolute(target: string, hosts: Endpoints): string {
	if (!target.startsWith('/')) return target;
	return (target.startsWith('/api/v1') ? hosts.apiUrl : hosts.adminUrl) + target;
}

/** A client with no credential. Good for /api/admin/setup and for logging in. */
export function publicClient(): HttpClient {
	return createClient(routedFetch(endpoints()));
}

/** A client that presents a bearer token on every call. */
export function signedInClient(token: string): HttpClient {
	return createClient(routedFetch(endpoints()), { Authorization: `Bearer ${token}` });
}

/**
 * Where the token is parked between scripts. The file holds a credential with
 * the rights of the account that issued it, so it is written owner-only and
 * gitignored.
 */
const TOKEN_CACHE = fileURLToPath(new URL('../.lyeve-token.json', import.meta.url));

/**
 * Logs in, or reuses a token from the last run.
 *
 * Logging in is not cheap. The engine seeds a rate-limit rule for
 * POST /api/admin/auth/login with a burst of 5 and a refill of one request
 * roughly every three minutes, per address, because that route is where
 * credential stuffing goes. Six scripts that each logged in would exhaust it on
 * the first run of the tour and then refuse to work for a quarter of an hour.
 *
 * So the token is cached on disk between runs. A long-lived process would hold
 * it in memory instead, and would log in again on expiry: the admin router
 * issues no refresh token to this flow.
 */
export async function signIn(): Promise<string> {
	const cached = cachedToken();
	if (cached) return cached;

	const { email, password } = credentials();
	const result = await login(email, password, publicClient());
	if (isMFAChallenge(result)) {
		throw new Error('this account has MFA enrolled; the examples expect an account that does not');
	}
	cacheToken(result.token);
	return result.token;
}

function cachedToken(): string | null {
	try {
		const { token } = JSON.parse(readFileSync(TOKEN_CACHE, 'utf8')) as { token: string };
		// Treat a token inside its last minute as spent, rather than discovering
		// the expiry halfway through a script.
		const expiry = (readClaims(token).exp ?? 0) * 1000;
		return expiry - Date.now() > 60_000 ? token : null;
	} catch {
		// No cache, an unreadable one, or a token that is not a JWT. Log in.
		return null;
	}
}

export function cacheToken(token: string): void {
	try {
		writeFileSync(TOKEN_CACHE, JSON.stringify({ token }), { mode: 0o600 });
	} catch {
		// A read-only checkout costs a login per script and nothing else.
	}
}

export interface TokenClaims {
	sub?: string;
	email?: string;
	roles?: string[];
	tenant_id?: string;
	iat?: number;
	exp?: number;
}

/**
 * Reads a token's claims. It does not verify them, and no client should: the
 * engine verifies its own tokens, and a separate service that has to trust one
 * fetches the public key from /.well-known/jwks.json. This is here to show what
 * the token says about its own lifetime.
 */
export function readClaims(token: string): TokenClaims {
	const payload = token.split('.')[1];
	if (!payload) throw new Error('token is not a JWT');
	return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TokenClaims;
}

/**
 * Declares a belongs_to relation, always optional.
 *
 * A required relation is the one schema mistake that breaks everything
 * downstream. The generator emits two columns for it, a dead `<name>` and the
 * real `<name>_id`, both NOT NULL, and the write path only ever fills the
 * second. Every insert into the type then fails with a 422 that names no field.
 * Declare the relation optional and enforce the requirement in the application.
 */
export function belongsTo(name: string, target: string): SchemaField {
	return {
		name,
		field_type: 'relation',
		relation_to: target,
		relation_type: 'belongs_to',
		required: false,
		unique: false,
		indexed: true
	};
}

/**
 * Reads the id a relation stores.
 *
 * Relations are asymmetric. You write `author` and you read `author_id`. The
 * response also carries an `author` key that is null on every unpopulated read,
 * which is the dead column above showing through.
 */
export function relationId(data: Record<string, unknown>, field: string): string | null {
	const id = data[`${field}_id`];
	if (typeof id === 'string' && id) return id;
	const inflated = data[field];
	if (inflated && typeof inflated === 'object' && 'id' in inflated) {
		return String((inflated as { id: unknown }).id);
	}
	return null;
}

/** Reads a populated relation, or null when the request did not populate it. */
export function related<T = Record<string, unknown>>(
	data: Record<string, unknown>,
	field: string
): T | null {
	const value = data[field];
	return value && typeof value === 'object' ? (value as T) : null;
}

/**
 * Waits until a newly applied content type is readable.
 *
 * The apply is accepted before the type is visible, and the gap is roughly a
 * quarter of a second. It is enough that a script which defines a type and
 * writes to it immediately fails on a cold database and passes on a warm one.
 */
export async function waitForSchema(client: HttpClient, name: string, timeoutMs = 10_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const schemas = await client.get<{ name: string }[]>('/api/v1/schemas');
		if (Array.isArray(schemas) && schemas.some((schema) => schema.name === name)) return;
		await new Promise((resolve) => setTimeout(resolve, 150));
	}
	throw new Error(`content type "${name}" was applied but never became readable`);
}

export function heading(text: string): void {
	console.log(`\n${text}`);
	console.log('='.repeat(text.length));
}

export function section(text: string): void {
	console.log(`\n${text}`);
}

export function note(text: string): void {
	console.log(`  ${text}`);
}

const LABEL_WIDTH = 26;

export function row(label: string, value: unknown): void {
	const gutter = label.length < LABEL_WIDTH ? label.padEnd(LABEL_WIDTH) : `${label}  `;
	console.log(`  ${gutter}${render(value)}`);
}

function render(value: unknown): string {
	if (typeof value === 'string') return value;
	if (value === null || value === undefined) return String(value);
	return JSON.stringify(value);
}

/** Runs a step and reports a failure in terms of what the engine actually said. */
export async function run(step: () => Promise<void>): Promise<void> {
	try {
		await step();
	} catch (err) {
		console.error(`\n${explain(err)}`);
		process.exitCode = 1;
	}
}

function explain(err: unknown): string {
	if (err instanceof ApiError) {
		const hint = HINTS[err.status];
		return `HTTP ${err.status}  ${err.message}${hint ? `\n${hint}` : ''}`;
	}
	if (err instanceof TypeError) {
		const { adminUrl, apiUrl } = endpoints();
		return `could not reach the engine on ${adminUrl} or ${apiUrl}. Boot the stack first.`;
	}
	return err instanceof Error ? err.message : String(err);
}

const HINTS: Record<number, string> = {
	401: 'The token was missing, expired or rejected. Nothing on the engine reads without one.',
	429: 'The login route is rate limited per address, and a small burst empties it. Log in once and reuse the token.',
	403: 'The account is authenticated but its role is not allowed to do this. Publishing content needs admin.',
	404: 'No such route or no such record. A misspelled content type name reads as a missing route.',
	409: 'A slug is unique per tenant across every content type, not per type.',
	422: 'A validation failure answers {"errors":[...]} with no top-level error key, so the message above is the raw body.',
	503: 'The engine reports a store failure as 503 even when the request caused it.'
};
