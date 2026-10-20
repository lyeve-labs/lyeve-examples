/**
 * Fails when the apps disagree on the ui-kit range. A caret range on a 0.x
 * version never crosses a minor, so an app left behind on a bump stays on
 * the older kit and nothing else would say so.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const KIT = '@lyeve-labs/ui-kit';
const ranges = new Map();
for (const app of readdirSync('apps').sort()) {
	const file = join('apps', app, 'package.json');
	if (!existsSync(file)) continue;
	const pkg = JSON.parse(readFileSync(file, 'utf8'));
	const range = pkg.dependencies?.[KIT] ?? pkg.devDependencies?.[KIT];
	if (!range) continue;
	ranges.set(range, [...(ranges.get(range) ?? []), app]);
}
if (ranges.size > 1) {
	for (const [range, apps] of ranges) console.error(`FAIL  ${KIT} ${range}: ${apps.join(', ')}`);
	process.exit(1);
}
const [[range, apps] = ['none', []]] = ranges;
console.log(`ok    ${apps.length} apps declare ${KIT} ${range}`);
