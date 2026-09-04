import {
	collectorConfig,
	contentActivity,
	dailyRollup,
	providerCount,
	requestSummary,
	requestTrend
} from '$lib/server/telemetry';
import { listNotes } from '$lib/server/notes';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Every source is independent, so they go out together. One slow plugin
	// should not serialize the page, and one dead plugin must not blank it:
	// each helper turns a failure into a panel state rather than throwing.
	const [summary, trend, config, activity, rollup, providers, notes] = await Promise.all([
		requestSummary(),
		requestTrend(),
		collectorConfig(),
		contentActivity(200),
		dailyRollup(),
		providerCount(),
		listNotes(6).catch(() => [])
	]);

	const events = activity.value;

	// Content activity by type, which is the closest thing the engine keeps to
	// "what changed today". The events carry a schema name in event_category.
	const byCategory = new Map<string, number>();
	for (const event of events) {
		byCategory.set(event.event_category, (byCategory.get(event.event_category) ?? 0) + 1);
	}
	const byKind = new Map<string, number>();
	for (const event of events) {
		byKind.set(event.event_name, (byKind.get(event.event_name) ?? 0) + 1);
	}

	return {
		summary: summary.value,
		summaryProvenance: summary.provenance,
		trend: trend.value.map((point) => ({ hour: point.hour, value: point.request_count })),
		trendProvenance: trend.provenance,
		config: config.value,
		configProvenance: config.provenance,
		activity: {
			total: events.length,
			unprocessed: events.filter((e) => !e.processed).length,
			newest: events[0]?.created_at ?? null,
			byCategory: [...byCategory]
				.map(([label, value]) => ({ label, value }))
				.sort((a, b) => b.value - a.value)
				.slice(0, 10),
			byKind: [...byKind].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
		},
		activityProvenance: activity.provenance,
		rollup: rollup.value,
		rollupProvenance: rollup.provenance,
		providers: providers.value,
		providersProvenance: providers.provenance,
		notes: notes.map((note) => ({ id: note.id, title: note.title, kind: note.kind, recordedAt: note.recordedAt }))
	};
};
