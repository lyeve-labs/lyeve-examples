/**
 * A count of the clicks this process has reported to the engine.
 *
 * It exists because the engine will not tell us. `POST
 * /api/admin/search/analytics/click` writes `clicked_entry_id` onto an
 * analytics row, and no read route returns that column: the summary reports
 * total searches, unique queries, average result count, average duration, the
 * top twenty queries and the zero-result percentage, and nothing about clicks.
 * There is no route that lists raw analytics rows either. So a click-through
 * rate is not obtainable from this API, and the console says so rather than
 * showing a plausible number.
 *
 * This tally is the app's own record of what it sent, held in memory. It is
 * lost on restart, it is per process, and it is not what the engine holds. It
 * is here to make the gap concrete rather than to stand in for the missing
 * read.
 */
interface Tally {
	searchesLogged: number;
	clicksReported: number;
	lastQuery: string | null;
	lastAt: string | null;
}

const tally: Tally = {
	searchesLogged: 0,
	clicksReported: 0,
	lastQuery: null,
	lastAt: null
};

export function recordLoggedSearch(query: string): void {
	tally.searchesLogged++;
	tally.lastQuery = query;
	tally.lastAt = new Date().toISOString();
}

export function recordReportedClick(): void {
	tally.clicksReported++;
}

export function reportedTally(): Tally {
	return { ...tally };
}
