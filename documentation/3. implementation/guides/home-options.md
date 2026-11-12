# Home options

The Home screen of the phone app opens with up to three option rows, in this order: Start, Ongoing, Backlogs (decisions 154, 156 and 158; drawing `2. design/mockups/app/tabs.html`, section 1). Each row has its icon (play, clock, list), its name and a chevron, with no subtitle and no count. The code is `code/app/src/home/HomeOptions.tsx`.

| Row | Shown when | Opens |
|---|---|---|
| Start | the member has open steps, waiting steps or steps she can start (`agency_list_my_open_steps`) | the Start page |
| Ongoing | the same test as Start | the Ongoing page |
| Backlogs | the agency has the `taskmanager` module and the member can read at least one backlog (`taskmanager_backlog_list`), and the role also has workflows | the Backlogs page |

A role with no workflows and at least one visible backlog sees the backlogs themselves instead of the three rows, the one opened last on top. A backlog counts as opened when a backlogs path names it; the choice is kept on the phone for each agency (`home/lastBacklog.ts`). A smart backlog opens its smart page, any other backlog opens its board.

A read that fails counts as having nothing behind it, so a row never shows for something the member could not reach. Nothing is drawn until both reads are answered, so the rows do not jump.

The Start page heading is Start and the Ongoing page heading is Ongoing.
