// app.js: drive one example application's pages.
//
//   k6 run -e APP=blog -e APP_URL=http://localhost:4700 app.js
//
// This measures what a visitor actually waits for: a server-rendered page,
// which means SvelteKit plus every engine call that page makes. It fetches HTML
// only and runs no JavaScript, so it is a measure of time to first byte of a
// complete document, not of what the browser does afterwards.
//
// Dynamic routes are driven by following real links found on the pages listed
// in the app's `crawl` set. Inventing slugs would measure the 404 path, which
// is fast and meaningless.
import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const config = JSON.parse(open('../apps.json'));
const APP = __ENV.APP || 'blog';
const app = config.apps.find((a) => a.name === APP);
if (!app) throw new Error(`unknown app ${APP}; see perf/apps.json`);

const APP_URL = (__ENV.APP_URL || `http://localhost:${app.port}`).replace(/\/$/, '');
const RATE = Number(__ENV.RATE || 20);

const latency = new Trend('page_latency', true);
const okRate = new Rate('page_ok');
const skipped = new Counter('page_skipped');

// One trend per declared path, created at init because k6 cannot register a
// metric later. The label is the path as written, so `{link}` is reported as
// one series covering every detail page.
const perPath = {};
for (const p of app.paths) perPath[p.path] = new Trend(`page_${slugify(p.path)}`, true);

function slugify(p) {
  return p.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'root';
}

const totalWeight = app.paths.reduce((s, p) => s + p.weight, 0);

export const options = {
  scenarios: {
    [`app_${slugify(APP)}`]: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: __ENV.DURATION || '30s',
      preAllocatedVUs: Math.max(10, Math.ceil(RATE / 2)),
      maxVUs: Math.max(50, RATE * 4),
    },
  },
  thresholds: {
    page_latency: [`p(95)<${app.thresholds.p95_ms}`],
    page_ok: [`rate>${1 - app.thresholds.error_rate}`],
    http_req_failed: [`rate<${app.thresholds.error_rate}`],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(95)', 'p(99)', 'max'],
  tags: { layer: 'app', app: APP },
};

export function setup() {
  // Crawl for internal links. A detail page is reachable only through one, and
  // this is also the check that the app is serving something real: an app whose
  // home page renders an empty list yields no links, and the run says so rather
  // than quietly driving the home page 100% of the time.
  const links = new Set();
  for (const path of app.crawl) {
    const res = http.get(`${APP_URL}${path}`);
    if (res.status !== 200) continue;
    for (const m of res.body.matchAll(/href="(\/[a-zA-Z0-9][^"#]*)"/g)) {
      // A query string stays: an app that routes a result through a tracking
      // redirect carries what the detail page needs in it.
      const href = m[1].replace(/&amp;/g, '&');
      // Keep only links that look like a detail page: something below a
      // top-level segment, which is where the slug routes live.
      if (href.split('?')[0].split('/').filter(Boolean).length >= 2) links.add(href);
    }
  }

  const needsLinks = app.paths.some((p) => p.path === '{link}');
  if (needsLinks && links.size === 0) {
    throw new Error(`${APP}: no internal links found by crawling ${app.crawl.join(', ')}; is it seeded and serving?`);
  }
  return { links: [...links].slice(0, 200) };
}

export default function (data) {
  let r = Math.random() * totalWeight;
  let chosen = app.paths[0];
  for (const p of app.paths) { r -= p.weight; if (r <= 0) { chosen = p; break; } }

  let path = chosen.path;
  if (path === '{link}') {
    if (!data.links.length) { skipped.add(1); return; }
    path = data.links[Math.floor(Math.random() * data.links.length)];
  }

  const res = http.get(`${APP_URL}${path}`, { tags: { path: chosen.path } });
  const good = res.status === 200;

  latency.add(res.timings.duration);
  perPath[chosen.path].add(res.timings.duration);
  okRate.add(good);
  check(res, { [`${APP} ${chosen.path}`]: () => good });
}
