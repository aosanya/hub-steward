# Changelog

All notable changes to this project are listed here, grouped by area. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] - 2026-11-04

### Console (`code/console`)
- Agency manager's web app: sign-in, create a hub, and the pages for approvals, people, groups, agents, documents and operations (2026-10-27). The Equipment page is drawn, not built.
- Model choice per agent, with limits, usage and instructions tabs (2026-10-27, 2026-11-03).
- Hub management and a hub switcher; six interface languages.
- Review page, workflow editor with objectives, and group-order screens (2026-10-29 to 2026-10-30).
- Chat actions, role limits, limit raises and the test budget with their approval views; the objective flow, test report, user cards, suggestions and workflow chat step pages; the first Usage pages (2026-11-02).
- Usage pages with chart components and the answer tab for a why question; sign-in redirect when the session expires, staff seats kept out of Usage, and the reason a page failed (2026-11-03).

### Phone app (`code/app`)
- Mobile-first shell with app bar, tab bar and a small component kit (2026-10-28).
- Market screens: products, shops, prices, buy now and group orders.
- Sign-in, Home tiles and the shop's own wording on screen (2026-11-01).
- Chat-workflow, form-answering, catch-up and report journeys.
- Shared controls, sign-in renewal, the sign-in link page and inbox notices; group orders, unit words and the Ongoing page, with journey walks (2026-11-02).

### Demo agencies (`demo`)
- Eight synthetic agencies: the Siaya lab (2026-10-21), boda-boda riders and farmers (2026-10-26), and the clinical research organization, electric grid utility, logistics freight company, mobile money operator and crop-spraying drone service (2026-11-01).
- The Siaya lab's house rules, booking rules, opening hours and Wi-Fi guide in English, Swahili and German.

### Bundled API (`code/wakala-api`)
- Trimmed copy of the Mwanachama API server the console and app talk to, with a Dockerfile (SQLite at `/data`, port 8082).

### Documentation
- Product, technical spec, user journeys, test plan and results (2026-10-21 onward).
- Risk library: hazards, threats, consequences and controls (2026-10-31).
- Reorganised into requirements, design, implementation and qa (2026-11-04).
- Scope broadened from a community computer lab to running an agency end to end; the Siaya lab stays as the worked example (2026-11-04).
- User journeys checked against the code: steps and "not yet built" lists corrected in journeys 01, 02, 05, 06, 08, 09, 10, 11, 12, 13, 14, 16, 18, 19, 20, 21, 22, 24, 25, 26, 27, 28 and 29 (2026-11-04).
- The See where the tokens go journey drawn, with its four-step walk-through and mockups (2026-11-03); the chat workflow journey's mockups and requirements (2026-11-02).
- Test results recorded: the console passes 3640 tests and builds; the phone app passes 1905 tests and builds; the bundled API has no test files, so `go test` only compiles it (2026-11-04).
- Demo index added: `demo/README.md` lists the eight agencies from their `agency.json` files (2026-11-04).
- Technical spec rewritten around what the bundled API mounts; the digital twin is not mounted in the bundled API and the network simulator is planned, not in this repository (2026-11-04).
