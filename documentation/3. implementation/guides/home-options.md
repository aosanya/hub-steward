# Home options

The Home screen of the phone app opens with up to three option rows, in this order: Start, Ongoing, Backlogs (decisions 154, 156 and 158; drawing `2. design/mockups/app/tabs.html`, section 1). Each row has its icon (play, clock, list), its name and a chevron, with no subtitle and no count. The code is `code/app/src/home/HomeOptions.tsx`.

| Row | Shown when | Opens |
|---|---|---|
| Start | the member has open steps, waiting steps or steps she can start (`agency_list_my_open_steps`) | the Start page |
| Ongoing | the same test as Start | the Ongoing page |
| Backlogs | the agency has the `taskmanager` module, the member's roles hold `task.read` (`agency_get_my_roles`, the same gate the Backlogs page uses), the member can read at least one backlog (`taskmanager_backlog_list`), and the role also has workflows | the Backlogs page |

A role with no workflows and at least one visible backlog sees the backlogs themselves instead of the three rows, the one opened last on top. A backlog counts as opened when a backlogs path names it; the choice is kept on the phone for each agency (`home/lastBacklog.ts`). A smart backlog opens its smart page, any other backlog opens its board.

A member without `task.read`, such as the Mayor, gets no Backlogs row and no card, and Home does not ask the hub for backlogs for them. The hub would answer `taskmanager_backlog_list` with the tool error "agencies: instance not found", sent with HTTP 200, which looks like a failure but is a plain refusal. The check is the `mayRead` prop of `HomeOptions.tsx`, which defaults to `askMayRead` in `code/app/src/backlogs/access.ts`; the test is `code/app/src/home/homeOptions.test.tsx`. This is the owner decision of 2026-11-13 (option 1 of MUN868).

A read that really fails (a network error, a server error, or unreadable roles, backlogs or modules) draws the card "Backlogs could not be loaded." with Try again. Start and Ongoing stay as they are, and when both workflow reads fail their card reads "Start and Ongoing could not be loaded." Nothing is drawn until both reads are answered, so the rows do not jump.

The Start page heading is Start and the Ongoing page heading is Ongoing.
