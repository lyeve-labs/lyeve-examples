import { redirect } from '@sveltejs/kit';
import { DEFAULT_LOCALE } from '$lib/locales';
import type { PageServerLoad } from './$types';

/**
 * Every page of this site lives under a locale, so the bare root has to choose
 * one. It chooses the default rather than reading Accept-Language: the header
 * would have to be honored here and nowhere else, because the engine's own
 * locale middleware is never installed, and a redirect that varies by header
 * cannot be cached by URL.
 */
export const load: PageServerLoad = () => {
	redirect(307, `/${DEFAULT_LOCALE}`);
};
