import { error, fail } from '@sveltejs/kit';
import {
	LyeveError,
	createContent,
	getContentBySlug,
	related,
	uploadMedia
} from '$lib/lyeve';
import { lyeve, APPLICATIONS, LISTINGS } from '$lib/server/lyeve';
import type { CompanyData, ListingData } from '$lib/server/listings';
import { employmentLabel, formatSalary, paragraphs, slugify } from '$lib/jobs';
import type { Actions, PageServerLoad } from './$types';

/**
 * The engine's own media route caps an upload at 100 MiB. A CV is not that, and
 * the smaller limit belongs to the handler that accepts it: the engine's guard
 * runs after this server has already read the body off the wire.
 */
const MAX_CV_BYTES = 4 * 1024 * 1024;

const CV_TYPES = [
	'application/pdf',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const CV_EXTENSIONS = ['.pdf', '.doc', '.docx'];

/** Mirrors the CHECK constraint the engine puts on an `email` column in Postgres. */
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const load: PageServerLoad = async ({ params }) => {
	// The engine has no "get by slug" route, so this is a filtered list of one.
	// filters[] is exact equality, which is all a slug lookup needs.
	const row = await getContentBySlug<ListingData>(lyeve, LISTINGS, params.slug, {
		populate: ['company']
	});
	if (!row) error(404, 'That role is not listed');

	const company = related<CompanyData>(row.data, 'company');

	return {
		job: {
			title: row.data.title,
			slug: row.data.slug,
			summary: row.data.summary ?? '',
			paragraphs: paragraphs(row.data.body ?? ''),
			location: row.data.location ?? 'Location not stated',
			employmentLabel: employmentLabel(row.data.employment_type),
			salary: formatSalary(row.data.salary_min, row.data.salary_max),
			postedAt: row.created_at
		},
		company: company
			? {
					title: company.title,
					bio: company.bio ?? '',
					// Content is data, so a link out of the page gets checked
					// rather than trusted. Only http and https reach an href.
					website: safeUrl(company.website)
				}
			: null
	};
};

export const actions: Actions = {
	apply: async ({ request, params }) => {
		const form = await request.formData();
		const name = field(form, 'applicant_name');
		const email = field(form, 'applicant_email');
		const letter = field(form, 'cover_letter');
		const cv = form.get('cv');
		const values = { applicant_name: name, applicant_email: email, cover_letter: letter };

		if (name.length < 2) {
			return fail(400, { ...values, error: 'Enter the name to put on the application.' });
		}
		if (!EMAIL_PATTERN.test(email)) {
			return fail(400, { ...values, error: 'Enter an email address the employer can reply to.' });
		}
		if (letter.length < 40) {
			const tooShort = 'Write at least a couple of sentences about why you fit the role.';
			return fail(400, { ...values, error: tooShort });
		}
		if (letter.length > 5000) {
			return fail(400, { ...values, error: 'Keep the covering note under 5000 characters.' });
		}

		if (!(cv instanceof File)) {
			return fail(400, { ...values, error: 'Attach your CV as a PDF or a Word document.' });
		}
		const cvError = checkCv(cv);
		if (cvError) return fail(400, { ...values, error: cvError });

		// Resolve the listing from the URL rather than from a hidden field, so a
		// posted form cannot attach an application to a different role.
		const listing = await getContentBySlug<ListingData>(lyeve, LISTINGS, params.slug);
		if (!listing) return fail(404, { ...values, error: 'That role has been withdrawn.' });

		try {
			// The file goes to this server first and the server passes it on. The
			// engine's media route is authenticated, so a browser posting straight
			// at it is rejected, and shipping the credential to the browser to fix
			// that would hand every visitor the whole content API.
			const media = await uploadMedia(lyeve, cv, safeFilename(cv.name));

			const slug = applicationSlug(params.slug, name);

			// Media and content are separate stores. The engine has no file field
			// type, so the link between the two is the text column below and
			// nothing else: deleting the media record leaves the id behind.
			const created = await createContent(lyeve, {
				schema: APPLICATIONS,
				slug,
				title: `${name} for ${listing.data.title}`,
				body: {
					slug,
					applicant_name: name,
					applicant_email: email,
					cover_letter: letter,
					cv_media_id: media.id,
					// Relations are written under the field name and read back as
					// `<field>_id`.
					listing: listing.id
				},
				// An application is inbound data, not something this board
				// publishes. Nothing in the app reads it back.
				status: 'draft'
			});

			return { submitted: true, reference: reference(created.id) };
		} catch (err) {
			return fail(502, { ...values, error: submitError(err) });
		}
	}
};

/** A short, quotable handle for the applicant. The full id stays internal. */
function reference(id: unknown): string {
	const text = typeof id === 'string' ? id.replace(/-/g, '') : '';
	return text ? text.slice(0, 8).toUpperCase() : 'RECEIVED';
}

function field(form: FormData, key: string): string {
	const value = form.get(key);
	return typeof value === 'string' ? value.trim() : '';
}

function checkCv(cv: File): string | null {
	if (cv.size === 0) return 'Attach your CV as a PDF or a Word document.';
	if (cv.size > MAX_CV_BYTES) return 'That CV is over 4 MB. Send a smaller file.';

	const name = cv.name.toLowerCase();
	const looksRight = CV_TYPES.includes(cv.type) || CV_EXTENSIONS.some((ext) => name.endsWith(ext));
	// Browsers sometimes send no content type at all, so the extension is the
	// fallback rather than the primary check.
	if (!looksRight) return 'CVs are accepted as PDF, DOC or DOCX.';
	return null;
}

function safeFilename(name: string): string {
	const cleaned = name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[-.]+/, '');
	return cleaned.slice(-80) || 'cv.pdf';
}

function applicationSlug(listingSlug: string, name: string): string {
	// Two people with the same name can apply for the same role, so the slug
	// carries a timestamp. The engine rejects control characters and % in a
	// slug, and slugify only ever emits a-z, 0-9 and hyphens.
	return `${listingSlug}-${slugify(name)}-${Date.now().toString(36)}`.slice(0, 200);
}

function safeUrl(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	return /^https?:\/\//i.test(value) ? value : null;
}

/**
 * A rejection the applicant caused is worth showing. Anything else is an
 * engine-side failure, and its text is for the log rather than the page.
 */
function submitError(err: unknown): string {
	if (err instanceof LyeveError && [400, 413, 422].includes(err.status)) return err.message;
	console.error('application submit failed', err);
	return 'The application could not be recorded. Try again in a moment.';
}
