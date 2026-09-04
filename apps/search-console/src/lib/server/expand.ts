/**
 * Applies a synonym group to a query, because the engine does not.
 *
 * The plugin stores synonym groups, serves four routes for managing them, and
 * has a helper that rewrites a query into `term OR synonym OR synonym`. Nothing
 * calls that helper. The native search builds its SQL straight from the request,
 * so a group can be created, listed and deleted without ever changing a result.
 *
 * This app therefore reads the groups and does the rewrite itself, which is what
 * makes a synonym visible. The matching rule deliberately copies the unused
 * helper: the whole query must equal the base term, not contain it, because that
 * is the lookup the plugin would have done. It is a narrow rule, and it is the
 * one the stored data was shaped for, since base_term is a single indexed column
 * with a unique constraint rather than a pattern.
 *
 * `OR` is understood by the Postgres query parser the engine uses, so the
 * rewritten string needs no other support. On MySQL and MSSQL search is a LIKE
 * over the whole phrase and the rewrite would match nothing, which is the reason
 * this is presented as an app-level feature rather than a portable one.
 */
import type { SynonymGroup } from './search';

export interface Expansion {
	/** What to send to the engine. */
	query: string;
	/** The group that was applied, or null when nothing matched. */
	applied: SynonymGroup | null;
}

export function expandQuery(query: string, groups: SynonymGroup[]): Expansion {
	const term = query.trim().toLowerCase();
	if (!term) return { query, applied: null };

	const group = groups.find((candidate) => candidate.base_term.trim().toLowerCase() === term);
	if (!group || group.synonyms.length === 0) return { query, applied: null };

	const parts = [query.trim(), ...group.synonyms.map((synonym) => synonym.trim()).filter(Boolean)];
	return { query: parts.join(' OR '), applied: group };
}
