import type { LyeveClient } from './client.ts';

export type FieldType =
	| 'text' | 'richtext' | 'number' | 'decimal' | 'boolean'
	| 'datetime' | 'date' | 'json' | 'email' | 'url' | 'uid' | 'relation';

export interface SchemaField {
	name: string;
	field_type: FieldType;
	required?: boolean;
	unique?: boolean;
	indexed?: boolean;
	relation_to?: string;
	relation_type?: 'belongs_to' | 'has_many' | 'many_to_many';
}

export interface SchemaDefinition {
	name: string;
	display_name?: string;
	fields: SchemaField[];
	with_created_at?: boolean;
	with_updated_at?: boolean;
	with_soft_delete?: boolean;
	with_draft_publish?: boolean;
	with_localization?: boolean;
}

/** Declares a belongs_to relation, always optional. See the note in `applySchemas`. */
export function belongsTo(name: string, target: string): SchemaField {
	return {
		name,
		field_type: 'relation',
		relation_to: target,
		relation_type: 'belongs_to',
		// Never `required: true`. The generator emits both a dead `<name>` NOT
		// NULL column and the real `<name>_id`, and the write path only fills
		// the second, so every insert fails with a 422 that names nothing.
		// Enforce the requirement in the application instead.
		required: false,
		indexed: true
	};
}

/**
 * Creates content types in the order given, waiting until each is readable.
 *
 * Order is significant: a relation emits a foreign key referencing the target's
 * generated table, so the target must already exist or the apply fails.
 *
 * The wait is not belt and braces. A schema stays invisible to `/api/v1` for
 * roughly a quarter of a second after the apply returns, so a setup script that
 * creates a type and immediately writes to it fails on a cold database and
 * succeeds on a warm one.
 */
export async function applySchemas(client: LyeveClient, schemas: SchemaDefinition[]): Promise<void> {
	for (const schema of schemas) {
		await client.request('admin', '/api/admin/schemas', {
			method: 'POST',
			body: JSON.stringify({
				with_created_at: true,
				with_updated_at: true,
				...schema
			})
		});
		await waitForSchema(client, schema.name);
	}
}

async function waitForSchema(client: LyeveClient, name: string, timeoutMs = 10_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (await schemaExists(client, name)) return;
		await new Promise((r) => setTimeout(r, 150));
	}
	throw new Error(`schema "${name}" was applied but never became readable`);
}

export async function listSchemas(client: LyeveClient): Promise<SchemaDefinition[]> {
	const rows = await client.request<SchemaDefinition[]>('api', '/api/v1/schemas');
	return Array.isArray(rows) ? rows : [];
}

export async function schemaExists(client: LyeveClient, name: string): Promise<boolean> {
	const schemas = await listSchemas(client);
	return schemas.some((s) => s.name === name);
}
