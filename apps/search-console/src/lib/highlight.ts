/**
 * Splits an engine snippet into plain and highlighted segments.
 *
 * `highlight=true` asks Postgres for a headline, and the markers it returns are
 * the literal strings `<mark>` and `</mark>` inside a string that is otherwise
 * unescaped document text. Rendering that string as HTML would work and would
 * also make every article body a script injection vector, so it is parsed here
 * and rendered as text with real elements instead.
 */
export interface Segment {
	text: string;
	mark: boolean;
}

export function segments(snippet: string): Segment[] {
	const out: Segment[] = [];
	let rest = snippet;

	while (rest.length > 0) {
		const open = rest.indexOf('<mark>');
		if (open === -1) {
			out.push({ text: rest, mark: false });
			break;
		}
		if (open > 0) out.push({ text: rest.slice(0, open), mark: false });

		const after = rest.slice(open + '<mark>'.length);
		const close = after.indexOf('</mark>');
		if (close === -1) {
			out.push({ text: after, mark: true });
			break;
		}
		out.push({ text: after.slice(0, close), mark: true });
		rest = after.slice(close + '</mark>'.length);
	}

	return out.filter((segment) => segment.text.length > 0);
}
