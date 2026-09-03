import { pages, openings } from '$lib/server/site';
import { pagePath } from '$lib/site';
import type { RequestHandler } from './$types';

interface Entry {
	path: string;
	lastmod: string;
	changefreq: string;
	priority: string;
}

/**
 * The sitemap, built from this app's own content.
 *
 * The flow plugin's seo-sitemap template can answer one from a pages type, but
 * it has no idea which routes this app decided to serve its content from. A
 * sitemap that disagrees with the router is worse than none, so it is generated
 * from the same functions the pages render from. The README says more.
 */
export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const [allPages, roles] = await Promise.all([pages(), openings()]);

	const entries: Entry[] = [
		{ path: '/careers', lastmod: today(), changefreq: 'daily', priority: '0.8' },
		{ path: '/contact', lastmod: today(), changefreq: 'yearly', priority: '0.5' }
	];

	for (const p of allPages) {
		entries.push({
			path: pagePath(p.slug),
			lastmod: day(p.updatedAt),
			changefreq: 'monthly',
			priority: p.slug === 'home' ? '1.0' : '0.7'
		});
	}

	for (const role of roles) {
		entries.push({
			path: `/careers/${role.slug}`,
			lastmod: day(role.updatedAt),
			changefreq: 'weekly',
			priority: '0.6'
		});
	}

	// Team members are rendered inside /about and have no page of their own, so
	// they are deliberately absent. A URL in a sitemap that redirects or 404s
	// costs crawl budget on every sweep.

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((e) => urlNode(e, url.origin)).join('\n')}
</urlset>
`;

	setHeaders({
		'content-type': 'application/xml; charset=utf-8',
		'cache-control': 'public, max-age=3600'
	});
	return new Response(body);
};

function urlNode(entry: Entry, origin: string): string {
	return [
		'  <url>',
		`    <loc>${escapeXml(new URL(entry.path, origin).href)}</loc>`,
		`    <lastmod>${entry.lastmod}</lastmod>`,
		`    <changefreq>${entry.changefreq}</changefreq>`,
		`    <priority>${entry.priority}</priority>`,
		'  </url>'
	].join('\n');
}

function day(timestamp: string): string {
	const d = new Date(timestamp);
	return Number.isNaN(d.getTime()) ? today() : d.toISOString().slice(0, 10);
}

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

/** Slugs are tame, but a loc is untrusted the moment an editor can type one. */
function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}
