/**
 * Creates the desk's content types and seeds a support queue with traffic on it.
 *
 * Safe to run more than once: applying a schema that exists is accepted, and
 * seeding stops if the desk already has tickets.
 */
import { lyeveFromEnv, applySchemas, belongsTo, listContent, createContent } from '../src/lib/lyeve/index.ts';

const client = lyeveFromEnv();

const TICKETS = 'desk_tickets';
const REPLIES = 'desk_replies';

// Order matters: a relation emits a foreign key against the target's generated
// table, so tickets must exist before replies references them.
await applySchemas(client, [
	{
		name: TICKETS,
		display_name: 'Support Tickets',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'body', field_type: 'text' },
			// Indexed because every inbox query is a filters[status] equality.
			{ name: 'status', field_type: 'text', indexed: true },
			{ name: 'priority', field_type: 'text', indexed: true },
			{ name: 'requester_name', field_type: 'text' },
			// Plain text, not the engine's email type. An email column carries a
			// database CHECK on Postgres, and the admin write mirrors into that
			// table best effort: an address the CHECK refuses is accepted by the
			// API and then missing from every read, with no error anywhere. The
			// app validates the address before it writes instead.
			{ name: 'requester_email', field_type: 'text' },
			{ name: 'attachment_media_id', field_type: 'text' }
		]
	},
	{
		name: REPLIES,
		display_name: 'Ticket Replies',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'body', field_type: 'text' },
			{ name: 'author_name', field_type: 'text' },
			{ name: 'author_role', field_type: 'text' },
			belongsTo('ticket', TICKETS)
		]
	}
]);
console.log('content types ready');

if ((await listContent(client, TICKETS, { limit: 25 })).length > 0) {
	console.log('tickets already seeded, nothing to do');
	process.exit(0);
}

interface SeedReply {
	author: string;
	role: 'agent' | 'requester';
	body: string;
}

interface SeedTicket {
	slug: string;
	subject: string;
	status: 'open' | 'pending' | 'closed';
	priority: 'urgent' | 'high' | 'normal' | 'low';
	name: string;
	email: string;
	body: string;
	replies: SeedReply[];
}

const tickets: SeedTicket[] = [
	{
		slug: 'desk-webhook-retries-stopped-after-3-2',
		subject: 'Webhook retries stopped after the 3.2 upgrade',
		status: 'open',
		priority: 'urgent',
		name: 'Priya Raghunathan',
		email: 'priya.raghunathan@harborline.example',
		body: 'We upgraded to 3.2 on Tuesday evening. Since then a failed delivery is marked dead on the first attempt instead of backing off and retrying five times.\n\nOur receiver was down for eleven minutes during a deploy and we lost 2,140 events with no retry. The delivery log shows one attempt each, all at the same second.',
		replies: [
			{
				author: 'Nadia Osei',
				role: 'agent',
				body: 'Thanks for the detail, that is enough to reproduce. 3.2 moved retry policy from the endpoint to the subscription, and an endpoint upgraded in place keeps its old policy row but no subscription reads it. That is our bug, not a setting you missed.'
			},
			{
				author: 'Priya Raghunathan',
				role: 'requester',
				body: 'Is there anything we can do today? We have a second deploy window on Friday and I would rather not lose another batch.'
			},
			{
				author: 'Nadia Osei',
				role: 'agent',
				body: 'Re-saving each subscription writes the policy to the new location and restores backoff. There are nine on your account and I can do that from our side if you would rather not touch them. The fix ships in 3.2.4 on Thursday.'
			}
		]
	},
	{
		slug: 'desk-bulk-import-429-after-400-records',
		subject: 'Bulk import hits 429 after about 400 records',
		status: 'open',
		priority: 'high',
		name: 'Sofia Marchetti',
		email: 'sofia.marchetti@velarossa.example',
		body: 'Importing our supplier catalog through the API, every run stops somewhere between 380 and 420 records with a 429. The retry-after header says 60 but waiting a minute and resuming gives another 429 almost immediately.\n\nThe catalog is 6,800 rows so this is not something we can nurse along by hand.',
		replies: [
			{
				author: 'Luca Bianchi',
				role: 'agent',
				body: 'The per-record endpoint is rate limited at 600 writes a minute and the limiter counts the whole minute window, so a resume inside the window inherits the earlier count. That is why the second attempt fails straight away.'
			},
			{
				author: 'Luca Bianchi',
				role: 'agent',
				body: 'The bulk endpoint takes 500 records per request and is limited per request rather than per record, which turns 6,800 rows into fourteen calls. I have put a short example in your account notes. Tell me if the payload shape does not match what you have.'
			}
		]
	},
	{
		slug: 'desk-csv-export-truncates-at-10000-rows',
		subject: 'CSV export truncates at 10,000 rows',
		status: 'open',
		priority: 'normal',
		name: 'Marcus Ilunga',
		email: 'm.ilunga@northgate-transit.example',
		body: 'Every export from the events view stops at exactly 10,000 rows. There is no warning in the UI and the file looks complete, which means our monthly reconciliation has been quietly short for at least two months.',
		replies: [
			{
				author: 'Sam Whitfield',
				role: 'agent',
				body: 'Confirmed, and the silence is the worse half of it. The export path takes the same 10,000 row ceiling as the table view and does not tell you it applied one. I have raised that as a defect rather than a limit.'
			},
			{
				author: 'Marcus Ilunga',
				role: 'requester',
				body: 'How far back can we re-export? We need October and November corrected before the audit on the 20th.'
			},
			{
				author: 'Sam Whitfield',
				role: 'agent',
				body: 'Your retention is 400 days so both months are intact. The scheduled export job has no ceiling, so a date-bounded scheduled export will give you complete files today rather than waiting for the UI fix.'
			},
			{
				author: 'Marcus Ilunga',
				role: 'requester',
				body: 'That worked, both months came through at full length. Leaving this open until the UI warns people, because the next person will not know to ask.'
			}
		]
	},
	{
		slug: 'desk-api-key-rotation-drops-requests',
		subject: 'Rotating an API key drops requests already in flight',
		status: 'open',
		priority: 'high',
		name: 'Tomas Bergqvist',
		email: 'tomas@bergqvist-analytics.example',
		body: 'The docs describe key rotation as zero downtime, but rotating ours returned 401s for about four seconds. Our ingest pipeline retries, so nothing was lost, but the alerting was loud enough that I would like to know whether we did it wrong.',
		replies: [
			{
				author: 'Nadia Osei',
				role: 'agent',
				body: 'You did it right. Rotation avoids downtime only when the old key stays active through the overlap window, and the rotate button in the dashboard revokes immediately. The API accepts an overlap of up to 24 hours and the dashboard does not expose it, which is our gap.'
			},
			{
				author: 'Tomas Bergqvist',
				role: 'requester',
				body: 'Understood. We will rotate through the API with an overlap from now on. Worth fixing the docs, they read as though the button does the same thing.'
			}
		]
	},
	{
		slug: 'desk-sso-login-loops-on-safari',
		subject: 'SSO login loops back to the sign-in page on Safari',
		status: 'pending',
		priority: 'high',
		name: 'Hannah Weiss',
		email: 'hweiss@lumenpath.example',
		body: 'Since last week our Safari users cannot sign in through Okta. They authenticate, come back to the app and land on the sign-in page again. Chrome and Firefox are fine on the same machines.',
		replies: [
			{
				author: 'Marta Lindqvist',
				role: 'agent',
				body: 'That pattern is almost always the session cookie being dropped on the return leg. Safari refuses a SameSite=None cookie that is not marked Secure, and it stopped tolerating the mismatch in the version that shipped last week.'
			},
			{
				author: 'Marta Lindqvist',
				role: 'agent',
				body: 'Your tenant is on a custom domain that terminates TLS at your load balancer and forwards plain HTTP, so we mark the cookie insecure. Setting X-Forwarded-Proto on the balancer fixes it. Could you check whether that header is set?'
			},
			{
				author: 'Hannah Weiss',
				role: 'requester',
				body: 'Our network team has the change queued for the Thursday maintenance window. I will confirm once it is live.'
			}
		]
	},
	{
		slug: 'desk-deleted-user-session-still-valid',
		subject: 'A deleted user can still use their existing session',
		status: 'pending',
		priority: 'urgent',
		name: 'Daniel Okonkwo',
		email: 'd.okonkwo@stonebridge.example',
		body: 'We removed a contractor from the workspace on Monday. Our audit log shows two API calls from their session on Tuesday morning. Deletion appears to stop new sign-ins but leaves the issued token working.\n\nWe need to know how long that window is, because it changes what we have to tell our security committee.',
		replies: [
			{
				author: 'Sam Whitfield',
				role: 'agent',
				body: 'The window is the remaining life of the access token, up to 15 minutes, plus the refresh token if one was issued to that session. Deletion revokes refresh tokens but does not invalidate an access token already in the wild.'
			},
			{
				author: 'Daniel Okonkwo',
				role: 'requester',
				body: 'The two calls were 19 hours after deletion, so that does not fit. Can you check the actual revocation record for that user?'
			},
			{
				author: 'Sam Whitfield',
				role: 'agent',
				body: 'You are right and I was wrong. Their token came from a personal access token, not a session, and those are tied to the workspace rather than the user. Deletion left it live. I have revoked it and I am escalating the behavior. I will come back with what we intend to change.'
			}
		]
	},
	{
		slug: 'desk-january-invoice-shows-old-plan',
		subject: 'January invoice still shows the previous plan',
		status: 'pending',
		priority: 'normal',
		name: 'Aoife Donnelly',
		email: 'aoife.donnelly@clearwater.example',
		body: 'We moved from Team to Business on 3 January. The January invoice bills the full month at the Team rate and the upgrade does not appear anywhere. The amount is lower than expected, so this is us telling you that you undercharged us.',
		replies: [
			{
				author: 'Luca Bianchi',
				role: 'agent',
				body: 'Thank you for flagging it rather than letting it ride. The upgrade was applied to the subscription but the proration line was written after the invoice was finalized, so it fell into the next cycle instead.'
			},
			{
				author: 'Luca Bianchi',
				role: 'agent',
				body: 'February will carry the 28 days of prorated Business plus the normal month. I have attached the breakdown to your billing page so your finance team can see the two lines separately. Leaving this with you until they confirm it reconciles.'
			}
		]
	},
	{
		slug: 'desk-second-sandbox-environment',
		subject: 'Can we get a second sandbox environment?',
		status: 'pending',
		priority: 'low',
		name: 'Elena Vasquez',
		email: 'elena.vasquez@puntoazul.example',
		body: 'We have two teams sharing one sandbox and they keep overwriting each other test data. Is a second sandbox something we can add on our plan, and what does it cost?',
		replies: [
			{
				author: 'Nadia Osei',
				role: 'agent',
				body: 'Business includes one sandbox and additional ones are 40 a month each. Before you buy: sandbox data is namespaced per API key, so two keys give the teams separate datasets in the same sandbox at no cost. That solves the overwriting for most people.'
			},
			{
				author: 'Elena Vasquez',
				role: 'requester',
				body: 'That might be enough. I will try the two-key setup with both teams this sprint and come back to you either way.'
			}
		]
	},
	{
		slug: 'desk-scheduled-reports-arrive-an-hour-early',
		subject: 'Scheduled reports arrive an hour early since the clock change',
		status: 'closed',
		priority: 'normal',
		name: 'Kenji Nakamura',
		email: 'kenji.nakamura@sakuraworks.example',
		body: 'Our daily report is set for 09:00 and has arrived at 08:00 every day since the end of October. The schedule screen still says 09:00.',
		replies: [
			{
				author: 'Marta Lindqvist',
				role: 'agent',
				body: 'The schedule was stored as a UTC offset rather than a zone name, so it kept the offset it had when you created it and did not follow the change. The screen shows what you typed, which is why it still reads 09:00.'
			},
			{
				author: 'Kenji Nakamura',
				role: 'requester',
				body: 'That explains why it was correct for eight months. Do I need to recreate the schedule?'
			},
			{
				author: 'Marta Lindqvist',
				role: 'agent',
				body: 'No. I have migrated your four schedules to named zones, so they will follow future changes. Tomorrow 09:00 should be 09:00.'
			},
			{
				author: 'Kenji Nakamura',
				role: 'requester',
				body: 'Arrived at 09:02 today. Thank you, closing this.'
			}
		]
	},
	{
		slug: 'desk-dashboard-charts-blank-on-firefox',
		subject: 'Dashboard charts render blank on Firefox 132',
		status: 'closed',
		priority: 'normal',
		name: 'Ruth Achterberg',
		email: 'r.achterberg@delftmetrics.example',
		body: 'Charts are blank rectangles on Firefox 132. The legend and axes draw, the series do not. The console has a message about a blocked resource but I cannot tell what it refers to.',
		replies: [
			{
				author: 'Sam Whitfield',
				role: 'agent',
				body: 'Could you paste the console message in full? A blocked resource on a chart is usually the content security policy refusing something, and the directive name tells us which.'
			},
			{
				author: 'Ruth Achterberg',
				role: 'requester',
				body: 'It says the page settings blocked an inline style from being applied because it violates style-src.'
			},
			{
				author: 'Sam Whitfield',
				role: 'agent',
				body: 'That is ours. The chart library writes inline styles on the series and our policy stopped allowing them in the 4.1 release, which only Firefox enforces this strictly. Fixed in 4.1.2, released this morning. Closing, but reopen if you still see it after a refresh.'
			}
		]
	},
	{
		slug: 'desk-teammate-invite-never-arrives',
		subject: 'Teammate invite email never arrives',
		status: 'closed',
		priority: 'high',
		name: 'Owen Pritchard',
		email: 'owen@pritchard-surveying.example',
		body: 'I have invited the same colleague four times over two days. The invite shows as pending in the members list and nothing reaches her inbox, including spam.',
		replies: [
			{
				author: 'Nadia Osei',
				role: 'agent',
				body: 'Our delivery log shows all four invites bounced with a hard rejection from her mail server, which is why nothing reached spam either. The reason given is that the recipient address does not exist.'
			},
			{
				author: 'Owen Pritchard',
				role: 'requester',
				body: 'She changed surname in December and the old address was retired. I had been typing the old one. Sorry for the noise.'
			},
			{
				author: 'Nadia Osei',
				role: 'agent',
				body: 'No apology needed, and the invite screen should have told you it bounced instead of sitting on pending. I have raised that separately. Her new address is invited and accepted.'
			}
		]
	},
	{
		slug: 'desk-vat-number-will-not-save',
		subject: 'VAT number will not save on the billing address',
		status: 'closed',
		priority: 'low',
		name: 'Ines Ferreira',
		email: 'ines.ferreira@atlanticoverde.example',
		body: 'Entering our VAT number and saving returns the form with the field empty and no error. Everything else on the billing address saves normally.',
		replies: [
			{
				author: 'Luca Bianchi',
				role: 'agent',
				body: 'We validate the number against the EU VIES service and drop it silently when validation fails, which is a poor way to tell you anything. VIES returned invalid for PT509xxxxxx because the number was entered without the PT prefix.'
			},
			{
				author: 'Ines Ferreira',
				role: 'requester',
				body: 'Adding the prefix worked. The silent failure cost me half an hour, but the fix is fine.'
			}
		]
	}
];

let replyCount = 0;

for (const ticket of tickets) {
	const { id } = await createContent(client, {
		schema: TICKETS,
		slug: ticket.slug,
		title: ticket.subject,
		body: {
			slug: ticket.slug,
			body: ticket.body,
			status: ticket.status,
			priority: ticket.priority,
			requester_name: ticket.name,
			requester_email: ticket.email
		}
	});

	// Replies go in one at a time so the thread reads in the order it happened.
	// The engine orders every read created_at DESC and offers no alternative,
	// so the app reverses the page rather than asking for another sort.
	for (const [i, reply] of ticket.replies.entries()) {
		const slug = `${ticket.slug}-r${i + 1}`;
		await createContent(client, {
			schema: REPLIES,
			slug,
			title: `Re: ${ticket.subject}`.slice(0, 200),
			body: {
				slug,
				body: reply.body,
				author_name: reply.author,
				author_role: reply.role,
				// Relations are written under the field name and read back as
				// `<field>_id`. See docs/VERIFIED-RECIPE.md section 6.
				ticket: id
			}
		});
		replyCount++;
	}
}

console.log(`seeded ${tickets.length} tickets and ${replyCount} replies`);
