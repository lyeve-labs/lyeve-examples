export interface ProseBlock {
	kind: 'text' | 'code';
	text: string;
}

/**
 * Splits a stored body into paragraphs and code blocks.
 *
 * A text field is stored and returned verbatim, so every formatting
 * convention belongs to the application. This one is deliberately small:
 * a blank line ends a block, and a block indented by four spaces is code.
 */
export function toBlocks(body: string): ProseBlock[] {
	return body
		.split(/\n{2,}/)
		.map((block) => block.replace(/\s+$/, ''))
		.filter((block) => block.length > 0)
		.map((block) =>
			block.startsWith('    ')
				? { kind: 'code' as const, text: stripIndent(block) }
				: { kind: 'text' as const, text: block }
		);
}

/** First sentences of a body, for a search result or a card. */
export function excerpt(body: string, limit = 180): string {
	const [first = ''] = body.split(/\n{2,}/);
	const flat = first.replace(/\s+/g, ' ').trim();
	if (flat.length <= limit) return flat;
	const cut = flat.slice(0, limit);
	const lastSpace = cut.lastIndexOf(' ');
	return `${cut.slice(0, lastSpace > 40 ? lastSpace : cut.length)}...`;
}

function stripIndent(block: string): string {
	return block
		.split('\n')
		.map((line) => line.replace(/^ {4}/, ''))
		.join('\n');
}
