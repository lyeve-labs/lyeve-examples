/**
 * The engine answers with three different error envelopes depending on which
 * layer rejected the request, and a 422 carries no top-level `error` key at
 * all. Parsing defensively here keeps every caller from re-discovering that.
 */
export class LyeveError extends Error {
	readonly status: number;
	readonly code: string;
	readonly requestId: string;
	readonly fieldErrors: FieldError[];

	constructor(status: number, body: unknown, fallback: string) {
		const parsed = parseBody(body, fallback);
		super(parsed.message);
		this.name = 'LyeveError';
		this.status = status;
		this.code = parsed.code;
		this.requestId = parsed.requestId;
		this.fieldErrors = parsed.fieldErrors;
	}

	/** A 503 from the engine is frequently a caller-caused store failure, not an outage. */
	get isRetryable(): boolean {
		return this.status === 429 || this.status === 502 || this.status === 504;
	}
}

export interface FieldError {
	/** Absent on some plugin envelopes, which report a message with no field. */
	field?: string;
	message: string;
	code?: string;
	rule?: string;
}

interface Parsed {
	message: string;
	code: string;
	requestId: string;
	fieldErrors: FieldError[];
}

function parseBody(body: unknown, fallback: string): Parsed {
	const empty: Parsed = { message: fallback, code: '', requestId: '', fieldErrors: [] };
	if (!body || typeof body !== 'object') return empty;
	const b = body as Record<string, unknown>;

	// Two shapes carry field errors. The 422 validation envelope uses `errors`.
	// A strict-decode 400 on some plugin routes uses `fields` and keeps its own
	// `error` string. Parsing only the first threw the field detail away and left
	// the caller with a bare "invalid request".
	const list = Array.isArray(b.errors) ? b.errors : Array.isArray(b.fields) ? b.fields : null;
	if (list) {
		const fieldErrors = list as FieldError[];
		const summary = fieldErrors
			.map((e) => (e.field ? `${e.field}: ${e.message}` : e.message))
			.filter(Boolean)
			.join('; ');
		const top = typeof b.error === 'string' ? b.error : '';
		return {
			message: [top, summary].filter(Boolean).join(' - ') || fallback,
			code: typeof b.code === 'string' ? b.code : 'validation_failed',
			requestId: typeof b.request_id === 'string' ? b.request_id : '',
			fieldErrors
		};
	}

	return {
		message: typeof b.error === 'string' ? b.error : fallback,
		code: typeof b.code === 'string' ? b.code : '',
		requestId: typeof b.request_id === 'string' ? b.request_id : '',
		fieldErrors: []
	};
}
