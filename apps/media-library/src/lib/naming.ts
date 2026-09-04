/**
 * The names this app uses, and the rules behind them.
 *
 * Kept clear of `$lib/server` and of SvelteKit's environment modules so that
 * `setup/provision.ts` can import the same definitions with a relative path.
 * The alternative is restating the slug prefixes in the seed script, which is
 * exactly how a seeded slug and a routed slug drift apart.
 */

export const ALBUMS = 'gallery_albums';
export const PHOTOS = 'gallery_photos';

/**
 * Content entry slugs are unique per tenant across every content type, with no
 * schema in the index, so a bare `harbour-in-fog` would be blocked by any other
 * example that wanted the same words. Every slug this app writes carries a
 * prefix, and the URL segment is the slug with the prefix removed, so the
 * addresses stay readable without the stored slug claiming a common word.
 */
export const ALBUM_SLUG_PREFIX = 'gallery-';
export const PHOTO_SLUG_PREFIX = 'gallery-photo-';

export function albumSlug(segment: string): string {
	return `${ALBUM_SLUG_PREFIX}${segment}`;
}

export function albumSegment(slug: string): string {
	return slug.startsWith(ALBUM_SLUG_PREFIX) ? slug.slice(ALBUM_SLUG_PREFIX.length) : slug;
}

export function photoSlug(segment: string): string {
	return `${PHOTO_SLUG_PREFIX}${segment}`;
}

export function photoSegment(slug: string): string {
	return slug.startsWith(PHOTO_SLUG_PREFIX) ? slug.slice(PHOTO_SLUG_PREFIX.length) : slug;
}

/**
 * The storage folder an album's originals are written under.
 *
 * The media plugin validates a folder against `[a-z0-9_/-]` and rejects
 * anything else outright, so an album segment carrying a capital letter would
 * fail the upload with a 400 naming the character. Album segments are lower
 * case for that reason and not only for tidiness.
 */
export function albumFolder(segment: string): string {
	return `gallery/${segment}`;
}

/**
 * The variant presets, hard-coded in the plugin's `defaultThumbnailPresets`.
 *
 * There is no route that lists them and no setting that changes them.
 * `media_thumbnail_format` and `media_thumbnail_quality` decide how a variant
 * is encoded. The three boxes are compiled in.
 */
export const PRESETS = [
	{ name: 'small', width: 150, height: 150 },
	{ name: 'medium', width: 480, height: 480 },
	{ name: 'large', width: 1024, height: 1024 }
] as const;

export type PresetName = (typeof PRESETS)[number]['name'];

/**
 * Whether the processor will decline a preset for a source of this size.
 *
 * The comparison is inclusive in both dimensions, which is the part that
 * surprises people: a 1024x1024 source is not larger than the 1024 box, so it
 * gets no `large` variant, and a 150x150 source gets nothing at all.
 */
export function presetSkipped(
	preset: { width: number; height: number },
	width: number,
	height: number
): boolean {
	return width <= preset.width && height <= preset.height;
}
