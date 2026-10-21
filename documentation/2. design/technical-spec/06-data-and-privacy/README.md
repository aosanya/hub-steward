# 06 · Data and privacy

## In the demo

Every member, message, document and agency in the demo is synthetic. The Siaya lab's documents are marked illustrative, and no real person's data is used.

## Where data lives

| Data | Where | Who can reach it |
|---|---|---|
| Members and their agencies | Mwanachama | The member; the agency's owners and agents |
| Chat | Mwanachama, per agency | Members of the room; a thread for the managers only is closed to everyone else |
| The agency's documents | Mwanachama, per agency | Members of the agency, today; narrowing writes to the manager is not decided |
| Forms, reports and their answers | Mwanachama, per agency | The group that sent the form; the sender of a report and the people the agency names |
| Tasks and records (for the lab: Wi-Fi account tasks; seat holds when a bookings module exists) | Mwanachama, per agency | Members of the agency, today; narrowing by role is not decided |
| Devices (for the lab: terminals, access points, router) | Mwanachama, per agency | Not decided; the twin is not mounted yet |
| Drafts awaiting approval | Mwanachama, per agency | The agency's owners and agents; only an owner decides |
| Model accounts and their keys | Mwanachama, per agency, sealed in the API's database | Never shown after they are saved |
| What the model sees | Sent to the agency's model provider for each turn | The text of the turn and the tool results it needs |
| Hub Steward | Holds nothing of its own | None |

Each agency has its own tables inside one database. A caller who is not a member of an agency is answered as if the agency did not exist, so an agency cannot be discovered by trying names. An agent's service key is minted by the API's operator and granted to one role by the agency's owner ([hub keys](../hub-keys.md)). It reaches that agency only, as an agent: it cannot approve its own drafts, do what only an owner may, or create an agency.

Members sign in with a link sent to their email. Mwanachama's API holds no member password; it asks the sign-in service whose token it is. An agency's staff open the console the same way; no password is made for them.

## Before an agency opens

Each real agency needs its own answer to what it keeps about people, for how long and who sees it, under the law of the place it works in, and its own check of whether the people it serves are a vulnerable group. Hub Steward has none of these answers yet.

| Work | State |
|---|---|
| Lawful basis, consent and retention for what the agency keeps about its members, under the data protection law where it works | To do, per agency |
| Whether the agency must register or run an impact assessment | To do, per agency |
| What member memory may hold, who sees it and for how long | Not decided; member memory is planned, not built |

For example, the two lab sites:

| Site | Work | State |
|---|---|---|
| Lab in Germany | GDPR: lawful basis for what Hub Steward keeps about residents, consent, whether an impact assessment is needed | To do; residents are a vulnerable group |
| Lab in Siaya | Kenya's Data Protection Act 2019: whether the lab registers with the Data Protection Commissioner | To do |
