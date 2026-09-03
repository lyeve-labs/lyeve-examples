import type { RequestHandler } from './$types';

/**
 * robots.txt, served by the app.
 *
 * The flow plugin's seo-robots template can answer one from a robots_rules type,
 * which suits a team that edits crawl rules without a deploy. This app owns
 * its rules because the only line that matters is the sitemap pointer, and that
 * has to name a route this app serves.
 */
export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const body = [
		'User-agent: *',
		'Allow: /',
		'',
		`Sitemap: ${new URL('/sitemap.xml', url.origin).href}`,
		''
	].join('\n');

	setHeaders({
		'content-type': 'text/plain; charset=utf-8',
		'cache-control': 'public, max-age=86400'
	});
	return new Response(body);
};
