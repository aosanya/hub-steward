# Console: the posting step panel

The card where a builder sets up the step that posts a worked-out amount to a member's account: the amount, the account, the account on the opposite side, the direction and a reason in words, with a short card that reads the whole posting back as a sentence. It is drawn on screen 3 of [workflow-calculating-step.html](../2.%20design/mockups/console/agency/workflow-calculating-step.html), which the owner accepted on 2026-11-17, and described in [calculating-step-screen.md](../2.%20design/technical-spec/calculating-step-screen.md), section The posting step. It is built for ISS-56.

## Where it lives

All of it is in `code/console/src/pages/calcstep/`.

| File | What it holds |
|---|---|
| `postingSentence.ts` | The `Posting` type and `postingSentence`, the pure function that writes the posting as a sentence |
| `PostingStepCard.tsx` | The card with its five rows and the "What it does" card beside it |
| `postingSentence.test.ts`, `PostingStepCard.test.tsx` | The tests |
| `../../journeys/postingCard.walk.test.tsx` | The journey step that fills the card in and saves the page for the screenshot |
| `../../journeys/walkShot.ts` | `savePage`, the one function the walk steps use to save a rendered card as a page |

The card takes everything as props and fetches nothing. The page that mounts it is the assembly issue ISS-58.

## What the card takes

| Prop | Meaning |
|---|---|
| `title` | The name of the step |
| `results` | The results of the calculating steps earlier in the workflow: a key, the result's name and the step it comes from |
| `accounts` | The member accounts that may be chosen: an id and a name |
| `value` | The posting: `amount` (a result key), `account`, `otherSide` (account ids), `direction` and `reason` |
| `onChange(value)` | The builder changed one field; the whole posting is passed back |
| `sample` | Optional. The figure the sample run gave, shown as "564.88 on the sample" |

## The rules

- The amount picker lists only the `results`. There is no field to type an amount, and the sentence under the picker says so.
- Account and Other side each list every account. The sentence is not written while both are the same account.
- Direction is two choices, Debit and Credit, each named with the account it applies to. It is never a sign.
- The sentence is written only when the amount, both accounts and a reason are given. Until then the card says what is missing.
- For a credit: "Credits Member loans and debits Cash by the Monthly payment." For a debit the two verbs swap. The reason follows in quotation marks, and the last sentence says that running the step twice for the same case posts once, which is the send key of the ledger (ISS-49).
- Below the sentence is a short list: the amount, then each account with its side.

## Words

The words are the keys `calcstep.posting.*` in `public/i18n.json`, in all seven languages. The sentences are `calcstep.posting.sentence.*`.

## What stays open

- The call that lists the member accounts is to be confirmed against the accounting side. The card is coded against props and a fixture, never a guessed route.
- The record of figures that is not money (compute-side decision 7) is written by a step that is not decided yet and is not drawn in this panel. The posting step's own open questions live on the agency's posting-step design page.
- Balances come from a ledger of double-entry, append-only entries, and a correction is a reversing entry (compute-side decision 6). The posting step is the actualization stage of a bulk run (decision 11). This card only sets the step up; it writes no entry.
- The Reason box is narrow in the screenshot and cuts a sentence-length reason. The text control is the shared one; widening it is a change to the shared control and not made here.

## How it was checked

`npx vitest run src/pages/calcstep/postingSentence.test.ts src/pages/calcstep/PostingStepCard.test.tsx src/journeys/postingCard.walk.test.tsx` passes and `npm run typecheck` is clean. A screenshot of the card and its sentence at 1440 wide, rendered through the journey test with the example of screen 3, is in [iss-56/posting-card-1440.png](../4.%20qa/walk-records/iss-56/posting-card-1440.png). To make it again, run the journey test with `WALK_SHOTS` set to a folder and open the saved page in a browser at 1440 wide.
