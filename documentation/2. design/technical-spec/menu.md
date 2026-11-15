# Menu

Approved by the owner on 2026-11-15 (hub issue MUN886, 52 screens). Drawn in the Folders pattern of [files.html](../mockups/app/files.html): a search bar on top of the list, and on a wide window the list as a panel with the chosen record beside it. Recorded in hub issue MUN956. Drawn as [menu.html](../mockups/app/menu.html) (five states) and one page for each section: [Residents](../mockups/app/menu-residents.html), [Properties](../mockups/app/menu-properties.html), [Issues](../mockups/app/menu-issues.html), [Services](../mockups/app/menu-services.html), [Assets](../mockups/app/menu-assets.html), [Council](../mockups/app/menu-council.html), [Staff](../mockups/app/menu-staff.html), [Finance](../mockups/app/menu-finance.html), [Settings](../mockups/app/menu-settings.html).

Home gets one more list under Start, Ongoing and Backlogs: the sections of the agency. Each section opens a screen of submenus, and each submenu opens a list.

## Rules

| Rule | Answer |
|---|---|
| Which sections show | One Home row for each section the agency has the module for |
| Settings | Has no module of its own. It is shown only with at least one other section, never alone |
| A section screen | Lists its submenus as rows |
| A submenu with no screen yet | Says Not available yet and is not a button |
| The Dashboard | The Dashboard of the first prototype is Home, so it has no row |
| Back | Back from a section reads Home |
| The bottom bar | Unchanged: Home, Chat, Notifications |

## What fills it

| Part | Tool |
|---|---|
| Which sections show | `agency_list_mounts` |
| Home's own lists (Start, Ongoing) | `agency_list_my_open_steps` |

The drawings name the module only for Residents (actor) and for the smaller agency drawn in state 5 of menu.html (actor and forms only: Properties, Assets, Council and Finance are not drawn). The module behind each other section is not fixed in the drawings.

## The section names are the agency's own

A section's title is the name the agency gave a mount of the section's module, read from `agency_list_mounts`, so a school can show Students where a town council shows Residents. The mounts of a module are taken in order: when several sections share a module (Residents and Staff & Departments both use actor), the first section takes the module's first mount name, the second section the second. A mount with no name, a module with fewer mounts than sections, and an agency whose mounts cannot be read keep the fixed words in the table below. The same title shows on Home and on the section screen. The submenu names are not renamed.

## The sections

| Section | Submenus |
|---|---|
| Residents | All Residents, Households, Registrations, Groups & Associations, Communications |
| Properties & Addresses | Properties, Addresses, Ownership & Tenure, Land Use & Zoning |
| Issues & Requests | All Issues, Assigned to Me, Overdue, Map View, Service Types |
| Services & Permits | Applications, Permits, Licences, Fees & Payments, Service Catalogue |
| Assets & Works | Roads & Paths, Street Lights, Water Points, Buildings, Work Orders, Maintenance Schedule |
| Council & Decisions | Meetings, Agendas & Minutes, Resolutions, Bylaws, Committees |
| Staff & Departments | Staff, Departments, Crews, Roles & Permissions |
| Finance | Budget, Revenue & Billing, Procurement, Payments, Financial Reports |
| Settings | Municipality Profile, Users & Roles, Boundaries & Wards, Integrations, Audit Log |

## The screens

| Section | Submenu | What it shows | Tool |
|---|---|---|---|
| Residents | All Residents | One row for each resident: name and status | `actor_list_actors` |
| Residents | A resident | Name, status and the groups the resident belongs to; read only | `actor_get_actor`, `actor_list_groups_for_actor` |
| Residents | Households | One row for each household: name and member count | `actor_list_groups`, `actor_get_group_population` |
| Residents | Registrations | One row for each request to join: name and request date; the opened request has Approve and Decline | `actor_list_join_requests_for_group` |
| Residents | Groups & Associations | One row for each group: name and member count | `actor_list_groups`, `actor_get_group_population` |
| Residents | Communications | One row for each thread: title and time of its last message | `comm_chat_thread_list` |
| Properties & Addresses | Properties | One row for each property: name and type | `assetmanager_asset_list` |
| Properties & Addresses | A property | Name, type and location; read only | `assetmanager_asset_read`, `assetmanager_location_read` |
| Properties & Addresses | Addresses | One row for each address: street line and the place it sits in | `assetmanager_location_list` |
| Properties & Addresses | Ownership & Tenure | One row for each property: name | `assetmanager_asset_list` |
| Properties & Addresses | Land Use & Zoning | One row for each land area: name | `assetmanager_location_list` |
| Issues & Requests | All Issues | One row for each raised issue: title and status | `forms_catalog_raised_item_list_nearby` |
| Issues & Requests | An issue | Title and status from the list row, the replies so far, and a reply box | `forms_catalog_reply_list`, `forms_catalog_reply_send` |
| Issues & Requests | Assigned to Me | One row for each issue given to the signed-in person: title | `forms_catalog_raised_item_list_mine` |
| Issues & Requests | Overdue | One row for each late matter: title and how late, longest late first | `forms_catalog_raised_item_list_overdue` |
| Issues & Requests | Map View | A plain map with pins, and under it a search bar and a list: title and place | `forms_catalog_raised_item_list_nearby` |
| Issues & Requests | Service Types | One row for each kind of request a resident can raise: type name and a short line | `forms_catalog_entry_list` |
| Services & Permits | Applications | The existing Forms list, waiting view: form title, status and closing date | `forms_form_list_waiting` |
| Services & Permits | An application | Form title, date sent, status and the answers given; a button withdraws it | `forms_submission_read_mine`, `forms_answer_list`, `forms_form_withdraw` |
| Services & Permits | Permits | One row for each of the person's permit applications: name, status and sent date | `forms_submission_list` |
| Services & Permits | Licences | One row for each licence held or applied for: name, status and sent date | `forms_submission_list` |
| Services & Permits | Fees & Payments | One row for each fee, Open first then Paid: what it is for and the status; staff mark a row paid | `forms_submission_list`, `forms_submission_mark_paid` |
| Services & Permits | Service Catalogue | One row for each service the municipality offers: name and one short line | `forms_catalog_entry_list_public` |
| Assets & Works | Roads & Paths | One row for each road or path: name and kind | `assetmanager_asset_list` |
| Assets & Works | A road | Name, code, kind, where it is and its latest movements, newest first; read only | `assetmanager_asset_read`, `assetmanager_location_read`, `assetmanager_movement_list` |
| Assets & Works | Street Lights | One row for each light: place and code | `assetmanager_asset_list` |
| Assets & Works | Water Points | One row for each water point: place and code | `assetmanager_asset_list` |
| Assets & Works | Buildings | One row for each municipal building: name and place | `assetmanager_asset_list`, `assetmanager_location_list` |
| Assets & Works | Work Orders | One row for each job not yet Done: title and status | `taskmanager_task_list` |
| Assets & Works | Maintenance Schedule | One row for each repeating job: title and how often it repeats | `taskmanager_repeating_task_list` |
| Council & Decisions | Committees | One row for each committee: name and chair | `actor_list_groups`, `actor_list_group_leaders` |
| Council & Decisions | Meetings | One row for each meeting: name and date; a meeting shows name, date and place | None, sample rows |
| Council & Decisions | Agendas & Minutes | One row for each agenda or minutes: meeting name, which of the two, and date | None, sample rows |
| Council & Decisions | Resolutions | One row for each resolution: title and date | None, sample rows |
| Council & Decisions | Bylaws | One row for each bylaw: title and the year it took effect | None, sample rows |
| Staff & Departments | Staff | One row for each person: name, role and, where the assignment names it, department | `actor_list_actors`, `actor_list_role_assignments_for_group` |
| Staff & Departments | A staff member | Name, one row for each seat with its role, department and standing (In post when the seat has not ended); read only | `actor_get_actor`, `actor_list_role_assignments_for_actor`, `actor_get_actor_standing` |
| Staff & Departments | Departments | One row for each department: name and head count | `actor_list_groups`, `actor_get_group_population` |
| Staff & Departments | Crews | One row for each crew: name and leader | `actor_list_groups`, `actor_list_group_leaders` |
| Staff & Departments | Roles & Permissions | One row for each role: name and how many people hold it | `agency_list_roles`, `agency_list_role_assignments` |
| Finance | Budget | One row for each budget line: name; a line shows Planned and Spent as a dash | None, sample rows |
| Finance | Revenue & Billing | One row for each bill sent: payer, amount and a paid mark | `market_list_orders`, `forms_submission_list` |
| Finance | Procurement | One row for each purchase request: item, quote count and status (Waiting for quote, or Quoted) | `market_list_asks`, `market_list_quotes` |
| Finance | Payments | One row for each order: payer, amount and a paid mark or a Mark paid button | `market_list_orders`, `market_mark_paid` |
| Finance | Financial Reports | One row for each report: name and period | None, sample rows |
| Settings | Municipality Profile | The municipality's name and languages; the one action is Rename | `agency_get_agency`, `instance_get_languages`, `instance_rename` |
| Settings | Users & Roles | One row for each app user: name and role | `actor_list_actors`, `agency_list_role_assignments` |
| Settings | Boundaries & Wards | One row for each ward: name and resident count | `actor_list_groups`, `actor_get_group_population` |
| Settings | Integrations | One row for each connected service, marked Connected | `ai_list_accounts` |
| Settings | Audit Log | One row for each recent change: who, what and when | None, sample rows |

The search bar on every list is drawn empty and no tool is named for it.

## Gaps

| Gap | What it means for the screens |
|---|---|
| Meetings, Agendas & Minutes, Resolutions, Bylaws | No tool in the hub supplies them. The rows are samples until one exists |
| Budget, Financial Reports | No tool supplies budget lines or reports. No amount is drawn on a budget line |
| Audit Log | No tool supplies an audit log. The rows are samples |
| Road condition and length | No tool supplies them. A road's movements carry an actor id, not a name, so who made a movement is left out |
| Street light and water point state | No working, broken, in-use or attention field. Which lights need attention cannot be shown |
| Building condition and opening hours | No tool supplies them |
| Work order due date, asset and assignee | The list does not supply them |
| Maintenance next-due and last-done date | The listing is not confirmed to supply one |
| Property owner, tenure holder, tenure and zone label | No tool supplies them, so Ownership & Tenure shows only property names and Land Use & Zoning only area names |
| Household address and head; group chair and meeting place | No tool supplies them |
| Which group type is a household | Households lists groups only where a group type stands for a household |
| Which resident a thread is with | Left out when comm_chat_thread_list does not name the resident |
| A staff member's job title, contact detail, and department on a list row | No tool supplies a job title or contact. A department shows only when the role assignment names it |
| Amount on a fee | No tool supplies it. Fees & Payments shows what the fee is for and Open or Paid |
| Bill date and number, payment date and method, request date, budget and supplier | No tool supplies them |
| Permit kind, licence expiry date, service category, price and duration | No tool supplies them |
| A single issue | No read tool exists. Title and status come from the All Issues list row |
| Map pins | No tool supplies coordinates. The pins are drawn only as a place for them |
| Other fields on Integrations | Only the service and its connected state |
