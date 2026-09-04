/**
 * Creates the privacy desk's content types and seeds the register.
 *
 * Safe to run more than once: applying a schema that exists is accepted, and
 * seeding stops if the register already holds requests.
 *
 * This script never calls POST /api/admin/gdpr/erase, and it never will. An
 * erasure is not reversible, this stack is shared by every example in the
 * repository, and the identifier that route is happiest to accept is the
 * credential the seed script is holding.
 */
import {
	lyeveFromEnv,
	applySchemas,
	belongsTo,
	listContent,
	createContent
} from '../src/lib/lyeve/index.ts';

const client = lyeveFromEnv();

const OFFICERS = 'privacy_officers';
const REQUESTS = 'privacy_requests';
const ACTIONS = 'privacy_actions';

const OPERATOR_EMAIL = (process.env.LYEVE_EMAIL ?? 'admin@lyeve.example').toLowerCase();

// Order matters: a relation emits a foreign key against the target's generated
// table, so officers must exist before requests references them, and requests
// before actions does.
await applySchemas(client, [
	{
		name: OFFICERS,
		display_name: 'Privacy officers',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'email', field_type: 'text' },
			{ name: 'remit', field_type: 'text' }
		]
	},
	{
		name: REQUESTS,
		display_name: 'Data subject requests',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'subject_name', field_type: 'text' },
			// Deliberately text rather than the engine's `email` field type. A
			// request sometimes names an account id and no address, and on
			// PostgreSQL an email field carries a CHECK constraint that an empty
			// string does not satisfy. The app validates the address instead.
			{ name: 'subject_email', field_type: 'text', indexed: true },
			{ name: 'subject_account_id', field_type: 'text', indexed: true },
			{ name: 'request_type', field_type: 'text', indexed: true },
			{ name: 'request_state', field_type: 'text', indexed: true },
			{ name: 'details', field_type: 'text' },
			{ name: 'resolution_note', field_type: 'text' },
			{ name: 'received_at', field_type: 'datetime' },
			{ name: 'due_at', field_type: 'datetime', indexed: true },
			belongsTo('handler', OFFICERS)
		]
	},
	{
		name: ACTIONS,
		display_name: 'Privacy actions',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'action_kind', field_type: 'text', indexed: true },
			{ name: 'outcome', field_type: 'text' },
			// The subject is recorded as a digest, never as the identifier. A
			// register of erasures should not be the one place the erased
			// address survives. The recipe is the engine's own subject_ref:
			// SHA-256, first six bytes, hex.
			{ name: 'subject_digest', field_type: 'text', indexed: true },
			{ name: 'identifier_kind', field_type: 'text' },
			{ name: 'rows_affected', field_type: 'number' },
			{ name: 'record_count', field_type: 'number' },
			{ name: 'sections', field_type: 'text' },
			{ name: 'notes', field_type: 'text' },
			{ name: 'ran_at', field_type: 'datetime' },
			belongsTo('request', REQUESTS),
			belongsTo('officer', OFFICERS)
		]
	}
]);
console.log('content types ready');

if ((await listContent(client, REQUESTS, { limit: 25 })).length > 0) {
	console.log('register already seeded, nothing to do');
	process.exit(0);
}

const officers = [
	{
		key: 'sandoval',
		slug: 'privacy-officer-ingrid-sandoval',
		title: 'Ingrid Sandoval',
		email: 'ingrid.sandoval@northwind.example',
		remit: 'Data protection officer. Owns the register and signs off every erasure.'
	},
	{
		key: 'renner',
		slug: 'privacy-officer-tobias-renner',
		title: 'Tobias Renner',
		email: 'tobias.renner@northwind.example',
		remit: 'Platform engineering. Confirms what the engine actually holds before a bundle goes out.'
	},
	{
		key: 'okonjo',
		slug: 'privacy-officer-marisol-okonjo',
		title: 'Marisol Okonjo',
		email: 'marisol.okonjo@northwind.example',
		remit: 'Legal counsel. Decides when a hold applies and drafts the refusals.'
	}
];

const officerIds: Record<string, string> = {};
for (const officer of officers) {
	const { id } = await createContent(client, {
		schema: OFFICERS,
		slug: officer.slug,
		title: officer.title,
		body: { slug: officer.slug, email: officer.email, remit: officer.remit }
	});
	officerIds[officer.key] = id;
}

const DAY = 86_400_000;
const now = Date.now();
const ago = (days: number) => new Date(now - days * DAY).toISOString();
const due = (receivedDaysAgo: number) => new Date(now - (receivedDaysAgo - 30) * DAY).toISOString();

const requests = [
	{
		key: 'reinholm',
		slug: 'privacy-request-access-reinholm',
		title: 'Access request from Marta Reinholm',
		subject_name: 'Marta Reinholm',
		subject_email: 'marta.reinholm@northwind.example',
		subject_account_id: '',
		request_type: 'access',
		request_state: 'received',
		receivedDaysAgo: 3,
		handler: '',
		details:
			'Asks for a copy of everything held about her, including the newsletter she unsubscribed from in June and any comments left under her name.',
		resolution_note: ''
	},
	{
		key: 'vasquez',
		slug: 'privacy-request-erasure-vasquez',
		title: 'Erasure request from Dorian Vasquez',
		subject_name: 'Dorian Vasquez',
		subject_email: 'dorian.vasquez@harborlight.example',
		subject_account_id: '',
		request_type: 'erasure',
		request_state: 'in_progress',
		receivedDaysAgo: 9,
		handler: 'sandoval',
		details:
			'Closed his account in July and wants what is left removed. Identity confirmed against the address on the closed account and a photograph of a utility bill, held in the case file and not here.',
		resolution_note: ''
	},
	{
		key: 'okpara',
		slug: 'privacy-request-portability-okpara',
		title: 'Portability request from Chidi Okpara',
		subject_name: 'Chidi Okpara',
		subject_email: '',
		subject_account_id: '7c1f4d02-0e6b-4c8a-9c6f-2b41d3a9e510',
		request_type: 'portability',
		request_state: 'verifying',
		receivedDaysAgo: 6,
		handler: 'renner',
		details:
			'Gave an account id rather than an address, which is the easier of the two to answer: an id names one account across every tenant, where an address is only unique among accounts. Waiting on identity confirmation before anything is read.',
		resolution_note: ''
	},
	{
		key: 'brandt',
		slug: 'privacy-request-rectification-brandt',
		title: 'Rectification request from Lene Brandt',
		subject_name: 'Lene Brandt',
		subject_email: 'lene.brandt@fjordline.example',
		subject_account_id: '',
		request_type: 'rectification',
		request_state: 'received',
		receivedDaysAgo: 35,
		handler: '',
		details:
			'Her surname is spelled wrong on two invoices and in the mailing list. Nobody picked this up when it arrived, which is why it is past the deadline.',
		resolution_note: ''
	},
	{
		key: 'delacroix',
		slug: 'privacy-request-erasure-delacroix',
		title: 'Erasure request from Henri Delacroix',
		subject_name: 'Henri Delacroix',
		subject_email: 'henri.delacroix@harborlight.example',
		subject_account_id: '',
		request_type: 'erasure',
		request_state: 'refused',
		receivedDaysAgo: 21,
		handler: 'okonjo',
		details: 'Asks for every record to be deleted, including the disputed order from March.',
		resolution_note:
			'Refused in part and deferred in part. The order records are needed to defend a live claim, which Art. 17(3)(e) already carves out, so they stay until the claim is settled. Everything else was actioned.'
	},
	{
		key: 'weatherby',
		slug: 'privacy-request-access-weatherby',
		title: 'Access request from Rosalind Weatherby',
		subject_name: 'Rosalind Weatherby',
		subject_email: 'rosalind.weatherby@fjordline.example',
		subject_account_id: '',
		request_type: 'access',
		request_state: 'completed',
		receivedDaysAgo: 28,
		handler: 'sandoval',
		details: 'Asked what the account record holds. Answered with the bundle the exporters returned.',
		resolution_note:
			'Bundle sent 19 days ago. The covering letter said which systems the export does not reach, because the bundle does not say so itself.'
	},
	{
		key: 'staff',
		slug: 'privacy-request-erasure-staff-account',
		title: 'Erasure request naming a platform account',
		subject_name: 'Filed by an employee',
		subject_email: OPERATOR_EMAIL,
		subject_account_id: '',
		request_type: 'erasure',
		request_state: 'in_progress',
		receivedDaysAgo: 4,
		handler: 'okonjo',
		details:
			'Arrived through the public form naming the address the platform itself authenticates with. Left in the register on purpose: the confirm step refuses it, and a refusal an operator can see is worth more than a rule written down somewhere.',
		resolution_note: ''
	}
];

const requestIds: Record<string, string> = {};
for (const request of requests) {
	const body: Record<string, unknown> = {
		slug: request.slug,
		subject_name: request.subject_name,
		subject_email: request.subject_email,
		subject_account_id: request.subject_account_id,
		request_type: request.request_type,
		request_state: request.request_state,
		details: request.details,
		resolution_note: request.resolution_note,
		// A datetime field is a TIMESTAMPTZ, and RFC 3339 is what it takes.
		received_at: ago(request.receivedDaysAgo),
		due_at: due(request.receivedDaysAgo)
	};
	// Relations are written under the field name and read back as
	// `<field>_id`. Optional by design: a required relation makes every insert
	// fail, so an unassigned request is a shape the database accepts and the
	// app reports.
	if (request.handler) body.handler = officerIds[request.handler];

	const { id } = await createContent(client, {
		schema: REQUESTS,
		slug: request.slug,
		title: request.title,
		body
	});
	requestIds[request.key] = id;
}

/** The engine's own subject_ref: SHA-256 of the identifier, first six bytes, hex. */
async function digest(identifier: string): Promise<string> {
	const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identifier));
	return [...new Uint8Array(hash).slice(0, 6)]
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

const seededActions = [
	{
		slug: 'privacy-action-export-weatherby',
		request: 'weatherby',
		officer: 'sandoval',
		kind: 'export',
		outcome: 'complete',
		identifier: 'rosalind.weatherby@fjordline.example',
		identifier_kind: 'email',
		record_count: 1,
		rows_affected: 0,
		sections: 'sys_users:1',
		notes: '1 of 5 registered exporters held data. Content, media and the audit trail are not among them, and the covering letter said so.',
		ranDaysAgo: 19
	},
	{
		slug: 'privacy-action-refusal-delacroix',
		request: 'delacroix',
		officer: 'okonjo',
		kind: 'refusal',
		outcome: 'held',
		identifier: 'henri.delacroix@harborlight.example',
		identifier_kind: 'email',
		record_count: 0,
		rows_affected: 0,
		sections: '',
		notes: 'Order records are under a hold pending a live claim. The rest was erased in the same window.',
		ranDaysAgo: 14
	}
];

for (const action of seededActions) {
	await createContent(client, {
		schema: ACTIONS,
		slug: action.slug,
		title: `${action.kind} on ${action.request}: ${action.outcome}`,
		body: {
			slug: action.slug,
			action_kind: action.kind,
			outcome: action.outcome,
			subject_digest: await digest(action.identifier),
			identifier_kind: action.identifier_kind,
			rows_affected: action.rows_affected,
			record_count: action.record_count,
			sections: action.sections,
			notes: action.notes,
			ran_at: ago(action.ranDaysAgo),
			request: requestIds[action.request],
			officer: officerIds[action.officer]
		}
	});
}

console.log(
	`seeded ${officers.length} officers, ${requests.length} requests, ${seededActions.length} actions`
);
