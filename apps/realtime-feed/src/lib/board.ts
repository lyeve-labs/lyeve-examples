/**
 * The board's vocabulary and the shapes the page and the live route agree on.
 *
 * Nothing here touches the engine, so it is safe to import from a component.
 */

export const SEVERITIES = ['minor', 'major', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const STATES = ['investigating', 'identified', 'monitoring', 'resolved'] as const;
export type IncidentState = (typeof STATES)[number];

export const SEVERITY_LABEL: Record<Severity, string> = {
	minor: 'Degraded performance',
	major: 'Partial outage',
	critical: 'Major outage'
};

export const STATE_LABEL: Record<IncidentState, string> = {
	investigating: 'Investigating',
	identified: 'Identified',
	monitoring: 'Monitoring',
	resolved: 'Resolved'
};

/** Worst first, so a service takes the color of its worst open incident. */
export const SEVERITY_RANK: Record<Severity, number> = { critical: 0, major: 1, minor: 2 };

export function isSeverity(v: unknown): v is Severity {
	return typeof v === 'string' && (SEVERITIES as readonly string[]).includes(v);
}

export function isIncidentState(v: unknown): v is IncidentState {
	return typeof v === 'string' && (STATES as readonly string[]).includes(v);
}

export interface Service {
	id: string;
	slug: string;
	name: string;
	description: string;
}

export interface Incident {
	id: string;
	slug: string;
	title: string;
	summary: string;
	severity: Severity;
	state: IncidentState;
	serviceId: string | null;
	openedAt: string;
	resolvedAt: string | null;
}

export interface IncidentUpdate {
	id: string;
	incidentId: string | null;
	state: IncidentState;
	summary: string;
	postedAt: string;
}

/** A service is green only while nothing unresolved points at it. */
export function serviceSeverity(incidents: Incident[], serviceId: string): Severity | null {
	const open = incidents.filter((i) => i.serviceId === serviceId && i.state !== 'resolved');
	if (open.length === 0) return null;
	return open.reduce<Severity>(
		(worst, i) => (SEVERITY_RANK[i.severity] < SEVERITY_RANK[worst] ? i.severity : worst),
		'minor'
	);
}

/** Newest first, and an unresolved incident always outranks a resolved one. */
export function sortIncidents(incidents: Incident[]): Incident[] {
	return [...incidents].sort(
		(a, b) =>
			Number(a.state === 'resolved') - Number(b.state === 'resolved') ||
			Date.parse(b.openedAt) - Date.parse(a.openedAt)
	);
}

/**
 * Folds live events over the server-rendered list.
 *
 * The page never replaces its loaded data with stream data. An event is an
 * overlay entry keyed by id, so a dropped event costs one stale row until the
 * next resync rather than a board assembled entirely out of events that may
 * have gaps in it.
 */
export function applyOverlay<T extends { id: string }>(base: T[], overlay: Record<string, T>): T[] {
	const merged = new Map(base.map((row) => [row.id, row]));
	for (const [id, row] of Object.entries(overlay)) merged.set(id, row);
	return [...merged.values()];
}
