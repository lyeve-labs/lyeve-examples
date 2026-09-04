/**
 * Every engine call the status board makes.
 *
 * Incidents, updates and the services they hang off are ordinary content
 * types. The engine has no incident resource, so nothing below this file knows
 * that an unresolved critical incident should turn a service red.
 */
import {
	createContent,
	listContent,
	relationId,
	type ContentEntry
} from '$lib/lyeve';
import { INCIDENTS, SERVICES, UPDATES, lyeve } from './lyeve';
import {
	isIncidentState,
	isSeverity,
	sortIncidents,
	type Incident,
	type IncidentState,
	type IncidentUpdate,
	type Service,
	type Severity
} from '$lib/board';

/** The engine clamps a page to 25..200 rows, so 200 is the largest useful ask. */
const PAGE = 200;

interface ServiceFields {
	title: string;
	slug: string;
	description?: string;
}

interface IncidentFields {
	title: string;
	slug: string;
	summary?: string;
	severity?: string;
	state?: string;
	opened_at?: string;
	resolved_at?: string;
}

interface UpdateFields {
	title: string;
	slug: string;
	summary?: string;
	state?: string;
	posted_at?: string;
}

/**
 * Reads every row a filter matches, a page at a time.
 *
 * A list response is a bare array with no total and no has_more, so a short
 * page is the only signal that the data ended.
 */
async function readAll<T>(
	schema: string,
	filters?: Record<string, string>
): Promise<ContentEntry<T>[]> {
	const rows: ContentEntry<T>[] = [];
	for (let offset = 0; ; offset += PAGE) {
		const page = await listContent<T>(lyeve, schema, { limit: PAGE, offset, filters });
		rows.push(...page);
		if (page.length < PAGE) return rows;
	}
}

export interface Board {
	services: Service[];
	incidents: Incident[];
	updates: IncidentUpdate[];
}

/**
 * Loads the whole board in three reads.
 *
 * This is also the recovery path. The stream is best effort, so the page asks
 * for the board again on a schedule and after every reconnect, and whatever
 * comes back wins over anything the stream said.
 */
export async function loadBoard(): Promise<Board> {
	const [services, incidents, updates] = await Promise.all([
		readAll<ServiceFields>(SERVICES),
		readAll<IncidentFields>(INCIDENTS),
		readAll<UpdateFields>(UPDATES)
	]);

	return {
		services: services.map(toService).sort((a, b) => a.name.localeCompare(b.name)),
		incidents: sortIncidents(incidents.map(toIncident)),
		updates: updates.map(toUpdate)
	};
}

export function toService(row: ContentEntry<ServiceFields>): Service {
	return {
		id: row.id,
		slug: row.data.slug,
		name: row.data.title,
		description: row.data.description ?? ''
	};
}

export function toIncident(row: ContentEntry<IncidentFields>): Incident {
	const d = row.data;
	return {
		id: row.id,
		slug: d.slug,
		title: d.title,
		summary: d.summary ?? '',
		severity: isSeverity(d.severity) ? d.severity : 'minor',
		state: isIncidentState(d.state) ? d.state : 'investigating',
		// A belongs_to relation is written under its field name and read back
		// under `<field>_id`. relationId reads whichever of the two is present.
		serviceId: relationId(d, 'service'),
		openedAt: d.opened_at ?? row.created_at,
		resolvedAt: d.resolved_at ?? null
	};
}

export function toUpdate(row: ContentEntry<UpdateFields>): IncidentUpdate {
	const d = row.data;
	return {
		id: row.id,
		incidentId: relationId(d, 'incident'),
		state: isIncidentState(d.state) ? d.state : 'investigating',
		summary: d.summary ?? '',
		// The entry's own created_at would do for a live write, but only the
		// admin write path publishes it on the stream and a seeded timeline
		// needs to be backdated. The field is written explicitly so both cases
		// read the same way.
		postedAt: d.posted_at ?? row.created_at
	};
}

export interface NewIncident {
	serviceId: string;
	title: string;
	summary: string;
	severity: Severity;
}

/**
 * Opens an incident and files its first timeline entry.
 *
 * Two writes, not one, and nothing makes them atomic. The engine has no
 * transaction a caller can hold across two content writes, so a failure between
 * them leaves an incident with an empty timeline. The board renders that
 * correctly, which is the only defense available here.
 */
export async function openIncident(input: NewIncident): Promise<string> {
	const slug = uniqueSlug(input.title);
	const openedAt = new Date().toISOString();

	// The id the admin write returns is the id every later read and every
	// stream event carries, because the admin write mirrors into the generated
	// table under the same id. That is what makes the second write below a
	// plain insert rather than a read-back of the row just written.
	const { id } = await createContent(lyeve, {
		schema: INCIDENTS,
		slug,
		title: input.title,
		body: {
			slug,
			summary: input.summary,
			severity: input.severity,
			state: 'investigating',
			opened_at: openedAt,
			// Written under the field name, read back as service_id.
			service: input.serviceId
		}
	});

	await postUpdate({ id, slug, title: input.title }, 'investigating', input.summary);
	return slug;
}

/**
 * Files a timeline entry and moves the incident to that state.
 *
 * The order matters to a reader watching the board: the update lands first, so
 * the state change is never on screen without the sentence explaining it.
 */
export async function addUpdate(
	incident: Incident,
	state: IncidentState,
	summary: string
): Promise<void> {
	await postUpdate(incident, state, summary);
	if (state !== incident.state) await setIncidentState(incident, state);
}

async function postUpdate(
	incident: { id: string; slug: string; title: string },
	state: IncidentState,
	summary: string
): Promise<void> {
	const slug = uniqueSlug(`${incident.slug}-update`);
	await createContent(lyeve, {
		schema: UPDATES,
		slug,
		title: `${incident.title}: ${state}`.slice(0, 200),
		body: {
			slug,
			summary,
			state,
			posted_at: new Date().toISOString(),
			// Written under the field name, read back as incident_id.
			incident: incident.id
		}
	});
}

/**
 * Moves an incident to a new state.
 *
 * An edit is `PUT /api/admin/content/{id}` and it replaces the body rather than
 * merging into it, so the whole field set goes back every time. Sending state
 * alone would erase the summary, the severity and the service the incident
 * belongs to.
 */
async function setIncidentState(incident: Incident, state: IncidentState): Promise<void> {
	const resolvedAt =
		state === 'resolved' ? (incident.resolvedAt ?? new Date().toISOString()) : undefined;

	const body: Record<string, unknown> = {
		title: incident.title,
		slug: incident.slug,
		summary: incident.summary,
		severity: incident.severity,
		state,
		opened_at: incident.openedAt
	};
	if (incident.serviceId) body.service = incident.serviceId;
	if (resolvedAt) body.resolved_at = resolvedAt;

	await lyeve.request('admin', `/api/admin/content/${incident.id}`, {
		method: 'PUT',
		body: JSON.stringify({
			title: incident.title,
			slug: incident.slug,
			body,
			change_note: `state changed to ${state}`
		})
	});
}

export async function findIncidentBySlug(slug: string): Promise<Incident | null> {
	const [row] = await listContent<IncidentFields>(lyeve, INCIDENTS, {
		limit: 25,
		filters: { slug }
	});
	return row ? toIncident(row) : null;
}

export async function listServices(): Promise<Service[]> {
	const rows = await readAll<ServiceFields>(SERVICES);
	return rows.map(toService).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Slugs are unique per tenant across every content type rather than per type,
 * and every example in this repo shares one engine and one tenant. The prefix
 * keeps the board clear of the other apps and the suffix keeps two incidents
 * with the same title apart.
 */
function uniqueSlug(subject: string): string {
	const base =
		subject
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 60) || 'incident';
	const prefixed = base.startsWith('status-') ? base : `status-${base}`;
	return `${prefixed}-${crypto.randomUUID().slice(0, 8)}`;
}
