import type { ParamMatcher } from '@sveltejs/kit';
import { isLocale } from '$lib/locales';

/**
 * Keeps `/[locale]` from swallowing every other top-level path.
 *
 * Without the matcher `/translations` and `/favicon.ico` both look like a
 * locale, and the first one only works because static segments win the routing
 * tie. Naming the accepted set makes an unknown locale a 404 instead of a page
 * that renders in the default language and lies about which language it is in.
 */
export const match: ParamMatcher = (param) => isLocale(param);
