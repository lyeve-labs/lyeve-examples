/**
 * The small amount of plumbing the two client programs share.
 *
 * Nothing here imports the shared example client, and that is the point. This
 * is the one program in the repository that is not a server holding an
 * operator session: it is a phone, it holds a scoped API key, and it talks to
 * the engine directly. So it uses fetch and nothing else.
 */

export interface Endpoints {
	/** Public router. Content, schemas and the quota status route. */
	apiUrl: string;
	/** Admin router. Reachable with a key, and refused without the scope for it. */
	adminUrl: string;
}

export function endpoints(): Endpoints {
	return {
		apiUrl: process.env.LYEVE_API_URL ?? 'http://localhost:4402',
		adminUrl: process.env.LYEVE_ADMIN_URL ?? 'http://localhost:4401'
	};
}

export function apiKey(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(
			`${name} is not set. Run \`pnpm run setup\` from apps/mobile-api-backend, which mints the keys and writes client/.env, or mint one in the console and put it there by hand.`
		);
	}
	return value;
}

export interface CallResult {
	method: string;
	url: string;
	router: 'public' | 'admin';
	status: number;
	contentType: string;
	headers: Headers;
	body: unknown;
	/** Set when the engine refused on scopes rather than on anything else. */
	scopeRefused: boolean;
	/**
	 * Whether a successful request on this route lands in the key's audit
	 * trail. False for the quota status route: the plugin declares it in the
	 * authenticated group, which carries no audit middleware.
	 */
	auditable: boolean;
}

const calls: CallResult[] = [];

export function callLog(): CallResult[] {
	return calls;
}

/** One request as the client, recorded so the counts at the end are not guesses. */
export async function call(
	key: string,
	opts: {
		method?: string;
		router?: 'public' | 'admin';
		path: string;
		body?: unknown;
		auditable?: boolean;
	}
): Promise<CallResult> {
	const method = opts.method ?? 'GET';
	const router = opts.router ?? 'public';
	const root = router === 'public' ? endpoints().apiUrl : endpoints().adminUrl;
	const url = `${root}${opts.path}`;

	const headers: Record<string, string> = { 'X-API-Key': key };
	// The engine refuses a mutation whose content type is not JSON before it
	// looks at anything else, so a write attempt has to be well formed for the
	// refusal to be about scopes.
	if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

	const res = await fetch(url, {
		method,
		headers,
		body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
	});

	const contentType = res.headers.get('content-type') ?? '';
	const text = await res.text();
	let body: unknown = text;
	if (text) {
		try {
			body = JSON.parse(text);
		} catch {
			body = text;
		}
	}

	const result: CallResult = {
		method,
		url,
		router,
		status: res.status,
		contentType,
		headers: res.headers,
		body,
		scopeRefused: res.status === 403 && text.includes('insufficient scope'),
		auditable: opts.auditable ?? true
	};
	calls.push(result);
	return result;
}

export function quotaHeaders(headers: Headers): string[] {
	const names = [
		'x-quota-requests-used',
		'x-quota-requests-limit',
		'x-quota-requests-pct',
		'x-quota-warning-80',
		'x-quota-warning-90',
		'x-quota-exceeded',
		'x-quota-blocked',
		'x-ratelimit-exceeded'
	];
	return names
		.filter((n) => headers.get(n) !== null)
		.map((n) => `${canonical(n)}: ${headers.get(n)}`);
}

function canonical(header: string): string {
	return header
		.split('-')
		.map((part) => (part === 'x' ? 'X' : part.charAt(0).toUpperCase() + part.slice(1)))
		.join('-');
}

export function heading(text: string): void {
	console.log(`\n${text}`);
	console.log('='.repeat(text.length));
}

export function step(n: number, text: string): void {
	console.log(`\n${n}  ${text}`);
}

export function note(text: string): void {
	console.log(`   ${text}`);
}

const LABEL_WIDTH = 22;

export function row(label: string, value: unknown): void {
	const gutter = label.length < LABEL_WIDTH ? label.padEnd(LABEL_WIDTH) : `${label}  `;
	console.log(`   ${gutter}${typeof value === 'string' ? value : JSON.stringify(value)}`);
}

/** Reports a failure in terms of what the engine said, not what fetch threw. */
export async function run(body: () => Promise<void>): Promise<void> {
	try {
		await body();
	} catch (err) {
		if (err instanceof TypeError) {
			const { apiUrl, adminUrl } = endpoints();
			console.error(`\ncould not reach the engine on ${apiUrl} or ${adminUrl}. Boot the stack first.`);
		} else {
			console.error(`\n${err instanceof Error ? err.message : String(err)}`);
		}
		process.exitCode = 1;
	}
}
