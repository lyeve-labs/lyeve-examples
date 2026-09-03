import { LyeveError, createContent, getContentBySlug } from '$lib/lyeve';
import { lyeve } from './lyeve';

/**
 * The contact form, stored in the two content types the schema plugin's forms
 * preset creates.
 *
 * `forms` holds the definition: a name, a unique slug, the layout as JSON and
 * an optional notification address. `form_submissions` holds what visitors
 * post, as JSON, with a status. The preset is tables and nothing more: there
 * is no submit route, no validation of a submission against its form and no
 * spam check. This module is where each of those lives.
 *
 * Slugs are unique per tenant and every example shares one engine, so the slug
 * carries the app name.
 */
export const CONTACT_FORM = 'company-site-contact';

const FORMS = 'forms';
const SUBMISSIONS = 'form_submissions';

export interface FormFieldDef {
	type: string;
	label: string;
	name: string;
	placeholder?: string;
	required: boolean;
	help_text?: string;
	options?: string[];
	rows?: number;
	min_length?: number;
	max_length?: number;
}

/**
 * What this app stores in the preset's `fields` column. The preset calls it
 * the form's field layout and gives it no shape, so the copy around the
 * fields travels in it too.
 */
export interface FormLayout {
	description: string;
	submit_text: string;
	success_message: string;
	honeypot: boolean;
	fields: FormFieldDef[];
}

export interface FormDef {
	id: string;
	name: string;
	slug: string;
	active: boolean;
	layout: FormLayout;
}

interface FormRecord {
	name: string;
	slug: string;
	fields: FormLayout;
	notify_email: string | null;
	active: boolean | null;
}

/**
 * The trap field this app renders when the layout asks for one.
 *
 * It is not one of the form's declared fields. A person never sees it. A bot
 * that fills every input fills it too, gets the ordinary success message, and
 * nothing is stored, so it cannot tell it was caught.
 */
export const HONEYPOT_FIELD = '_website';

/** Finds a form definition by the slug the preset makes unique. */
export async function formDefinition(slug: string): Promise<FormDef | null> {
	const row = await getContentBySlug<FormRecord>(lyeve, FORMS, slug);
	if (!row) return null;
	return {
		id: row.id,
		name: row.data.name,
		slug: row.data.slug,
		// The preset's default of true is not applied to a read of a record
		// written without it, so an absent value counts as active here.
		active: row.data.active !== false,
		layout: row.data.fields
	};
}

export interface SubmitOutcome {
	ok: boolean;
	status: number;
	message: string;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Checks posted values against the stored definition.
 *
 * The engine checks a submission against the `form_submissions` type, whose
 * `data` column is any JSON at all. Nothing in the engine reads the form's
 * field list, so the required fields, the length bounds, the address shape
 * and the options of a select are enforced here or nowhere.
 */
export function validate(def: FormDef, values: Record<string, string>): string | null {
	for (const field of def.layout.fields) {
		const value = values[field.name];
		if (!value) {
			if (field.required) return `${field.label} is required.`;
			continue;
		}
		if (field.min_length && value.length < field.min_length) {
			return `${field.label} needs at least ${field.min_length} characters.`;
		}
		if (field.max_length && value.length > field.max_length) {
			return `${field.label} is limited to ${field.max_length} characters.`;
		}
		if (field.type === 'email' && !EMAIL.test(value)) {
			return `${field.label} does not look like an email address.`;
		}
		if (field.type === 'select' && !(field.options ?? []).includes(value)) {
			return `${field.label} is not one of the choices.`;
		}
	}
	return null;
}

/**
 * Stores a submission as a `form_submissions` record.
 *
 * It is written with this app's credential through the admin content route,
 * because a submission is content like any other and there is no anonymous
 * route for it. Only declared fields are stored. The caller has already
 * dropped everything else. The status is required even though the preset
 * declares a default: a write that leaves it out is refused as missing.
 *
 * A `form-submitted` flow on the submission type's after_create event is how
 * the engine would mail it to the form's notify address. This example leaves
 * that address empty, so nothing is sent.
 */
export async function submitForm(
	def: FormDef,
	data: Record<string, string>
): Promise<SubmitOutcome> {
	try {
		await createContent(lyeve, {
			schema: SUBMISSIONS,
			slug: `${def.slug}-${crypto.randomUUID()}`,
			title: `Submission to ${def.name}`,
			body: { form: def.id, data, status: 'new' }
		});
	} catch (err) {
		const status = err instanceof LyeveError ? err.status : 502;
		return { ok: false, status, message: 'The message could not be sent. Try again shortly.' };
	}
	return { ok: true, status: 201, message: def.layout.success_message };
}
