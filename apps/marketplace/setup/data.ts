/**
 * The catalog the seed writes: four sellers, five categories, 24 products and
 * 31 reviews. Prices are whole cents so no rounding decision is ever left to
 * the database or to JavaScript.
 */

export type SellerSeed = {
	slug: string;
	title: string;
	bio: string;
	rating: number;
};

export type CategorySeed = {
	slug: string;
	title: string;
};

export type ProductSeed = {
	slug: string;
	title: string;
	seller: string;
	category: string;
	priceCents: number;
	stock: number;
	description: string;
};

export type ReviewSeed = {
	slug: string;
	title: string;
	product: string;
	rating: number;
	body: string;
};

export const sellers: SellerSeed[] = [
	{
		slug: 'northline-supply',
		title: 'Northline Supply',
		bio: 'Waxed canvas and bridle leather bags, cut and sewn two at a time in a workshop in Ashland.',
		rating: 4.8
	},
	{
		slug: 'harbour-clay-studio',
		title: 'Harbour Clay Studio',
		bio: 'Wheel-thrown stoneware, gas fired to cone 10, out of a converted boat shed in Whitby.',
		rating: 4.6
	},
	{
		slug: 'verdigris-roasters',
		title: 'Verdigris Roasters',
		bio: 'Single-origin coffee roasted on a 5kg drum the morning it ships.',
		rating: 4.9
	},
	{
		slug: 'fieldnote-paper',
		title: 'Fieldnote Paper Co',
		bio: 'Letterpress notebooks printed on a 1948 platen press and bound by hand.',
		rating: 4.4
	}
];

export const categories: CategorySeed[] = [
	{ slug: 'bags-and-carry', title: 'Bags and Carry' },
	{ slug: 'ceramics', title: 'Ceramics' },
	{ slug: 'coffee', title: 'Coffee' },
	{ slug: 'stationery', title: 'Stationery' },
	{ slug: 'home-and-kitchen', title: 'Home and Kitchen' }
];

export const products: ProductSeed[] = [
	{
		slug: 'waxed-canvas-rucksack',
		title: 'Waxed Canvas Rucksack, 24L',
		seller: 'northline-supply',
		category: 'bags-and-carry',
		priceCents: 18500,
		stock: 6,
		description:
			'Eighteen-ounce waxed duck over a bridle leather base, a roll top that closes flat, and a padded sleeve sized for a 15 inch laptop.'
	},
	{
		slug: 'field-tote-olive',
		title: 'Field Tote in Olive Duck',
		seller: 'northline-supply',
		category: 'bags-and-carry',
		priceCents: 7400,
		stock: 14,
		description:
			'A wide-mouthed tote with an internal divider and handles long enough to carry on a shoulder over a winter coat.'
	},
	{
		slug: 'rolltop-pannier',
		title: 'Rolltop Pannier, Single',
		seller: 'northline-supply',
		category: 'bags-and-carry',
		priceCents: 12900,
		stock: 0,
		description:
			'Hooks onto a standard rear rack, seam-sealed against a wet commute, and unclips into a shoulder bag at the other end.'
	},
	{
		slug: 'two-pocket-musette',
		title: 'Two-Pocket Musette',
		seller: 'northline-supply',
		category: 'bags-and-carry',
		priceCents: 6200,
		stock: 9,
		description:
			'A light shoulder bag for a market run: two outside pockets, one deep main compartment, and no structure holding a shape it does not need.'
	},
	{
		slug: 'waxed-dopp-kit',
		title: 'Waxed Cotton Dopp Kit',
		seller: 'northline-supply',
		category: 'bags-and-carry',
		priceCents: 4800,
		stock: 21,
		description:
			'Wipe-clean lining, a zip that runs the full length so nothing hides in a corner, and a leather pull that ages the way the bag does.'
	},
	{
		slug: 'canvas-log-carrier',
		title: 'Canvas Log Carrier',
		seller: 'northline-supply',
		category: 'home-and-kitchen',
		priceCents: 5600,
		stock: 4,
		description:
			'Two riveted handles and a panel of heavy duck that takes an armful of split wood without folding in the middle.'
	},
	{
		slug: 'ash-glaze-mug',
		title: 'Ash Glaze Mug, 300ml',
		seller: 'harbour-clay-studio',
		category: 'ceramics',
		priceCents: 3200,
		stock: 32,
		description:
			'Wood ash glaze over a dark stoneware body, so no two run the same way down the side. Dishwasher safe, though the glaze prefers a sink.'
	},
	{
		slug: 'speckled-serving-bowl',
		title: 'Speckled Serving Bowl, 28cm',
		seller: 'harbour-clay-studio',
		category: 'ceramics',
		priceCents: 7800,
		stock: 7,
		description:
			'Wide enough for a salad for six and heavy enough that it stays where it is put while you toss it.'
	},
	{
		slug: 'unglazed-pour-over',
		title: 'Unglazed Pour-Over Dripper',
		seller: 'harbour-clay-studio',
		category: 'ceramics',
		priceCents: 5400,
		stock: 11,
		description:
			'A 60 degree cone with a single large opening, left unglazed outside so the heat stays in the coffee bed rather than the wall.'
	},
	{
		slug: 'dinner-plate-set',
		title: 'Dinner Plate Set of Four',
		seller: 'harbour-clay-studio',
		category: 'home-and-kitchen',
		priceCents: 14800,
		stock: 3,
		description:
			'Ten inch plates with an unglazed foot ring, thrown and fired together so the set matches rather than nearly matches.'
	},
	{
		slug: 'salt-cellar-oak-lid',
		title: 'Salt Cellar with Oak Lid',
		seller: 'harbour-clay-studio',
		category: 'home-and-kitchen',
		priceCents: 2900,
		stock: 18,
		description:
			'Holds about a cup of flaked salt, with a turned oak lid that sits flush and lifts with one finger.'
	},
	{
		slug: 'cobalt-rim-vase',
		title: 'Tall Vase, Cobalt Rim',
		seller: 'harbour-clay-studio',
		category: 'ceramics',
		priceCents: 9600,
		stock: 0,
		description:
			'Thirty centimetres tall with a neck narrow enough to hold cut stems upright, finished with a cobalt line at the lip.'
	},
	{
		slug: 'ethiopia-guji-washed',
		title: 'Ethiopia Guji, Washed, 340g',
		seller: 'verdigris-roasters',
		category: 'coffee',
		priceCents: 2200,
		stock: 40,
		description:
			'Bergamot and white peach, roasted light for filter. Picked at 2,050 meters and rested four days before it ships.'
	},
	{
		slug: 'colombia-huila-honey',
		title: 'Colombia Huila, Honey Process, 340g',
		seller: 'verdigris-roasters',
		category: 'coffee',
		priceCents: 2050,
		stock: 26,
		description:
			'Red apple and cane sugar, with enough body to hold up to four minutes in a plunger.'
	},
	{
		slug: 'espresso-blend-no-4',
		title: 'Espresso Blend No. 4, 1kg',
		seller: 'verdigris-roasters',
		category: 'coffee',
		priceCents: 5200,
		stock: 12,
		description:
			'Brazil for the body, Guatemala for the acidity. Pulled at 1:2 in 28 seconds it tastes of cocoa and dried fig.'
	},
	{
		slug: 'decaf-brazil-sugarcane',
		title: 'Decaf Brazil, Sugarcane Process, 340g',
		seller: 'verdigris-roasters',
		category: 'coffee',
		priceCents: 1900,
		stock: 15,
		description:
			'Decaffeinated with sugarcane ethyl acetate rather than a solvent, which leaves the sweetness where it was.'
	},
	{
		slug: 'filter-sampler-three',
		title: 'Filter Sampler, Three Origins',
		seller: 'verdigris-roasters',
		category: 'coffee',
		priceCents: 3600,
		stock: 8,
		description:
			'Three 100g bags from the current filter lineup, so a new grinder setting is not a 340g commitment.'
	},
	{
		slug: 'cold-brew-concentrate',
		title: 'Cold Brew Concentrate, 500ml',
		seller: 'verdigris-roasters',
		category: 'coffee',
		priceCents: 1400,
		stock: 0,
		description:
			'Steeped 18 hours at room temperature and bottled without dilution. Cut it one part to three.'
	},
	{
		slug: 'letterpress-notebook-ruled',
		title: 'Letterpress Notebook, Ruled',
		seller: 'fieldnote-paper',
		category: 'stationery',
		priceCents: 1800,
		stock: 45,
		description:
			'Sixty-four pages of 100gsm cream paper ruled at 7mm, in a cover printed one color at a time.'
	},
	{
		slug: 'pocket-refill-three-pack',
		title: 'Pocket Refill, Pack of Three',
		seller: 'fieldnote-paper',
		category: 'stationery',
		priceCents: 1200,
		stock: 60,
		description:
			'Three stapled refills that fit any standard pocket cover: one ruled, one grid, one blank.'
	},
	{
		slug: 'grid-journal-a5',
		title: 'Grid Journal, A5',
		seller: 'fieldnote-paper',
		category: 'stationery',
		priceCents: 2400,
		stock: 22,
		description:
			'Sewn binding that lies flat at any page, with a 5mm grid printed in a gray light enough to disappear under ink.'
	},
	{
		slug: 'index-card-set',
		title: 'Index Card Set, 100',
		seller: 'fieldnote-paper',
		category: 'stationery',
		priceCents: 900,
		stock: 33,
		description:
			'Unruled 5 by 3 cards on stock heavy enough to survive a coat pocket, boxed in a slipcase.'
	},
	{
		slug: 'cotton-rag-blotter',
		title: 'Blotter Pad, Cotton Rag',
		seller: 'fieldnote-paper',
		category: 'stationery',
		priceCents: 3400,
		stock: 5,
		description:
			'Twenty-five sheets of cotton rag on a bound pad, for a fountain pen that writes faster than the ink dries.'
	},
	{
		slug: 'archival-fineliner',
		title: 'Archival Fineliner, 0.3mm',
		seller: 'fieldnote-paper',
		category: 'stationery',
		priceCents: 1500,
		stock: 0,
		description:
			'Pigment ink that does not feather on the grid journal and does not lift when a highlighter crosses it.'
	}
];

export const reviews: ReviewSeed[] = [
	{
		slug: 'waxed-canvas-rucksack-review-1',
		title: 'Carries a week of hand luggage',
		product: 'waxed-canvas-rucksack',
		rating: 5,
		body: 'Three flights in and the roll top still closes flat over a laptop, a camera and a jumper. The leather base has picked up a mark I have decided I like.'
	},
	{
		slug: 'waxed-canvas-rucksack-review-2',
		title: 'Heavier than I expected',
		product: 'waxed-canvas-rucksack',
		rating: 4,
		body: 'The canvas is genuinely eighteen ounce, which means it weighs something before you put anything in it. Worth it for how it hangs, but check the empty weight first.'
	},
	{
		slug: 'waxed-canvas-rucksack-review-3',
		title: 'Straps needed breaking in',
		product: 'waxed-canvas-rucksack',
		rating: 4,
		body: 'Stiff for the first fortnight and comfortable ever since.'
	},
	{
		slug: 'field-tote-olive-review-1',
		title: 'The divider is the whole point',
		product: 'field-tote-olive',
		rating: 5,
		body: 'It keeps a laptop off the shopping. I did not think I wanted it and now I would not buy the version without it.'
	},
	{
		slug: 'field-tote-olive-review-2',
		title: 'Handles sit right over a coat',
		product: 'field-tote-olive',
		rating: 4,
		body: 'Long enough for a winter shoulder, short enough not to drag on the floor when carried by hand.'
	},
	{
		slug: 'rolltop-pannier-review-1',
		title: 'Dry after an hour of rain',
		product: 'rolltop-pannier',
		rating: 5,
		body: 'Rode home in a downpour and everything inside came out dry. The clips have not rattled loose once.'
	},
	{
		slug: 'rolltop-pannier-review-2',
		title: 'Fits my rack, just',
		product: 'rolltop-pannier',
		rating: 3,
		body: 'The hooks needed spacing out for a wider rack. Ten minutes with a screwdriver, but it was not obvious from the listing.'
	},
	{
		slug: 'waxed-dopp-kit-review-1',
		title: 'Wipes clean as promised',
		product: 'waxed-dopp-kit',
		rating: 5,
		body: 'A shampoo lid came off somewhere over the Atlantic and the lining took it without a stain.'
	},
	{
		slug: 'ash-glaze-mug-review-1',
		title: 'No two are the same',
		product: 'ash-glaze-mug',
		rating: 5,
		body: 'Bought two and the glaze ran differently on each. Holds heat far longer than the thin porcelain it replaced.'
	},
	{
		slug: 'ash-glaze-mug-review-2',
		title: 'Handle suits a large hand',
		product: 'ash-glaze-mug',
		rating: 4,
		body: 'Roomy handle and balanced when full. The rim is thicker than I usually go for.'
	},
	{
		slug: 'ash-glaze-mug-review-3',
		title: 'Replacement arrived intact',
		product: 'ash-glaze-mug',
		rating: 5,
		body: 'The first one cracked in transit and the studio sent another the same week, packed properly.'
	},
	{
		slug: 'speckled-serving-bowl-review-1',
		title: 'Heavy in the right way',
		product: 'speckled-serving-bowl',
		rating: 5,
		body: 'It does not skate across the table when you toss a salad in it.'
	},
	{
		slug: 'speckled-serving-bowl-review-2',
		title: 'Bigger than I pictured',
		product: 'speckled-serving-bowl',
		rating: 4,
		body: 'Twenty-eight centimetres is a serious bowl. Measure the cupboard before ordering.'
	},
	{
		slug: 'unglazed-pour-over-review-1',
		title: 'Holds temperature well',
		product: 'unglazed-pour-over',
		rating: 5,
		body: 'Brews land four degrees warmer than they did in my glass cone, and the drawdown is consistent.'
	},
	{
		slug: 'unglazed-pour-over-review-2',
		title: 'Fits a standard filter',
		product: 'unglazed-pour-over',
		rating: 4,
		body: 'Size 02 papers sit flush with no folding or trimming.'
	},
	{
		slug: 'dinner-plate-set-review-1',
		title: 'The set actually matches',
		product: 'dinner-plate-set',
		rating: 5,
		body: 'Four plates with the same glaze depth on all of them, which was not true of the last set I bought.'
	},
	{
		slug: 'salt-cellar-oak-lid-review-1',
		title: 'Lid seals better than expected',
		product: 'salt-cellar-oak-lid',
		rating: 4,
		body: 'The salt stayed dry through a humid August a hundred meters from the sea.'
	},
	{
		slug: 'cobalt-rim-vase-review-1',
		title: 'Stems stay upright',
		product: 'cobalt-rim-vase',
		rating: 5,
		body: 'The neck is narrow enough to hold three or four stems exactly where I put them.'
	},
	{
		slug: 'ethiopia-guji-washed-review-1',
		title: 'The peach is not marketing copy',
		product: 'ethiopia-guji-washed',
		rating: 5,
		body: 'Brewed at 1:16 in a V60 it is unmistakably stone fruit. Best bag I have had this year.'
	},
	{
		slug: 'ethiopia-guji-washed-review-2',
		title: 'Roasted three days before it arrived',
		product: 'ethiopia-guji-washed',
		rating: 5,
		body: 'The roast date on the bag was Monday and it was through the door on Thursday.'
	},
	{
		slug: 'ethiopia-guji-washed-review-3',
		title: 'Light even for filter',
		product: 'ethiopia-guji-washed',
		rating: 3,
		body: 'Needed a finer grind and hotter water than I usually run. Good once dialed in, but not a forgiving coffee.'
	},
	{
		slug: 'colombia-huila-honey-review-1',
		title: 'Good in a plunger',
		product: 'colombia-huila-honey',
		rating: 4,
		body: 'Holds up to four minutes of immersion without going flat, which is not true of most of the light roasts I buy.'
	},
	{
		slug: 'colombia-huila-honey-review-2',
		title: 'Sweet without being cloying',
		product: 'colombia-huila-honey',
		rating: 5,
		body: 'Tastes like red apple skin. My first honey process and it will not be the last.'
	},
	{
		slug: 'espresso-blend-no-4-review-1',
		title: 'Consistent shot to shot',
		product: 'espresso-blend-no-4',
		rating: 5,
		body: 'Same recipe for a fortnight and the shots have not wandered. Cocoa and fig is a fair description.'
	},
	{
		slug: 'espresso-blend-no-4-review-2',
		title: 'The kilo bag is the right size',
		product: 'espresso-blend-no-4',
		rating: 4,
		body: 'Lasts a month in a two-person house and stays good to the last dose in the valve bag.'
	},
	{
		slug: 'espresso-blend-no-4-review-3',
		title: 'Needed a week to settle',
		product: 'espresso-blend-no-4',
		rating: 4,
		body: 'Gassy for the first few days, as fresh espresso is. Patience fixed it.'
	},
	{
		slug: 'decaf-brazil-sugarcane-review-1',
		title: 'Decaf I will drink after dinner',
		product: 'decaf-brazil-sugarcane',
		rating: 5,
		body: 'Sweet, low acidity and no papery finish. Rare in a decaf.'
	},
	{
		slug: 'filter-sampler-three-review-1',
		title: 'The right way to try a roaster',
		product: 'filter-sampler-three',
		rating: 5,
		body: 'Three 100g bags told me more than one 340g bag would have.'
	},
	{
		slug: 'letterpress-notebook-ruled-review-1',
		title: 'Ink does not show through',
		product: 'letterpress-notebook-ruled',
		rating: 5,
		body: 'A wet fountain pen on 100gsm with no bleed and only the faintest ghost on the reverse.'
	},
	{
		slug: 'letterpress-notebook-ruled-review-2',
		title: 'The cover took a beating',
		product: 'letterpress-notebook-ruled',
		rating: 4,
		body: 'Corners softened after a month loose in a bag, which is what paper board does.'
	},
	{
		slug: 'grid-journal-a5-review-1',
		title: 'Lies flat from page one',
		product: 'grid-journal-a5',
		rating: 5,
		body: 'The sewn binding does what a glued one never does, and the gray grid stays out of the way.'
	}
];
