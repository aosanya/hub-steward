# Smart backlogs, and sending issues to a backlog

Decided by the owner on 2026-11-10 as D90 to D100 in [decisions.md](../../../../../hub-steward-swe/documentation/1.%20requirements/decisions.md), with the requirements R35 to R44. Drawn as [mockups](../../mockups/app/smart-backlogs.html).

The idea comes from the smart playlist in a music app: rules on the issue, and the list fills itself. The backlogs the app has today are the other kind, filled by hand.

## Two kinds of backlog

| | Backlog with steps (today) | Smart backlog (new) |
|---|---|---|
| What it is | A workflow: ordered steps, a Kanban board | A saved set of rules |
| What is in it | Issues put there; an issue is in exactly one backlog, at one step (D58) | Whatever the rules match right now |
| How an issue gets in | Sent there (this page), moved by Chat, or loaded | It meets the rules; nothing is sent |
| Steps and board | Yes | None of its own; its Board draws a column for each step of the backlogs its issues live in |
| Can it be a place to send to | Yes | No |
| Edited by | Its name, steps and access (SW34) | Its name, rules and access |

A smart backlog never owns an issue. An issue lives in one backlog with steps and can show up in any number of smart backlogs, so the one-backlog rule stays as it is.

## The Backlogs screen

The Backlogs screen lists both kinds in one list. A smart backlog has a Smart pill, its count and its issues in each step as small bubbles, Done and Cancelled counted by the hub (D120, D125), with no steps and no rules on the row; the rules are read back once it is opened. Add a backlog asks which kind first: Backlog with steps goes to the screen drawn in [manage-backlogs.html](../../mockups/app/manage-backlogs.html), Smart backlog to the rules screen.

## The rules screen

Taken from the smart playlist window the owner showed: a name, **Match all | any** of the rules, one row for each rule with a minus, and an Add a rule button. A live line says how many issues match now.

A rule is a field, an operator and a value. Only what an issue already has can be a field:

| Field | Operators | Value |
|---|---|---|
| Tag | has, does not have | a tag that exists, the repo among them |
| Mark | is, is not | Ready, Waiting or Blocked (each is its tag only, D101, D142; a paused row has none) |
| Backlog | is, is not | a backlog with steps |
| Step | is, is not | a step name that exists |
| Priority | is, is not | a priority |
| Title | contains, does not contain | typed words |
| Description | contains, does not contain | typed words |
| Waits on | has something, has nothing | none |
| Last changed | is in the last, is not in the last | a number and days, weeks or months |

Mark, Backlog and Step keep their own fields, so a rule says what it means ("Mark is Ready", "Step is To do"). The repo is a tag (D13), so it is a Tag rule: "Tag has hub-steward".

There is no limit and no order (D95): the list keeps its own rank order. The music app's Limit, Skips, Last Played and Genre have no equal here; Last changed is the one the owner already uses in [Find old issues](../../../../../hub-steward-swe/documentation/4.%20qa/user-journeys/05-find-old-issues/README.md).

The same rules cannot be saved twice. The screen says so and links to the backlog that has them.

**Editing and deleting.** Edit rules opens the same screen filled with the saved name and rules, with Save in place of Create smart backlog. For a person who may manage backlogs a quiet **Delete this smart backlog** button sits under Save. It asks "Delete <name>?" with Delete and Cancel, as deleting a backlog with steps does ([manage-backlogs.html](../../mockups/app/manage-backlogs.html)). Delete removes only the rules: a smart backlog owns no issue (D90), so no issue is touched and nothing stops it. The person returns to the Backlogs screen with one line, "Deleted <name>". Drawn in [smart-backlogs.html](../../mockups/app/smart-backlogs.html#s2).

## Opening a smart backlog

The same list as All issues, narrowed by the rules: the Smart pill, the first rule read back with a "+N more" bubble when there are more (see [many rules](#a-smart-backlog-with-many-rules)), the count, an Edit rules link and a Change who has access link for a person who may manage backlogs (the same words as a backlog with steps; it opens the Access screen of the smart backlog), and Select in the top bar. It carries the same search box as every list (SW254, the shared FilterBar, no second search): typing narrows the issues the rules matched, in List and in Board, by code, title and tags, case-insensitively, and the count reads "1 of 3 issues" while a search is on; the cross empties it. The match is made in the app on the issues already loaded. A smart backlog that matches nothing is an empty card with an Edit rules button inside it.

## From a filter (SW71)

When a tag or a search is chosen on any list, a Save as smart backlog button sits under the count, for a person who may manage backlogs. It opens the rules screen already filled: each chosen tag is a Tag rule, typed search words become a Title rule, matched on all, with a name made from the filter. When a smart backlog with the same rules exists, the button is replaced by a link to it. It replaces the separate filter backlog the board once had; a filter is saved as a smart backlog.

## A smart backlog with many rules

The header shows the first rule and nothing more of the rest, so it stays one line on every window width (D114). With more than one rule a small bubble, the app's Chip, reads "+N more" after the first rule, N being the rules that are not shown. Tapping the bubble opens a sheet, the sheet the app already has, titled Rules: a line says how the rules combine ("Matches all of these rules" or "Matches any of these rules") and the rules follow, one to a line. Tapping outside the sheet closes it. With one rule there is no bubble, and a smart backlog with no rules shows only the Smart pill, as before. When the line is short the first rule is cut with an ellipsis, and the count, the List | Board switch and Actions stay put. Drawn in [smart-backlogs.html](../../mockups/app/smart-backlogs.html#s3) on a phone and [wide.html](../../mockups/app/wide.html#s6) on a wide window.

## Sending an issue to a backlog

A person who may move issues can send one issue, or several, to a backlog with steps.

1. **One issue:** a Send to backlog button under the description of the opened issue.
2. **Several:** Select in the top bar of any list turns the rows into ticked rows, the title counts them, All ticks every row shown, and a Send to backlog button replaces the tab bar.
3. **Where:** a sheet lists the backlogs with steps the person has Can move on, each with the step the issues land at (its first step). Smart backlogs are not listed.
4. **After:** the list returns with one line, "2 issues sent to Documentation".

Sending is the move that Chat already does ("move 4 to Documentation", D22): it takes the issue out of its old backlog and puts it at the first step of the new one. To put it at another step, ask in Chat.

## Chat

| The owner says | The role does |
|---|---|
| "Make a smart backlog of ready issues at To do" (Mark is Ready, Step is To do) | Shows a card with the rules read back and the count, and Create and Edit rules buttons; nothing is made until Create |
| "Show Ready to start" | A card with the count and an Open button, as for the other backlogs |
| "Send 2 and 4 to Documentation" | The existing move, one line back |
| "Change Ready to start to the last 14 days" | Edits the rule and answers with the new count |

## Access

A group's access to a smart backlog is Can see or Can edit (D96; there is nothing to move), set on the same Access screen as for any backlog. It never leaks: a person sees only the issues their groups can already see, so two people can see different counts in the same smart backlog.

## What this leaves out

| Left out | Why |
|---|---|
| Nested rules (all of these, or any of those) | One level of Match all \| any is the smart playlist's own shape |
| Moving an issue into a smart backlog | The rules decide what is in it |
| An Undo on the sent line | Needs the old backlog and step kept; D94 |
| Counts of Ready and Blocked on rows | The line carries the repo and backlog as bubbles; a Blocked bubble shows only on a blocked issue |

## The lighter row

The list rows in the drawings carry less than before: the number and title, then one line of bubbles with the repo and the backlog, and a Blocked or Waiting bubble only on an issue that is one (Blocked red, Waiting a light amber-orange, never both). Before, every row had a Ready or Blocked chip, a repo chip, a backlog chip and an area chip, and the phone showed `projects/hub-steward-agency_creator` and `hub-steward-agency_creator` side by side for the same repo. Tapping the repo, the backlog or Blocked still filters. The Ready chip is gone, so Ready is not a tap-to-filter tag; it is still a Mark rule. [lists.html](../../mockups/app/lists.html) and [kanban.html](../../mockups/app/kanban.html) show the lighter row.

## Every tag is a bubble (SW194)

The repo and the backlog on a row or card are bubbles like Blocked, no longer plain words. Each bubble takes its colour from its own text, so the same tag has the same colour on every row, card and issue page, and the row shows the colour of the text it displays (a repo `projects/x` and a repo `x` both read `x` and share one colour). The generated colours are only greens and blues; the reds are kept for Blocked, and Ready keeps its own green tone, because they carry meaning. The tint is a wash of the hue with text mixed toward the ink colour, so it reads in the light and the dark theme. The issue page shows the same bubbles for the mark, repo, topics and backlog. [lists.html](../../mockups/app/lists.html), [kanban.html](../../mockups/app/kanban.html) and the issue page in [smart-backlogs.html](../../mockups/app/smart-backlogs.html) draw them.

On a wide window a smart backlog opens as a List or a Board that uses the full width: [Using the full width of a window](backlog-page.md#using-the-full-width-of-a-window), drawn in [wide.html](../../mockups/app/wide.html#s4).
