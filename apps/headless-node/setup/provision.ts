/**
 * Provisions this example: the content types from step 2, then the seed content
 * from step 3.
 *
 *   pnpm run setup
 *
 * Both steps are idempotent, so this is safe to run against an engine that
 * already has them.
 *
 * The imports are dynamic and awaited one at a time. Two static imports would
 * be two modules with top-level await and no dependency between them, and the
 * loader is free to start the second while the first is still waiting on the
 * network. The seed would then race the content types it needs.
 */
export {};

await import('../src/02-define-schema.ts');
await import('../src/03-write-content.ts');
