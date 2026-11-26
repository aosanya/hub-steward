# Design mockups: the hub console

These files are static pages in a dark, amber visual style: one page of the hub console per file, each state a full-window screen under a monospace caption, all sharing `studio.css`. Open `index.html` first, then any file in a browser; the side bar of every page links to the others, so the set can be clicked through. It works from `file://`.

## The console wins

The pages were rebuilt from the real console in [`code/console/src`](../../../../code/console/src). Where a mockup and the console disagree, the console is right and the mockup is changed. Anything the console does not do is labelled Proposed in the note under the screen's caption, so a page that draws only what exists carries no such label.

- `agency/workflows/workflow-canvas.html` and `agency/workflows/function-formula.html` are Proposed: the console has no canvas and no formula page.
- The Workflows row has two sub-menus, Designed and Generated, in `menu.js` (`workflows-designed`, `workflows-generated`). Both are Proposed: the console menu has no sub-menus under Workflows, one page lists every workflow, and `check-menu.mjs` reports the two ids until the console has them. Designed is `agency/workflows/workflows.html`, whose eight screens are the console as built and whose ninth and tenth are Proposed (the tenth draws the title row's Actions menu open); tapping Workflows lands on Designed.
- `agency/workflows/workflows-generated.html`, `agency/workflows/workflow-generated.html`, `agency/publish/publish-generated.html` and the third screen of `agency/workflows/workflow-canvas.html` are Proposed: the console has no generated workflows. `work/records.html` is the console's Records page; only its card of generated workflows is Proposed. See [console-generated-workflows.md](../../console-generated-workflows.md).
- `work/farm-orders.html` and `work/produce.html` are not console pages: the console has no page and no menu row for either.
- `work/operations-network.html` is hidden in the console menu. Its first screen is what the console shows, and the screens after it are Proposed.
- `work/equipment.html` screen 1 is the console's "This page is planned."; the screens after it are Proposed.
- The title row's Actions menu is Proposed on every page: the console draws the header buttons as buttons. The screens that draw it open say so in their note; every other screen shows it closed.
- Single screens on other pages carry the label too, for example on Documents, Agents, Roles and Status.

Example data is drawn where a page needs it, and its note says so. Each caption also names the tools that fill the screen on a muted second line, "Filled by: tool_a, tool_b".

## How a page is built

Every page shares one stylesheet and six scripts, each component in one file. A page loads a single script, `shell.js`, as its last tag, with `../` for each folder level (`../../shell.js` from `agency/goals/`), and `shell.js` loads the others. A page copies a neighbour and changes only its content and the attributes below.

- `menu.js` is the side menu. It mirrors the console's `data/menu.ts`: the same rows, order, hub kinds, hidden rows and count rule. Attributes on `<nav class="side">`: `data-agency` (`farmers`, `lab` or `riders`), `data-current` (the row marked current; a detail page names its parent's row, `models` highlights Configure and `workflows` highlights Designed) and `data-badges` (`id:count` pairs, for example `review-goals:2,review-roles:2`). The console shows count chips only on the review rows, and so do these pages.
- `strip.js` is the header strip. Attributes on `<header class="strip">`: `data-hub` (`farmers`, `lab`, `riders` or `swe`), `data-state` (`setting-up` or `ready`), `data-crumb` (for example `Agency / Roles`; write `Label=path` for a part that links) and `data-open` (`true` draws the hub switcher open; its panel stays in the page).
- `chat.js` is the chat head and composer. Attributes on `<aside class="chat">`: `data-ctx` (the page label in the context chip), `data-ctx-icon`, `data-placeholder` and `data-model` (the label on the model picker, closed; leave it out for a hub with no model). The thread and the suggestion chips stay in the page.
- `icons.js` is the console's icon set and the helper that draws it for the strip and the chat. `menu.js` carries the icons of its own rows.
- `parts.js` draws the page parts a page only declares, each from `data-` attributes, so no page repeats their markup. `components.html` screens 16, 17, 31 and 32 draw them and show the declarations.
  - Page header: `<div class="top" data-title="Profile" data-meta='[{"text":"Staff seat","tone":"mute"}]' data-switches='[{"label":"Autosave","on":true}]' data-actions='[{"label":"Save changes","kind":"primary"},{"label":"Enhance"},{"label":"Open Status","href":"status/status.html","opens":"Status"},{"label":"Remove","kind":"danger"}]' data-open="true"></div>`. Only `data-title` is required. The title (`h1`) is at the left and is cut with an ellipsis, never wrapped; `data-meta` is the slot right after it for what is neither an action nor a switch (a status tag with a `tone`, or plain text when it has none); `data-switches` draws the switches, one style, immediately left of Actions; `data-actions` becomes one quiet button, "Actions" with a 14px down chevron, drawn as the chat head's context tag is (same height `--head-chip-h`, padding, radius, font size and weight, icon size). A page with a switch and no action keeps the switch; a page with neither keeps the plain title. In the menu the `primary` item comes first and takes the accent, a `danger` item goes last behind a divider in the danger colour, the rest keep their order. Every item shows a 16px icon: `icon` (a name from `icons.js`) or one chosen from its label; `href` with `opens` gives the link its title and aria text; `busy` shows the spinner and dims it, `disabled` dims it. A single action stays a menu. `data-open="true"` draws the menu open for a captioned screen; closed is the default. A click, Arrow keys, Home, End and Escape work too.
  - Section heading: `<div class="section-head" data-title="Generated" data-count="6" data-end='{"kind":"tag","text":"Valid","tone":"ok"}' data-note="One line under the heading."></div>`. The `h2`, then the count in the mono style, then one trailing item at the right (`kind`: `tag` with `text` and `tone`, `text`, `link` with `label`, `href`, `opens`, or `button`, a quiet extra-small button, with `label` and optionally `disabled`), then the one-line note under it.
  - Notice bar: `<div class="notice" data-tone="ok" data-text="The workflow was saved to the draft."></div>`; `data-tone` is `ok` (role status) or `bad` (role alert).
  - Draft bar: `<section class="draft" aria-label="Changes not published" data-text="3 changes not published" data-link="See what changed" data-href="..." data-opens="What is not published" data-button="Publish"></section>`; `data-note` replaces the link with a line of text, `data-busy="true"` shows the spinner on the button and `data-disabled="true"` also disables it.
- The header's height is one value, `--head-h` (3.5rem) in `studio.css`, used by `.top` and by the chat head, and the page title and the chat's "Chat" title share one rule (`--head-title-size`, 1.125rem, weight 700), so the line under the page title and the line under the chat head are one straight line. Nothing wraps in either: the title is cut, never wrapped. The chat sits under the content, not beside it, in a window narrower than about 1220px, and the lines are not compared there. A failure line, a draft bar or the chat's answer that a screen shows comes under the title row, never above it.
- `shell.js` loads `icons.js`, `strip.js`, `chat.js`, `menu.js` and `parts.js`.

Blocks these attributes cannot express stay static: the open model picker, the queue, the collapsed rail and the inline threads. They are in `chat.html`, `settings/model-edit.html` and `agency/workflows/function-formula.html`, and `check-links.mjs` reports them as plain chat blocks.

The generator that once produced the pages (`_generator/`) is not in the repository. Pages are edited by hand and, for the shared parts, by changing the one component file. `components.html` draws the components.

## Keeping in step

Run these from this folder with node. Each prints `ok` or one finding per line.

- `check-menu.mjs` compares `menu.js` with `data/menu.ts`: ids, order, sections, hub kinds, children, hidden rows and labels.
- `check-pages.mjs` checks that every console view and menu row has a mockup and that every mockup is reachable from a menu row, a detail mapping or `index.html`.
- `check-links.mjs` checks every link, every `data-current` value and the use of the shared components.
- `check-header.mjs` checks every page in headless Chrome: each `.top`, `.section-head`, `.notice` and `.draft` is written as its declaration, no button or link stays loose in `.top-end`, every action has an icon, the title, the Actions button and the header have the sizes of `--head-title-size`, `--head-chip-h` and `--head-h`, and the header line and the chat head line are on the same y. It needs Chrome (set `CHROME` when it is not the macOS default).
- `check-lib.mjs` holds the helpers the other four import; it is not run on its own.

When the console's menu or pages change, change `menu.js` (and the page), then run the three scripts.

## The console in the mockups

Inside a hub every page has the header strip across the full width and three columns under it: the side bar, the content and the chat. The menu follows the hub's kind. All three have Status, Profile, Goals, Roles, Workflows, Risks, Modules, Review, Publish, Users, Groups, Agents and the Settings rows. Farmers add Objectives and Test and have no Generated or Knowledge group; Lab and Riders have Approvals, Operations (Activity and Alerts), Records and Documents, and Riders also Equipment. `menu.js` is the full list.

A hub card under Your hubs and the hub chip in the header name a kind only when the agency's own kind text says it: Farmers (it mentions a farm), Riders (a rider or boda) or Lab (the word "lab"). An agency of any other kind, or of none, shows no kind chip, and its card carries the plain people glyph. It is listed the Lab's menu; which pages it should list is not decided (hub question Q-27).

Pages that edit the agency's definition show the draft bar: the console shows it on Profile, Goals, Roles, Risks, Bowties, Modules, Assistant and the calculating step, and on no other page; Objectives, Workflows, Test, Publish and Review show none. "See what changed" opens `agency/publish/draft.html`.

The chat is collapsible to a rail with an unread dot. Its box has a model picker, an Enhance button, a Send arrow that becomes Stop while the assistant works, and a queue for messages sent meanwhile. While a thread is empty it shows a greeting and three suggestion chips (`hintKeys` in `data/menu.ts`; Models shows one while the hub has no model). `chat.html` draws each of these states, including the loading state, the approval card, the failed call and a list that lands in the content area under an "Answer to" banner.

Every page with an action has one quiet Actions button at the right end of the title row, and the primary action is the first item in its menu; an empty state is a card with the button inside it.

## Models and providers

Providers are Meta Model API, Meta open weights, Hugging Face, Claude and Other (OpenAI-compatible). There is no Acme AI; `settings/model-template.html` is a kept comparison variant of the original template and still names it. A hub can have several models, and a model's page carries the checkbox "Can be used in the chat" and the name the picker shows. An agent's own model is chosen on its page, `people/agent-edit.html`.

## Themes

`studio.css` defines five themes by `data-theme` on the window: `dark` (the default), `light`, `midnight`, `forest` and `contrast` (High contrast). `settings/general.html` and the themes screen of `components.html` draw one window in each. No page runs a script that stores or applies a choice.

`studio.css` also sets the scroll bars of every scrolling area in one rule set, the console's own: 0.5rem wide, a transparent track, a rounded thumb in `--line` that turns `--line2` while the pointer is over the area and `--text4` over the thumb itself, and `scrollbar-width: thin` with the same two tokens where the browser has no `::-webkit-scrollbar`. No page or component sets a scroll bar of its own.

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
