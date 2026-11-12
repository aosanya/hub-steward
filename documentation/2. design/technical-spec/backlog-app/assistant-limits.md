# The assistant: who may ask, and how much

From the owner's remark on 2026-11-10 that assistant use should be configurable with token limits. Decided the same day as D102 to D106 in [decisions.md](../../../../../hub-steward-swe/documentation/1.%20requirements/decisions.md); the per-person count and its check (SW132) are built, described in [3. implementation/assistant-limits.md](../../../../../hub-steward-swe/documentation/3.%20implementation/assistant-limits.md); the console page and the at-the-limit card are not. Drawn as [mockups](../../mockups/app/assistant-limits.html). Task rows on the [board](../../../../../hub-steward-swe/documentation/3.%20implementation/todo.md): SW126 (this design), SW132 to SW135 and SW146, SW147 (the build).

## Where it stands today

| | Today |
|---|---|
| Who may ask | Every Backlog role (member, worker, manager) may use the assistant for now, with a chat-only permission, as the owner chose; the owner always may. A person in no group, or in a group with no role, sees "The assistant is not available yet." |
| What is limited | The model account holds limits for tokens per call, per day, per week and per month, and for requests per minute, per day and per week. A limit left empty is no limit. The console sets them on the model's page (Limits). |
| Whose usage is counted | The whole account, and the AI role (the Triager) through its own role limits. The counting windows are by account and AI role, not by person: a usage record can name a person, but no limit is checked for one. |
| Who sees usage | The console's Usage page shows counts and tokens by model for the account. It does not list people. |

So today everyone who may ask draws on one shared pool. One person asking a lot can use the whole pool before the others have asked.

## The design

One page in the console, Assistant, next to the page for the model:

- **A switch for each Backlog role.** May ask, or not (the switch gives or takes away the chat-only permission on the role). The owner always may.
- **Two numbers, tokens a day and tokens a month for each person (D102, D103).** Every person who may ask has their own count for the day and for the month. A number left empty means no limit, as every other limit does.
- **Two numbers for the owner, tokens a day and tokens a month for you (D105).** The owner's own pair, kept apart from the people's, so setting the people's number small never stops the owner. Empty means the owner has no limit.
- **Save** writes the switches and all four numbers in one call. Drawn in [screen 1](../../mockups/app/assistant-limits.html#s1).

A call through the gateway that names a person (the usage-person header) is held to that person's numbers in the same way as a chat, and refused with status 429 and the chat's own words; its tokens are counted against the same person. A gateway call that names no person is held only to the role's and account's limits, as before.

Only the owner sets them, in the console (D104). The Usage page keeps its totals by model and does not list people.

The person-at-the-limit sentences are the same for the owner. When a person has used their tokens for the day, the Assistant page shows the empty card it already shows when the assistant is not available, with one sentence: "You have used today's share of the assistant. It comes back tomorrow." For the month it says "You have used this month's share of the assistant. It comes back on the 1st." There is no writing box. A person whose role is switched off still sees "The assistant is not available yet." as built. Drawn in [screens 2 and 3](../../mockups/app/assistant-limits.html#s2).

## What is decided

| D | Decision |
|---|---|
| 102 | Each person has their own assistant share, counted per person |
| 103 | The share is a number of tokens for a day and a number for a month |
| 104 | The owner sets it in the console; the Usage page keeps its totals by model |
| 105 | The owner has their own day number and month number, apart from the people's; empty means no limit for the owner |
| 106 | The day starts at midnight UTC and the month on the 1st, UTC; the sentences say tomorrow and the 1st, as drawn |

## Open question for the owner

None. Question 4, when a day starts, is answered: midnight UTC, the month on the 1st (D106). The sentences a person reads keep "tomorrow" and "on the 1st"; the hub has no time zone setting, so for people in Hungary the share comes back at 01:00 or 02:00 local time.

## Rows

SW132 the per-person count and its check, SW133 the console Assistant page, SW134 the at-the-limit card, SW146 the owner's own numbers on the server, SW147 the owner's two fields on the console page, SW135 a step in [journey 08](../../../../../hub-steward-swe/documentation/4.%20qa/user-journeys/08-ask-the-assistant/README.md) and the tests.
