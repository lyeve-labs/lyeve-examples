/**
 * A single origin in front of the engine's two listeners.
 *
 * The CLI builds one SDK client and points it at --admin-url. That client sends
 * the login and the schema list to /api/admin/*, which only the admin listener
 * serves, and every content write to /api/v1/content/{schema}, which only the
 * public listener serves. No single base URL satisfies both, so a live
 * migration against a two-port deployment fails on every entry with a 404 that
 * names nothing.
 *
 * This routes by path prefix, which is all a real deployment does too: put
 * traefik, nginx or an ingress in front and give the CLI that hostname.
 *
 * Node's standard library only. Nothing here is part of the app.
 *
 * PROXY_PORT sets the first port to try, PROXY_PORT_FILE names a file the
 * chosen port is written to. The port is not fixed because a development
 * machine often has other servers running, and a taken port would otherwise
 * fail the migration rather than move out of the way.
 */
import http from 'node:http';
import { writeFileSync } from 'node:fs';
import { URL } from 'node:url';

const firstPort = Number(process.env.PROXY_PORT ?? 4498);
const portFile = process.env.PROXY_PORT_FILE ?? '';
const adminTarget = new URL(process.env.LYEVE_ADMIN_URL ?? 'http://localhost:4401');
const apiTarget = new URL(process.env.LYEVE_API_URL ?? 'http://localhost:4402');

function targetFor(path) {
	if (path.startsWith('/api/admin/')) return adminTarget;
	if (path.startsWith('/api/v1/')) return apiTarget;
	// /healthz and /readyz answer on both. Anything else is a path mistake, and
	// sending it to the admin listener makes the 404 come from the engine rather
	// than from here, which is where a reader will look for it.
	return adminTarget;
}

const server = http.createServer((req, res) => {
	const target = targetFor(req.url ?? '/');

	const upstream = http.request(
		{
			hostname: target.hostname,
			port: target.port,
			path: req.url,
			method: req.method,
			headers: { ...req.headers, host: target.host }
		},
		(up) => {
			res.writeHead(up.statusCode ?? 502, up.headers);
			up.pipe(res);
		}
	);

	upstream.on('error', (err) => {
		res.writeHead(502, { 'content-type': 'application/json' });
		res.end(JSON.stringify({ error: `proxy: ${err.message}` }));
	});

	req.pipe(upstream);
});

let port = firstPort;
server.on('error', (err) => {
	if (err.code === 'EADDRINUSE' && port < firstPort + 10) {
		port += 1;
		server.listen(port, '127.0.0.1');
		return;
	}
	process.stderr.write(`proxy failed: ${err.message}\n`);
	process.exit(1);
});
server.on('listening', () => {
	if (portFile) writeFileSync(portFile, String(port));
	process.stdout.write(`proxy listening on http://127.0.0.1:${port}\n`);
	process.stdout.write(`  /api/admin/* -> ${adminTarget.origin}\n`);
	process.stdout.write(`  /api/v1/*    -> ${apiTarget.origin}\n`);
});
server.listen(port, '127.0.0.1');

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => server.close(() => process.exit(0)));
}
