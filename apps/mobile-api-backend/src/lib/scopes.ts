/**
 * The scope vocabulary, worked out from the engine's own derivation rule.
 *
 * There is no catalog endpoint. The engine builds the scope a request needs
 * from the request itself: the resource is the third path segment and the
 * action comes from the method. So the only way to know what to ask for is to
 * know which routes the client will call, and to run the same rule over them.
 * That rule is `requiredScope` below, and this list is it applied to the routes
 * a read-only mobile client uses.
 */
export interface ScopeChoice {
	scope: string;
	label: string;
	/** What holding it opens, stated as routes rather than as a feature name. */
	grants: string;
	/** True where handing it to a phone is a mistake, whatever the app needs. */
	dangerous?: boolean;
}

export const SCOPE_CHOICES: ScopeChoice[] = [
	{
		scope: 'content:read',
		label: 'Read content',
		grants: 'GET /api/v1/content/{type}, /{id}, /cursor, /revisions and /relations'
	},
	{
		scope: 'schemas:read',
		label: 'Read content types',
		grants: 'GET /api/v1/schemas and /api/v1/schemas/{name}'
	},
	{
		scope: 'content:write',
		label: 'Write content',
		grants: 'POST and PUT /api/v1/content/{type}, publish and unpublish',
		dangerous: true
	},
	{
		scope: 'content:delete',
		label: 'Delete content',
		grants: 'DELETE /api/v1/content/{type}/{id}',
		dangerous: true
	},
	{
		scope: 'media:read',
		label: 'Read media',
		grants: 'GET /api/admin/media and the download route, on the admin router',
		dangerous: true
	},
	{
		scope: 'api-keys:read',
		label: 'Read API keys',
		grants: 'GET /api/admin/api-keys, so a key can enumerate its siblings',
		dangerous: true
	}
];

/**
 * The scope a request needs, by the same rule the engine applies.
 *
 * Mirrors core.BuildScopeRoute. It matters that this is derived rather than
 * configured: a route added tomorrow demands a scope nobody minted, and a
 * wildcard granted to avoid that grants far more than the route in hand.
 */
export function requiredScope(method: string, path: string): string {
	return `${resourceOf(path)}:${actionOf(method)}`;
}

function resourceOf(path: string): string {
	const parts = path.replace(/^\//, '').split('/');
	if (parts.length >= 3 && parts[0] === 'api' && (parts[1] === 'v1' || parts[1] === 'admin')) {
		return parts[2];
	}
	return parts.find((p) => p !== '') ?? 'unknown';
}

function actionOf(method: string): string {
	switch (method.toUpperCase()) {
		case 'GET':
		case 'HEAD':
		case 'OPTIONS':
			return 'read';
		case 'DELETE':
			return 'delete';
		default:
			return 'write';
	}
}

/**
 * Whether a scope list grants a resource:action pair, wildcards included.
 * Used to explain a refusal on the key page rather than to enforce anything.
 */
export function grants(scopes: string[], required: string): boolean {
	const [resource, action] = required.split(':');
	return scopes.some((raw) => {
		const [r, a] = raw.trim().toLowerCase().split(':');
		if (!r || !a) return false;
		return (r === '*' || r === resource) && (a === '*' || a === action);
	});
}
