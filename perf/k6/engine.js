// engine.js: drive the engine directly for one content type.
//
//   k6 run -e SCHEMA=blog_posts engine.js
//
// This is the other half of a page's cost. app.js measures what a visitor
// waits for. This measures what the engine contributes to it, so a slow page
// can be attributed rather than guessed at.
//
// Every request shape here is one the engine actually has. The engine ignores a
// parameter it does not know, so a wrong filter answers 200 with an unfiltered
// list. The shapes below are the ones verified by execution:
//
//   filters[column]=value    exact equality, and the only filter form
//   filters[<rel>_id]=<uuid> a relation is filtered by its foreign key
//   populate=* / depth=N     inflate relations
//   limit                    clamped to 25..200
//   no sort parameter        rows are always created_at DESC
//   GET /api/admin/search    search is on the admin router only
import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const SCHEMA = __ENV.SCHEMA || 'blog_posts';
const API_URL = (__ENV.API_URL || 'http://localhost:4402').replace(/\/$/, '');
const ADMIN_URL = (__ENV.ADMIN_URL || 'http://localhost:4401').replace(/\/$/, '');
const EMAIL = __ENV.EMAIL || 'admin@lyeve.example';
const PASSWORD = __ENV.PASSWORD || 'Admin12345678';
const RATE = Number(__ENV.RATE || 50);

const latency = new Trend('engine_latency', true);
const okRate = new Rate('engine_ok');
const skipped = new Counter('engine_skipped');

const OPS = [
  { id: 'read-by-id', weight: 40 },
  { id: 'list-25', weight: 25 },
  { id: 'filter-slug', weight: 15 },
  { id: 'populate-all', weight: 12 },
  { id: 'search', weight: 8 },
];
const perOp = {};
for (const op of OPS) perOp[op.id] = new Trend(`engine_${op.id.replace(/-/g, '_')}`, true);
const totalWeight = OPS.reduce((s, o) => s + o.weight, 0);

export const options = {
  scenarios: {
    engine: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: __ENV.DURATION || '30s',
      preAllocatedVUs: Math.max(10, Math.ceil(RATE / 2)),
      maxVUs: Math.max(50, RATE * 4),
    },
  },
  thresholds: {
    engine_latency: ['p(95)<80'],
    engine_ok: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(95)', 'p(99)', 'max'],
  tags: { layer: 'engine', schema: SCHEMA },
};

function dget(o, p) { return p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o); }

export function setup() {
  // One login for the run. The engine allows five per fifteen minutes per
  // address, enforced by a rate-limit rule the documented setting cannot reach,
  // so authenticating per VU would lock the run out.
  const res = http.post(`${ADMIN_URL}/api/admin/auth/login`, JSON.stringify({ email: EMAIL, password: PASSWORD }), { headers: { 'Content-Type': 'application/json' } });
  if (res.status !== 200) throw new Error(`login failed (${res.status}); the run would measure 401s`);
  const token = dget(res.json(), 'token');
  if (!token) throw new Error('login returned no token');
  const headers = { Authorization: `Bearer ${token}` };

  // 200 is the largest page the engine will serve.
  const list = http.get(`${API_URL}/api/v1/content/${SCHEMA}?limit=200`, { headers });
  if (list.status !== 200) throw new Error(`cannot list ${SCHEMA} (${list.status})`);

  const items = list.json();
  if (!Array.isArray(items)) throw new Error(`${SCHEMA} list was not a bare array; the response shape changed`);
  if (items.length === 0) throw new Error(`${SCHEMA} is empty; run make setup before measuring`);

  // A slug lives at data.slug, never at the top level of the item.
  const ids = items.map((it) => it.id).filter(Boolean);
  const slugs = [...new Set(items.map((it) => dget(it, 'data.slug')).filter(Boolean))];

  return { token, ids, slugs, rows: items.length };
}

export default function (data) {
  let r = Math.random() * totalWeight;
  let op = OPS[0];
  for (const o of OPS) { r -= o.weight; if (r <= 0) { op = o; break; } }

  const headers = { Authorization: `Bearer ${data.token}` };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  let res;

  switch (op.id) {
    case 'read-by-id':
      res = http.get(`${API_URL}/api/v1/content/${SCHEMA}/${pick(data.ids)}`, { headers, tags: { op: op.id } });
      break;
    case 'list-25':
      res = http.get(`${API_URL}/api/v1/content/${SCHEMA}?limit=25`, { headers, tags: { op: op.id } });
      break;
    case 'filter-slug': {
      if (!data.slugs.length) { skipped.add(1); return; }
      const slug = encodeURIComponent(pick(data.slugs));
      res = http.get(`${API_URL}/api/v1/content/${SCHEMA}?filters[slug]=${slug}&limit=25`, { headers, tags: { op: op.id } });
      break;
    }
    case 'populate-all':
      res = http.get(`${API_URL}/api/v1/content/${SCHEMA}/${pick(data.ids)}?populate=*`, { headers, tags: { op: op.id } });
      break;
    case 'search':
      res = http.get(`${ADMIN_URL}/api/admin/search?q=${encodeURIComponent(pick(data.slugs) || SCHEMA)}&schema=${SCHEMA}`, { headers, tags: { op: op.id } });
      break;
  }

  const good = res.status >= 200 && res.status < 400;
  latency.add(res.timings.duration);
  perOp[op.id].add(res.timings.duration);
  okRate.add(good);
  check(res, { [`${SCHEMA} ${op.id}`]: () => good });
}
