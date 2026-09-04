import {
	agentBreakdown,
	anomalies,
	collectorConfig,
	endpointBreakdown,
	methodBreakdown,
	requestSummary,
	requestTrend,
	tenantBreakdown
} from '$lib/server/telemetry';
import type { PageServerLoad } from './$types';

/** The presets the range control offers, resolved to the from and to the route takes. */
const RANGES = {
	'1h': { label: 'Last hour', hours: 1 },
	'6h': { label: 'Last 6 hours', hours: 6 },
	'24h': { label: 'Last 24 hours', hours: 24 }
} as const;

export type RangeKey = keyof typeof RANGES;

export const load: PageServerLoad = async ({ url }) => {
	const key = (url.searchParams.get('range') ?? '24h') as RangeKey;
	const range = RANGES[key] ?? RANGES['24h'];

	// The route takes from and to as RFC 3339 instants. There is no hours or
	// days parameter: one is accepted and silently ignored, and the response
	// still labels itself a 24 hour window, so a page passing hours would show
	// the wrong figures under the right heading.
	const to = new Date();
	const from = new Date(to.getTime() - range.hours * 3_600_000);
	const window = { from: from.toISOString(), to: to.toISOString() };

	const [summary, endpoints, methods, agents, tenants, trend, config, anomalyReport] = await Promise.all([
		requestSummary(window),
		endpointBreakdown(15),
		methodBreakdown(10),
		agentBreakdown(10),
		tenantBreakdown(25),
		requestTrend(),
		collectorConfig(),
		anomalies()
	]);

	return {
		rangeKey: RANGES[key] ? key : ('24h' as RangeKey),
		ranges: Object.entries(RANGES).map(([value, r]) => ({ value, label: r.label })),
		summary: summary.value,
		summaryProvenance: summary.provenance,
		// The breakdown routes have no window parameter of their own, so they
		// always answer over their default window. Saying so on the panel keeps
		// the range control from appearing to scope more than it does.
		endpoints: endpoints.value,
		endpointsProvenance: endpoints.provenance,
		methods: methods.value,
		methodsProvenance: methods.provenance,
		agents: agents.value,
		agentsProvenance: agents.provenance,
		tenants: tenants.value,
		tenantsProvenance: tenants.provenance,
		trend: trend.value.map((point) => ({ hour: point.hour, value: point.request_count })),
		errorTrend: trend.value.map((point) => ({ hour: point.hour, value: point.error_rate })),
		trendProvenance: trend.provenance,
		config: config.value,
		configProvenance: config.provenance,
		anomalies: anomalyReport.value,
		anomaliesProvenance: anomalyReport.provenance
	};
};
