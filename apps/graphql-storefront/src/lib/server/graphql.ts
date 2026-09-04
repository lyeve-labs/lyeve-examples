import { LyeveError } from '$lib/lyeve';
import { lyeve } from './lyeve';

/**
 * The GraphQL transport for this app.
 *
 * There is a published client, `@lyeve-labs/client-graphql`, and this app does
 * not use it. Its `createGraphQLClient` wants an `HttpClient` from
 * `@lyeve-labs/client`, whose `createClient(fetchFn, defaultHeaders)` carries
 * no base URL and no way to obtain a token: the caller supplies the origin, logs
 * in, caches the token, backs off the login rate limit and re-injects the header
 * when it rotates. That is the whole of the wrapper, so the wrapper is what gets
 * written either way. The one thing the package would add over this file is
 * `subscribe`, which needs a browser `WebSocket` and a real origin, and the
 * browser is exactly where this app must never talk to the engine.
 */

/**
 * A GraphQL document with its variable and result shapes attached.
 *
 * The two type parameters only exist at compile time. They are what stops a
 * document being run with another document's variables. `text` is kept as
 * written so the /graphql page can show the reader the same string the page
 * sent, rather than a reconstruction of it.
 */
export interface GraphQLDocument<TVars, TData> {
	readonly name: string;
	readonly text: string;
	readonly __vars?: TVars;
	readonly __data?: TData;
}

export function gql<TVars = Record<string, never>, TData = unknown>(
	name: string,
	text: string
): GraphQLDocument<TVars, TData> {
	return { name, text: text.trim() };
}

/** One request and its answer, kept whole for the /graphql page. */
export interface Exchange<TData> {
	/** Only what the page displays: the name and the text as written. */
	document: { name: string; text: string };
	variables: Record<string, unknown>;
	/** The engine's response body verbatim, including a null `data` on refusal. */
	response: GraphQLResponse<TData>;
	/** HTTP status. 200 for a resolver error, 400 for a rejected document. */
	status: number;
	elapsedMs: number;
}

type Variables = Record<string, unknown>;

export interface GraphQLResponse<TData> {
	data: TData | null;
	errors?: GraphQLResponseError[];
}

export interface GraphQLResponseError {
	message: string;
	locations?: { line: number; column: number }[] | null;
	path?: (string | number)[];
}

/** A query the engine refused, or one whose resolvers reported an error. */
export class GraphQLQueryError extends Error {
	readonly status: number;
	readonly messages: string[];

	constructor(name: string, status: number, messages: string[]) {
		super(`${name}: ${messages.join('; ') || 'query failed'}`);
		this.name = 'GraphQLQueryError';
		this.status = status;
		this.messages = messages;
	}
}

/**
 * Sends one document and returns the response body untouched.
 *
 * A GraphQL server answers a resolver error with HTTP 200 and an `errors` array,
 * and this endpoint answers a document it refuses outright (depth, cost, field
 * count) with HTTP 400 and the same array. The shared client throws on the 400,
 * and its error parser reads a top-level `errors` array as a list of field
 * errors, so the messages come back out of `fieldErrors`. Both cases end up in
 * the same shape here, which is the point of doing it in one place.
 */
export async function exchange<TVars extends Variables, TData>(
	document: GraphQLDocument<TVars, TData>,
	variables: TVars = {} as TVars
): Promise<Exchange<TData>> {
	const startedAt = performance.now();
	const body = JSON.stringify({
		query: document.text,
		variables,
		operationName: document.name
	});

	try {
		// The engine rejects a body that is not application/json with a 415, and
		// the shared client sets that header whenever a request carries one.
		const response = await lyeve.request<GraphQLResponse<TData>>(
			'api',
			'/api/v1/graphql',
			{ method: 'POST', body }
		);
		return {
			document: { name: document.name, text: document.text },
			variables,
			response,
			status: 200,
			elapsedMs: performance.now() - startedAt
		};
	} catch (err) {
		if (err instanceof LyeveError) {
			return {
				document: { name: document.name, text: document.text },
				variables,
				response: { data: null, errors: messagesOf(err).map((message) => ({ message })) },
				status: err.status,
				elapsedMs: performance.now() - startedAt
			};
		}
		throw err;
	}
}

/**
 * Sends one document and returns its data, throwing on anything else.
 *
 * `errors` and a usable `data` can arrive together when one field of several
 * failed. This treats that as a failure, because every page here selects only
 * fields it needs.
 */
export async function run<TVars extends Variables, TData>(
	document: GraphQLDocument<TVars, TData>,
	variables: TVars = {} as TVars
): Promise<TData> {
	const result = await exchange(document, variables);
	const errors = result.response.errors ?? [];
	if (errors.length > 0 || result.response.data == null) {
		throw new GraphQLQueryError(
			document.name,
			result.status,
			errors.map((e) => e.message)
		);
	}
	return result.response.data;
}

function messagesOf(err: LyeveError): string[] {
	const fromFields = err.fieldErrors.map((e) => e.message).filter(Boolean);
	return fromFields.length > 0 ? fromFields : [err.message];
}
