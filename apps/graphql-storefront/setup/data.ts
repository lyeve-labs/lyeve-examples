/**
 * The catalog.
 *
 * `slug` is the public URL segment and lives in the content type's own `slug`
 * field. The entry slug the provisioner sends is that value with a `gql-`
 * prefix, because `sys_content_entries` is UNIQUE (slug, tenant_id) with no
 * content type in the index: one example app's `drivetrain` would block every
 * other app's, and the refusal is a 409 that names no field.
 */

export interface CollectionSeed {
	slug: string;
	title: string;
	description: string;
}

export interface ProductSeed {
	slug: string;
	title: string;
	collection: string;
	priceCents: number;
	stock: number;
	description: string;
}

export interface ReviewSeed {
	slug: string;
	title: string;
	product: string;
	rating: number;
	body: string;
}

export const collections: CollectionSeed[] = [
	{
		slug: 'drivetrain',
		title: 'Drivetrain',
		description:
			'Chains, cranks and bearings. Everything here wears out on a schedule, so it is stocked deep and priced to be replaced rather than nursed.'
	},
	{
		slug: 'wheels-and-tyres',
		title: 'Wheels and Tyres',
		description:
			'Wheels are built to order in the workshop, two days from order to box. Tyres and tubes ship the same day.'
	},
	{
		slug: 'bags-and-racks',
		title: 'Bags and Racks',
		description:
			'Waxed canvas and welded steel, made in small runs. Nothing in this collection is waterproof and none of it is sold as such.'
	},
	{
		slug: 'tools-and-workshop',
		title: 'Tools and Workshop',
		description:
			'The short list of tools that pay for themselves in one repair. Anything you would use once a decade is worth borrowing instead.'
	}
];

export const products: ProductSeed[] = [
	{
		slug: 'eleven-speed-chain',
		title: 'Sparrow 11-Speed Chain',
		collection: 'drivetrain',
		priceCents: 3400,
		stock: 42,
		description:
			'A nickel-plated eleven-speed chain, 118 links, supplied with a joining pin rather than a quick link.\n\nChains are the cheapest part of a drivetrain and the one that decides how long the expensive parts last. Measure it every thousand kilometres and replace it at 0.5 percent elongation, before it starts reshaping the cassette.'
	},
	{
		slug: 'hollow-crankset-170',
		title: 'Hollow-Forged Crankset, 170mm',
		collection: 'drivetrain',
		priceCents: 18900,
		stock: 6,
		description:
			'A hollow-forged aluminum crankset with a 30mm spindle, 170mm arms and a 46-30 chainring pair.\n\nThe spindle needs a bottom bracket to match, which is not included, because the shell width on your frame decides which one fits. Ask before ordering if the frame is older than 2015.'
	},
	{
		slug: 'sealed-bottom-bracket',
		title: 'Sealed Bottom Bracket, 68mm',
		collection: 'drivetrain',
		priceCents: 4250,
		stock: 23,
		description:
			'A cartridge bottom bracket with double-lip seals, sized for a 68mm threaded shell.\n\nSealed cartridges are not serviceable, which is the point: they last two or three winters and then get replaced in ten minutes instead of being stripped, packed and re-shimmed.'
	},
	{
		slug: 'handbuilt-rear-wheel',
		title: 'Handbuilt 32-Spoke Rear Wheel',
		collection: 'wheels-and-tyres',
		priceCents: 24500,
		stock: 4,
		description:
			'A 32-spoke rear wheel on a sealed-bearing hub, three-cross both sides, tensioned and stress-relieved by hand.\n\nThirty-two spokes is more than a light rider needs and exactly what a loaded bike needs. A wheel built this way stays true through a broken spoke, which is the difference between a slow ride home and a phone call.'
	},
	{
		slug: 'gravel-tyre-700-35',
		title: 'Gravel Tyre, 700 x 35',
		collection: 'wheels-and-tyres',
		priceCents: 5900,
		stock: 61,
		description:
			'A 35mm folding tyre with a fast center and shouldered side knobs, tubeless-ready, 120 threads per inch.\n\nIt rolls close to a slick on tarmac and holds a line on loose gravel. On wet clay it does neither, and no tyre this size does.'
	},
	{
		slug: 'butyl-inner-tube',
		title: 'Butyl Inner Tube, 700 x 28-45',
		collection: 'wheels-and-tyres',
		priceCents: 850,
		stock: 140,
		description:
			'A 0.9mm butyl tube with a 48mm removable-core presta valve.\n\nHeavier than latex and far less trouble. It holds pressure for a fortnight, patches in the dark, and costs less than the coffee you would drink while waiting for a latex tube to go soft.'
	},
	{
		slug: 'waxed-saddle-bag',
		title: 'Waxed Canvas Saddle Bag',
		collection: 'bags-and-racks',
		priceCents: 6800,
		stock: 12,
		description:
			'A 1.5 liter saddle bag in 18oz waxed canvas with leather straps and a brass buckle.\n\nIt takes a tube, two levers, a multitool and a patch kit, and nothing else. Water resistant, not waterproof: in real rain the contents get damp and the wax needs redoing once a year.'
	},
	{
		slug: 'front-pannier-rack',
		title: 'Front Pannier Rack',
		collection: 'bags-and-racks',
		priceCents: 9200,
		stock: 9,
		description:
			'A tig-welded steel low-rider rack rated to 15kg, powder-coated black, with stainless fixings.\n\nIt needs mid-fork eyelets. If the fork has none, the P-clamp workaround will hold the rack and will not hold 15kg, so treat that as a 5kg rack instead.'
	},
	{
		slug: 'chain-wear-indicator',
		title: 'Chain Wear Indicator',
		collection: 'tools-and-workshop',
		priceCents: 1600,
		stock: 31,
		description:
			'A drop-in gauge reading 0.5 and 0.75 percent elongation on 8 to 12 speed chains.\n\nThe cheapest tool in the workshop and the one that saves the most money, because a chain replaced at 0.5 percent leaves the cassette alone and a chain replaced at 1 percent does not.'
	},
	{
		slug: 'cone-spanner-set',
		title: 'Cone Spanner Set, 13-16mm',
		collection: 'tools-and-workshop',
		priceCents: 3100,
		stock: 14,
		description:
			'Four thin-jaw spanners, 13, 14, 15 and 16mm, hardened and ground rather than stamped.\n\nOnly useful on cup-and-cone hubs, which means older wheels and current Shimano. Sealed cartridge hubs need none of this and there is nothing to adjust on them.'
	}
];

export const reviews: ReviewSeed[] = [
	{
		slug: 'chain-lasted-the-winter',
		title: 'Lasted the winter and the cassette survived',
		product: 'eleven-speed-chain',
		rating: 5,
		body: 'Fitted in November, measured in March, still under 0.5 percent. The old chain took a cassette with it; this one did not.'
	},
	{
		slug: 'joining-pin-is-fiddly',
		title: 'The joining pin is fiddly',
		product: 'eleven-speed-chain',
		rating: 4,
		body: 'Nothing wrong with the chain. I would rather it shipped with a quick link, because the pin needs a proper tool and I broke the first one.'
	},
	{
		slug: 'crank-stiff-under-load',
		title: 'Stiff under load, quiet after a month',
		product: 'hollow-crankset-170',
		rating: 5,
		body: 'No flex standing on a climb with forty kilos on the bike. It creaked for the first week until I greased the spindle interface properly.'
	},
	{
		slug: 'check-your-shell-width',
		title: 'Check your shell width first',
		product: 'hollow-crankset-170',
		rating: 3,
		body: 'My mistake rather than theirs, but the product page could be louder about it. My frame is 73mm and I ordered a 68mm bottom bracket to match the crank.'
	},
	{
		slug: 'bottom-bracket-two-winters',
		title: 'Two winters, no play',
		product: 'sealed-bottom-bracket',
		rating: 5,
		body: 'Salt, grit and no maintenance at all. Still spins smoothly and there is nothing to adjust, which is why I bought it.'
	},
	{
		slug: 'wheel-true-after-tour',
		title: 'Still true after three thousand kilometres',
		product: 'handbuilt-rear-wheel',
		rating: 5,
		body: 'Loaded touring on bad roads and it has not needed a spoke key once. Worth the two-day wait and worth the price over a machine-built wheel.'
	},
	{
		slug: 'wheel-heavier-than-expected',
		title: 'Heavier than I expected',
		product: 'handbuilt-rear-wheel',
		rating: 4,
		body: 'It is a strong wheel and it weighs what a strong wheel weighs. If you want light, buy fewer spokes and accept the trade.'
	},
	{
		slug: 'tyre-fast-on-tarmac',
		title: 'Fast on tarmac, honest about mud',
		product: 'gravel-tyre-700-35',
		rating: 5,
		body: 'Rolls almost like a slick and grips loose gravel well. The description is right that wet clay defeats it, which I appreciate more than a claim it would not.'
	},
	{
		slug: 'tyre-tubeless-seated-easily',
		title: 'Seated tubeless without a compressor',
		product: 'gravel-tyre-700-35',
		rating: 4,
		body: 'Went up with a track pump on a 21mm internal rim. Lost one bar overnight for the first three days and then held.'
	},
	{
		slug: 'tubes-hold-pressure',
		title: 'Holds pressure for a fortnight',
		product: 'butyl-inner-tube',
		rating: 5,
		body: 'Bought six. Fitted two, patched one at the roadside in the rain, no trouble. The removable valve core is the detail that sold me.'
	},
	{
		slug: 'saddle-bag-right-size',
		title: 'Exactly the size it says',
		product: 'waxed-saddle-bag',
		rating: 4,
		body: 'Tube, levers, tool, patches. Nothing else fits and I stopped trying. Rain gets in eventually, as promised.'
	},
	{
		slug: 'rack-needs-eyelets',
		title: 'Solid rack, needs the eyelets',
		product: 'front-pannier-rack',
		rating: 4,
		body: 'Beautifully welded and dead rigid on a fork with mid-blade eyelets. On my other fork the clamps work but I would not load it near the rating.'
	},
	{
		slug: 'gauge-paid-for-itself',
		title: 'Paid for itself the first time I used it',
		product: 'chain-wear-indicator',
		rating: 5,
		body: 'Found a chain at 0.6 percent that I would have run all winter. Sixteen dollars against a cassette.'
	},
	{
		slug: 'spanners-fit-old-hubs',
		title: 'Thin enough for old hubs',
		product: 'cone-spanner-set',
		rating: 5,
		body: 'Ground jaws fit locknuts that my stamped set would not touch. Useless on my newer wheels, which is not their fault.'
	}
];
