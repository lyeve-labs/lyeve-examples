/**
 * Creates the documentation portal content types and seeds two spaces.
 *
 * Safe to run more than once: applying a schema that exists is accepted, and
 * seeding stops if the portal already has a space.
 */
import {
	lyeveFromEnv, applySchemas, belongsTo, listContent, createContent
} from '../src/lib/lyeve/index.ts';

const client = lyeveFromEnv();

const SPACES = 'docs_spaces';
const PAGES = 'docs_pages';

// Spaces first: a relation emits a foreign key against the target generated
// table, so docs_spaces has to exist before docs_pages points at it. The
// parent relation points docs_pages at itself, which needs no such ordering:
// the engine creates the table and then adds the foreign key to it.
await applySchemas(client, [
	{
		name: SPACES,
		display_name: 'Documentation Spaces',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'summary', field_type: 'text' },
			{ name: 'order_index', field_type: 'number' }
		]
	},
	{
		name: PAGES,
		display_name: 'Documentation Pages',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'body', field_type: 'text' },
			{ name: 'order_index', field_type: 'number' },
			belongsTo('space', SPACES),
			belongsTo('parent', PAGES)
		]
	}
]);
console.log('content types ready');

if ((await listContent(client, SPACES, { limit: 25 })).length > 0) {
	console.log('guide already seeded, nothing to do');
	process.exit(0);
}

interface SeedSpace {
	slug: string;
	title: string;
	summary: string;
	order: number;
}

interface SeedPage {
	space: string;
	slug: string;
	title: string;
	order: number;
	parent: string | null;
	body: string;
}

const spaces: SeedSpace[] = [
	{
		slug: 'getting-started',
		title: 'Getting Started',
		summary: 'Boot the engine, model a content type, and write a record the whole product can see.',
		order: 1
	},
	{
		slug: 'api-reference',
		title: 'API Reference',
		summary: 'The routes this portal calls, the parameters the engine honors, and the ones it ignores.',
		order: 2
	}
];

// Parents are listed before their children so the seed can resolve a parent id
// from the rows it has already written.
const pages: SeedPage[] = [
	{
		space: 'getting-started',
		slug: 'installation',
		title: 'Installation',
		order: 1,
		parent: null,
		body: [
			'The engine is a single Go binary. It needs a PostgreSQL, MySQL or SQL Server database, a writable directory for its signing key, and nothing else.',
			'Two listeners are configured separately. ADMIN_LISTEN_ADDR carries schemas, content writes, search and media. API_LISTEN_ADDR carries public content reads and the token endpoint. Most deployments put only the second one on a public network.',
			'Set JWT_KEY_PATH to a directory the process can write to. Left at its default, the engine logs a permission error at boot and falls back to a shared secret signing algorithm, which is easy to miss because the rest of startup looks normal.'
		].join('\n\n')
	},
	{
		space: 'getting-started',
		slug: 'run-with-docker',
		title: 'Run with Docker',
		order: 1,
		parent: 'installation',
		body: [
			'The engine and the admin interface ship as separate images. Run the engine with a database URL and the two listen addresses bound to the interfaces you want.',
			'    docker run -p 4401:4401 -p 4402:4402 \\\n      -e DATABASE_URL=postgres://lyeve:lyeve@db:5432/lyeve \\\n      -e ADMIN_LISTEN_ADDR=:4401 -e API_LISTEN_ADDR=:4402 \\\n      -e JWT_KEY_PATH=/var/lib/lyeve ghcr.io/lyeve-labs/lyeve-core',
			'Migrations run at boot. The first process to start takes a lock, applies whatever is outstanding and releases it, so several replicas starting at once is safe.',
			'Mount a volume for the signing key. Without one, every restart mints a new key pair and invalidates every token issued before it.'
		].join('\n\n')
	},
	{
		space: 'getting-started',
		slug: 'build-from-source',
		title: 'Build from Source',
		order: 2,
		parent: 'installation',
		body: [
			'The command directory is its own Go module, so build it from there rather than from the repository root.',
			'    go build -o bin/lyeve ./cmd/lyeve',
			'The license public key is linked into the binary with -ldflags. A build without it starts and serves at the free tier, and its log says that no public key was linked.',
			'That the key is a link time value rather than a setting is deliberate. A license is a property of the artifact, so no environment variable can widen what a binary is entitled to run.'
		].join('\n\n')
	},
	{
		space: 'getting-started',
		slug: 'first-content-type',
		title: 'Your First Content Type',
		order: 2,
		parent: null,
		body: [
			'A content type is a JSON document posted to the schemas route. Each field carries a name and a field_type. The key is field_type and nothing else: a request that spells it type leaves the type empty, and the field lands as text.',
			'    POST /api/admin/schemas\n    {"name":"docs_pages","fields":[{"name":"title","field_type":"text","required":true}]}',
			'Applying a type generates a table named after it and answers 200 rather than 201. The response is not the document you sent. The engine injects its own system fields for the identifier and the timestamps, so comparing the response to your definition always reports differences that are not real.',
			'A default declared on a field is accepted and then ignored. No DEFAULT clause reaches the table, so set the value when you write the record.'
		].join('\n\n')
	},
	{
		space: 'getting-started',
		slug: 'writing-content',
		title: 'Writing Content',
		order: 3,
		parent: null,
		body: [
			'There are two write paths and they are not interchangeable. The admin content route records the entry, indexes it for search and mirrors it into the generated table. The public content route writes only the table.',
			'Content written the second way reads back correctly over the public API and stays invisible to search and to the admin interface for the rest of its life. Nothing reports this. Search returns a perfectly ordinary empty result.',
			'The admin route wants the title twice, once at the top level and once inside the body, because the body is validated against the fields of the type it names.',
			'    POST /api/admin/content\n    {"schema":"docs_pages","slug":"installation","title":"Installation",\n     "body":{"title":"Installation","slug":"installation"},"status":"published"}'
		].join('\n\n')
	},
	{
		space: 'getting-started',
		slug: 'draft-and-published',
		title: 'Draft and Published',
		order: 1,
		parent: 'writing-content',
		body: [
			'Status defaults to draft. Only an admin or a super admin may create an entry that is already published.',
			'On a type created with draft and publish support, a list response carries published rows only unless the caller asks for another status explicitly.',
			'Publishing does not overwrite history. Every write records a revision and the entry keeps a pointer to the current one, so a rollback is a read of an older revision rather than a restore from a backup.'
		].join('\n\n')
	},
	{
		space: 'getting-started',
		slug: 'authentication',
		title: 'Authentication',
		order: 4,
		parent: null,
		body: [
			'The token route exchanges an email and a password for a bearer token. It is one of the few routes that answers without one. The health and readiness probes are the others.',
			'There is no anonymous read. Every content route requires a token, including a list of published pages, so a browser cannot call the engine directly and a public site has to put a server in front of it. This portal is that server: the browser talks to SvelteKit, and only SvelteKit holds the credential.',
			'Point a load balancer at /readyz. The route named /api/v1/health sounds public and is not.'
		].join('\n\n')
	},
	{
		space: 'getting-started',
		slug: 'token-lifetime',
		title: 'Token Lifetime',
		order: 1,
		parent: 'authentication',
		body: [
			'A token lasts fifteen minutes by default, and the ceiling in production is one hour.',
			'The API router wires no refresh store, so a long lived server side client authenticates again rather than refreshing. Coalescing those logins is worth the few lines it takes, because the auth route is rate limited and a cold cache can otherwise send a burst of identical requests at it.',
			'Tokens are signed with Ed25519 and carry a key id. A service that only needs to verify one can read the public key from the JWKS endpoint instead of holding a shared secret.'
		].join('\n\n')
	},
	{
		space: 'api-reference',
		slug: 'content-api',
		title: 'Content API',
		order: 1,
		parent: null,
		body: [
			'Reads live on the public router under /api/v1/content/{type}. Writes live on the admin router. The split is the reason an application configures two base URLs rather than one.',
			'A list response is a bare JSON array. There is no envelope, no total and no cursor, so a caller that needs a count reads the rows and counts them.',
			'Unknown query parameters are ignored rather than rejected. A misspelled filter name is a 400, but a misspelled parameter name is a 200 and a full unfiltered page.'
		].join('\n\n')
	},
	{
		space: 'api-reference',
		slug: 'list-entries',
		title: 'List Entries',
		order: 1,
		parent: 'content-api',
		body: [
			'    GET /api/v1/content/docs_pages?limit=200&filters[space_id]=<uuid>',
			'The limit is clamped to the range 25 to 200. A request for three rows returns twenty five, so a short list is a slice in the caller rather than a smaller request.',
			'A filter is exact equality. There are no operators, no ranges, no partial matches and no OR, and a filter naming a column the type does not have is rejected.',
			'Rows come back newest first, ordered by the time they were created. There is no sort parameter. Any other order is applied after the response arrives, which also means it can only order the rows that response contained.'
		].join('\n\n')
	},
	{
		space: 'api-reference',
		slug: 'create-an-entry',
		title: 'Create an Entry',
		order: 2,
		parent: 'content-api',
		body: [
			'The admin content route takes the type name, a slug, a title, and a body holding every field of the type.',
			'The slug is required and normalized. Control characters and percent signs are rejected outright.',
			'Validation failures come back as a list of field errors with no top level error key, which catches out clients that parse one error shape for every failure.',
			'    {"errors":[{"field":"slug","message":"is required","code":"required"}]}'
		].join('\n\n')
	},
	{
		space: 'api-reference',
		slug: 'reading-relations',
		title: 'Reading Relations',
		order: 3,
		parent: 'content-api',
		body: [
			'A belongs_to relation is written under its own name and read back under name_id. The response also carries the bare name set to null unless the request asked for it to be populated, so reading the field you wrote gives you null every time.',
			'    populate=space   inflates one relation into the whole related record\n    depth=1          does the same for every relation on the type',
			'Populating costs a read per relation per row, so a hundred rows with two populated relations is two hundred extra queries. This portal populates nothing: it reads the parent id, which is all a tree needs, and resolves the links in memory.',
			'Declare every relation optional. A required belongs_to generates a second unused column that is NOT NULL, the write path never fills it, and every insert against the type then fails validation.'
		].join('\n\n')
	},
	{
		space: 'api-reference',
		slug: 'search-api',
		title: 'Search API',
		order: 2,
		parent: null,
		body: [
			'    GET /api/admin/search?q=relations&schema=docs_pages&limit=20',
			'Search runs over recorded entries rather than the generated tables, so it sees exactly the content that was written through the admin content route and nothing else.',
			'A hit carries the entry id, the slug, the title and the body as it was stored. The body is the write shape, which is why a relation appears there under its own name while a content read returns it under name_id.',
			'There is no public search route. A search box on a public site is a request to your own server, which holds the credential and forwards the query.'
		].join('\n\n')
	},
	{
		space: 'api-reference',
		slug: 'media-api',
		title: 'Media API',
		order: 3,
		parent: null,
		body: [
			'An upload is a multipart request with the file under the field name file, and the answer is a JSON array even for a single file.',
			'A media record carries a storage key and no public URL. The bytes come from the download route, which requires a bearer token like everything else.',
			'An image tag pointed at that route shows a broken image, because the browser has no token to send. Serve media from a route of your own and let the server hold the credential. This portal proxies uploads at /media/{id} for exactly that reason.'
		].join('\n\n')
	}
];

const spaceIds: Record<string, string> = {};
for (const space of spaces) {
	const { id } = await createContent(client, {
		schema: SPACES,
		slug: space.slug,
		title: space.title,
		body: { slug: space.slug, summary: space.summary, order_index: space.order }
	});
	spaceIds[space.slug] = id;
}

const pageIds: Record<string, string> = {};
for (const page of pages) {
	const parentId = page.parent ? pageIds[page.parent] : null;
	if (page.parent && !parentId) {
		throw new Error(`page "${page.slug}" names a parent that has not been written yet: ${page.parent}`);
	}

	const { id } = await createContent(client, {
		schema: PAGES,
		slug: page.slug,
		title: page.title,
		body: {
			slug: page.slug,
			body: page.body,
			order_index: page.order,
			// A relation is written under its own name and read back as
			// <field>_id. A page with no parent omits the key rather than
			// sending null, and the tree treats it as a root.
			space: spaceIds[page.space],
			...(parentId ? { parent: parentId } : {})
		}
	});
	pageIds[page.slug] = id;
}

console.log(`seeded ${spaces.length} spaces and ${pages.length} pages`);
