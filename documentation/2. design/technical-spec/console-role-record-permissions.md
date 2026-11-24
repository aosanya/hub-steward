# Role page: record permissions

How the console's role page lets a manager give a role the permissions of a record. Built for ISS-160, one part of the record permissions work (ISS-149, decisions D1, D10 and D14).

| Built | Planned |
|---|---|
| The section on the role page, its save, the words in seven languages, the mockup | The hub and the sibling that derive and accept the codes (ISS-150 and ISS-151); until they land a record's codes are not listed by the server and a save is refused by it |

## 1. The screen

The section is the card Record permissions on the role page while the role is being edited (Edit in the title row). It sits under the form for the name, the description and the agent switch, and above the Role card. The catalogue permissions stay where they are; the card never touches them.

| Part | What it is |
|---|---|
| Row | One for each record of the draft, sorted as the draft lists them. The record's name is the label; its item name sits beside it in the muted code style when it differs from the name. |
| Ticks | Four, in one row: Add, Edit, Delete and See every row. A tick is on when the role's saved permissions list holds the code. |
| Save record permissions | At the foot of the card. Dimmed until a tick differs from what the role holds. |
| No record | The card is not drawn. |

The mockup is screen 8 of `documentation/2. design/mockups/console/agency/roles/roles.html`.

## 2. What a tick writes

| Tick | Code |
|---|---|
| Add | `record.<code>.add` |
| Edit | `record.<code>.edit` |
| Delete | `record.<code>.delete` |
| See every row | `record.<code>.view` |

`<code>` is the record's code. The codes sit in the role's `permissions` list beside the catalogue codes (D14).

A save sends the role's name, description, staff flag and permissions to `agency_update_role` in the open draft. The list is the one the role holds now, less the codes unticked, plus the codes ticked; every catalogue code, every record code of a record not shown and every other record code stay as they are. The role is read again just before the save, so a save does not overwrite a change made since the page opened.

A change that must be approved says so with the same Waiting for approval line the other role forms use. A refusal keeps the ticks and says The change could not be sent.

## 3. What the page reads

| Tool | For |
|---|---|
| `agency_list_records` | The records of the draft: `code`, `name` and `item_name` |
| `agency_get_role` | The permissions the role holds |
| `agency_update_role` | The save |

## 4. Where the code is

Under `code/console/src/`: `pages/spec/rolesRecords.tsx` (the card), `data/pages/recordPermissions.ts` (the codes, the read and the change), the `recordPermissions` action in `data/pages/roles.ts`, and the `roles.records`, `roles.recordAdd`, `roles.recordEdit`, `roles.recordDelete`, `roles.recordView` and `roles.recordsSave` words in `public/i18n.json`. The tests are in `pages/spec/rolesPage.test.tsx` and `data/pages/roles.test.ts`.
