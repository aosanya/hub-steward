# Console list pages

How an agency page that lists named things looks in the console. Written on 2026-11-02 from decision 161, which takes the Objectives page as the pattern.

## 1. The page

| Part | What it is |
|---|---|
| Title row | The page's name, Enhance and the page's one or two buttons; it stays at the top while the page scrolls. |
| Search box | One box under the title row; its placeholder is "Search" and the page's name in lower case (Search bowties, Search hazards, Search documents). Test keeps Search scenarios. |
| Cards | One collapsed card for each item, sorted by name. |

## 2. A card

| Part | What it is |
|---|---|
| Heading | "code · name", for example RK-2 · Data leak, with a chevron; a click opens or folds the card. |
| Right side | An Edit link, and a delete button where the page can remove the item. |
| Inside | A detail list of the item's fields, labels on the left and values aligned left. A field the item has no value for is not drawn. |

A card opens folded. The Objectives page, the Bowties page and the Hazards, Threats and Consequences pages are the examples; the code is `pages/objectives/ObjectivesList.tsx`, `pages/risks/RisksList.tsx` and `pages/library/LibraryPartTable.tsx`.

## 3. Which pages

| State | Pages |
|---|---|
| Done | Objectives, Workflows, Bowties, Hazards, Threats, Consequences, Roles, Groups, Agents, Controls, Modules, Documents, Network, Activity, Models, Users, Goals |
| Stay as they are | Test: its cards already carry a tick box, a result chip and a run and remove menu that a folded card would hide |
| Stay as they are | Alerts, Operations, General, Status, Approvals, Suggestions, Limits: feeds, queues, dashboards and settings |

## 4. Sizes

A button is 36 px high with `.875rem` text, a small one 32 px. The page's text is `.875rem`, a card heading `.9375rem`. Every size is in `rem` off the one root size.

## 5. Not settled

The Workflows page has no Orders under way section, so nothing on the console stops an order (HS739).
