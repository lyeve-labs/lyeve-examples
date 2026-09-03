/**
 * Creates the job board's content types and seeds the listings.
 *
 * Safe to run more than once: applying a schema that exists is accepted, and
 * seeding stops if the board already has listings.
 */
import {
	lyeveFromEnv, applySchemas, belongsTo, listContent, createContent
} from '../src/lib/lyeve/index.ts';

const client = lyeveFromEnv();

const COMPANIES = 'jobs_companies';
const LISTINGS = 'jobs_listings';
const APPLICATIONS = 'jobs_applications';

// Order matters: a relation emits a foreign key against the target's generated
// table, so companies must exist before listings references them.
await applySchemas(client, [
	{
		name: COMPANIES,
		display_name: 'Employers',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'bio', field_type: 'text' },
			{ name: 'website', field_type: 'url' }
		]
	},
	{
		name: LISTINGS,
		display_name: 'Job listings',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'summary', field_type: 'text' },
			{ name: 'body', field_type: 'text' },
			{ name: 'location', field_type: 'text' },
			// Indexed because the board filters on it. filters[] is exact
			// equality, so the column carries a token and the app owns the label.
			{ name: 'employment_type', field_type: 'text', indexed: true },
			{ name: 'salary_min', field_type: 'number' },
			{ name: 'salary_max', field_type: 'number' },
			belongsTo('company', COMPANIES)
		]
	},
	{
		name: APPLICATIONS,
		display_name: 'Applications',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'applicant_name', field_type: 'text', required: true },
			// An email column carries a CHECK constraint on PostgreSQL, so a
			// malformed address is refused by the database, not just by the app.
			{ name: 'applicant_email', field_type: 'email', required: true },
			{ name: 'cover_letter', field_type: 'text' },
			// There is no file field type. An upload is a media record, and this
			// column holds its id.
			{ name: 'cv_media_id', field_type: 'text' },
			belongsTo('listing', LISTINGS)
		]
	}
]);
console.log('content types ready');

if ((await listContent(client, LISTINGS, { limit: 25 })).length > 0) {
	console.log('listings already seeded, nothing to do');
	process.exit(0);
}

const companies = [
	{
		slug: 'northwind-rail-data',
		title: 'Northwind Rail Data',
		website: 'https://northwind-rail.example',
		bio: 'Builds the timetable and telemetry systems behind three regional rail operators. Around sixty people, based in Manchester with a second office at Crewe.'
	},
	{
		slug: 'kestrel-marine-robotics',
		title: 'Kestrel Marine Robotics',
		website: 'https://kestrelmarine.example',
		bio: 'Designs autonomous survey vehicles for offshore wind farm inspection. Founded in 2019 by two naval architects and still run by them.'
	},
	{
		slug: 'tallow-and-finch',
		title: 'Tallow and Finch',
		website: 'https://tallowandfinch.example',
		bio: 'A bakery group with eight shops across Bristol and Bath, supplied by one wholesale kitchen in Bedminster.'
	},
	{
		slug: 'ferndale-health-systems',
		title: 'Ferndale Health Systems',
		website: 'https://ferndalehealth.example',
		bio: 'Sells patient record integration software to NHS trusts and private clinics. Leeds head office, remote-first engineering team.'
	},
	{
		slug: 'basalt-energy-analytics',
		title: 'Basalt Energy Analytics',
		website: 'https://basaltenergy.example',
		bio: 'Forecasts grid demand and wholesale prices for utilities across the UK and Ireland. Spun out of an Edinburgh research group in 2016.'
	}
];

const listings = [
	{
		slug: 'senior-backend-engineer-northwind',
		title: 'Senior Backend Engineer',
		company: 'northwind-rail-data',
		location: 'Manchester',
		employment_type: 'full_time',
		salary_min: 68000,
		salary_max: 82000,
		summary: 'Own the service that turns raw signaling feeds into the timetable every passenger app reads.',
		body: 'You would work on the ingest side of the platform. Signaling messages arrive from four operators in three different formats, and by the time they reach our API they have to look like one timetable.\n\nThe stack is Go and PostgreSQL with a queue between ingest and the read model. We care more about how you reason about late and duplicate messages than about which frameworks you have used.\n\nThe team is six engineers. On-call is one week in six and the rota is paid.'
	},
	{
		slug: 'data-platform-engineer-northwind',
		title: 'Data Platform Engineer',
		company: 'northwind-rail-data',
		location: 'Manchester, two days on site',
		employment_type: 'full_time',
		salary_min: 60000,
		salary_max: 72000,
		summary: 'Keep the warehouse that every performance report and regulator submission is built from.',
		body: 'Our analysts publish punctuality figures that the regulator reads, so the pipeline behind them has to be reproducible and auditable.\n\nYou would own the transformation project, the schedules around it and the tests that stop a bad load reaching a published figure. Expect to spend real time sitting with the analysts rather than taking tickets from them.\n\nThe last of the legacy SQL Server jobs comes across this year, so there is a decommissioning project attached to the role.'
	},
	{
		slug: 'timetable-analyst-northwind',
		title: 'Timetable Analyst',
		company: 'northwind-rail-data',
		location: 'Crewe',
		employment_type: 'contract',
		salary_min: 45000,
		salary_max: 52000,
		summary: 'Twelve month contract rebuilding the engineering possession calendar before the December change.',
		body: "Every December the national timetable changes, and every possession, diversion and stock swap has to be reconciled against it. This contract covers that cycle end to end.\n\nYou would work between our data team and the operators' planning offices, mostly in spreadsheets and our own planning tool, and you would be the person who spots that two possessions overlap.\n\nRail planning experience matters more here than a technical background. Twelve months, with an extension likely."
	},
	{
		slug: 'embedded-systems-engineer-kestrel',
		title: 'Embedded Systems Engineer',
		company: 'kestrel-marine-robotics',
		location: 'Aberdeen',
		employment_type: 'full_time',
		salary_min: 55000,
		salary_max: 70000,
		summary: 'Write the firmware that keeps a survey vehicle sane when the acoustic link drops.',
		body: 'Our vehicles spend most of a mission with no link to the surface, so the firmware has to decide on its own when a dive is going wrong and how to come home.\n\nYou would work in C and Rust on the vehicle side, with a Python toolchain for mission planning and log analysis. Sea trials happen roughly every six weeks and everyone on the team goes out for some of them.\n\nWe are looking for someone who has shipped software that had to work with nobody watching it.'
	},
	{
		slug: 'field-robotics-technician-kestrel',
		title: 'Field Robotics Technician',
		company: 'kestrel-marine-robotics',
		location: 'Aberdeen',
		employment_type: 'full_time',
		salary_min: 34000,
		salary_max: 42000,
		summary: 'Prepare, launch and recover survey vehicles, and keep the spares cupboard honest.',
		body: 'This is the job that decides whether a mission happens. You would build the vehicles up before a trial, run the pre-dive checks, handle launch and recovery from the deck, then strip and rebuild the thrusters afterwards.\n\nAbout a third of the year is offshore in blocks of one or two weeks. The rest is workshop and test tank work at Altens.\n\nOffshore survival and medical certificates are funded if you do not already hold them.'
	},
	{
		slug: 'mechanical-design-intern-kestrel',
		title: 'Mechanical Design Intern',
		company: 'kestrel-marine-robotics',
		location: 'Aberdeen',
		employment_type: 'internship',
		salary_min: 24000,
		salary_max: 24000,
		summary: 'Twelve week summer placement on the pressure housing redesign for the next vehicle.',
		body: 'The current housing is machined from billet and takes eleven days to produce. A two part design should halve that, and this placement exists to prove or kill the idea.\n\nYou would work alongside two mechanical engineers with your own CAD seat and access to the test tank. The pressure testing at the end of the placement is real, not a demonstration.\n\nOpen to penultimate year mechanical engineering and naval architecture students. Accommodation in Aberdeen is provided.'
	},
	{
		slug: 'head-baker-tallow-and-finch',
		title: 'Head Baker',
		company: 'tallow-and-finch',
		location: 'Bristol',
		employment_type: 'full_time',
		salary_min: 34000,
		salary_max: 39000,
		summary: 'Run the overnight bench at the Bedminster kitchen and own the sourdough program.',
		body: 'The wholesale kitchen produces around 1,400 loaves a night for our own shops and for thirty cafes across the city. You would run that bench and the four bakers on it.\n\nThe starter is fourteen years old and we are precious about it. Beyond that we are open to argument: two of our best selling loaves came from bakers who pushed for them.\n\nShifts start at 10pm, four nights a week, with a fifth night at the same rate through December.'
	},
	{
		slug: 'wholesale-account-manager-tallow-and-finch',
		title: 'Wholesale Account Manager',
		company: 'tallow-and-finch',
		location: 'Bristol',
		employment_type: 'part_time',
		salary_min: 26000,
		salary_max: 31000,
		summary: 'Look after the thirty cafes and delis that buy from the kitchen, three days a week.',
		body: 'Wholesale is a third of the business and it grew by accident. The accounts have never had one person looking after them, and this role is that person.\n\nYou would handle the standing orders, the seasonal changes and the conversation that follows a late delivery, and you would decide which new accounts are worth taking on.\n\nThree days a week, with an early start on the days you visit customers. The figure quoted is for the three day week.'
	},
	{
		slug: 'bakery-supervisor-tallow-and-finch',
		title: 'Bakery Supervisor',
		company: 'tallow-and-finch',
		location: 'Bath',
		employment_type: 'full_time',
		salary_min: 28000,
		salary_max: 32000,
		summary: 'Run the Walcot Street shop, its two counter staff and the morning bake.',
		body: 'Our Bath shop finishes and bakes off everything it sells, so the morning is a production shift and the afternoon is a retail one.\n\nYou would open four days a week, own the rota and the waste figures, and be the person the wholesale drivers deal with.\n\nRetail bakery experience is useful, but we have promoted counter staff into this role twice.'
	},
	{
		slug: 'clinical-data-engineer-ferndale',
		title: 'Clinical Data Engineer',
		company: 'ferndale-health-systems',
		location: 'Leeds',
		employment_type: 'full_time',
		salary_min: 58000,
		salary_max: 70000,
		summary: 'Turn HL7 and FHIR messages from twenty trusts into one patient timeline.',
		body: 'Every trust we integrate with sends the same clinical events in a slightly different shape, and the product only works if the timeline a clinician sees is right.\n\nYou would work on the mapping layer and the reconciliation jobs behind it, in Python and PostgreSQL, with a lot of time spent reading real message samples.\n\nThis is patient data. Everyone on the team clears DBS and information governance training before touching a live feed.'
	},
	{
		slug: 'integration-consultant-ferndale',
		title: 'Integration Consultant',
		company: 'ferndale-health-systems',
		location: 'Remote, UK',
		employment_type: 'contract',
		salary_min: 72000,
		salary_max: 88000,
		summary: 'Six month contract taking three new trusts live on the record integration platform.',
		body: 'Each go-live runs about eight weeks: scoping the feeds with the trust informatics team, configuring the mapping, running parallel against the incumbent, then cutover.\n\nYou would run two of these at once with an engineer assigned to each. Expect a day or two on site per trust per month and the rest remote.\n\nWe are looking for someone who has done NHS integration work before and knows why the parallel run matters.'
	},
	{
		slug: 'information-governance-officer-ferndale',
		title: 'Information Governance Officer',
		company: 'ferndale-health-systems',
		location: 'Leeds',
		employment_type: 'part_time',
		salary_min: 32000,
		salary_max: 38000,
		summary: 'Own the impact assessments, the data sharing agreements and the answers to trust security questionnaires.',
		body: 'Selling into the NHS means answering the same two hundred question security assessment for every customer, and answering it honestly.\n\nYou would own that process, keep the impact assessments current as the product changes, and sit in the design reviews where the answers are really decided.\n\nFour days a week. The figure quoted is for the four day week.'
	},
	{
		slug: 'grid-forecasting-scientist-basalt',
		title: 'Grid Forecasting Scientist',
		company: 'basalt-energy-analytics',
		location: 'Edinburgh',
		employment_type: 'full_time',
		salary_min: 65000,
		salary_max: 80000,
		summary: 'Improve the day ahead demand model that our customers trade against.',
		body: 'Our forecasts feed positions worth several million pounds a day, so a systematic error is both expensive and obvious.\n\nYou would work on the demand side: weather inputs, holiday and behavior effects, and the backtesting harness that decides whether a change is real or noise. Python, plus a small amount of Julia we would happily retire.\n\nA background in statistics or physics matters more than energy market experience, which we can teach.'
	},
	{
		slug: 'frontend-engineer-basalt',
		title: 'Frontend Engineer',
		company: 'basalt-energy-analytics',
		location: 'Edinburgh, hybrid',
		employment_type: 'full_time',
		salary_min: 52000,
		salary_max: 64000,
		summary: 'Build the dashboards traders keep open for eight hours a day.',
		body: 'Our users run the product on three monitors all day, so the bar for density, latency and color choice is higher than a normal web app.\n\nYou would work in TypeScript and Svelte on the charting and alerting surfaces, with direct access to the traders who use them. Feedback is immediate and blunt.\n\nTwo days a week in the office, which is on Lothian Road.'
	},
	{
		slug: 'customer-success-analyst-basalt',
		title: 'Customer Success Analyst',
		company: 'basalt-energy-analytics',
		location: 'Edinburgh',
		employment_type: 'full_time',
		salary_min: 30000,
		salary_max: 36000,
		summary: 'Be the person a utility calls when a forecast looks wrong.',
		body: 'Most tickets here are analytical questions in disguise. A customer thinks the forecast is off and wants to know why before they trade against it.\n\nYou would investigate those, write the explanation, and feed the pattern back to the modeling team. Some of those answers turn into product changes.\n\nComfort with spreadsheets and a willingness to learn the electricity market matter more than previous support experience.'
	}
];

const companyIds: Record<string, string> = {};
for (const company of companies) {
	const { id } = await createContent(client, {
		schema: COMPANIES,
		slug: company.slug,
		title: company.title,
		body: { slug: company.slug, bio: company.bio, website: company.website }
	});
	companyIds[company.slug] = id;
}

for (const listing of listings) {
	await createContent(client, {
		schema: LISTINGS,
		slug: listing.slug,
		title: listing.title,
		body: {
			slug: listing.slug,
			summary: listing.summary,
			body: listing.body,
			location: listing.location,
			employment_type: listing.employment_type,
			// A number field generates a NUMERIC column and the write path
			// refuses a JSON string for it, so these stay numeric literals.
			salary_min: listing.salary_min,
			salary_max: listing.salary_max,
			// Relations are written under the field name and read back as
			// `<field>_id`. See docs/VERIFIED-RECIPE.md section 6.
			company: companyIds[listing.company]
		}
	});
}

console.log(`seeded ${companies.length} employers and ${listings.length} listings`);
console.log('applications arrive through the form at /jobs/<slug>, nothing is seeded for them');
