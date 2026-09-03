/**
 * Constants the pages and the crawler routes share.
 *
 * Nothing here touches the engine, so it is safe to import from a component.
 * Basalt Networks is invented for this example.
 */
export const COMPANY = {
	name: 'Basalt Networks',
	tagline: 'Dedicated network fabric and managed Postgres for teams that cannot run on shared tenancy.',
	foundedIn: 2019,
	headquarters: 'Amsterdam'
};

export const NAV = [
	{ href: '/about', label: 'About' },
	{ href: '/careers', label: 'Careers' },
	{ href: '/security-and-compliance', label: 'Security' },
	{ href: '/contact', label: 'Contact' }
];

/** Splits a stored body into paragraphs. Bodies are written with blank lines between them. */
export function paragraphs(body: string): string[] {
	return body
		.split('\n\n')
		.map((p) => p.trim())
		.filter(Boolean);
}

/**
 * The route a page slug is served from.
 *
 * Two pages have hand-written routes because they render more than their own
 * body: home fronts the careers teaser, and about renders the team. Everything
 * else falls through to /[slug]. The sitemap and the footer both need to agree
 * with the router, so the mapping lives in one place.
 */
export function pagePath(slug: string): string {
	if (slug === 'home') return '/';
	if (slug === 'about') return '/about';
	return `/${slug}`;
}
