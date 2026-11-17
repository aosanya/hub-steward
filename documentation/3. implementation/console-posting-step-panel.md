# Console: the posting step panel

The card a builder uses to set up the step that posts a worked-out amount to a member's account, and the card beside it that reads the whole posting back as one sentence. It is drawn on screen 3 of [workflow-calculating-step.html](../2.%20design/mockups/console/agency/workflow-calculating-step.html), which the owner accepted on 2026-11-17, and described in [calculating-step-screen.md](../2.%20design/technical-spec/calculating-step-screen.md), section The posting step. It is built for ISS-56.

## Where it lives

All of it is in `code/console/src/pages/calcstep/`.

| File | What it holds |
|---|---|
| `postingSentence.ts` | `postingSentence`, the pure function that writes a posting as a sentence, and the types `Posting`, `Direction` and `PostingNames` |
| `PostingStepCard.tsx` | `PostingStepCard`: the Post the payment card with Amount, Account, Other side, Direction and Reason, and the What it does card |
| `postingSentence.test.ts`, `PostingStepCard.test.tsx` | The tests |
| `../../journeys/postingCard.walk.test.tsx` | The journey step that fills the card in and saves the page for the screenshot; it saves through `../../journeys/walkShot.ts`, the one `savePage` the walk steps share |

The words are the keys `calcstep.posting.*` in `public/i18n.json`, 22 keys in all seven languages. The sentence is built from four of them (`sentence.credit`, `sentence.debit`, `sentence.reason`, `sentence.once`), so it reads in the language of the console. The card is built from the shared `Card`, `SettingRows`, `SelectControl`, `TextControl`, `Detail`, `Note` and `Stack` of `src/ui`, and from `OptionControl` for the two sides. It has no styles of its own.

## What the card takes

The card fetches nothing. The page that mounts it passes everything in.

| Prop | What it is |
|---|---|
| `title` | The step's own name, for example Post the payment |
| `results` | The calculating steps of the workflow, each `{ key, name, step }`: the name its result is kept under and the step that works it out. These are the only choices for the amount |
| `accounts` | The accounts, each `{ id, name }`. Both Account and Other side list all of them |
| `value` | The posting as it stands: `{ amount, account, otherSide, direction, reason }`. `amount` is the key of a result, `direction` is `debit` or `credit` |
| `onChange` | Called with the whole new posting on every change |
| `sample` | Optional. The figure of the last sample run, shown in the list as `564.88 on the sample` |

## What a builder can and cannot do

| Rule | Where it is held |
|---|---|
| The amount is the result of a calculating step earlier in the workflow and nothing else. The picker lists only `results`, and there is no field to type an amount | `PostingStepCard.tsx`, tested |
| Every posting names both accounts: the member's account and the other side | Two pickers, both required for the sentence |
| Direction is a choice of two sides of the account (Debit Member loans, Credit Member loans) and never a sign | Two radio buttons, tested |
| The reason is a line in words | A text field, shown on the entry |

## The sentence

`postingSentence(posting, names, t)` returns the sentence, or an empty text when the posting is not complete. It is complete when the amount, both accounts and a reason are chosen and the two accounts are not the same.

| Direction | The first sentence |
|---|---|
| Credit | Credits {account} and debits {other} by the {amount}. |
| Debit | Debits {account} and credits {other} by the {amount}. |

Then comes `The reason on the entry reads “{reason}”.` and last `Running this step twice for the same case posts once.` The example of the accepted drawing reads:

> Credits Member loans and debits Cash by the Monthly payment. The reason on the entry reads “Loan payment for the month”. Running this step twice for the same case posts once.

Under the sentence the card lists the amount on the sample (when there is a sample), the account with its side and the other side with the opposite side. While the posting is incomplete the card says what to choose, and lists nothing. The sentence never contains a minus sign.

The last sentence, that a second run for the same case posts once, is a promise of the host (the send key of the posting step, compute decisions 8 and 11), not something the card checks.

## What the card calls

Nothing. The list of the member accounts is to be confirmed against the accounting side, so the card takes `accounts` as a prop and the page passes a fixture until that call exists. No route is guessed.

## Checks

- `npx vitest run src/pages/calcstep/posting src/journeys/postingCard.walk.test.tsx`: 12 tests pass.
- `npm run typecheck` in `code/console` is clean.
- The screenshot of the card at 1440 wide with the example of the accepted drawing is in the swe repo, [iss-56/posting-card-1440.png](../4.%20qa/walk-records/iss-56/posting-card-1440.png). It was taken from the card rendered through the journey step with the console's own stylesheets in headless Chrome, not from the assembled page, which the assembly issue ISS-58 shoots. To make it again, run the journey test with `WALK_SHOTS` set to a folder and open the saved page in a browser at 1440 wide.

## What stays open

- **The accounts call.** Which call lists the member accounts, and whether Other side may be any account or only some, is not decided on the accounting side. The card allows any account.
- **The record of figures that is not money** (compute decision 7) is written by a step that is not decided yet. It is not drawn on this card.
- **The posting step's own open questions** are on the agency's posting-step design page and are not repeated here.
- **The Reason field is narrow.** The shared `TextControl` has no width option, so a long reason is cut in the field on the screenshot. Changing the shared control is not part of this issue.
- **The walk of the whole step.** The journey step here fills in this card only. The walk of building the loan payment step on the assembled page is the assembly issue ISS-58.
- **Words shared with the other cards.** `public/i18n.json` is edited by every card of this screen, so each adds only its own `calcstep.*` keys after re-reading the file. `src/i18nFiles.test.ts` checks that all 22 keys of this card are written out in the seven languages and passes.
