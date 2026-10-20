# Measured results

Every row was produced by `perf/run.sh` from an actual run. Nothing here is a
target, an estimate or a figure carried over from elsewhere. The engine commit
is recorded per row because a change to the engine changes what these mean.

The two layers answer different questions. `app` is the server-rendered page a
visitor waits for, which includes SvelteKit and every engine call that page
makes. `engine` is the engine alone for that app's primary content type. A slow
page with a fast engine is the app's own doing.

These ran on a development machine. They are comparable with each other and with
nothing else.

| App | Layer | Run (UTC) | Requests | Rate/s | p50 ms | p95 ms | p99 ms | OK | Thresholds | Engine |
|---|---|---|---:|---:|---:|---:|---:|---:|---|---|
| blog | engine | 20260904T123636Z | 603 | 40.0 | 4.07 | 6.76 | 7.86 | 100.00% | met | 449beae |
| blog | app | 20260904T124034Z | 227 | 14.9 | 23.28 | 80.22 | 81.86 | 100.00% | met | 449beae |
| blog | app | 20260904T124150Z | 302 | 19.6 | 19.39 | 62.78 | 63.80 | 100.00% | met | 449beae |
| blog | engine | 20260904T124206Z | 302 | 20.0 | 5.08 | 7.95 | 8.81 | 100.00% | met | 449beae |
| booking | app | 20260904T124222Z | 302 | 19.8 | 24.83 | 68.28 | 69.69 | 100.00% | met | 449beae |
| booking | engine | 20260904T124238Z | 303 | 20.1 | 5.46 | 10.89 | 17.32 | 100.00% | met | 449beae |
| company-site | app | 20260904T124254Z | 302 | 19.7 | 25.62 | 64.03 | 65.67 | 100.00% | met | 449beae |
| company-site | engine | 20260904T124310Z | 303 | 20.1 | 4.82 | 10.66 | 16.03 | 100.00% | met | 449beae |
| docs-portal | app | 20260904T124326Z | 302 | 19.7 | 34.83 | 69.73 | 86.38 | 100.00% | met | 449beae |
| docs-portal | engine | 20260904T124342Z | 302 | 19.9 | 3.92 | 10.00 | 12.75 | 100.00% | met | 449beae |
| events-ticketing | app | 20260904T124358Z | 303 | 19.3 | 44.97 | 77.80 | 86.72 | 100.00% | met | 449beae |
| events-ticketing | engine | 20260904T124415Z | 303 | 20.1 | 7.29 | 11.98 | 15.75 | 100.00% | met | 449beae |
| helpdesk | app | 20260904T124431Z | 302 | 18.6 | 24.99 | 68.95 | 92.73 | 100.00% | met | 449beae |
| helpdesk | engine | 20260904T124448Z | 303 | 20.1 | 6.57 | 12.57 | 15.69 | 100.00% | met | 449beae |
| jobs-board | app | 20260904T124504Z | 302 | 19.5 | 45.71 | 71.27 | 83.64 | 100.00% | met | 449beae |
| jobs-board | engine | 20260904T124521Z | 303 | 20.0 | 5.02 | 15.38 | 25.53 | 100.00% | met | 449beae |
| lms-courses | app | 20260904T124537Z | 302 | 20.1 | 45.45 | 79.74 | 91.59 | 100.00% | met | 449beae |
| lms-courses | engine | 20260904T124553Z | 302 | 20.0 | 4.11 | 7.23 | 7.98 | 100.00% | met | 449beae |
| marketplace | app | 20260904T124609Z | 302 | 19.9 | 2.84 | 4.44 | 60.89 | 1.99% | 2 breached | 449beae |

## Notes on specific rows

**The content list cache fix, before and after, at identical load.** 40 requests per second for 15
seconds, 603 requests, blog_posts:

| Engine | p50 ms | p95 ms | p99 ms |
|---|---:|---:|---:|
| before the fix | 4.07 | 6.76 | 7.86 |
| after the fix | 4.22 | 6.79 | 7.62 |

Copying a cached row for each caller costs nothing measurable at this document
size: p99 came out lower after the fix, which is run-to-run variance rather than
an improvement. The same binary then served 19,200 requests through the script
that killed the unfixed engine after 73.

**Provenance caveat on the rows above the last one.** Early rows record a
`source_checkout_commit` in the Binary column rather than a binary fingerprint,
because the first version of `run.sh` recorded the commit of the source checkout.
That is not the identity of what ran: the binary can come from a worktree, and
the checkout can move on while a long-running engine keeps serving the build it
started with. Both happened here. Rows from `cd7c4835179a` onward carry the
sha256 prefix of the binary actually measured.

**marketplace / app / 20260904T124609Z, 1.99% OK.** Not an application fault.
The engine died partway through that sweep, so those page requests were failing
to reach it. The cause is a data race in the engine's content list cache:
concurrent reads of the same page share one map, and a read carrying `populate`
writes it while another marshals it for an ETag, which aborts the process with
an unrecoverable fatal error. Reproduced afterwards in five seconds from a cold
boot. The row is kept because it was measured and because it is how the bug was
found.

That crash also stopped the sweep at marketplace, which is why the apps after it
have no rows from that run. `run.sh` no longer aborts a sweep when one target is
unreachable.
| blog | engine | 20260904T142206Z | 603 | 40.0 | 4.22 | 6.79 | 7.62 | 100.00% | met | c803ee1 |
| blog | engine | 20260904T142250Z | 603 | 40.0 | 4.13 | 6.96 | 7.77 | 100.00% | met | cd7c4835179a |
| analytics-dashboard | app | 20261005T220348Z | 602 | 20.0 | 9.80 | 18.28 | 19.59 | 100.00% | met | ed346a5eea36 |
| analytics-dashboard | engine | 20261005T220420Z | 1503 | 50.0 | 2.30 | 4.56 | 6.54 | 100.00% | met | ed346a5eea36 |
| blog | app | 20261005T220451Z | 602 | 20.1 | 7.37 | 11.32 | 13.50 | 100.00% | met | ed346a5eea36 |
| blog | engine | 20261005T220522Z | 1502 | 49.9 | 2.44 | 5.06 | 6.59 | 100.00% | met | ed346a5eea36 |
| booking | app | 20261005T220553Z | 602 | 20.1 | 11.40 | 15.77 | 17.27 | 100.00% | met | ed346a5eea36 |
| booking | engine | 20261005T220624Z | 1502 | 49.9 | 2.50 | 5.92 | 7.49 | 100.00% | met | ed346a5eea36 |
| cms-migration | app | 20261005T220656Z | 601 | 20.0 | 10.44 | 18.68 | 20.03 | 100.00% | met | ed346a5eea36 |
| cms-migration | engine | 20261005T220727Z | 1503 | 50.0 | 2.66 | 4.99 | 6.14 | 100.00% | met | ed346a5eea36 |
| community-forum | app | 20261005T220758Z | 602 | 20.0 | 10.73 | 15.54 | 101.06 | 100.00% | met | ed346a5eea36 |
| community-forum | engine | 20261005T220829Z | 1502 | 50.0 | 2.34 | 5.02 | 7.27 | 100.00% | met | ed346a5eea36 |
| company-site | app | 20261005T220900Z | 603 | 20.1 | 8.71 | 12.27 | 13.08 | 100.00% | met | ed346a5eea36 |
| company-site | engine | 20261005T220931Z | 1502 | 50.0 | 2.29 | 4.39 | 6.16 | 100.00% | met | ed346a5eea36 |
| docs-portal | app | 20261005T221002Z | 602 | 20.0 | 13.21 | 17.62 | 19.30 | 100.00% | met | ed346a5eea36 |
| docs-portal | engine | 20261005T221034Z | 1503 | 50.0 | 1.91 | 3.83 | 5.46 | 100.00% | met | ed346a5eea36 |
| events-ticketing | app | 20261005T221105Z | 602 | 20.1 | 9.99 | 14.42 | 16.64 | 100.00% | met | ed346a5eea36 |
| events-ticketing | engine | 20261005T221136Z | 1503 | 50.0 | 3.35 | 5.67 | 7.33 | 100.00% | met | ed346a5eea36 |
| graphql-storefront | app | 20261005T221207Z | 602 | 20.0 | 9.62 | 35.40 | 40.88 | 100.00% | met | ed346a5eea36 |
| graphql-storefront | engine | 20261005T221238Z | 1503 | 50.0 | 2.44 | 5.27 | 6.80 | 100.00% | met | ed346a5eea36 |
| helpdesk | app | 20261005T221309Z | 602 | 20.0 | 12.50 | 134.57 | 327.39 | 100.00% | met | ed346a5eea36 |
| helpdesk | engine | 20261005T221341Z | 1503 | 50.0 | 3.52 | 6.59 | 8.15 | 100.00% | met | ed346a5eea36 |
| jobs-board | app | 20261005T221412Z | 602 | 20.0 | 10.09 | 19.51 | 22.16 | 100.00% | met | ed346a5eea36 |
| jobs-board | engine | 20261005T221443Z | 1502 | 49.9 | 2.61 | 6.85 | 8.35 | 100.00% | met | ed346a5eea36 |
| lms-courses | app | 20261005T221514Z | 602 | 20.0 | 17.03 | 23.74 | 26.87 | 100.00% | met | ed346a5eea36 |
| lms-courses | engine | 20261005T221545Z | 1502 | 50.0 | 2.39 | 4.63 | 6.36 | 100.00% | met | ed346a5eea36 |
| marketplace | app | 20261005T221616Z | 602 | 20.0 | 14.34 | 21.54 | 23.37 | 100.00% | met | ed346a5eea36 |
| marketplace | engine | 20261005T221648Z | 1503 | 50.0 | 2.16 | 4.18 | 6.43 | 100.00% | met | ed346a5eea36 |
| media-library | app | 20261005T221719Z | 602 | 20.1 | 10.13 | 15.63 | 17.24 | 100.00% | met | ed346a5eea36 |
| media-library | engine | 20261005T221750Z | 1503 | 50.0 | 2.51 | 5.41 | 6.96 | 100.00% | met | ed346a5eea36 |
| mobile-api-backend | app | 20261005T221821Z | 601 | 20.0 | 12.35 | 16.01 | 17.70 | 100.00% | met | ed346a5eea36 |
| mobile-api-backend | engine | 20261005T221852Z | 1503 | 50.0 | 2.20 | 4.57 | 6.40 | 100.00% | met | ed346a5eea36 |
| multi-language-site | app | 20261005T221924Z | 763 | 25.3 | 17.72 | 22.63 | 24.10 | 100.00% | met | ed346a5eea36 |
| multi-language-site | engine | 20261005T221955Z | 1503 | 50.0 | 1.94 | 3.88 | 5.63 | 100.00% | met | ed346a5eea36 |
| newsroom | app | 20261005T222026Z | 602 | 20.1 | 8.36 | 12.67 | 14.38 | 100.00% | met | ed346a5eea36 |
| newsroom | engine | 20261005T222057Z | 1503 | 50.0 | 2.86 | 5.14 | 7.40 | 100.00% | met | ed346a5eea36 |
| privacy-compliance | app | 20261005T222128Z | 602 | 20.1 | 11.61 | 16.90 | 106.24 | 100.00% | met | ed346a5eea36 |
| privacy-compliance | engine | 20261005T222200Z | 1503 | 50.0 | 3.70 | 6.69 | 8.19 | 100.00% | met | ed346a5eea36 |
| realtime-feed | app | 20261005T222231Z | 602 | 20.1 | 9.29 | 11.73 | 12.75 | 100.00% | met | ed346a5eea36 |
| realtime-feed | engine | 20261005T222302Z | 1502 | 49.9 | 2.44 | 5.14 | 6.38 | 100.00% | met | ed346a5eea36 |
| saas-multitenant | app | 20261005T222333Z | 602 | 20.0 | 11.37 | 16.91 | 19.09 | 100.00% | met | ed346a5eea36 |
| saas-multitenant | engine | 20261005T222404Z | 1503 | 50.0 | 3.20 | 5.46 | 7.06 | 100.00% | met | ed346a5eea36 |
| search-console | engine | 20261005T222436Z | 1502 | 50.0 | 2.15 | 4.57 | 6.67 | 100.00% | met | ed346a5eea36 |
| subscription-gating | app | 20261005T222507Z | 602 | 20.1 | 8.66 | 14.02 | 15.22 | 100.00% | met | ed346a5eea36 |
| subscription-gating | engine | 20261005T222539Z | 1503 | 50.0 | 3.02 | 5.32 | 7.29 | 100.00% | met | ed346a5eea36 |
| webhook-integrations | app | 20261005T222610Z | 601 | 20.0 | 9.18 | 15.03 | 16.96 | 100.00% | met | ed346a5eea36 |
| search-console | app | 20261005T222845Z | 919 | 30.6 | 11.22 | 34.30 | 42.62 | 100.00% | met | ed346a5eea36 |
| webhook-integrations | engine | 20261005T222916Z | 1502 | 50.0 | 3.00 | 5.23 | 6.80 | 100.00% | met | ed346a5eea36 |
| analytics-dashboard | app | 20261011T154503Z | 601 | 20.0 | 10.92 | 21.65 | 23.71 | 100.00% | met | d675fc0dbcb4 |
| analytics-dashboard | engine | 20261011T154535Z | 1503 | 50.0 | 2.33 | 4.55 | 5.90 | 100.00% | met | d675fc0dbcb4 |
| blog | app | 20261011T154606Z | 602 | 20.1 | 7.59 | 11.37 | 12.96 | 100.00% | met | d675fc0dbcb4 |
| blog | engine | 20261011T154637Z | 1503 | 50.0 | 2.54 | 4.88 | 6.36 | 100.00% | met | d675fc0dbcb4 |
| booking | app | 20261011T154708Z | 602 | 20.0 | 11.57 | 14.84 | 16.26 | 100.00% | met | d675fc0dbcb4 |
| booking | engine | 20261011T154739Z | 1502 | 50.0 | 2.61 | 6.10 | 7.46 | 100.00% | met | d675fc0dbcb4 |
| cms-migration | app | 20261011T154810Z | 602 | 20.0 | 11.46 | 18.58 | 20.02 | 100.00% | met | d675fc0dbcb4 |
| cms-migration | engine | 20261011T154842Z | 1503 | 50.0 | 2.62 | 4.91 | 5.92 | 100.00% | met | d675fc0dbcb4 |
| community-forum | app | 20261011T154913Z | 602 | 20.0 | 12.90 | 17.73 | 258.92 | 100.00% | met | d675fc0dbcb4 |
| community-forum | engine | 20261011T154944Z | 1503 | 50.0 | 2.38 | 4.51 | 5.48 | 100.00% | met | d675fc0dbcb4 |
| company-site | app | 20261011T155016Z | 603 | 20.1 | 7.58 | 9.52 | 11.19 | 100.00% | met | d675fc0dbcb4 |
| company-site | engine | 20261011T155048Z | 1503 | 50.0 | 2.34 | 4.36 | 5.76 | 100.00% | met | d675fc0dbcb4 |
| docs-portal | app | 20261011T155119Z | 602 | 20.0 | 14.24 | 18.10 | 19.36 | 100.00% | met | d675fc0dbcb4 |
| docs-portal | engine | 20261011T155151Z | 1502 | 49.9 | 2.12 | 4.03 | 5.64 | 100.00% | met | d675fc0dbcb4 |
| events-ticketing | app | 20261011T155222Z | 603 | 20.1 | 10.65 | 14.73 | 16.89 | 100.00% | met | d675fc0dbcb4 |
| events-ticketing | engine | 20261011T155253Z | 1502 | 50.0 | 3.46 | 5.44 | 7.00 | 100.00% | met | d675fc0dbcb4 |
| graphql-storefront | app | 20261011T155324Z | 602 | 20.1 | 10.00 | 36.52 | 41.81 | 100.00% | met | d675fc0dbcb4 |
| graphql-storefront | engine | 20261011T155356Z | 1503 | 50.0 | 2.63 | 5.27 | 6.52 | 100.00% | met | d675fc0dbcb4 |
| helpdesk | app | 20261011T155427Z | 601 | 20.0 | 13.09 | 36.73 | 240.13 | 100.00% | met | d675fc0dbcb4 |
| helpdesk | engine | 20261011T155458Z | 1502 | 49.9 | 5.00 | 8.13 | 9.13 | 100.00% | met | d675fc0dbcb4 |
| jobs-board | app | 20261011T155529Z | 601 | 20.0 | 10.50 | 19.33 | 21.99 | 100.00% | met | d675fc0dbcb4 |
| jobs-board | engine | 20261011T155601Z | 1502 | 49.9 | 2.68 | 6.93 | 8.16 | 100.00% | met | d675fc0dbcb4 |
| lms-courses | app | 20261011T155632Z | 601 | 20.0 | 17.11 | 22.74 | 24.80 | 100.00% | met | d675fc0dbcb4 |
| lms-courses | engine | 20261011T155703Z | 1503 | 50.0 | 2.56 | 4.85 | 6.12 | 100.00% | met | d675fc0dbcb4 |
| marketplace | app | 20261011T155733Z | 602 | 20.0 | 15.14 | 20.87 | 23.23 | 100.00% | met | d675fc0dbcb4 |
| marketplace | engine | 20261011T155805Z | 1503 | 50.0 | 2.15 | 4.49 | 5.89 | 100.00% | met | d675fc0dbcb4 |
| media-library | app | 20261011T155836Z | 601 | 20.0 | 9.52 | 14.16 | 16.13 | 100.00% | met | d675fc0dbcb4 |
| media-library | engine | 20261011T155907Z | 1503 | 50.0 | 2.41 | 4.76 | 5.75 | 100.00% | met | d675fc0dbcb4 |
| mobile-api-backend | app | 20261011T155937Z | 602 | 20.0 | 11.52 | 20.15 | 29.58 | 100.00% | met | d675fc0dbcb4 |
| mobile-api-backend | engine | 20261011T160010Z | 1503 | 50.0 | 2.34 | 4.26 | 5.81 | 100.00% | met | d675fc0dbcb4 |
| multi-language-site | app | 20261011T160040Z | 783 | 26.0 | 17.13 | 20.51 | 22.51 | 100.00% | met | d675fc0dbcb4 |
| multi-language-site | engine | 20261011T160113Z | 1503 | 50.0 | 2.22 | 4.39 | 6.37 | 100.00% | met | d675fc0dbcb4 |
| newsroom | app | 20261011T160144Z | 601 | 20.0 | 8.64 | 12.26 | 13.70 | 100.00% | met | d675fc0dbcb4 |
| newsroom | engine | 20261011T160215Z | 1503 | 50.0 | 2.99 | 5.29 | 7.18 | 100.00% | met | d675fc0dbcb4 |
| privacy-compliance | app | 20261011T160246Z | 602 | 20.0 | 11.90 | 18.71 | 21.14 | 100.00% | met | d675fc0dbcb4 |
| privacy-compliance | engine | 20261011T160318Z | 1502 | 50.0 | 3.69 | 6.21 | 7.48 | 100.00% | met | d675fc0dbcb4 |
| realtime-feed | app | 20261011T160349Z | 602 | 20.1 | 9.27 | 11.51 | 12.55 | 100.00% | met | d675fc0dbcb4 |
| realtime-feed | engine | 20261011T160420Z | 1503 | 50.0 | 2.63 | 5.12 | 6.52 | 100.00% | met | d675fc0dbcb4 |
| saas-multitenant | app | 20261011T160452Z | 602 | 20.0 | 13.05 | 18.64 | 20.49 | 100.00% | met | d675fc0dbcb4 |
| saas-multitenant | engine | 20261011T160523Z | 1503 | 50.0 | 4.42 | 6.68 | 8.08 | 100.00% | met | d675fc0dbcb4 |
| search-console | app | 20261011T160555Z | 892 | 29.7 | 11.70 | 37.44 | 43.84 | 100.00% | met | d675fc0dbcb4 |
| search-console | engine | 20261011T160626Z | 1502 | 49.9 | 2.18 | 4.20 | 5.26 | 100.00% | met | d675fc0dbcb4 |
| subscription-gating | app | 20261011T160656Z | 601 | 20.0 | 8.19 | 13.57 | 14.93 | 100.00% | met | d675fc0dbcb4 |
| subscription-gating | engine | 20261011T160728Z | 1503 | 50.0 | 2.99 | 4.79 | 5.81 | 100.00% | met | d675fc0dbcb4 |
| webhook-integrations | app | 20261011T160759Z | 602 | 20.0 | 9.24 | 15.00 | 16.44 | 100.00% | met | d675fc0dbcb4 |
| webhook-integrations | engine | 20261011T160830Z | 1502 | 50.0 | 3.08 | 5.19 | 6.36 | 100.00% | met | d675fc0dbcb4 |
| analytics-dashboard | app | 20261020T133955Z | 602 | 20.0 | 10.51 | 22.23 | 24.26 | 100.00% | met | fb3cebb3a4a4 |
| analytics-dashboard | engine | 20261020T134027Z | 1502 | 49.9 | 2.71 | 5.36 | 7.89 | 100.00% | met | fb3cebb3a4a4 |
| blog | app | 20261020T134058Z | 602 | 20.1 | 7.85 | 12.20 | 21.19 | 100.00% | met | fb3cebb3a4a4 |
| blog | engine | 20261020T134129Z | 1502 | 50.0 | 2.90 | 5.38 | 7.39 | 100.00% | met | fb3cebb3a4a4 |
| booking | app | 20261020T134200Z | 602 | 20.0 | 12.68 | 15.96 | 16.96 | 100.00% | met | fb3cebb3a4a4 |
| booking | engine | 20261020T134232Z | 1503 | 50.0 | 2.70 | 6.32 | 7.50 | 100.00% | met | fb3cebb3a4a4 |
| cms-migration | app | 20261020T134303Z | 601 | 20.0 | 9.81 | 20.02 | 21.34 | 100.00% | met | fb3cebb3a4a4 |
| cms-migration | engine | 20261020T134334Z | 1502 | 50.0 | 2.97 | 5.61 | 6.80 | 100.00% | met | fb3cebb3a4a4 |
| community-forum | app | 20261020T134405Z | 600 | 19.9 | 14.53 | 128.59 | 529.76 | 100.00% | met | fb3cebb3a4a4 |
| community-forum | engine | 20261020T134437Z | 1502 | 49.9 | 2.85 | 5.32 | 7.21 | 100.00% | met | fb3cebb3a4a4 |
| company-site | app | 20261020T134508Z | 603 | 20.1 | 9.42 | 12.36 | 13.73 | 100.00% | met | fb3cebb3a4a4 |
| company-site | engine | 20261020T134539Z | 1503 | 50.0 | 2.63 | 5.07 | 6.68 | 100.00% | met | fb3cebb3a4a4 |
| docs-portal | app | 20261020T134610Z | 602 | 20.0 | 13.96 | 18.11 | 19.55 | 100.00% | met | fb3cebb3a4a4 |
| docs-portal | engine | 20261020T134641Z | 1503 | 50.0 | 2.26 | 4.67 | 6.82 | 100.00% | met | fb3cebb3a4a4 |
| events-ticketing | app | 20261020T134712Z | 602 | 20.1 | 11.49 | 15.49 | 16.81 | 100.00% | met | fb3cebb3a4a4 |
| events-ticketing | engine | 20261020T134743Z | 1502 | 50.0 | 3.84 | 6.49 | 8.36 | 100.00% | met | fb3cebb3a4a4 |
| graphql-storefront | app | 20261020T134814Z | 602 | 20.1 | 10.40 | 38.92 | 41.89 | 100.00% | met | fb3cebb3a4a4 |
| graphql-storefront | engine | 20261020T134845Z | 1503 | 50.0 | 2.68 | 5.68 | 6.86 | 100.00% | met | fb3cebb3a4a4 |
| helpdesk | app | 20261020T134916Z | 599 | 19.9 | 13.36 | 175.32 | 542.18 | 100.00% | met | fb3cebb3a4a4 |
| helpdesk | engine | 20261020T134947Z | 1502 | 49.9 | 4.23 | 7.52 | 8.88 | 100.00% | met | fb3cebb3a4a4 |
| jobs-board | app | 20261020T135018Z | 602 | 20.1 | 10.89 | 20.09 | 24.00 | 100.00% | met | fb3cebb3a4a4 |
| jobs-board | engine | 20261020T135050Z | 1503 | 50.0 | 3.19 | 7.59 | 8.63 | 100.00% | met | fb3cebb3a4a4 |
| lms-courses | app | 20261020T135121Z | 602 | 20.0 | 17.85 | 25.50 | 27.90 | 100.00% | met | fb3cebb3a4a4 |
| lms-courses | engine | 20261020T135153Z | 1503 | 50.0 | 2.69 | 5.16 | 6.52 | 100.00% | met | fb3cebb3a4a4 |
| marketplace | app | 20261020T135224Z | 602 | 20.0 | 14.83 | 22.61 | 23.86 | 100.00% | met | fb3cebb3a4a4 |
| marketplace | engine | 20261020T135255Z | 1503 | 50.0 | 2.43 | 4.39 | 6.23 | 100.00% | met | fb3cebb3a4a4 |
| media-library | app | 20261020T135326Z | 602 | 20.0 | 10.77 | 16.39 | 17.70 | 100.00% | met | fb3cebb3a4a4 |
| media-library | engine | 20261020T135358Z | 1503 | 50.0 | 2.71 | 5.27 | 6.55 | 100.00% | met | fb3cebb3a4a4 |
| mobile-api-backend | app | 20261020T135428Z | 602 | 20.0 | 12.99 | 16.25 | 18.08 | 100.00% | met | fb3cebb3a4a4 |
| mobile-api-backend | engine | 20261020T135500Z | 1503 | 50.0 | 2.56 | 5.05 | 6.71 | 100.00% | met | fb3cebb3a4a4 |
| multi-language-site | app | 20261020T135531Z | 770 | 25.6 | 18.18 | 22.16 | 24.25 | 100.00% | met | fb3cebb3a4a4 |
| multi-language-site | engine | 20261020T135603Z | 1502 | 50.0 | 2.31 | 4.78 | 6.79 | 100.00% | met | fb3cebb3a4a4 |
| newsroom | app | 20261020T135634Z | 602 | 20.1 | 9.11 | 13.43 | 14.61 | 100.00% | met | fb3cebb3a4a4 |
| newsroom | engine | 20261020T135707Z | 1503 | 50.0 | 3.17 | 5.75 | 7.70 | 100.00% | met | fb3cebb3a4a4 |
| privacy-compliance | app | 20261020T135738Z | 601 | 20.0 | 12.08 | 18.16 | 137.39 | 100.00% | met | fb3cebb3a4a4 |
| privacy-compliance | engine | 20261020T135809Z | 1503 | 50.0 | 3.90 | 6.84 | 8.70 | 100.00% | met | fb3cebb3a4a4 |
| realtime-feed | app | 20261020T135840Z | 602 | 20.1 | 9.80 | 12.18 | 13.12 | 100.00% | met | fb3cebb3a4a4 |
| realtime-feed | engine | 20261020T135911Z | 1503 | 50.0 | 2.94 | 5.71 | 6.51 | 100.00% | met | fb3cebb3a4a4 |
| saas-multitenant | app | 20261020T135942Z | 602 | 20.0 | 11.40 | 17.22 | 18.69 | 100.00% | met | fb3cebb3a4a4 |
| saas-multitenant | engine | 20261020T140013Z | 1502 | 50.0 | 3.60 | 5.72 | 7.67 | 100.00% | met | fb3cebb3a4a4 |
| search-console | app | 20261020T140044Z | 905 | 30.1 | 11.95 | 35.98 | 42.92 | 100.00% | met | fb3cebb3a4a4 |
| search-console | engine | 20261020T140115Z | 1503 | 50.0 | 2.27 | 4.69 | 6.86 | 100.00% | met | fb3cebb3a4a4 |
| subscription-gating | app | 20261020T140146Z | 602 | 20.1 | 9.54 | 14.63 | 15.41 | 100.00% | met | fb3cebb3a4a4 |
| subscription-gating | engine | 20261020T140217Z | 1502 | 49.9 | 3.10 | 5.57 | 7.91 | 100.00% | met | fb3cebb3a4a4 |
| webhook-integrations | app | 20261020T140248Z | 601 | 20.0 | 9.74 | 15.95 | 17.11 | 100.00% | met | fb3cebb3a4a4 |
| webhook-integrations | engine | 20261020T140319Z | 1503 | 50.0 | 3.25 | 5.62 | 8.02 | 100.00% | met | fb3cebb3a4a4 |
