# Changelog

All notable changes to this project are listed here, grouped by area. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] - 2026-11-04

### API (`code/wakala-api`)
- Forms can declare where their answers land (`lands_in`): the catalog, the ledger (one posting per key, a resend posts nothing twice) or ratings (given as the member who answered). Opening is refused while a question has no field or the module has no writer, a resend updates the same record, and a test run writes nothing (2026-11-08).
- A form edit that leaves out `lands_in` keeps it instead of clearing it, and opening a form is refused when a mapped field is not one the target module (accounting entry, ratings rating) lets a form fill (2026-11-11).
- Forms can declare `one_voice` (`refuse` or `flag`): a second send from the same member in the same round answers 409 `ErrSecondVoice` with the first answer standing, or is stored beside it as a repeat that no listing or count includes (2026-11-08).
- Form amounts: clearing a form with an amount is refused unless the approver holds a live seat whose approval limit covers it. A seat's limit can be changed on a live seat, and setting a limit and checking an amount are routes and tools (2026-11-07).
- Role-checked form steps: `agency_list_my_open_steps` with `available` lists the steps a caller can act on now, and `agency_submit_step_answers` checks the caller's role and the answers, saves them to the step's register and returns the next step. Publishing makes a register for each fill-form step. Two sends of one run's step at the same moment give one 201 and one 409, a multi-select answer may be a list of options each checked against the question's options, and steps with the same title in one workflow get their own registers (2026-11-05). See [Form steps](documentation/2.%20design/technical-spec/04-tools-and-apis/README.md#form-steps).
- Consent and withdrawal:

  - Custody gains a consent gate and a withdrawal notifier. The gate refuses chat and direct-message posts, RSVPs, offers of help and form answers without a live consent, and also gates check-in, notice and chat read markers and declarations; `POST /consent/withdraw` records a withdrawal in a database ledger (2026-11-07).
  - A withdrawal reaches engage, forms and comm, and the per-account router gates the same acts (2026-11-07).
  - `POST /consent/agree` records the caller's own consent to the sheet in force (language and structure optional, English when left out), 409 while no mechanics version is in force. A resident reaches this route and withdraw on a custody-mounted instance and no other custody route; agreeing again after a withdrawal restores the acts it gated (MUN84, 2026-11-11).
  - A resident also reads the sheet in force (`GET /consent/versions/in-force/{scope}/{language}`) and their own consent state (`GET /consent/mine`: `none`, `agreed` or `withdrawn`, with when and to which version); every other custody route, including reading a sheet by id or a draft, stays closed to a resident with 404 (MUN139, 2026-11-11).
  - A withdrawal hides a member's survey answers, event answers, unpicked offers of help and messages instead of deleting them (`WithWithdrawalPolicy`, default `keep_hidden`). Hidden rows leave counts and listings and come back when `withdrawn_at` is cleared; engage, comm and forms can list and restore one person's hidden rows, and `HiddenRowsOf` and `RestoreWithdrawn` on the agency registry gather the three for a legal request. A Postgres fan-out test covers hide, list and restore (2026-11-07, 2026-11-08).
  - A re-answer after a withdrawal is stored beside the hidden answer instead of overwriting or deleting it (2026-11-08).
- Insights minimum count:

  - The minimum is a declared setting (`minimum_count`, readable with `MinimumCount`); the insight count action has the `insight.count` permission (2026-11-07).
  - Counts below the minimum are folded into one `other` cell in poll counts and `GET /insights/counts`, and that cell is withheld while it is still below the minimum. A published poll count leaves out folded choices, and the answered total is withheld when anything is hidden (2026-11-07).
- Raised items carry a group, filled from a `routing` catalog setting (topic to group, with a default) and kept when a person set it. `PUT /raised-items/{raisedItemID}/department` (`catalog.raised_item.reassign`, under `board.manage`) reassigns it, and a member's own list and the follow read show the group and a status (2026-11-07).
- Group boundaries: a group can carry a boundary (a GeoJSON Polygon or MultiPolygon), set on creation or with `PUT /groups/{group_id}/boundary`; a point or an unclosed ring is refused with 400. `GET /groups/at-point?lon=&lat=` lists the groups whose boundary holds a point, and an area index is built from boundaries. A raised item with a pin and no area, and a catalog entry with a `location` point and no area, get the area from the boundaries; a typed one is kept and a mismatch is flagged (2026-11-07).
- The custody, digitaltwin and engage modules are ported from the Mwanachama backend and mounted with their routes and operation tables (2026-11-07).
- The riskmanager module is mounted as `risks` with its routes, MCP tools and operation table, test-copy support and owner checks against the actor directory; an unknown owner is refused as a bad reference. It gains a name-matching tool, a gaps-by-owner filter for the chat agent and starter risk libraries (2026-11-07).
- The accounting overdue read can age from the day a charge was raised (`age_from`), and accounting gains milestones, payment certificates and retention (2026-11-07).
- Trimmed copy of the Mwanachama API server the console and app talk to, with a Dockerfile (SQLite at `/data`, port 8082).

### Console (`code/console`)
- Agency manager's web app: sign-in, create a hub, and the pages for approvals, people, groups, agents, documents and operations (2026-10-27). The Equipment page is drawn, not built.
- Model choice per agent, with limits, usage and instructions tabs (2026-10-27, 2026-11-03).
- Hub management and a hub switcher; six interface languages.
- Review page, workflow editor with objectives, and group-order screens (2026-10-29 to 2026-10-30).
- Chat actions, role limits, limit raises and the test budget with their approval views; the objective flow, test report, user cards, suggestions and workflow chat step pages; the first Usage pages (2026-11-02).
- Usage pages with chart components and the answer tab for a why question; sign-in redirect when the session expires, staff seats kept out of Usage, and the reason a page failed (2026-11-03).
- The workflow tab has a "Cancels an order" toggle in all six languages, saved as `cancels_order`; the "When it passes, run" picker lists only the ticked workflows and the one already chosen. This is the console half of HS674; the wakala-api half is still open (2026-11-06).
- The copied workflow walk tests in `src/journeys/` are one data-driven harness, `workflow.walk.test.tsx`, reading a small fixture per workflow from `src/journeys/walks/` (codes, role per step, which steps are AI steps, the approval wording and any extra text checks) (2026-11-07).
- An agency can be kept out of the template picker: a person sees only the agency their own user set belongs to (2026-11-08).

### Phone app (`code/app`)
- Mobile-first shell with app bar, tab bar and a small component kit (2026-10-28).
- Market screens for browsing, buying and group orders.
- Sign-in, Home tiles and the agency's own wording on screen (2026-11-01).
- Chat-workflow, form-answering, catch-up and report journeys.
- Shared controls, sign-in renewal, the sign-in link page and inbox notices; group orders, unit words and the Ongoing page, with journey walks (2026-11-02).
- Do Something lists a member only the fill-form steps whose role they hold. Any such step in any agency opens a step page that builds the form from the step's questions and sends it; the row then shows Sent, and the next role's step appears in that person's Do Something (2026-11-05). Sent is kept per agency and per run, so a first step can start again; the group-order screen is chosen by the form's name, not its questions (2026-11-05). See [Do Something: each member's own steps](documentation/2.%20design/technical-spec/do-something-own-steps.md).
- After a member sends a workflow's first step, the Start list shows that step once, as Sent, and not also as an open row; a repeat start returns after an app reload (HS1020, 2026-11-06). The Forms card is hidden for a member with no form waiting and none answered, so a role with one step sees only that step; it stays if the read of forms fails (HS1021, 2026-11-06).

### Demo agencies (`demo`)
- Synthetic agencies from different sectors, each described by an `agency.json`, with their documents in several languages (2026-10-21 to 2026-11-01).
- Agencies import whole: every role step has a kind and a done form.
- Demo agencies follow the rule that an AI role only drafts, summarises, chases or counts, and can mount the risk module with read roles (2026-11-07).

### Documentation
- Product, technical spec, user journeys, test plan and results (2026-10-21 onward).
- Risk library: hazards, threats, consequences and controls (2026-10-31).
- Reorganised into requirements, design, implementation and qa (2026-11-04).
- Scope broadened from a single community venue to running an agency end to end (2026-11-04).
- User journeys checked against the code: steps and "not yet built" lists corrected across the journeys (2026-11-04).
- The See where the tokens go journey drawn, with its four-step walk-through and mockups (2026-11-03); the chat workflow journey's mockups and requirements (2026-11-02).
- Test results recorded: the console passes 3640 tests and builds; the phone app passes 1905 tests and builds; the bundled API has no test files, so `go test` only compiles it (2026-11-04).
- Demo index added: `demo/README.md` lists the agencies from their `agency.json` files (2026-11-04).
- Technical spec rewritten around what the bundled API mounts (2026-11-04).
- Network watch removed from the documentation (2026-11-04).
