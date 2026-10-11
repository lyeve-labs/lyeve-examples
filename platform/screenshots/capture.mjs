// Capture a preview of every page of every example, from the running stack.
//
//   make up && make setup && make build && make preview
//   make screenshots                      every app that is being served
//   make screenshots APPS=blog,helpdesk   only these
//
// The served apps come from .stack/preview.pids, which make preview writes, and
// the pages come from each app's src/routes. Each page is saved as
// apps/<app>/screenshots/<name>.webp, with an index.json beside the images that
// says which route and which URL each one shows. The Preview section of the
// app's README and the gallery in docs/PREVIEWS.md are then written from those
// indexes, so the images and the text that describes them cannot drift apart.
//
// A dynamic route has no URL of its own. Rather than invent a slug, the capture
// crawls the app from its home page and takes the first link that fits the
// route, so every image shows a page the seeded content really has. A route
// nothing links to, such as the page a form submission lands on, is reported
// and skipped.
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const APPS = join(REPO, 'apps');
const PIDS = join(REPO, '.stack', 'preview.pids');
const GUIDE = join(REPO, 'docs', 'PREVIEWS.md');

// 1440 by 900 is a common laptop viewport, and rendering it at twice the pixel
// density keeps text sharp when an image is shown large or on a dense screen.
const DESKTOP = { width: 1440, height: 900, scale: 2 };
const PHONE = { width: 390, height: 844, scale: 3 };
const QUALITY = 82;
// The width an image takes in a README grid. Without it a 2880 pixel image
// widens the table past the page, because GitHub sizes a table to its content.
const DESKTOP_WIDTH = 420;
const PHONE_WIDTH = 200;
// How many pages the crawl may fetch per app while it looks for links that fit
// the dynamic routes. Every example's seeded content is reachable well inside it.
const CRAWL_LIMIT = 60;

// A page that shows its useful state only with a query, as a reader would
// arrive at it. The words are ones the seeded content answers.
const QUERIES = {
  blog: { '/search': '?q=engine' },
  'docs-portal': { '/search': '?q=schema' },
  'search-console': { '/': '?q=checkpoint' },
};

// A page left out on purpose, with the reason its README gives. The account
// page prints the license the local stack runs with, and that is a fact about
// one machine, not about the example.
const LEAVE_OUT = {
  'subscription-gating': { '/account': 'it prints the license of the stack it was captured on' },
};

// The Makefile's APPS lists every example, separated by spaces, unless the
// caller names some, which they may separate with commas.
const only = new Set((process.env.APPS ?? '').split(/[\s,]+/).filter(Boolean));

function served() {
  if (!existsSync(PIDS)) {
    console.error('screenshots: nothing is being served, run make preview first');
    process.exit(2);
  }
  const apps = [];
  for (const line of readFileSync(PIDS, 'utf8').split('\n')) {
    const [pid, name, port] = line.trim().split(/\s+/);
    if (!pid || !name || !port) continue;
    if (only.size && !only.has(name)) continue;
    try {
      process.kill(Number(pid), 0);
    } catch {
      console.error(`screenshots: ${name} is not running, see .stack/logs/preview-${name}.log`);
      continue;
    }
    apps.push({ name, base: `http://localhost:${port}` });
  }
  for (const name of only) {
    const hasPages = pageRoutes(join(APPS, name)).length > 0;
    if (hasPages && !apps.some((a) => a.name === name)) console.error(`screenshots: ${name} is not being served`);
  }
  if (!apps.length) {
    console.error('screenshots: none of the requested apps is being served');
    process.exit(2);
  }
  return apps;
}

function pageRoutes(appDir) {
  const root = join(appDir, 'src', 'routes');
  const out = [];
  const walk = (dir, prefix) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        // A group directory in parentheses does not appear in the URL.
        const seg = entry.startsWith('(') && entry.endsWith(')') ? '' : `/${entry}`;
        walk(full, prefix + seg);
      } else if (entry === '+page.svelte') {
        out.push(prefix === '' ? '/' : prefix);
      }
    }
  };
  if (existsSync(root)) walk(root, '');
  // Code-point order, so every machine lists the routes, and so the README
  // grid, the same way whatever its locale.
  return out.sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a < b ? -1 : a > b ? 1 : 0));
}

const segments = (path) => path.split('/').filter(Boolean);
const isParam = (seg) => seg.startsWith('[') && seg.endsWith(']');

function decoded(seg) {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

function fits(route, path) {
  const r = segments(route);
  const p = segments(path);
  return r.length === p.length && r.every((seg, i) => isParam(seg) || seg === decoded(p[i]));
}

// The route the app itself would answer a path with: of the routes that fit,
// the one with a fixed segment where the others have a parameter, read from
// the left. That is how /translations/intro reaches /translations/[slug] and
// not /[locale]/[slug].
function owner(routes, path) {
  const candidates = routes.filter((r) => fits(r, path));
  candidates.sort((a, b) => {
    const sa = segments(a);
    const sb = segments(b);
    for (let i = 0; i < sa.length; i++) {
      const d = Number(isParam(sa[i])) - Number(isParam(sb[i]));
      if (d !== 0) return d;
    }
    return 0;
  });
  return candidates[0];
}

function shotName(route) {
  if (route === '/') return 'home';
  return segments(route)
    .map((seg) => (isParam(seg) ? seg.slice(1, -1).split('=')[0] : seg))
    .join('-');
}

// A link keeps its query, because some pages reach their detail pages only
// through a redirect that reads one, such as a search result that records the
// click before it opens the article.
function linksIn(html) {
  const out = [];
  for (const m of html.matchAll(/href="(\/[^"#]*)"/g)) {
    const link = m[1].replaceAll('&amp;', '&');
    const path = link.split('?')[0];
    if (path.startsWith('/_app/') || /\.[a-z0-9]{2,5}$/i.test(path)) continue;
    out.push(path.length > 1 && !link.includes('?') ? path.replace(/\/$/, '') : link);
  }
  return out;
}

// Breadth first from the home page and every fixed route, in the order the
// links appear, so the same seeded content always yields the same pages.
async function crawl(base, seeds) {
  const queue = [...seeds];
  const seen = new Set(queue);
  const found = [];
  while (queue.length && found.length < CRAWL_LIMIT) {
    const path = queue.shift();
    let res;
    try {
      res = await fetch(base + path, { redirect: 'follow', signal: AbortSignal.timeout(30_000) });
    } catch {
      continue;
    }
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('text/html')) continue;
    const landed = new URL(res.url).pathname.replace(/(.)\/$/, '$1');
    found.push(landed);
    for (const link of linksIn(await res.text())) {
      if (!seen.has(link)) {
        seen.add(link);
        queue.push(link);
      }
    }
  }
  const linked = [...seen].map((link) => link.split('?')[0]);
  return [...new Set([...found, ...linked])];
}

async function targetsFor(app, routes) {
  const fixed = routes.filter((r) => !segments(r).some(isParam));
  // A query a page is captured with is also where its results link from.
  const queried = Object.entries(QUERIES[app.name] ?? {}).map(([route, query]) => route + query);
  const paths = await crawl(app.base, ['/', ...fixed.filter((r) => r !== '/'), ...queried]);
  const targets = [];
  const skipped = [];
  for (const route of routes) {
    const leftOut = LEAVE_OUT[app.name]?.[route];
    if (leftOut) {
      skipped.push({ route, reason: leftOut });
      continue;
    }
    const path = fixed.includes(route) ? route : paths.find((p) => owner(routes, p) === route);
    if (!path) {
      skipped.push({ route, reason: 'no page links to it' });
      continue;
    }
    targets.push({ route, path: path + (QUERIES[app.name]?.[route] ?? ''), name: shotName(route) });
  }
  return { targets, skipped };
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
  await page.evaluate(async () => {
    await document.fonts.ready;
    const visible = [...document.images].filter((img) => !img.complete && img.getBoundingClientRect().top < innerHeight);
    const loaded = Promise.all(
      visible.map((img) => new Promise((done) => {
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      })),
    );
    await Promise.race([loaded, new Promise((done) => setTimeout(done, 10_000))]);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

// Playwright writes PNG or JPEG only. The browser encodes WebP itself, which is
// about half the PNG's size for a page of text and needs no image library.
// Asking Chromium for WebP directly drops the pixel density back to 1x.
async function toWebp(encoder, png) {
  const data = await encoder.evaluate(async ({ b64, quality }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas.toDataURL('image/webp', quality).split(',')[1];
  }, { b64: png.toString('base64'), quality: QUALITY / 100 });
  return Buffer.from(data, 'base64');
}

async function shoot(context, encoder, url, file) {
  const page = await context.newPage();
  try {
    const res = await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
    const status = res?.status() ?? 0;
    if (status === 0 || status >= 400) return { ok: false, reason: `answered ${status}` };
    await settle(page);
    // Motion would freeze half way through a frame, and a blinking caret lands
    // in some shots and not others.
    const png = await page.screenshot({ type: 'png', animations: 'disabled', caret: 'hide' });
    writeFileSync(file, await toWebp(encoder, png));
    const landed = new URL(page.url());
    return { ok: true, title: (await page.title()).trim(), url: landed.pathname + landed.search };
  } finally {
    await page.close();
  }
}

function newContext(browser, size, phone = false) {
  return browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: size.scale,
    isMobile: phone,
    hasTouch: phone,
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
}

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// GitHub renders no Markdown inside an HTML table, so a code span becomes code.
const inlineCode = (s) => escapeHtml(s).replace(/`([^`]+)`/g, '<code>$1</code>');

function label(shot) {
  if (shot.viewport === 'phone') return 'On a phone';
  return shot.title || (shot.route === '/' ? 'Home' : shot.route);
}

function grid(cells) {
  const rows = [];
  for (let i = 0; i < cells.length; i += 2) {
    const pair = cells.slice(i, i + 2).map((c) => `    <td width="50%" valign="top">${c}</td>`);
    rows.push(['  <tr>', ...pair, '  </tr>'].join('\n'));
  }
  return ['<table>', ...rows, '</table>'].join('\n');
}

function previewSection(app, index) {
  const cells = index.shots.map((shot) => {
    const src = `screenshots/${shot.file}`;
    const alt = escapeHtml(`${app}: ${label(shot)}`);
    const route = shot.viewport === 'phone' ? shot.url : shot.route;
    const width = shot.viewport === 'phone' ? PHONE_WIDTH : DESKTOP_WIDTH;
    return `<a href="${src}"><img src="${src}" width="${width}" alt="${alt}"></a><br><b>${escapeHtml(label(shot))}</b><br><code>${escapeHtml(route)}</code>`;
  });
  const lines = [
    '## Preview',
    '',
    'Every page of this example, captured from a running stack with its seeded content.',
    '',
    grid(cells),
    '',
  ];
  if (index.skipped.length) {
    lines.push('Not shown:', '', ...index.skipped.map((s) => `- \`${s.route}\`, because ${s.reason}.`), '');
  }
  lines.push(
    `\`make screenshots APPS=${app}\` at the repository root captures them again. [docs/PREVIEWS.md](../../docs/PREVIEWS.md) says how they are made and how to use them.`,
    '',
  );
  return lines.join('\n');
}

// The Preview section sits before the README's first second-level heading, and
// a later run replaces it where it is.
function writeSection(file, heading, body, { atEnd = false } = {}) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const start = lines.indexOf(heading);
  let from;
  let to;
  if (start !== -1) {
    from = start;
    to = atEnd ? lines.length : lines.findIndex((l, i) => i > start && l.startsWith('## '));
    if (to === -1) to = lines.length;
  } else if (atEnd) {
    from = to = lines.length;
  } else {
    from = to = lines.findIndex((l) => l.startsWith('## '));
    if (from === -1) from = to = lines.length;
  }
  const before = lines.slice(0, from);
  while (before.length && before[before.length - 1] === '') before.pop();
  const after = lines.slice(to);
  while (after.length && after[after.length - 1] === '') after.pop();
  const section = body.replace(/\n+$/, '').split('\n');
  const next = [...before, '', ...section, ...(after.length ? ['', ...after] : [])];
  writeFileSync(file, `${next.join('\n')}\n`);
}

// What each example proves, as the root README's table says it.
function summaries() {
  const out = {};
  const readme = readFileSync(join(REPO, 'README.md'), 'utf8');
  for (const m of readme.matchAll(/^\| \[([a-z0-9-]+)\]\(apps\/[a-z0-9-]+\/\) \| (.+) \|$/gm)) out[m[1]] = m[2];
  return out;
}

function writeGallery() {
  const said = summaries();
  const cells = [];
  const without = [];
  for (const app of readdirSync(APPS).sort()) {
    const indexFile = join(APPS, app, 'screenshots', 'index.json');
    if (!existsSync(indexFile)) {
      if (!pageRoutes(join(APPS, app)).length && existsSync(join(APPS, app, 'README.md'))) without.push(app);
      continue;
    }
    const index = JSON.parse(readFileSync(indexFile, 'utf8'));
    const first = index.shots.find((s) => s.viewport === 'desktop');
    if (!first) continue;
    const src = `../apps/${app}/screenshots/${first.file}`;
    const pages = index.shots.filter((s) => s.viewport === 'desktop').length;
    cells.push(
      `<a href="../apps/${app}/#preview"><img src="${src}" width="${DESKTOP_WIDTH}" alt="${escapeHtml(`${app}: ${label(first)}`)}"></a><br><b><a href="../apps/${app}/">${app}</a></b>, ${pages} ${pages === 1 ? 'page' : 'pages'}<br>${inlineCode(said[app] ?? '')}`,
    );
  }
  const lines = ['## Gallery', '', 'The first page of every example. Each one links to all of its pages.', '', grid(cells), ''];
  if (without.length) {
    lines.push(`${without.map((a) => `[${a}](../apps/${a}/)`).join(', ')} ${without.length === 1 ? 'has no pages to show: it runs' : 'have no pages to show: they run'} in a terminal.`, '');
  }
  writeSection(GUIDE, '## Gallery', lines.join('\n'), { atEnd: true });
}

const apps = served();
const browser = await chromium.launch();
const encoder = await browser.newPage();
let failed = 0;
try {
  for (const app of apps) {
    const appDir = join(APPS, app.name);
    const routes = pageRoutes(appDir);
    if (!routes.length) continue;
    const outDir = join(appDir, 'screenshots');
    mkdirSync(outDir, { recursive: true });
    const { targets, skipped } = await targetsFor(app, routes);
    const shots = [];
    const desktop = await newContext(browser, DESKTOP);
    for (const t of targets) {
      const file = `${t.name}.webp`;
      const r = await shoot(desktop, encoder, app.base + t.path, join(outDir, file));
      if (!r.ok) {
        failed++;
        console.error(`  ${app.name} ${t.route}: ${r.reason} at ${t.path}`);
        continue;
      }
      shots.push({ file, route: t.route, url: r.url, title: r.title, viewport: 'desktop' });
    }
    await desktop.close();
    if (targets.length) {
      const phone = await newContext(browser, PHONE, true);
      const first = targets[0];
      const file = `${first.name}-phone.webp`;
      const r = await shoot(phone, encoder, app.base + first.path, join(outDir, file));
      if (r.ok) shots.push({ file, route: first.route, url: r.url, title: r.title, viewport: 'phone' });
      else failed++;
      await phone.close();
    }
    const index = {
      app: app.name,
      captured: new Date().toISOString().slice(0, 10),
      viewports: { desktop: DESKTOP, phone: PHONE },
      shots,
      skipped,
    };
    writeFileSync(join(outDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
    writeSection(join(appDir, 'README.md'), '## Preview', previewSection(app.name, index));
    const kept = new Set(shots.map((s) => s.file));
    const stale = readdirSync(outDir).filter((f) => f.endsWith('.webp') && !kept.has(f));
    console.log(`  ${app.name.padEnd(22)} ${shots.length} images${skipped.length ? `, skipped ${skipped.map((s) => s.route).join(' ')}` : ''}`);
    if (stale.length) console.log(`  ${''.padEnd(22)} no longer captured, remove if the page is gone: ${stale.join(' ')}`);
  }
} finally {
  await browser.close();
}
writeGallery();
if (failed) {
  console.error(`screenshots: ${failed} pages failed`);
  process.exit(1);
}
