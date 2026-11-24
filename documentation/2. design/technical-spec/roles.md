# Roles

What a role is in Hub Steward and which roles exist. Written on 2026-11-02 from decisions 120 to 135 and the roles rows of [the board][board] (HS611 to HS627, HS646 to HS664). Where the owner has not decided, the line says Open and says what decides it. Every decision number is a link to the decisions page.

## 1. What a role is

A role is a name that a person or an agent holds, in the whole agency or in one group. A workflow step names the role that runs it ([127][d]). What a person or an agent may do is always driven by the workflows ([137][d]): a role holds no standing list of market actions, and a call is admitted because a published workflow step names the caller's role for it. What a role may read follows its permissions ([134][d]), and an action assigned to a group role in the agency design is the workflow naming that role on a step ([128][d]). A manager answers who can do what and see what on each person's page ([122][d]). Roles are made and described in the agency design, on the studio's Roles page.

Of group roles the owner said they should work "just like in whatsapp" ([121][d]). A group role belongs to one group, so Grace coordinates the Siaya farmers and is an ordinary member of the Supplier group. A person can hold roles of several kinds at once: the Hub manager is also Admin of the Supplier group ([133][d]).

| Kind | Held where | Examples | Who gives it |
|---|---|---|---|
| Agency job role | In the whole agency | Hub manager, IT manager, Market manager; the lab's Lab manager; more as the owner finds them necessary ([124][d], [135][d]) | Assigned. Who assigns is Open (section 6) |
| Member role | In the whole agency | Farmer, Supplier, Buyer in the farmers' agency; Member in the lab | Supplier and Buyer: approved by the Market manager ([135][d]). Farmer and Member: no decision says (section 6) |
| Group role | In one group only | Admin, Vice Admin, Coordinator ([121][d], [130][d]) | Open (section 6). The Admin decides who joins and leaves ([121][d]) |
| Agent | In the agency | Farmers' agent, Suppliers' agent, Hub Steward | One agent for each agent role, listed on the Agents page; the hub manager configures it (model, limits, instructions) and until then it can do nothing ([100][d]) |

## 2. The roles of the two demo agencies

### The farmers' agency

| Role | Kind | What it does | Held in the demo by | Decision |
|---|---|---|---|---|
| Hub manager | Agency job | Runs the hub; can decide a join request from the console | No person named. Admin of the Supplier group, and sends its invitation to Kisumu Agro Supplies | [124][d], [126][d], [133][d] |
| IT manager | Agency job | Looks after the hub's technology (the studio's wording; the owner has named the IT manager's jobs for the lab only) | No person named | [124][d] |
| Market manager | Agency job | Approves new suppliers and buyers, the vetting the template gave to the Group coordinator | No person named in the demo's data | [135][d] |
| Farmer | Member | Grows crops; buys alone or in a group order, asks for what is not listed, sells the harvest to a buyer | Asha Otieno, Chebet Kiprop, Baraka Odhiambo and the other Siaya farmers | |
| Supplier | Member | Sells farm inputs; posts offers with a price and a bulk price, keeps his own stock, says yes with a date or no, marks an order paid | Kisumu Agro Supplies | [135][d] |
| Buyer | Member | Buys the harvest; posts his price; says yes or no for himself, and nobody answers for him | Kisumu Grain Traders | [135][d] |
| Admin | Group | Decides who joins and leaves the group; a join request reaches his Notifications page, under Needs you ([126][d]) | Grace Adhiambo in the Siaya farmers; the Hub manager in the Supplier group | [121][d], [126][d], [133][d] |
| Vice Admin | Group | Composed of the Admin's actions; takes over when the Admin cannot act | Baraka Odhiambo in the Siaya farmers; none named in the Supplier group | [130][d], [133][d] |
| Coordinator | Group | Starts, sends and calls off a group order, decides for a quiet farmer, records payments; no longer approves a supplier | Grace Adhiambo in the Siaya farmers | [121][d], [127][d], [133][d], [135][d] |
| Farmers' agent | Agent | Speaks to the farmers, shows each shop's price, takes Buy now and Join, keeps the count of a group order; never says yes for a person; reads only where a step needs it | The one Farmers' agent | [73][d], [120][d], [131][d], [134][d] |
| Suppliers' agent | Agent | Speaks to suppliers and buyers, helps a supplier post offers and keep a private stock list; holds no farmer thread, cannot open an order, never says yes for a person | The one Suppliers' agent | [73][d], [131][d] |

The Farmers' agent finding the suppliers that hold an input and opening a thread with the farmer and the supplier is what the owner asked for ([120][d]); the backend cannot do it yet (HS616). The template (`demo/farmers/agency.json`) holds nine roles: Group coordinator, Farmer, Supplier, Buyer, Extension officer, Veterinary officer, Agriculture director, Farmers' agent and Suppliers' agent. It has no Hub manager, IT manager, Market manager, Admin or Vice Admin yet (HS626, HS612, HS648).

### The lab

| Role | Kind | What it does | Held in the demo by | Decision |
|---|---|---|---|---|
| Lab manager | Agency job | Runs the lab; keeps access requests, seat bookings and reservations; is Admin of every lab group | No person named | [124][d], [133][d] |
| IT manager | Agency job | Takes the lab's network (the alerts Hub Steward reports), the Wi-Fi accounts and the equipment | No person named; the studio draws Collins Okoth as example data | [124][d] |
| Member | Member | A registered member of the lab; uses it in opening hours, books seats, connects to the Wi-Fi, asks Hub Steward in the lab's chat | The lab's members, for example Akinyi Otieno | |
| Hub Steward | Agent | The lab's AI agent; answers members from the lab's documents, drafts access requests and seat bookings for the Lab manager to approve, watches the network; never approves its own drafts | The one Hub Steward | [131][d] |

The lab template (`demo/siaya-lab/agency.json`) holds Lab manager, Member and Hub Steward and no IT manager yet (HS626). No decision names a group role in the lab other than the Lab manager as Admin.

## 3. Group actions

A group job is a step of a workflow that names the group role ([137][d], [138][d]). The holder may do it in her own group only ([121][d]). The Roles page shows each group role's steps, read-only, and a role's reach changes by editing the workflow ([138][d]); the jobs that have no step yet are HS680.

| Action | Held by | State |
|---|---|---|
| Decide a join request | The Admin; the Join a group workflow names him and the request arrives on his Notifications page, under Needs you ([126][d]) | Settled |
| Remove a member | The Admin does the main job of joining and leaving ([121][d]); a step of a workflow that names the Admin, so it is not fixed to him ([138][d]) | Settled; no step drawn yet (HS680) |
| Take over the Admin's actions | A Vice Admin, when the Admin cannot act ([130][d]) | Settled; when exactly is Open |
| Leave the group | The member herself, with a Leave button, out at once, with no role needed ([129][d]) | Settled |
| Give or take back a group role, make an Admin | Not decided | Open: who gives roles (section 6) |
| Invite a person into the group | The demo has the Hub manager, as Admin of the Supplier group, send one ([133][d]); which role holds it in general is not decided | Open |
| Change the group's join mode | Not decided; the demo sets both farmers' groups to approval-only ([132][d]) | Open |
| Start, send and call off an order, decide for a quiet farmer, record a payment | The workflow names the role of each step ([127][d], [137][d]) | Settled: workflow steps only, no separate list of actions |
| Read every room, or a private thread | Whatever the role's permissions give; no blanket read for staff ([134][d]) | Open: which permission (HS661) |

A group's page lists the people who run the group and nobody else, each with a role tag ([125][d]).

## 4. How a workflow names who does a step

Each step names one role ([127][d]). Three cases, from [121][d] and [127][d]:

| The step names | Who may act |
|---|---|
| An agency role, such as the Market manager | Its holder in the agency, as today |
| A group role, such as the Admin | Its holder in that group only |
| The group the record sits in | Not a role: it is the group in which a group role is looked for. A join request sits in the group asked for, a group order in the group it was started in |

A person who coordinates the Siaya farmers is refused when she starts an order in the Supplier group (HS646).

Become a supplier ([124][d], [135][d], HS626). It replaces the template's Apply as a supplier and Approve a poster.

| Step | Who runs it | What happens |
|---|---|---|
| Apply | The applicant | Gives the shop's name, area and what he sells |
| Receive | The Suppliers' agent | Hands the application over and posts nothing |
| Decide | The Market manager, an agency role | Approves or declines; until then no farmer sees him; on approval he holds the Supplier role |

Join a group ([121][d], [126][d], HS648). The farmers' W-10 and the lab's W-5 have one step today and name nobody to decide.

| Step | Who runs it | What happens |
|---|---|---|
| Ask to join | The person asking | Fills in the form; the group code is optional |
| Decide | The Admin of the group asked for, a group role | The request arrives on the Admin's Notifications page, under Needs you, as a task, with no Requests screen of its own on the phone ([126][d]); the Hub manager can still decide from the console (HS649). In the lab the Admin is the Lab manager ([133][d]) |

## 5. What is built and what is not

Row ids are on [the board][board].

| What | State | Rows |
|---|---|---|
| The actor backend seats a person in a role per group | Built | HS611 |
| The definition cannot say a role is a group role or that it leads its group; publishing seats role kinds with leading off; a step cannot name a group role, and the open-steps read keeps a step by role id only, so a Coordinator of one group counts as Coordinator in all | Not built | HS612 |
| The order desk accepts only an owner or an agent holding an agency role, so a farmer who coordinates her group is refused at every order step | Not built | HS646 |
| Nothing lets an Admin remove a member (today he is answered "not found"); nothing lets a member leave; nothing guards the last Admin or seats a Vice Admin | Not built | HS647, HS654 |
| Join a group has no decide step; the console has no Approve or Decline; the phone has no Admin tools | Not built | HS648, HS649, HS655 |
| The templates have no job roles, no Become a supplier workflow, and only 3 of 27 farmers' steps carry a kind and a role | Not built | HS626, HS662 |
| No single read answers what one person can do and see; the console shows one role per person | Not built | HS653, HS650 |
| An AI role may carry an ability that says yes for a person; found by reading, not yet probed | Not built | HS651 |
| The permissions gate asks the role's ticked actions, not the workflows, so a resident farmer is refused all 8 market tools the app calls over MCP (the probe is red) | Not built | HS658, HS667 |
| The console's Role card has a Permissions line (it was What it may do and listed the role's rules). It lists each permission in the role's permissions list as its code and its name: a catalogue code such as `market.offer` with its catalogue name, and a record code such as `record.tender.add` with the name the permission list gives it, else the action and the record's item name, else the bare code alone. The rules are no longer listed on the card. Drawn in `mockups/console/agency/roles/roles.html`; the record codes in the mockup are an invented example | Built (ISS-148); the record permissions it shows come from the sibling issues of ISS-149 | ISS-148 |
| A staff account reads every group's room | Not built | HS661 |
| No read gives a member only the Admins and Coordinators of her group, and no screen lists them | Not built | HS627 |
| The live walk seats no Admin and forces the groups open | Not built | HS657 |
| The studio draws the roles: the Roles page, a group's page with its group roles (Add holder is Proposed), a person's page with Can do and Can see (Proposed) | Drawn; the Groups and Roles pages follow decisions 132 to 135 under HS656 | HS613, HS614, HS656 |

## 6. Open

- Vice Admin: whether he acts alongside the Admin at all times or only once the Admin is removed or marked gone, and who marks him gone. The owner's answer decides ([130][d], HS654).
- Who gives roles: group roles, agency job roles, and the Farmer and lab Member roles. The board proposes the group's page with Add holder (HS613) and the person's page (HS614); the owner's answer decides, and with it whether an Admin may give Admin or remove another leader (HS654, HS647).
- Which other agency job roles exist beyond Hub manager, IT manager and Market manager. The studio journeys also name an agency owner, a risk owner and a designer (HS626); the owner names what is necessary ([124][d], [135][d]).
- The Coordinator's actions: whether the Coordinator leads the group (the studio draws Admin leading and Coordinator not, as Proposed; HS611), and whether it answers for the group to suppliers and buyers, a sentence of the template with no step behind it (HS662).
- The Coordinator's name: Coordinator in the decisions, Group coordinator in the template and the journeys (HS656).
- Whose farmers see an order: the group's or everyone using the same market mount. The owner's answer decides ([127][d], HS646).
- One thread per shop or one shared thread with every asked shop, and whether "request the Buyer" means the Supplier. The owner's answer decides ([120][d], HS616).
- Who removes an approved supplier later: the market design says the coordinator (`documentation/2. design/market.md`), and decision [135][d] moved the vetting to the Market manager.
- Whether publishing refuses a workflow whose yes, decide, pay or call-off step names an AI role. Not confirmed by the owner ([131][d], HS651).
- Whether each group job with no step yet is a workflow of its own or a step added to Join a group and the Group order (HS680).
- Which permission lets a role read every room or a private thread ([134][d], HS661).
- Where a step addressed to an Admin goes when he leaves: the next Admin or the Hub manager is proposed (HS654).

## 7. Where a caller's roles come from

Built for ISS-188 on D33 and D42 of [record permissions](record-permissions.md). A person holds a role only through a seat they hold in the group they have assumed for the login session ([assumed group of a login session](assumed-group-session.md)). Nothing else gives a role: the member's linked agency role (`agency_role_id`) and the roles given to a group (`agency_group_roles`) are still stored and still editable, and count for nothing. The platform owner assumes a group like anyone and holds what that group's seats give.

| Case | Roles held |
|---|---|
| A seat in the assumed group | The role of the seat's kind, by its `definition_role_id` (D33, D42) |
| A seat in another group of the same person | None (D33) |
| No assumed group, or the session has no login | None, so no roles and no permissions (D32) |
| Two sessions of one person on two groups | Each session its own roles (D40) |
| The assumed group is deleted or its seat has ended | None from the next request |
| The assumed group is disabled (D54) | None from the next request. The flag itself is not built: `groupDisabled` in `agencies/caller_seats.go` is the one place to plug it in, and `GroupAssumable` already refuses a group for which it answers true, both for the group list and for the resolver |
| An agency API key or an agent | Like a person (D56, D57): it holds roles only when its session has assumed a group. The assume-group routes still refuse a caller with no login session, so a key holds nothing until ISS-194 lets it assume |

### The one resolver

All paths are under `code/wakala-api/internal/`.

| Part | Where | What it does |
|---|---|---|
| The session key | `api/http/middleware.go` (`identity`, `asCaller`), `agencies/caller_seats.go` (`WithLoginSession`, `LoginSessionOf`) | `callers.identify` returns the person and the key of the login session (the same keys as the assume-group routes). `asCaller` puts the key in the request context beside the person |
| The seats | `agencies/caller_seats.go` (`LiveSeatsOf`, `SeatsInAssumedGroup`, `SeatsInAnyGroup`) | Reads the person's active seats through the actor sibling's public calls, keeps seats whose role kind is not retired and whose group exists and is assumable, and for `SeatsInAssumedGroup` keeps the seats of the assumed group read from `AssumedGroups.AssumedGroupOf` |
| The role keys | `api/http/caller_roles.go` (`callerRoleKeys`, `heldAgencyRoles`) | The set of definition role ids of those seats. `heldAgencyRoles` matches them to the live roles and is what `my-roles`, open steps, send back and step answers read |
| The role ids and codes of a gate | `api/http/agent_permissions.go` (`callerRoleIDs`, `callerRolePermissionCodes`) | Used by `agentPermissioned`, `heldRolesAllow`, the module list, the studio list and the AI gateway |
| The step board | `api/http/step_role_board.go` (`requireHeld`) | Reads `callerRoleKeys`. The owner pass of `callerOwnsTheAgency` is unchanged |
| The approval limit | `agencies/caller_seats.go` (`AssumedSeatsDirectory`), `api/http/step_approval_limit.go`, `step_approval_refusal.go`, `agencies/approval_limits.go` | The largest limit and the over-limit rule read only the seats of the assumed group |
| Inspector forms and market agents | `agencies/inspector_forms.go`, `agencies/registry.go` (`seatedAgent`) | Read the seats of the assumed group |

Gone: `heldRoleKeys`, `agentRoleIDs`, `rolesHeldBy` and every read of `AgencyRoleOf` and `RoleIDsThroughGroups` that decided what a caller may do. The two stores (`SetAgencyRole`, `GiveGroupRole`) stay for now and have no reader in a request.

### Reads that stay on every seat, on purpose

These answer for someone other than the caller, or list what a person could assume, so they use `SeatsInAnyGroup` and not the assumed group.

| Where | Why |
|---|---|
| `seatedGroups` and `ownerSeatedIn` | The groups a person may assume, and the check on a key's group |
| `declarationHolders` | Who is expected to declare: a register of other people, not a request of the caller |
| `PaymentListHolders` | Who is told about unpaid forms: other people, with no session |
| `roleNamesInGroup` (`author_roles.go`) and `agencies/rooms.go` | The role badge of a message's author, from the seats of the room's group |
| `holdsStaffKind` (`staff.go`) | A staff flag of a role kind, not a role the person acts with |
| `service_grants` | Only reports the stored link of a granted service |

### What changed in the tests

People are seated in a group and a session assumes it, through `seatAs`, `seatGroupMembers`, `joinedGroup` and `asSubject` in `api/http/seat_helpers_test.go`. `cookieFor` assumes the group a person was seated in. Tests that proved the old sources were rewritten to say they count for nothing (a role given to a group, the linked role), and `assumed_roles_test.go` holds the red tests of the issue.

Five tests were skipped, not deleted, because they built access through a role given to a group that D42 no longer reads: the backlog access levels (Can see, Can move) give the group a role, and that role no longer reaches a person. Four were removed because their whole claim is gone (leaving a group takes a given role away; a role taken from a group closes the module; switching a role group to open suspends the role; a seated agent gets the roles of its groups). The owner has to say how a backlog access level reaches a person now: through a seat of the assumed group, or by another route.

[d]: ../../../../meta-global-ai-hackathon-community-hubs/documentation/1.%20requirements/decisions.md
[board]: ../../../../meta-global-ai-hackathon-community-hubs/documentation/3.%20implementation/todo.md
