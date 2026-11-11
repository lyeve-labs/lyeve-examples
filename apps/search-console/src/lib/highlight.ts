/**
 * Splits an engine snippet into plain and highlighted segments.
 *
 * `highlight=true` returns each snippet as HTML: the document text is escaped,
 * and the only live tags are the `<mark>` and `</mark>` pairs around each match.
 * The page could render it as HTML, but parsing it keeps the page free of raw
 * HTML rendering. The snippet is split on the mark tags, and each piece has its
 * entities decoded and is rendered as text, so `&lt;b&gt;` reads as `<b>` and
 * never becomes an element.
 */
export interface Segment {
	text: string;
	mark: boolean;
}

const named = new Map([
	['amp', '&'],
	['lt', '<'],
	['gt', '>'],
	['quot', '"'],
	['apos', "'"],
]);

/** Decodes the entities an HTML escaper writes, in one pass. */
export function decodeEntities(text: string): string {
	return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity, body: string) => {
		if (body[0] === '#') {
			const hex = body[1] === 'x' || body[1] === 'X';
			const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
			return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
		}
		return named.get(body.toLowerCase()) ?? entity;
	});
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

	return out
		.map((segment) => ({ text: decodeEntities(segment.text), mark: segment.mark }))
		.filter((segment) => segment.text.length > 0);
}
