import { createClient, type HttpClient } from '@lyeve-labs/client';
import { LyeveError } from './errors.ts';

export interface LyeveConfig {
	/** Public v1 router, serving content reads. Defaults to LYEVE_API_URL. */
	apiUrl: string;
	/** Admin router, serving schemas, writes, search and media. Defaults to LYEVE_ADMIN_URL. */
	adminUrl: string;
	email: string;
	password: string;
}

/**
 * A server-side client for the engine, built on the published SDK.
 *
 * The HTTP layer is `@lyeve-labs/client`, so an example uses the product's own
 * package rather than a private reimplementation, and `.api` and `.admin` are
 * ordinary `HttpClient`s: any `@lyeve-labs/client-rest` function can be called
 * with them directly.
 *
 * Two things the SDK does not do are done here.
 *
 * `createClient(fetchFn, defaultHeaders)` takes no base URL and captures its
 * headers once at construction, so it cannot carry a token that has to be
 * renewed. Both are solved by wrapping `fetch` instead of passing headers: the
 * wrapper resolves the base URL and asks for a live token on every call.
 *
 * The engine also has no anonymous read. Apart from the token endpoint and the
 * health probes, every content route requires authentication, so a browser
 * cannot call it. This holds the credential, and an example exposes only its
 * own routes. Never construct it in code that ships to the client: in SvelteKit
 * that means `+page.server.ts`, `+server.ts` and `hooks.server.ts` only.
 */
export class LyeveClient {
	readonly api: HttpClient;
	readonly admin: HttpClient;

	private readonly config: LyeveConfig;
	private token: string | null = null;
	private tokenExpiresAt = 0;
	private inFlightLogin: Promise<string> | null = null;

	constructor(config: LyeveConfig) {
		this.config = config;
		this.api = createClient(this.authedFetch(config.apiUrl));
		this.admin = createClient(this.authedFetch(config.adminUrl));
	}

	/**
	 * A fetch that resolves a relative SDK path against one router and attaches
	 * a live token.
	 *
	 * Every client-rest function issues a bare absolute path such as
	 * `/api/v1/content/posts`, which is why the base URL has to be applied here.
	 */
	private authedFetch(base: string): typeof fetch {
		return async (input, init) => {
			const path = typeof input === 'string' ? input : input.toString();
			const url = path.startsWith('http') ? path : `${base}${path}`;
			const token = await this.authenticate();

			const send = (bearer: string) =>
				fetch(url, {
					...init,
					headers: { ...(init?.headers as Record<string, string>), Authorization: `Bearer ${bearer}` }
				});

			const res = await send(token);
			// A token can expire between the clock check and the call. One forced
			// re-login separates a stale token from a real authorization failure,
			// which would otherwise surface as an unexplained 401.
			if (res.status !== 401) return res;
			this.token = null;
			return send(await this.authenticate());
		};
	}

	/**
	 * The admin router issues no refresh token, so an expired session is
	 * replaced by logging in again.
	 *
	 * Re-authentication is coalesced: a burst of concurrent requests on a cold
	 * cache produces one login rather than twenty. That matters more than it
	 * looks, because the login route allows five attempts per fifteen minutes
	 * per address, enforced by a rate-limit rule the documented
	 * PUBLIC_RATE_LIMITS setting does not reach. A 429 is a wait rather than a
	 * failure, so it is retried with backoff.
	 */
	private async authenticate(): Promise<string> {
		if (this.token && Date.now() < this.tokenExpiresAt) return this.token;
		if (this.inFlightLogin) return this.inFlightLogin;

		this.inFlightLogin = (async () => {
			let lastError: LyeveError | null = null;

			for (let attempt = 0; attempt < 6; attempt++) {
				const res = await fetch(`${this.config.adminUrl}/api/admin/auth/login`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: this.config.email, password: this.config.password })
				});
				const body = await readBody(res);

				if (res.ok) {
					const token = (body as { token?: string }).token;
					if (!token) throw new LyeveError(res.status, body, 'login returned no token');
					this.token = token;
					// Renew a minute early rather than discovering expiry mid-render.
					this.tokenExpiresAt = Date.now() + (expirySeconds(body) - 60) * 1000;
					return token;
				}

				lastError = new LyeveError(res.status, body, 'login failed');
				if (res.status !== 429) throw lastError;

				const retryAfter = Number(res.headers.get('retry-after'));
				const waitMs =
					Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
				await new Promise((r) => setTimeout(r, waitMs));
			}

			throw lastError ?? new LyeveError(429, null, 'login failed after retrying');
		})();

		try {
			return await this.inFlightLogin;
		} finally {
			this.inFlightLogin = null;
		}
	}

	/**
	 * Calls a route the SDK does not cover, and raises a LyeveError on failure.
	 *
	 * The SDK's own ApiError carries a status and a message. This keeps one error
	 * type across both, and parses the several error envelopes the engine uses.
	 */
	async request<T>(base: 'api' | 'admin', path: string, init: RequestInit = {}): Promise<T> {
		const root = base === 'api' ? this.config.apiUrl : this.config.adminUrl;
		const send = await this.authedFetch(root);
		const res = await send(path, {
			...init,
			headers: {
				...(init.body && !(init.body instanceof FormData)
					? { 'Content-Type': 'application/json' }
					: {}),
				...(init.headers as Record<string, string>)
			}
		});

		if (res.status === 204) return undefined as T;
		const body = await readBody(res);
		if (!res.ok) throw new LyeveError(res.status, body, `${init.method ?? 'GET'} ${path} failed`);
		return body as T;
	}

	/** Streams a response through untouched, for media bytes. */
	async raw(base: 'api' | 'admin', path: string): Promise<Response> {
		const root = base === 'api' ? this.config.apiUrl : this.config.adminUrl;
		return this.authedFetch(root)(path);
	}
}

async function readBody(res: Response): Promise<unknown> {
	const text = await res.text();
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		return { error: text.slice(0, 200) };
	}
}

function expirySeconds(body: unknown): number {
	const v = (body as { expires_in?: unknown }).expires_in;
	return typeof v === 'number' && v > 0 ? v : 900;
}
