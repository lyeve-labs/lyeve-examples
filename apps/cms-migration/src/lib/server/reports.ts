import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Reads what `migration/run.sh` left behind.
 *
 * The paths are resolved against process.cwd() rather than the module, because
 * the built server lives in build/server/chunks and both `vite dev` and
 * `node build/index.js` are started from the app directory.
 */
const REPORTS = join(process.cwd(), 'migration', 'reports');

export interface StageRecord {
	name: string;
	label: string;
	command: string;
	exit_code: number;
	report_file: string;
	log_file: string;
	checkpoint_file?: string;
	started_at: string;
	finished_at: string;
}

export interface RunRecord {
	engine_admin_url: string;
	engine_api_url: string;
	proxy_url: string;
	cli_version: string;
	started_at: string;
	finished_at: string;
	stages: StageRecord[];
}

export interface DryRunSummary {
	total_schemas: number | null;
	total_entries: number | null;
	schemas_to_create: number | null;
	schemas_already_exist: number | null;
	per_schema: { schema: string; entries: number; warnings: number; verdict: string }[];
}

export interface MigrationSummary {
	status: string | null;
	duration: string | null;
	schemas_created: number | null;
	schemas_skipped: number | null;
	total_entries: number | null;
	migrated: number | null;
	skipped: number | null;
	failed: number | null;
	errors: string[];
}

export interface Checkpoint {
	source: string;
	started_at: string;
	updated_at: string;
	total_entries: number;
	migrated_count: number;
	skipped_count: number;
	failed_count: number;
	schemas: {
		schema: string;
		total_count: number;
		migrated_ids: string[] | null;
		skipped_ids: string[] | null;
		failed_ids: string[] | null;
	}[];
}

async function readText(name: string): Promise<string | null> {
	try {
		return await readFile(join(REPORTS, name), 'utf8');
	} catch {
		return null;
	}
}

export async function readRun(): Promise<RunRecord | null> {
	const raw = await readText('run.json');
	if (!raw) return null;
	try {
		return JSON.parse(raw) as RunRecord;
	} catch {
		return null;
	}
}

export async function readCheckpoint(name: string): Promise<Checkpoint | null> {
	const raw = await readText(name);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as Checkpoint;
	} catch {
		return null;
	}
}

export async function readStageText(name: string): Promise<string | null> {
	return readText(name);
}

/**
 * The tool prints its reports as aligned text and writes no machine-readable
 * copy, so the numbers on the page are scraped from the same text shown beside
 * them. A label the tool renames goes to null rather than to a wrong number.
 */
export function parseDryRun(text: string): DryRunSummary {
	const num = (label: string) => {
		const m = text.match(new RegExp(`${label}\\s*:?\\s+(\\d+)`));
		return m ? Number(m[1]) : null;
	};

	const per: DryRunSummary['per_schema'] = [];
	const line = /^\s{2}(\S+)\s+(\d+) entries\s+(\d+) warnings\s+(PASS|FAIL)\s*$/gm;
	for (const m of text.matchAll(line)) {
		per.push({ schema: m[1], entries: Number(m[2]), warnings: Number(m[3]), verdict: m[4] });
	}

	return {
		total_schemas: num('Total schemas'),
		total_entries: num('Total entries'),
		schemas_to_create: num('Schemas to create'),
		schemas_already_exist: num('Schemas already exist'),
		per_schema: per
	};
}

export function parseMigration(text: string): MigrationSummary {
	const num = (label: string) => {
		const m = text.match(new RegExp(`${label}\\s*:?\\s+(\\d+)`));
		return m ? Number(m[1]) : null;
	};
	const str = (label: string) => {
		const m = text.match(new RegExp(`${label}\\s*:?\\s+(.+)`));
		return m ? m[1].trim() : null;
	};

	// One line per failed row, printed as "    [schema] source-id: message". The
	// schema and the id are both empty when the run failed before it reached a
	// row, which is what a connection refused looks like here.
	const errors: string[] = [];
	for (const m of text.matchAll(/^ {4}\[(.*?)\]\s*(.*?):\s+(.*)$/gm)) {
		errors.push([m[1], m[2]].filter(Boolean).join(' ') + `: ${m[3]}`);
	}

	return {
		status: str('Status'),
		duration: str('Duration'),
		schemas_created: num('Schemas created'),
		schemas_skipped: num('Schemas skipped'),
		total_entries: num('Total entries'),
		migrated: num('Migrated'),
		skipped: num('Skipped'),
		failed: num('Failed'),
		errors
	};
}
