# Changelog

All notable changes to this project are listed here, grouped by area. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] - 2026-11-04

### API (`code/wakala-api`)
- `GET /groups/at-point?lon=&lat=` lists the groups whose boundary holds a point, a ward index is built from group boundaries, and a point or other non-area boundary now answers 400 on `PUT /groups/{group_id}/boundary` (2026-11-07).
- Every role step of the municipality agency has a kind and a done form, so the agency imports whole (184 steps).
- A form carries an amount, and clearing it (plain or by slot) is refused unless the approver holds a live seat whose approval limit covers it; setting a limit and checking an amount are routes and tools (2026-11-07).
- A seat's approval limit can be changed on a live seat, and `AuthoriseApproval` refuses an amount over a seat's limit with a clear error (2026-11-07).
- A published poll count and the insight counts per subject apply the minimum count: a small cell is suppressed, a lone suppressed cell is covered, and the answered total is withheld when anything is hidden (2026-11-07).
- The custody, digitaltwin and engage modules are ported from the Mwanachama backend and mounted like voting, with their routes and operation tables (2026-11-07).
- The riskmanager module is mounted as `risks` with its routes, MCP tools and operation table, test-copy support and owner checks against the actor directory; an unknown owner is refused as a bad reference (2026-11-07).

- A group can carry a boundary (a GeoJSON Polygon or MultiPolygon), set on creation or with `PUT /groups/{group_id}/boundary`; a point or an unclosed ring is refused (2026-11-07).
- Custody gains a consent gate and a withdrawal notifier, not yet wired into other modules (2026-11-07).
- The consent gate now refuses chat and direct-message posts, RSVPs, offers of help and form answers without a live consent when custody is mounted; `POST /consent/withdraw` records a withdrawal in a database ledger (2026-11-07).
- A consent withdrawal now reaches engage (RSVPs and unpicked offers removed), forms (link answers unlinked from the member) and comm (push subscriptions dropped), and the per-account router gates the same acts (2026-11-07).
- The accounting overdue read can age from the day a charge was raised (`age_from`), and accounting gains contract milestones, payment certificates and retention (2026-11-07).
- The riskmanager module gains a name-matching tool and a gaps-by-owner filter for the chat agent, and four starter service-failure risk libraries (2026-11-07).

### Demo agencies (`demo`)
- `municipality.json` grows to 31 workflows and 172 work items (W-46 to W-50, W-53 to W-55, W-57) and mounts the risk module with a department-head and a council read role (2026-11-07).
- The Siaya lab's four documents are also in Hungarian (2026-11-07).
- `municipality.json`, an invented Hungarian town council with 12 roles and 5 workflows, and its copy in the console's templates (2026-11-07).
- `municipality.json` grows to 22 workflows and 124 work items, with the rule that an AI role only drafts, summarises, chases or counts (2026-11-07).

### Console (`code/console`)
- The 28 copied workflow walk tests in `src/journeys/` are one data-driven harness, `workflow.walk.test.tsx`, reading a small fixture per workflow from `src/journeys/walks/` (codes, role per step, which steps are AI steps, the approval wording and any extra text checks), with the RU-AI-1 meaning checked on every workflow (2026-11-07).
- Agency manager's web app: sign-in, create a hub, and the pages for approvals, people, groups, agents, documents and operations (2026-10-27). The Equipment page is drawn, not built.
- Model choice per agent, with limits, usage and instructions tabs (2026-10-27, 2026-11-03).
- Hub management and a hub switcher; six interface languages.
- Review page, workflow editor with objectives, and group-order screens (2026-10-29 to 2026-10-30).
- Chat actions, role limits, limit raises and the test budget with their approval views; the objective flow, test report, user cards, suggestions and workflow chat step pages; the first Usage pages (2026-11-02).
- Usage pages with chart components and the answer tab for a why question; sign-in redirect when the session expires, staff seats kept out of Usage, and the reason a page failed (2026-11-03).
- The workflow tab has a "Cancels an order" toggle in all six languages, saved as `cancels_order`; the "When it passes, run" picker lists only the ticked workflows and the one already chosen. This is the console half of HS674; the wakala-api half is still open (2026-11-06).

### Phone app (`code/app`)
- Mobile-first shell with app bar, tab bar and a small component kit (2026-10-28).
- Market screens: products, shops, prices, buy now and group orders.
- Sign-in, Home tiles and the shop's own wording on screen (2026-11-01).
- Chat-workflow, form-answering, catch-up and report journeys.
- Shared controls, sign-in renewal, the sign-in link page and inbox notices; group orders, unit words and the Ongoing page, with journey walks (2026-11-02).
- Do Something lists a member only the fill-form steps whose role she holds. Any such step in any agency opens a step page that builds the form from the step's questions and sends it; the row then shows Sent, and the next role's step appears in that person's Do Something (2026-11-05). Sent is kept per agency and per run, so a first step can start again; the group-order screen is chosen by the form's name, not its questions (2026-11-05). See [Do Something: each member's own steps](documentation/2.%20design/technical-spec/do-something-own-steps.md).
- After a member sends a workflow's first step, the Start list shows that step once, as Sent, and not also as an open row; a repeat start returns after an app reload (HS1020, 2026-11-06). The Forms card is hidden for a member with no form waiting and none answered, so a role with one step sees only that step; it stays if the read of forms fails (HS1021, 2026-11-06).

### Demo agencies (`demo`)
- Eight synthetic agencies: the Siaya lab (2026-10-21), boda-boda riders and farmers (2026-10-26), and the clinical research organization, electric grid utility, logistics freight company, mobile money operator and crop-spraying drone service (2026-11-01).
- The Siaya lab's house rules, booking rules, opening hours and Wi-Fi guide in English, Swahili and German.

### Bundled API (`code/wakala-api`)
- Trimmed copy of the Mwanachama API server the console and app talk to, with a Dockerfile (SQLite at `/data`, port 8082).
- Role-checked form steps: `agency_list_my_open_steps` with `available` lists the steps a caller can act on now, and `agency_submit_step_answers` checks the caller's role and the answers, saves them to the step's register and returns the next step; publishing makes a register for each fill-form step (2026-11-05). Two sends of one run's step at the same moment give one 201 and one 409; a multi-select answer may be a list of options, each checked against the question's options; steps with the same title in one workflow get their own registers (2026-11-05). See [Form steps](documentation/2.%20design/technical-spec/04-tools-and-apis/README.md#form-steps).

### Documentation
- Product, technical spec, user journeys, test plan and results (2026-10-21 onward).
- Risk library: hazards, threats, consequences and controls (2026-10-31).
- Reorganised into requirements, design, implementation and qa (2026-11-04).
- Scope broadened from a community computer lab to running an agency end to end; the Siaya lab stays as an example (2026-11-04).
- User journeys checked against the code: steps and "not yet built" lists corrected in journeys 01, 02, 05, 06, 08, 09, 10, 11, 12, 13, 14, 16, 18, 19, 20, 21, 22, 24, 25, 26, 27, 28 and 29 (2026-11-04).
- The See where the tokens go journey drawn, with its four-step walk-through and mockups (2026-11-03); the chat workflow journey's mockups and requirements (2026-11-02).
- Test results recorded: the console passes 3640 tests and builds; the phone app passes 1905 tests and builds; the bundled API has no test files, so `go test` only compiles it (2026-11-04).
- Demo index added: `demo/README.md` lists the eight agencies from their `agency.json` files (2026-11-04).
- Technical spec rewritten around what the bundled API mounts (2026-11-04).
- Network watch removed from the documentation (2026-11-04).
