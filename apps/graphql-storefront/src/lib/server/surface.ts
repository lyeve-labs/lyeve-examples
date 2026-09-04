import { exchange, gql, type Exchange } from './graphql';
import { COLLECTIONS, PRODUCTS, REVIEWS } from './lyeve';

/**
 * What /graphql shows: the live schema for this app's three types, and the
 * limits the endpoint enforces, each proven by a query that trips it.
 *
 * Nothing here is quoted from documentation. The surface comes from
 * introspection and the limits come from the engine's own refusals, so a
 * reader is looking at the running system rather than at a claim about it.
 */

const SCHEMAS = [COLLECTIONS, PRODUCTS, REVIEWS];

/**
 * The GraphQL type name for a content type is its name in PascalCase, so
 * `gql_products` becomes `GqlProducts`. The names have to be spelled out in the
 * document below, because a GraphQL query is text and cannot interpolate.
 */
const TYPE_NAMES = ['GqlCollections', 'GqlProducts', 'GqlReviews'] as const;

interface TypeRef {
	kind: string;
	name: string | null;
	ofType: { kind: string; name: string | null } | null;
}

interface IntrospectedField {
	name: string;
	description: string | null;
	args: { name: string; defaultValue: string | null; type: TypeRef }[];
	type: TypeRef;
}

interface IntrospectedInput {
	name: string;
	type: TypeRef;
}

interface SurfaceData {
	queryRoot: { fields: IntrospectedField[] } | null;
	mutationRoot: { fields: { name: string }[] } | null;
	collections: { fields: IntrospectedField[] } | null;
	products: { fields: IntrospectedField[] } | null;
	reviews: { fields: IntrospectedField[] } | null;
	collectionsFilter: { inputFields: IntrospectedInput[] } | null;
	productsFilter: { inputFields: IntrospectedInput[] } | null;
	reviewsFilter: { inputFields: IntrospectedInput[] } | null;
}

/**
 * Introspection is answered only for an admin or super_admin caller by default
 * (`graphql.introspection` is `admin-only` unless the configuration changes it). This
 * app holds a super_admin credential, so it works here. A storefront running on
 * a reader's token would get "introspection requires admin authentication".
 */
const Surface = gql<Record<string, never>, SurfaceData>(
	'Surface',
	`
query Surface {
  queryRoot: __type(name: "Query") {
    fields {
      name
      description
      args { name defaultValue type { kind name ofType { kind name } } }
      type { kind name ofType { kind name } }
    }
  }
  mutationRoot: __type(name: "Mutation") { fields { name } }
  collections: __type(name: "GqlCollections") {
    fields { name type { kind name ofType { kind name } } }
  }
  products: __type(name: "GqlProducts") {
    fields { name type { kind name ofType { kind name } } }
  }
  reviews: __type(name: "GqlReviews") {
    fields { name type { kind name ofType { kind name } } }
  }
  collectionsFilter: __type(name: "GqlCollectionsFilterInput") {
    inputFields { name type { kind name ofType { kind name } } }
  }
  productsFilter: __type(name: "GqlProductsFilterInput") {
    inputFields { name type { kind name ofType { kind name } } }
  }
  reviewsFilter: __type(name: "GqlReviewsFilterInput") {
    inputFields { name type { kind name ofType { kind name } } }
  }
}
`
);

export type RootField = {
	name: string;
	description: string;
	returns: string;
	args: string[];
};

export type TypeShape = {
	name: string;
	fields: { name: string; type: string }[];
	filterFields: { name: string; type: string }[];
};

export type SchemaSurface = {
	rootFields: RootField[];
	mutationNames: string[];
	types: TypeShape[];
	/** The introspection exchange itself, so the page can show that too. */
	exchange: Exchange<SurfaceData>;
};

export async function loadSurface(): Promise<SchemaSurface> {
	const result = await exchange(Surface);
	const data = result.response.data;

	// Root fields are filtered by description rather than by name, because the
	// generated name is derived and the description quotes the content type: a
	// list field reads "List rows from gql_products." and its by-id sibling
	// "Fetch a single gql_products by id."
	const rootFields = (data?.queryRoot?.fields ?? [])
		.filter((f) => SCHEMAS.some((schema) => (f.description ?? '').includes(schema)))
		.map((f) => ({
			name: f.name,
			description: f.description ?? '',
			returns: render(f.type),
			args: f.args
				.map((a) => `${a.name}: ${render(a.type)}${a.defaultValue ? ` = ${a.defaultValue}` : ''}`)
				.sort()
		}))
		.sort((a, b) => a.name.localeCompare(b.name));

	const mutationNames = (data?.mutationRoot?.fields ?? [])
		.map((f) => f.name)
		.filter((name) => TYPE_NAMES.some((type) => name.endsWith(type)))
		.sort();

	const types: TypeShape[] = [
		shape(TYPE_NAMES[0], data?.collections?.fields, data?.collectionsFilter?.inputFields),
		shape(TYPE_NAMES[1], data?.products?.fields, data?.productsFilter?.inputFields),
		shape(TYPE_NAMES[2], data?.reviews?.fields, data?.reviewsFilter?.inputFields)
	];

	return { rootFields, mutationNames, types, exchange: result };
}

function shape(
	name: string,
	fields: IntrospectedField[] | undefined,
	filter: IntrospectedInput[] | undefined
): TypeShape {
	return {
		name,
		fields: (fields ?? [])
			.map((f) => ({ name: f.name, type: render(f.type) }))
			.sort((a, b) => a.name.localeCompare(b.name)),
		filterFields: (filter ?? [])
			.map((f) => ({ name: f.name, type: render(f.type) }))
			.sort((a, b) => a.name.localeCompare(b.name))
	};
}

/** Renders an introspected type reference the way SDL writes it. */
function render(ref: TypeRef | { kind: string; name: string | null } | null): string {
	if (!ref) return 'unknown';
	const inner = 'ofType' in ref ? ref.ofType : null;
	if (ref.kind === 'NON_NULL') return `${render(inner)}!`;
	if (ref.kind === 'LIST') return `[${render(inner)}]`;
	return ref.name ?? ref.kind;
}

export type Limit = {
	title: string;
	limit: string;
	explanation: string;
	exchange: Exchange<unknown>;
};

/**
 * Each probe is the cheapest query that crosses one limit, so the refusal
 * message names the limit and the number it saw.
 */
export async function loadLimits(): Promise<Limit[]> {
	const [depth, cost, fields] = await Promise.all([
		exchange(depthProbe),
		exchange(costProbe),
		exchange(fieldCountProbe)
	]);

	return [
		{
			title: 'Query depth',
			limit: '7',
			explanation:
				'Nesting is counted through inline fragments and named fragment spreads too, so wrapping a selection in a fragment does not buy a level. Configurable as graphql.max_query_depth.',
			exchange: depth
		},
		{
			title: 'Query cost',
			limit: '1000',
			explanation:
				'A list field costs 10, an object field 2 and a scalar 1, summed over the whole document. This probe is 60 list fields of 7 scalars each, which is 60 times 17. Configurable as graphql.max_query_cost.',
			exchange: cost
		},
		{
			title: 'Field count',
			limit: '500',
			explanation:
				'A separate cap on the total number of fields, aliases counted separately, which catches the alias-batched query that stays under the cost limit. Not configurable.',
			exchange: fields
		}
	];
}

/**
 * Eight levels of introspection. Depth is the only limit a legitimate document
 * is likely to meet, and it is met by introspecting introspection.
 */
const depthProbe = gql(
	'DepthProbe',
	`
query DepthProbe {
  __schema { types { fields { type { ofType { fields { type { name } } } } } } }
}
`
);

const COST_ALIASES = 60;
const COST_SELECTION = 'id title slug body rating product_slug created_at';

const costProbe = gql(
	'CostProbe',
	`query CostProbe {\n${Array.from(
		{ length: COST_ALIASES },
		(_, i) => `  a${i + 1}: gql_reviews(limit: 1) { ${COST_SELECTION} }`
	).join('\n')}\n}`
);

const fieldCountProbe = gql(
	'FieldCountProbe',
	`query FieldCountProbe {\n  gql_reviews(limit: 1) {\n${Array.from(
		{ length: 600 },
		(_, i) => `    f${i + 1}: id`
	).join('\n')}\n  }\n}`
);
