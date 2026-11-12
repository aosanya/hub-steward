# Chat replies

How the roles' answers look in the Chat tab of the phone app. A reply is
either one plain line or one card. The card is the chat room's existing card
(`rm-card` in `hub-steward/code/app/src/chat/rooms/cards.tsx`): a title, a few
plain lines, and a row of buttons at the bottom. No new card kind is drawn.
This is a drawing for the owner to change, drawn as [mockups](../../mockups/app/chat-replies.html); the decisions it rests on are D40
to D49 and the conversations are in [chat-and-mcp.md](chat-and-mcp.md).

## Show all issues (D40, D46)

```text
You: show all issues
+--------------------------------+
| Backlog                        |
| 83 issues                      |
| [Open]                         |
+--------------------------------+
```

Open opens the list of all issues ([backlog-page.md](backlog-page.md)).
With a filter asked for ("show Blocked and mwanachama-frontend-kazi") the card says which:

```text
+-----------------------------------------------+
| Backlog                                       |
| 293 issues: Blocked, mwanachama-frontend-kazi |
| [Open]                                        |
+-----------------------------------------------+
```

## Show a backlog's board (D51, D60)

```text
You: show the Software board
+--------------------------------+
| Software                       |
| 5 issues in 6 steps            |
| [Open]                         |
+--------------------------------+
```

## Show the backlogs (D60)

```text
You: show the backlogs
+--------------------------------+
| Backlogs                         |
| [Software]  6 steps            |
| [Documentation]  5 steps       |
+--------------------------------+
```

A button opens that backlog's board. Only the backlogs the person can see are listed.

## Smart backlogs (SW78)

Written in [smart-backlogs.md](smart-backlogs.md); drawn in [chat-replies.html](../../mockups/app/chat-replies.html) section 4. Nothing is made until Create.

```text
You: make a smart backlog of ready issues at To do
+--------------------------------+
| Ready to start                 |
| Mark is Ready · Step is To do  |
| 3 issues match now             |
| [Create] [Edit rules]          |
+--------------------------------+
```

Edit rules opens the rules screen with the same rules filled in.

```text
You: show Ready to start
+--------------------------------+
| Ready to start                 |
| Smart · 3 issues               |
| [Open]                         |
+--------------------------------+
```

```text
You: change Gone quiet to 14 days
Gone quiet now matches issues not changed in the last 14 days: 3 issues.
```

## The assistant page around a write (SW154 to SW162)

The assistant page (`hub-steward/code/app/src/assistant`) shows a write as a confirm card and does nothing until the person taps it.

| Moment | What the page does |
|---|---|
| The card names its subject (SW155) | An issue is found by its key or its id from the lists this answer has read, and the step is shown in the backlog's own spelling ("In Progress", not "doing"); the id stays the fallback when nothing is found |
| A rule is sent in words (SW161) | The page lines and the Triager's description give the field, operator and value codes (`last_changed`, `in_the_last`, and the rest of the lists in `smartBacklog/fields.ts`); a create or rules change is checked against them before the card, and a wrong word gets no card and no hub call: the model is told what is wrong and that nothing was done |
| The write is confirmed and done (SW154) | The answer carries no lookup lists or cards, so no stale "This could not be opened." card and no Results row for the lookups made on the way |
| The hub refuses the confirmed write (SW160) | The ask ends: a failure card shows the hub's own reason in its grey line with Try again, and no confirm card or button stays live |
| "Show <smart backlog name>" (SW162) | The page lines tell the model to read the backlog list first, so the answer is the backlogs card with an Open button for each backlog |
| "Open 2" (SW156) | The question sent to the model names row 2 of the list picked in the Results tab (the newest when none is picked), with its id, title and the list's title; the message the person sees is unchanged |
| A list is longer than the rows the Results tab shows (SW170) | The tab says "Showing 24 of 724" and ends with Open all 724 issues, which opens the List screen with the answer's tags, repo, search words or backlog applied, so paging and Select reach the rest; a list from the pending tool that is narrowed by a tag, search words or a backlog (SW180) ends with Open these in the List and the line "The List also shows closed issues.", because the List cannot show the pending tool's open-only rule and so cannot promise the count; when the answer was narrowed by something the List cannot show (a step, a priority, nothing at all for the pending tool, a smart backlog with a pending call, a backlog not found) the button reads Open all issues, opens All issues, and the line above it says "Opens every issue, not only these." |
| A count read beside the rows of the same call (SW180) | The model may read the same list twice, once for twenty rows and once with one row to count it; the Results tab keeps the wider page whichever came first, and drops a read only when it is narrower in matches (SW113, SW114) |
| A move picked out of a word that fits seven or more issues (SW182) | The card is not shown: the page tells the model that no issue was chosen and to ask for a narrower word from the title, like a number, without choices; a move that names the issue by its key or its whole title, or one picked from a list that was not searched by words, still gets its card |

## Open an issue (D41, D42)

```text
You: open 2
+--------------------------------+
| 2  Import the municipality     |
| Load the English template into |
| the local database and check   |
| that all 46 workflows are      |
| listed.                        |
| Waits on                       |
| [Switch on the custody module] |
| [Fix the import route]         |
+--------------------------------+
```

One button for each issue it waits on; tapping one answers as if the owner
had typed "open" and its number. An issue that waits on nothing has no Waits
on line and no buttons.

## Plain lines

| The owner says | The roles answer, one line |
|---|---|
| "Load the boards" | The boards are loaded from a terminal on your laptop, not here. See loader.md. |
| "Move 2 to In Progress" | Moved 2, Import the municipality, to In Progress. |
| "Move 4 to Software" | Moved 4, Mirror the story boards, to the Software backlog, at To do. |
| "Add a step called Review after In Progress in Software" | Added Review to Software. Its steps are To do, In Progress, Review, Testing, Done, Cancelled. |
| "Add a backlog called Support with the steps New, Answering, Closed" | Added the Support backlog with 3 steps. Only the Product owner group can see it. |
| "Remove the step Review from Software" while it holds issues | Review still holds 3 issues. Move them first. |
| "Let Contributors see Documentation" | Contributors can now see Documentation. |
| "Let Contributors move issues in Software" | Contributors can now move issues in Software. |
| "Remove access to Documentation for Contributors" | Contributors can no longer see Documentation. |
| "Show Docs and Blocked" with nothing matching | No issues are both Docs and Blocked. |
| "Open 99" past the end of the list | The list has 83 issues. |

## Choosing between named issues

When the owner's words fit more than one issue, the reply is a card with one
button for each candidate, never a request to retype (the app's rule for
chat). A bare "move the import" for the issue just discussed means that issue.

```text
+--------------------------------+
| Which one?                     |
| [Import the municipality]      |
| [Import the story boards]      |
+--------------------------------+
```

## What this leaves out

| Left out | Why |
|---|---|
| A list of issues written into the chat | The list is a screen (D40) |
| A card for backlogs | A line is enough (D21) |
| A sort, its counts, Approve and Send back | Removed (D49) |
