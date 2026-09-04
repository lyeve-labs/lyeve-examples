/**
 * Every engine telemetry source this console reads, each wrapped so the caller
 * gets the figures and the reason the figures are what they are.
 *
 * The response shapes below were captured from a live engine on 2026-09-04.
 * Nothing is declared that was not observed coming back, because a field the
 * engine never sends renders as a confident zero.
 *
 * All of these live on the admin router. The public router serves only
 * /api/v1/analytics, /api/v1/quotas/status, /api/v1/health and /api/v1/ready,
 * plus the unauthenticated probes.
 */
import { LyeveError } from '$lib/lyeve';
import { lyeve, PUBLIC_PROBE_BASE } from './lyeve';
import type { Provenance, SourceState } from '$lib/provenance';

/** A panel's figures plus the reason they read the way they do. */
export interface Sourced<T> {
	value: T;
	provenance: Provenance;
}

/**
 * Calls the admin router and turns a failure into a state rather than an
 * exception, so one dead plugin does not blank the whole dashboard.
 *
 * A 402 is singled out because the analytics and apianalytics plugins keep
 * their routes mounted while unlicensed and answer 402 rather than 404. That is
 * the one failure that a reader must not mistake for "no traffic yet".
 */
async function adminGet<T>(path: string): Promise<{ body: T | null; failure: SourceState | null; message: string }> {
	try {
		return { body: await lyeve.request<T>('admin', path), failure: null, message: '' };
	} catch (err) {
		if (err instanceof LyeveError) {
			if (err.status === 402) {
				return { body: null, failure: 'unlicensed', message: 'the license does not grant this module' };
			}
			return { body: null, failure: 'error', message: `${err.status}: ${err.message}` };
		}
		return { body: null, failure: 'error', message: 'the engine could not be reached' };
	}
}

// API analytics
//
// The only source in this list the engine fills entirely on its own. The
// apianalytics plugin installs HTTP middleware, so every request through
// either router is recorded, buffered in memory and flushed to
// api_metrics_hourly on an interval. Nothing has to opt in and no client has to
// report. An empty response here really does mean no traffic.

export interface RequestSummary {
	from: string;
	to: string;
	total_requests: number;
	total_2xx: number;
	total_4xx: number;
	total_5xx: number;
	error_rate: number;
	avg_latency_p50_ms: number;
	avg_latency_p95_ms: number;
	avg_latency_p99_ms: number;
	max_latency_p99_ms: number;
	avg_request_size_bytes: number;
	max_request_size_bytes: number;
	unique_endpoints: number;
	unique_tenants: number;
	unique_methods: number;
	unique_user_agents: number;
}

export interface BreakdownRow {
	key: string;
	request_count: number;
	error_rate: number;
	avg_latency_p95_ms: number;
	max_latency_p99_ms: number;
	request_size_avg_bytes: number;
}

export interface TrendPoint {
	hour: string;
	request_count: number;
	error_rate: number;
	avg_latency_p95_ms: number;
	max_latency_p99_ms: number;
}

const IDLE_API = 'the engine records every request through this middleware, so an empty window means no traffic';
const LIVE_API = 'recorded by engine middleware on every request, flushed to api_metrics_hourly on an interval';

export async function requestSummary(window?: { from: string; to: string }): Promise<Sourced<RequestSummary | null>> {
	// The window parameters are from and to as RFC 3339 instants. There is no
	// hours or days parameter: passing one is accepted and ignored, and the
	// response still reports a 24 hour window, which reads like it worked.
	const query = window ? `?from=${encodeURIComponent(window.from)}&to=${encodeURIComponent(window.to)}` : '';
	const route = `/api/admin/apianalytics/metrics/summary${query}`;
	const { body, failure, message } = await adminGet<RequestSummary>(route);

	if (failure) return { value: null, provenance: { state: failure, route, detail: message } };
	const total = body?.total_requests ?? 0;
	return {
		value: body,
		provenance: { state: total > 0 ? 'collecting' : 'idle', route, detail: total > 0 ? LIVE_API : IDLE_API }
	};
}

async function breakdown(dimension: string, limit: number): Promise<Sourced<BreakdownRow[]>> {
	const route = `/api/admin/apianalytics/metrics/${dimension}?limit=${limit}`;
	const { body, failure, message } = await adminGet<{ items: BreakdownRow[]; total: number }>(route);

	if (failure) return { value: [], provenance: { state: failure, route, detail: message } };
	const items = body?.items ?? [];
	return {
		value: items,
		provenance: {
			state: items.length > 0 ? 'collecting' : 'idle',
			route,
			// The response's own total is the number of rows it returned, not the
			// distinct count. Cardinality comes from the summary's unique_* fields.
			detail: items.length > 0 ? `${LIVE_API}; showing the top ${items.length} by request count` : IDLE_API
		}
	};
}

export const endpointBreakdown = (limit = 12) => breakdown('endpoints', limit);
export const methodBreakdown = (limit = 10) => breakdown('methods', limit);
export const agentBreakdown = (limit = 10) => breakdown('agents', limit);
export const tenantBreakdown = (limit = 25) => breakdown('tenants', limit);

export async function requestTrend(): Promise<Sourced<TrendPoint[]>> {
	const route = '/api/admin/apianalytics/metrics/trend';
	const { body, failure, message } = await adminGet<{ points: TrendPoint[] }>(route);

	if (failure) return { value: [], provenance: { state: failure, route, detail: message } };
	const points = body?.points ?? [];
	return {
		value: points,
		provenance: {
			state: points.length > 0 ? 'collecting' : 'idle',
			route,
			// Only hours that saw traffic come back. A quiet hour is a missing row,
			// not a row of zeroes, so the series is padded before it is plotted.
			detail: points.length > 0 ? `${LIVE_API}; hours with no traffic are absent from the series` : IDLE_API
		}
	};
}

export interface AnomalyReport {
	count: number;
	window_hours: number;
	z_threshold: number;
}

export async function anomalies(): Promise<Sourced<AnomalyReport | null>> {
	const route = '/api/admin/apianalytics/metrics/anomalies';
	const { body, failure, message } = await adminGet<{
		anomalies: unknown[];
		window_hours: number;
		z_threshold: number;
	}>(route);

	if (failure) return { value: null, provenance: { state: failure, route, detail: message } };
	const count = body?.anomalies?.length ?? 0;
	return {
		value: body ? { count, window_hours: body.window_hours, z_threshold: body.z_threshold } : null,
		provenance: {
			state: 'collecting',
			route,
			// The detector runs over the same rollups, so it is as live as they
			// are. The count is all this app renders: no anomaly came back while
			// this app was built, so the shape of an entry is unverified and
			// laying out fields for it would be guessing.
			detail: 'a z-score pass over the same rollups; the shape of an entry is unverified here because none has fired'
		}
	};
}

export interface CollectorConfig {
	retention_days: number;
	anomaly_window_hours: number;
	anomaly_z_threshold: number;
	aggregation_enabled: boolean;
	metrics_buffer_size: number;
	flush_interval_seconds: number;
	max_distinct_endpoints: number;
}

export async function collectorConfig(): Promise<Sourced<CollectorConfig | null>> {
	const route = '/api/admin/apianalytics/config';
	const { body, failure, message } = await adminGet<{ config: CollectorConfig }>(route);

	if (failure) return { value: null, provenance: { state: failure, route, detail: message } };
	return {
		value: body?.config ?? null,
		provenance: {
			state: 'collecting',
			route,
			detail: 'the collector settings in force; flush_interval_seconds is how stale the request panels can be'
		}
	};
}

// Engine probes

export interface ProbeCheck {
	name: string;
	passed: boolean;
	took: string;
}

export interface ProbeReport {
	status: string;
	checked_at: string;
	checks: ProbeCheck[];
}

/**
 * Reads one of the three unauthenticated probes.
 *
 * These are the only engine endpoints a load balancer can poll, which is the
 * whole reason they are worth a panel: /api/v1/health sounds like the probe and
 * is not one, because it sits behind requireAuth and answers 401 without a
 * token.
 */
export async function probe(name: 'healthz' | 'readyz' | 'startup'): Promise<Sourced<ProbeReport | null>> {
	const route = `/${name}`;
	try {
		const res = await fetch(`${PUBLIC_PROBE_BASE}${route}`);
		const body = (await res.json()) as ProbeReport;
		return {
			value: body,
			provenance: {
				state: 'collecting',
				route: `${route} (public, no token)`,
				detail:
					name === 'startup'
						? 'runs its checks once and caches the pass, so checked_at is boot time and does not advance'
						: 'runs its checks on every call, so this is the freshest reading on the page'
			}
		};
	} catch {
		return {
			value: null,
			provenance: { state: 'error', route, detail: 'the probe did not answer, which is itself the signal' }
		};
	}
}

export interface ReadyReport {
	status: string;
	db: string;
	schema_count: number;
}

export async function tokenedReady(): Promise<Sourced<ReadyReport | null>> {
	const route = '/api/v1/ready';
	try {
		const body = await lyeve.request<ReadyReport>('api', route);
		return {
			value: body,
			provenance: {
				state: 'never',
				route,
				// The admin router mounts this handler as readyHandlerFn(pool, nil).
				// The nil is the schema cache accessor, so the count is a literal
				// zero on an install with dozens of schemas.
				detail:
					'status and db are live, but schema_count is hard zero: the handler is mounted with no schema cache to count'
			}
		};
	} catch {
		return { value: null, provenance: { state: 'error', route, detail: 'the engine refused the call' } };
	}
}

// Connection pool and latency, straight from the engine

export interface PoolHealth {
	engine: string;
	healthy: boolean;
	latency_ms: number;
	open_connections: number;
	in_use: number;
	idle: number;
	max_open_connections: number;
	wait_count: number;
	wait_duration_ms: number;
	utilization: number;
	utilization_warning: boolean;
	tracked_shapes: number;
}

export async function poolHealth(): Promise<Sourced<PoolHealth | null>> {
	const route = '/api/admin/pool/health';
	const { body, failure, message } = await adminGet<
		PoolHealth & { message?: string; slow_queries?: { tracked_shapes: number } }
	>(route);

	if (failure) return { value: null, provenance: { state: failure, route, detail: message } };

	// With no pool health provider wired the handler answers 200 with a healthy
	// flag, a message and no numbers. That is the exact shape this app exists to
	// call out: a green panel that measured nothing.
	if (!body || body.open_connections === undefined) {
		return {
			value: null,
			provenance: {
				state: 'needs-trigger',
				route,
				detail: body?.message ?? 'no pool health provider is wired, so the healthy flag is a default and not a reading'
			}
		};
	}

	return {
		value: { ...body, tracked_shapes: body.slow_queries?.tracked_shapes ?? 0 },
		provenance: {
			state: 'collecting',
			route,
			detail: "read straight off the driver's pool statistics at request time, so it is instantaneous and not averaged"
		}
	};
}

export interface LatencyRow {
	method: string;
	path: string;
	count: number;
	min_us: number;
	max_us: number;
	avg_us: number;
	p50_us: number;
	p95_us: number;
	p99_us: number;
}

export interface LatencyTracker {
	tracked_endpoints: number;
	max_endpoints: number;
	samples_per_endpoint: number;
	total_requests: number;
}

export async function latency(top = 10): Promise<Sourced<{ tracker: LatencyTracker; slowest: LatencyRow[] } | null>> {
	const route = `/api/admin/debug/latency?top=${top}`;
	const { body, failure, message } = await adminGet<{
		tracker?: LatencyTracker;
		slowest: LatencyRow[] | null;
		message?: string;
	}>(route);

	if (failure) return { value: null, provenance: { state: failure, route, detail: message } };

	if (!body?.tracker) {
		return {
			value: null,
			provenance: {
				state: 'needs-trigger',
				route,
				detail: body?.message ?? 'no latency tracker is wired into this build'
			}
		};
	}

	return {
		value: { tracker: body.tracker, slowest: body.slowest ?? [] },
		provenance: {
			state: 'collecting',
			route,
			// The tracker is a ring buffer in the process, so its counts start
			// again from zero at every boot and will not match the durable
			// apianalytics rollups.
			detail: `in-process ring buffer over ${body.tracker.tracked_endpoints} of ${body.tracker.max_endpoints} endpoint slots; it resets on restart`
		}
	};
}

/**
 * Parses the engine's Prometheus exposition into the handful of samples this
 * console shows.
 *
 * Worth one panel because it is the only place the Go runtime and the request
 * counters appear, and worth the caveat that goes with it: every counter here
 * is process-lifetime, so it disagrees with the durable apianalytics figures by
 * however much traffic arrived before the last restart.
 */
export interface RuntimeMetrics {
	goroutines: number;
	requestsInFlight: number;
	requestsByCode: { code: string; count: number }[];
	poolWaitCount: number;
	contentCacheHits: number;
	contentCacheMisses: number;
}

export async function runtimeMetrics(): Promise<Sourced<RuntimeMetrics | null>> {
	const route = '/api/admin/metrics';
	let text: string;
	try {
		const res = await lyeve.raw('admin', route);
		if (!res.ok) throw new Error(String(res.status));
		text = await res.text();
	} catch {
		return {
			value: null,
			provenance: { state: 'error', route, detail: 'the exposition endpoint refused the admin token' }
		};
	}

	const byCode = new Map<string, number>();
	let goroutines = 0;
	let inFlight = 0;
	let poolWait = 0;
	let hits = 0;
	let misses = 0;

	for (const line of text.split('\n')) {
		if (line.startsWith('#') || !line) continue;
		const space = line.lastIndexOf(' ');
		if (space < 0) continue;
		const name = line.slice(0, space);
		const value = Number(line.slice(space + 1));
		if (!Number.isFinite(value)) continue;

		if (name === 'go_goroutines') goroutines = value;
		else if (name === 'lyeve_db_pool_wait_count_total') poolWait = value;
		else if (name === 'lyeve_content_list_cache_hits_total') hits = value;
		else if (name === 'lyeve_content_list_cache_misses_total') misses = value;
		else if (name.startsWith('lyeve_requests_in_flight')) inFlight += value;
		else if (name.startsWith('lyeve_requests_total')) {
			const code = /code="([^"]+)"/.exec(name)?.[1];
			if (code) byCode.set(code, (byCode.get(code) ?? 0) + value);
		}
	}

	return {
		value: {
			goroutines,
			requestsInFlight: inFlight,
			requestsByCode: [...byCode].map(([code, count]) => ({ code, count })).sort((a, b) => a.code.localeCompare(b.code)),
			poolWaitCount: poolWait,
			contentCacheHits: hits,
			contentCacheMisses: misses
		},
		provenance: {
			state: 'collecting',
			route,
			detail:
				'Prometheus text from the engine, always live, but every counter restarts at boot so it will read far lower than the stored rollups'
		}
	};
}

// Usage and quota

export interface TenantUsage {
	tenant_id: string;
	billing_period: string;
	api_calls: number;
	storage_bytes: number;
	bandwidth_bytes: number;
	content_count: number;
	media_count: number;
}

/**
 * One response, two provenances.
 *
 * content_count, media_count and storage_bytes are COUNT and SUM queries run at
 * read time against sys_content_entries and sys_media, so they are exact.
 * api_calls and bandwidth_bytes are read from sys_api_usage, which only the
 * usage plugin's middleware writes, and that middleware returns early unless
 * the request authenticated with an API key. A deployment whose clients all use
 * bearer tokens reads zero for both, permanently.
 */
export async function tenantUsage(): Promise<{
	value: TenantUsage[];
	live: Provenance;
	metered: Provenance;
}> {
	const route = '/api/admin/usage/tenants';
	const { body, failure, message } = await adminGet<TenantUsage[]>(route);

	if (failure) {
		const p: Provenance = { state: failure, route, detail: message };
		return { value: [], live: p, metered: p };
	}

	const rows = Array.isArray(body) ? body : [];
	const metered = rows.some((r) => r.api_calls > 0);

	return {
		value: rows,
		live: {
			state: rows.length > 0 ? 'collecting' : 'idle',
			route,
			detail: 'content, media and storage are COUNT and SUM run at read time against the live tables, so they are exact'
		},
		metered: {
			state: metered ? 'collecting' : 'needs-reporter',
			route,
			detail: metered
				? 'incremented by the usage middleware for every API-key request'
				: 'the usage middleware only counts a request that authenticated with an API key, and returns early for a bearer token; zero here means no API-key client has called'
		}
	};
}

export interface Quota {
	tenant_id: string;
	requests_limit: number;
	storage_bytes_limit: number;
	bandwidth_bytes_limit: number;
	is_hard_limit: boolean;
	grace_period_hours: number;
	warn_at_pct_80: boolean;
	warn_at_pct_90: boolean;
	block_on_exceeded: boolean;
	blocked_at: string | null;
}

export async function quotas(): Promise<Sourced<Quota[]>> {
	const route = '/api/admin/quotas?limit=50';
	const { body, failure, message } = await adminGet<{ data: Quota[]; total_count: number }>(route);

	if (failure) return { value: [], provenance: { state: failure, route, detail: message } };
	const rows = body?.data ?? [];
	return {
		value: rows,
		provenance: {
			state: 'collecting',
			route,
			// A zero limit is the plugin's unlimited, seeded by EnsureDefault at
			// boot. Read as a number it looks like a tenant with no allowance
			// left, which is the opposite of what it means.
			detail: 'quota rows are administrative, not measured; a limit of 0 is this plugin spelling unlimited, not exhausted'
		}
	};
}

export interface QuotaStatus {
	tenant_id: string;
	requests_used: number;
	requests_limit: number;
	requests_pct: number;
	is_blocked: boolean;
	is_warning_80: boolean;
	is_warning_90: boolean;
	is_exceeded: boolean;
	is_hard_limit: boolean;
	grace_period_hours: number;
}

export async function quotaStatus(): Promise<Sourced<QuotaStatus | null>> {
	const route = '/api/v1/quotas/status';
	try {
		const body = await lyeve.request<QuotaStatus>('api', route);
		return {
			value: body,
			provenance: {
				state: body.requests_limit > 0 ? 'collecting' : 'needs-trigger',
				route,
				detail:
					body.requests_limit > 0
						? 'counted by the quota middleware against the tenant quota row'
						: 'the seeded quota has a limit of 0, which the plugin treats as unlimited, so requests_used is never compared to anything and requests_pct stays 0'
			}
		};
	} catch {
		return { value: null, provenance: { state: 'error', route, detail: 'the public router refused the call' } };
	}
}

export async function quotaRequestCount(): Promise<Sourced<number>> {
	const route = '/api/admin/quota-requests';
	const { body, failure, message } = await adminGet<{ data: unknown[]; total_count: number }>(route);
	if (failure) return { value: 0, provenance: { state: failure, route, detail: message } };
	const n = body?.data?.length ?? 0;
	return {
		value: n,
		provenance: {
			state: n > 0 ? 'collecting' : 'idle',
			route,
			detail: 'a tenant raises one of these through POST /api/v1/quota-requests; none has ever come back here, so only the count is rendered'
		}
	};
}

// The plugins whose numbers are not what their names promise

export interface DailyRollup {
	days: number;
	total_dau: number;
	total_api_calls: number;
	total_storage: number;
	total_new_users: number;
}

export async function dailyRollup(): Promise<Sourced<DailyRollup | null>> {
	const route = '/api/admin/analytics/summary';
	const { body, failure, message } = await adminGet<DailyRollup>(route);
	if (failure) return { value: null, provenance: { state: failure, route, detail: message } };
	return {
		value: body,
		provenance: {
			state: (body?.days ?? 0) > 0 ? 'collecting' : 'needs-trigger',
			route,
			// sys_tenant_analytics_daily is only written by the aggregation
			// endpoints or by the cron plugin calling AggregateAllTenants. The
			// analytics plugin schedules nothing itself.
			detail:
				'sums sys_tenant_analytics_daily, which is only written by POST /api/admin/analytics/aggregate or a cron job calling it; the plugin schedules no aggregation of its own'
		}
	};
}

export interface ContentActivityEvent {
	id: string;
	event_name: string;
	event_category: string;
	processed: boolean;
	created_at: string;
}

/**
 * Content activity, and the one automatic analytics source worth reading.
 *
 * The analytics plugin subscribes to the engine's AfterCreate, AfterUpdate and
 * AfterDelete hooks for every schema, so a row lands here whenever anything
 * writes content. That makes it a genuine activity feed with no configuration.
 *
 * processed is the catch. The hook builds its event with provider_types nil and
 * a comment reading "all enabled providers", while the dispatcher loops over
 * that list, so nil dispatches to nothing. No hook event is ever marked
 * processed, whether a provider is configured or not.
 */
export async function contentActivity(limit = 200): Promise<Sourced<ContentActivityEvent[]>> {
	const route = `/api/admin/analytics/events?limit=${limit}`;
	const { body, failure, message } = await adminGet<{ data: ContentActivityEvent[]; total_count: number }>(route);

	if (failure) return { value: [], provenance: { state: failure, route, detail: message } };
	const rows = body?.data ?? [];
	return {
		value: rows,
		provenance: {
			state: rows.length > 0 ? 'collecting' : 'idle',
			route,
			// total_count on this route is the length of the page, not the size
			// of the table, so it can never be used for paging.
			detail:
				'written automatically from the engine content hooks; total_count is only the page length, and processed stays false for every hook event because the dispatcher is handed an empty provider list'
		}
	};
}

export async function providerCount(): Promise<Sourced<number>> {
	const route = '/api/admin/analytics/providers';
	const { body, failure, message } = await adminGet<unknown[] | null>(route);
	if (failure) return { value: 0, provenance: { state: failure, route, detail: message } };
	return {
		// The route answers a bare null rather than an empty array when nothing
		// is configured, so a caller treating the body as a list crashes here.
		value: Array.isArray(body) ? body.length : 0,
		provenance: {
			state: 'needs-trigger',
			route,
			detail: 'external analytics destinations, created only through the admin API; with none configured the route answers a bare null and not an empty array'
		}
	};
}
