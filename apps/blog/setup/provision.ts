/**
 * Creates the blog's content types and seeds them.
 *
 * Safe to run more than once: applying a schema that exists is accepted, and
 * seeding stops if the blog already has posts.
 */
import {
	lyeveFromEnv, applySchemas, belongsTo, listContent, createContent
} from '../src/lib/lyeve/index.ts';

const client = lyeveFromEnv();

const AUTHORS = 'blog_authors';
const CATEGORIES = 'blog_categories';
const POSTS = 'blog_posts';

// Order matters: a relation emits a foreign key against the target's generated
// table, so authors and categories must exist before posts references them.
await applySchemas(client, [
	{
		name: AUTHORS,
		display_name: 'Authors',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'bio', field_type: 'text' }
		]
	},
	{
		name: CATEGORIES,
		display_name: 'Categories',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true }
		]
	},
	{
		name: POSTS,
		display_name: 'Posts',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'excerpt', field_type: 'text' },
			{ name: 'body', field_type: 'text' },
			{ name: 'cover_media_id', field_type: 'text' },
			belongsTo('author', AUTHORS),
			belongsTo('category', CATEGORIES)
		]
	}
]);
console.log('content types ready');

if ((await listContent(client, POSTS, { limit: 25 })).length > 0) {
	console.log('posts already seeded, nothing to do');
	process.exit(0);
}

const authors = [
	{ slug: 'ada-lovelace', title: 'Ada Lovelace', bio: 'Wrote the first algorithm intended for a machine.' },
	{ slug: 'grace-hopper', title: 'Grace Hopper', bio: 'Built the first compiler and argued for machine-independent languages.' }
];
const categories = [
	{ slug: 'engineering', title: 'Engineering' },
	{ slug: 'history', title: 'History' }
];

const authorIds: Record<string, string> = {};
for (const author of authors) {
	const { id } = await createContent(client, {
		schema: AUTHORS, slug: author.slug, title: author.title,
		body: { slug: author.slug, bio: author.bio }
	});
	authorIds[author.slug] = id;
}

const categoryIds: Record<string, string> = {};
for (const category of categories) {
	const { id } = await createContent(client, {
		schema: CATEGORIES, slug: category.slug, title: category.title,
		body: { slug: category.slug }
	});
	categoryIds[category.slug] = id;
}

const posts = [
	{
		slug: 'notes-on-the-analytical-engine',
		title: 'Notes on the Analytical Engine',
		category: 'history',
		author: 'ada-lovelace',
		excerpt: 'The engine weaves algebraic patterns the way the Jacquard loom weaves flowers.',
		body: 'The Analytical Engine has no pretensions whatever to originate anything. It can do whatever we know how to order it to perform.\n\nIts province is to assist us in making available what we are already acquainted with. This is a distinction worth holding onto, because it separates the machine that calculates from the mind that decides what is worth calculating.\n\nA note appended to a translation turned out to be longer than the translation, which is how most useful work begins.'
	},
	{
		slug: 'the-case-for-a-compiler',
		title: 'The Case for a Compiler',
		category: 'engineering',
		author: 'grace-hopper',
		excerpt: 'Nobody believed a computer could write its own programs, which made it worth doing.',
		body: 'It is easier to apologize than to get permission. That was true of the compiler, which was written on the argument that a machine could translate a symbolic instruction into its own code.\n\nThe objection at the time was not that it would be slow. The objection was that it was impossible, on the grounds that computers did arithmetic and nothing else.\n\nThe answer was to build it and then show people the output.'
	},
	{
		slug: 'why-indexes-are-a-modeling-decision',
		title: 'Why Indexes Are a Modeling Decision',
		category: 'engineering',
		author: 'ada-lovelace',
		excerpt: 'An index is not a performance tweak applied afterwards. It is a claim about how the data will be read.',
		body: 'Declaring a field indexed says something about the questions you expect to ask. A slug is indexed because every page load looks a post up by it; a body is not, because nobody asks for a post by its third paragraph.\n\nGetting this wrong is rarely visible at small volumes. Everything is fast when everything fits in memory, and the missing index only announces itself once the table stops fitting.\n\nThe useful habit is to write the query first and let it tell you what to index.'
	}
];

for (const post of posts) {
	await createContent(client, {
		schema: POSTS,
		slug: post.slug,
		title: post.title,
		body: {
			slug: post.slug,
			excerpt: post.excerpt,
			body: post.body,
			// Relations are written under the field name and read back as
			// `<field>_id`. See docs/VERIFIED-RECIPE.md §6.
			author: authorIds[post.author],
			category: categoryIds[post.category]
		}
	});
}

console.log(`seeded ${authors.length} authors, ${categories.length} categories, ${posts.length} posts`);
