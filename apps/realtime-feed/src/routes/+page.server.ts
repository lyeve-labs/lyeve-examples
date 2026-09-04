import { loadBoard } from '$lib/server/board';
import type { PageServerLoad } from './$types';

/**
 * The board is rendered on the server, in full, on every load.
 *
 * The stream is an accelerator on top of this, not the source of it. A browser
 * with JavaScript off, or one that missed events while the tab was asleep, sees
 * a correct board here and nothing else has to be true for that to work.
 */
export const load: PageServerLoad = async () => loadBoard();
