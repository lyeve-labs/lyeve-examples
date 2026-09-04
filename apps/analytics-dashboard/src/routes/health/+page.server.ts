import { latency, poolHealth, probe, runtimeMetrics, tokenedReady } from '$lib/server/telemetry';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [healthz, readyz, startup, ready, pool, latencies, runtime] = await Promise.all([
		probe('healthz'),
		probe('readyz'),
		probe('startup'),
		tokenedReady(),
		poolHealth(),
		latency(12),
		runtimeMetrics()
	]);

	return {
		probes: [
			{ name: '/healthz', purpose: 'Liveness. Point a container restart policy here.', ...healthz },
			{ name: '/readyz', purpose: 'Readiness. Point a load balancer here.', ...readyz },
			{ name: '/startup', purpose: 'Startup gate. Passes once, then caches.', ...startup }
		].map((entry) => ({
			name: entry.name,
			purpose: entry.purpose,
			report: entry.value,
			provenance: entry.provenance
		})),
		ready: ready.value,
		readyProvenance: ready.provenance,
		pool: pool.value,
		poolProvenance: pool.provenance,
		latency: latencies.value,
		latencyProvenance: latencies.provenance,
		runtime: runtime.value,
		runtimeProvenance: runtime.provenance
	};
};
