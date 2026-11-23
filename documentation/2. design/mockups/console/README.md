# Design mockups: the hub console

These files are static pages in a dark, amber visual style: one page of the hub console per file, each state a full-window screen under a monospace caption, all sharing `studio.css`. Open `index.html` first, then any file in a browser; the side bar of every page links to the others, so the set can be clicked through. It works from `file://`.

## The console wins

The pages were rebuilt from the real console in [`code/console/src`](../../../../code/console/src). Where a mockup and the console disagree, the console is right and the mockup is changed. Anything the console does not do is labelled Proposed in the note under the screen's caption, so a page that draws only what exists carries no such label.

- `agency/workflows/workflow-canvas.html` and `agency/workflows/function-formula.html` are Proposed: the console has no canvas and no formula page.
- `agency/workflows/workflows-generated.html`, `agency/workflows/workflow-generated.html`, `agency/publish/publish-generated.html` and the third screen of `agency/workflows/workflow-canvas.html` are Proposed: the console has no generated workflows. `work/records.html` is the console's Records page; only its card of generated workflows is Proposed. See [console-generated-workflows.md](../../console-generated-workflows.md).
- `work/farm-orders.html` and `work/produce.html` are not console pages: the console has no page and no menu row for either.
- `work/operations-network.html` is hidden in the console menu. Its first screen is what the console shows, and the screens after it are Proposed.
- `work/equipment.html` screen 1 is the console's "This page is planned."; the screens after it are Proposed.
- Single screens on other pages carry the label too, for example on Documents, Agents, Roles and Status.

Example data is drawn where a page needs it, and its note says so. Each caption also names the tools that fill the screen on a muted second line, "Filled by: tool_a, tool_b".

## How a page is built

Every page shares one stylesheet and five scripts, each component in one file. A page loads a single script, `shell.js`, as its last tag, with `../` for each folder level (`../../shell.js` from `agency/goals/`), and `shell.js` loads the others. A page copies a neighbour and changes only its content and the attributes below.

- `menu.js` is the side menu. It mirrors the console's `data/menu.ts`: the same rows, order, hub kinds, hidden rows and count rule. Attributes on `<nav class="side">`: `data-agency` (`farmers`, `lab` or `riders`), `data-current` (the row marked current; a detail page names its parent's row, and `models` highlights Configure) and `data-badges` (`id:count` pairs, for example `review-goals:2,review-roles:2`). The console shows count chips only on the review rows, and so do these pages.
- `strip.js` is the header strip. Attributes on `<header class="strip">`: `data-hub` (`farmers`, `lab`, `riders` or `swe`), `data-state` (`setting-up` or `ready`), `data-crumb` (for example `Agency / Roles`; write `Label=path` for a part that links) and `data-open` (`true` draws the hub switcher open; its panel stays in the page).
- `chat.js` is the chat head and composer. Attributes on `<aside class="chat">`: `data-ctx` (the page label in the context chip), `data-ctx-icon`, `data-placeholder` and `data-model` (the label on the model picker, closed; leave it out for a hub with no model). The thread and the suggestion chips stay in the page.
- `icons.js` is the console's icon set and the helper that draws it for the strip and the chat. `menu.js` carries the icons of its own rows.
- `shell.js` loads `icons.js`, `strip.js`, `chat.js` and `menu.js`.

Blocks these attributes cannot express stay static: the open model picker, the queue, the collapsed rail and the inline threads. They are in `chat.html`, `settings/model-edit.html` and `agency/workflows/function-formula.html`, and `check-links.mjs` reports them as plain chat blocks.

The generator that once produced the pages (`_generator/`) is not in the repository. Pages are edited by hand and, for the shared parts, by changing the one component file. `components.html` draws the components.

## Keeping in step

Run these from this folder with node. Each prints `ok` or one finding per line.

- `check-menu.mjs` compares `menu.js` with `data/menu.ts`: ids, order, sections, hub kinds, children, hidden rows and labels.
- `check-pages.mjs` checks that every console view and menu row has a mockup and that every mockup is reachable from a menu row, a detail mapping or `index.html`.
- `check-links.mjs` checks every link, every `data-current` value and the use of the shared components.
- `check-lib.mjs` holds the helpers the other three import; it is not run on its own.

When the console's menu or pages change, change `menu.js` (and the page), then run the three scripts.

## The console in the mockups

Inside a hub every page has the header strip across the full width and three columns under it: the side bar, the content and the chat. The menu follows the hub's kind. All three have Status, Profile, Goals, Roles, Workflows, Risks, Modules, Review, Publish, Users, Groups, Agents and the Settings rows. Farmers add Objectives and Test and have no Generated or Knowledge group; Lab and Riders have Approvals, Operations (Activity and Alerts), Records and Documents, and Riders also Equipment. `menu.js` is the full list.

Pages that edit the agency's definition show the draft bar: the console shows it on Profile, Goals, Roles, Risks, Bowties, Modules, Assistant and the calculating step, and on no other page; Objectives, Workflows, Test, Publish and Review show none. "See what changed" opens `agency/publish/draft.html`.

The chat is collapsible to a rail with an unread dot. Its box has a model picker, an Enhance button, a Send arrow that becomes Stop while the assistant works, and a queue for messages sent meanwhile. While a thread is empty it shows a greeting and three suggestion chips (`hintKeys` in `data/menu.ts`; Models shows one while the hub has no model). `chat.html` draws each of these states, including the loading state, the approval card, the failed call and a list that lands in the content area under an "Answer to" banner.

Every page has one filled accent button, at the right end of the title row; an empty state is a card with the button inside it.

## Models and providers

Providers are Meta Model API, Meta open weights, Hugging Face, Claude and Other (OpenAI-compatible). There is no Acme AI; `settings/model-template.html` is a kept comparison variant of the original template and still names it. A hub can have several models, and a model's page carries the checkbox "Can be used in the chat" and the name the picker shows. An agent's own model is chosen on its page, `people/agent-edit.html`.

## Themes

`studio.css` defines five themes by `data-theme` on the window: `dark` (the default), `light`, `midnight`, `forest` and `contrast` (High contrast). `settings/general.html` and the themes screen of `components.html` draw one window in each. No page runs a script that stores or applies a choice.

## Folders

- `index.html` is the design index: the three agencies and one card per page. `chat.html` and `components.html` sit beside it.
- `entry/`: sign-in, create-hub, hubs.
- `status/`: Status and the hub switcher.
- `agency/`, in subfolders named after the console's menu rows: `profile/`; `goals/` (goals, goal-detail, goal-add, objective-add, objectives); `roles/` (roles, role-add); `workflows/` (workflows, workflows-generated, workflow-generated, workflow-edit, workflow-calculating-step, workflow-canvas, function-formula); `test/`; `risks/` (risks redirects to bowties, then bowties, hazards, threats, consequences, controls, library-part); `modules/`; `publish/` (publish, publish-generated, draft, review, and review-profile, -goals, -objectives, -roles, -workflows, -risks, -tests).
- `people/`: Users, Groups, Agents and their detail pages.
- `work/`: Approvals, Operations, Records, Equipment, and the two pages that are not in the console.
- `knowledge/`: Documents.
- `settings/`: General, Consent text, Models with its tabs, Assistant, Usage (overview, work, agents) and Access keys.
- `flows/`: the Model key journey followed across pages, `step-01-set-the-key.html` (9 screens) and `step-02-test-the-key.html` (5 screens).
- `studio.css`, the five scripts, and the four `check-*.mjs` scripts.
