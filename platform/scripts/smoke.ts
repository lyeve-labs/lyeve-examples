/**
 * Exercises every helper in @lyeve-examples/lyeve against a live engine.
 * Run with `make smoke`. It is the check that the shared contract still holds
 * before any app is trusted to build on it.
 */
import {
	LyeveClient, applySchemas, belongsTo, listSchemas, listContent,
	getContentBySlug, createContent, search, relationId, related, listMedia
} from '../../packages/lyeve/src/index.ts';
import { getSchemas } from '@lyeve-labs/client-rest';

const client = new LyeveClient({
	apiUrl: process.env.LYEVE_API_URL!,
	adminUrl: process.env.LYEVE_ADMIN_URL!,
	email: process.env.LYEVE_EMAIL!,
	password: process.env.LYEVE_PASSWORD!
});

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
	console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
	if (!ok) failures++;
}

const suffix = process.env.SMOKE_SUFFIX ?? 'smoke';
const AUTHORS = `smoke_authors_${suffix}`;
const POSTS = `smoke_posts_${suffix}`;

await applySchemas(client, [
	{
		name: AUTHORS,
		display_name: 'Smoke Authors',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true }
		]
	},
	{
		name: POSTS,
		display_name: 'Smoke Posts',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'excerpt', field_type: 'text' },
			belongsTo('author', AUTHORS)
		]
	}
]);
check('applySchemas creates both types', (await listSchemas(client)).some((s) => s.name === POSTS));

const author = await createContent(client, {
	schema: AUTHORS,
	slug: `ada-${suffix}`,
	title: 'Ada Lovelace',
	body: { slug: `ada-${suffix}` }
});
check('createContent returns an id', Boolean(author.id), author.id);

await createContent(client, {
	schema: POSTS,
	slug: `first-post-${suffix}`,
	title: 'Enchantress of Number',
	body: { slug: `first-post-${suffix}`, excerpt: 'On the analytical engine.', author: author.id }
});

const listed = await listContent(client, POSTS, { limit: 5 });
check('listContent honors a limit below the engine floor', listed.length <= 5, `got ${listed.length}`);

const bySlug = await getContentBySlug(client, POSTS, `first-post-${suffix}`, { populate: ['author'] });
check('getContentBySlug finds the entry', bySlug !== null);
check('relationId reads the relation', relationId(bySlug?.data ?? {}, 'author') === author.id);
check('related reads the populated object',
	(related<{ title: string }>(bySlug?.data ?? {}, 'author')?.title) === 'Ada Lovelace');

const found = await search(client, 'Enchantress', { limit: 5 });
check('admin-written content is searchable', found.total > 0, `total=${found.total}`);
check('empty query short-circuits', (await search(client, '  ')).total === 0);
// Asserting only the shape here passed against a broken listMedia that always
// returned an empty array, because an empty array is an array. The count is
// what bites: the media route answers an envelope, not a bare list, and reading
// it as a list silently found nothing.
// The point of building on the SDK: any client-rest function takes the
// client's own HttpClient, so an app is not limited to the helpers here.
const sdkSchemas = await getSchemas(client.admin);
check('a client-rest function works with client.admin', Array.isArray(sdkSchemas) && sdkSchemas.length > 0,
	`${sdkSchemas.length} schemas via @lyeve-labs/client-rest`);

const media = await listMedia(client, { limit: 25 });
check('listMedia reads the envelope', Array.isArray(media.items) && typeof media.total === 'number');
check('listMedia sees the media that exists', media.total === 0 || media.items.length > 0,
	`total=${media.total} items=${media.items.length}`);

// Leave nothing behind, or every run adds another schema pair to the engine.
for (const name of [POSTS, AUTHORS]) {
	try {
		await client.request('admin', `/api/admin/schemas/${name}`, { method: 'DELETE' });
	} catch (err) {
		console.log(`warn  could not remove ${name}: ${(err as Error).message}`);
	}
}

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
