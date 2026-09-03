/**
 * Names this example claims on the shared engine.
 *
 * Every example in this repo provisions into one database, so a content type
 * called `plans` would be a collision waiting to happen. The same reasoning
 * applies to tenant slugs: the roster is global, and an operations console that
 * listed every tenant on the engine would show other examples' work.
 *
 * Held apart from the client so the seed script can import them without pulling
 * in a module that reads private environment.
 */
export const PLANS = 'saas_plans';
export const PROFILES = 'saas_tenant_profiles';
export const TENANT_PREFIX = 'saas_';
