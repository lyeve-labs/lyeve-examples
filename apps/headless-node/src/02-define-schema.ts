/**
 * Step 2. Define the content types.
 *
 *   pnpm define-schema
 *
 * A content type is a JSON document you POST to /api/admin/schemas. The engine
 * turns it into a real table with real columns, so the definition is a
 * migration and it deserves to live in version control next to the code that
 * reads it. This script is that file.
 *
 * Safe to run repeatedly. Applying a type that already exists is accepted.
 */
import type { Schema, SchemaField } from '@lyeve-labs/client';
import { getSchemas, upsertSchema } from '@lyeve-labs/client-rest';
import {
	ARTICLES, AUTHORS, belongsTo, heading, note, row, run, section, signIn, signedInClient, waitForSchema
} from './lyeve.ts';

/** A plain field. The key is field_type, never type. */
function field(name: string, fieldType: SchemaField['field_type'], options: Partial<SchemaField> = {}): SchemaField {
	return { name, field_type: fieldType, required: false, unique: false, indexed: false, ...options };
}

const authors: Schema = {
	name: AUTHORS,
	display_name: 'Headless Authors',
	with_created_at: true,
	with_updated_at: true,
	fields: [
		field('title', 'text', { required: true }),
		field('slug', 'text', { required: true, indexed: true }),
		field('bio', 'text')
	]
};

const articles: Schema = {
	name: ARTICLES,
	display_name: 'Headless Articles',
	with_created_at: true,
	with_updated_at: true,
	fields: [
		field('title', 'text', { required: true }),
		field('slug', 'text', { required: true, indexed: true }),
		field('summary', 'text'),
		field('body', 'text'),
		field('read_minutes', 'number'),
		// The media id, not a URL. Step 6 explains why a stored URL would be a
		// broken image in any browser that received it.
		field('cover_media_id', 'text'),
		belongsTo('author', AUTHORS)
	]
};

await run(async () => {
	heading('02  Define the content types');

	const client = signedInClient(await signIn());

	section('What already exists');
	const before = await getSchemas(client);
	row('types on this engine', before.length);
	row('ours', before.filter((s) => s.name.startsWith('headless_')).map((s) => s.name).join(', ') || '(none yet)');

	section('Apply');
	// Order is not cosmetic. The relation on articles emits a foreign key
	// against the authors table, so authors has to exist first or the apply
	// fails on a missing reference.
	for (const definition of [authors, articles]) {
		const applied = await upsertSchema(definition, client);
		await waitForSchema(client, definition.name);

		const returned = applied.fields;
		row(definition.name, `${definition.fields.length} fields sent, ${returned.length} returned`);
		row('  added by the engine', returned.filter((f) => f.system).map((f) => f.name).join(', ') || '(none)');
	}

	section('What the shape of that response tells you');
	note('The apply answers 200, not 201, and it answers with the type the engine built, not the one you sent.');
	note('It adds id, created_at and updated_at as system fields. Diffing your definition against the response never matches.');
	note('A default on a field is accepted and then ignored. No DEFAULT clause is emitted, so set the value when you write.');
	note('The relation came back as a pair: the author field you sent, plus a system author_id. Reads expose the second one.');
	note('The relation is declared optional on purpose. A required relation makes every insert into the type fail with a 422.');
	note('A type stays invisible to the v1 router for about a quarter of a second after the apply returns, which is why this waits.');
});
