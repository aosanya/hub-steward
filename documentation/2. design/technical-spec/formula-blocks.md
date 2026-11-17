# A function's formula as blocks beside its text

Mockup: `mockups/console/agency/function-formula.html`. Hub issue ISS-3. Status: drawn, not yet reviewed by the owner; the build (TD-2957) waits for that review. All names and figures are invented.

The screen shows one function's formula twice: as blocks and as the one line of text that is stored. The text is the only stored form (compute decision 5). The blocks are a second way to read and edit that same text (decision 7). The language page is `mwanachama-backend-compute/documentation/2. design/formula-language.md`.

## What the screen holds

| Part | What it shows |
|---|---|
| Blocks | The formula as nested blocks. Selecting a block offers only what the language accepts in its place. |
| Text | The standard text, editable. A label says `Standard shape` while it can be read. |
| Inputs | Each input's name and type. The blocks may use only these names. |
| Examples | The function's examples, run on the API, each with its result beside the expected one. |
| Save | Stores the standard text. Off while the text cannot be read. |

The studio holds no engine. Reading text into blocks, printing blocks back as text, and running the examples are calls to the API.

## The rules of the screen

Rules 1 to 4 follow the owner's decisions and the language page. Rules 5 and 6 are proposed.

1. **An edit in either view moves the other.** A block edit writes the standard text. A text edit that can be read rebuilds the blocks from the tree.
2. **A block edit cannot make a formula the language refuses to read.** Each block offers only the choices that give a valid tree: a comparison block lists the six comparisons, an arithmetic block the operators the mixing table allows for its operand types, a call block the functions that exist with the versions available.
3. **A text edit that cannot be read keeps the blocks but pauses them.** The text shows the Parse sentence word for word (figure 2), the blocks dim and say they show the last text that could be read, Examples and Save are off.
4. **There is no text-only fallback.** Every part of the language has a block, so every formula that can be saved opens as blocks. The mockup draws no text-only case; the todo's wording for one is replaced by decision 7 and the issue's decision that the blocks cover the whole language.
5. **A problem found by Check marks its block.** Check names the part by its path (language page, "Addressing a part"); the block at that path takes a bad border and its sentence sits beside it. This is the same sentence the text view shows.
6. **Limits are shown as the person nears them.** Depth 12, 100 nodes, 500 characters and 8 inputs are the language page's numbers. A block that would pass one is not offered.

## Every part of the language and its block

| Part of the language | Block | Notes |
|---|---|---|
| Integer literal `3` | Value block, type `integer` | Digits only. No sign, no leading zero. |
| Decimal literal `0.00` | Value block, type `decimal` | Keeps its written digits, so `0.010` and `0.01` are two blocks. |
| Text literal `"active"` | Value block, type `text` | `"` and `\` are the only escapes, written for the person. |
| Boolean `true`, `false` | Value block, type `boolean` | Two choices. |
| Input name | Name block | Chosen from the function's inputs. A name that is not an input cannot be picked. |
| Negation `!x` | `not` block with one slot | Takes a boolean. |
| `+` `-` `*` `/` `%` | Arithmetic block: left slot, operator, right slot | The operator list follows the operand types. `%` only for two integers. |
| `<` `<=` `>` `>=` | Compare block: left slot, operator, right slot | Operators read in words in the menu ("is at least"). |
| `==` `!=` | Compare block | For numbers or two texts. |
| `&&` `\|\|` | Logic block: left slot, `and` or `or`, right slot | Both slots take a boolean. |
| `condition ? then : else` | Conditional block with three rows: `if`, `then`, `else` | A chain of `else` is one `else` row holding another conditional block. |
| Call of a built-in `round(x, 2)` | Call block named `round`, one slot per argument | `round` and `to_decimal` take a whole number written in the block, 0 to 10. |
| Call of an agency function `late_days@1(due, filed)` | Call block with the function and its version | A call with no version cannot be built: the version is a required choice. |
| Call of a library function `fin.pmt@2(a, b, c)` | Call block with library, function and version | The menu lists the versions that exist. |
| List `[0.00, x]` | List block with one slot per item | One type of item. At least one item. |
| Brackets | None | Brackets only change the tree. The nesting of blocks shows the grouping, and the text is printed with the fewest brackets. |
| `float`, `date` | No literal block | These come only from an input or from `to_float`, so they appear as a name block or a call block. |

A tree that has a part not in this table cannot come from Parse, so the table is the whole language as the language page states it.

## Figures of the mockup

| Figure | Shows |
|---|---|
| 1 | The balance after a payment, as blocks and as text, the comparison selected with its menu of six replacements, the example table with results. |
| 2 | The same formula after a text edit that cannot be read: the plain-words error, paused blocks, Save off, examples off. |
| 3 | A formula with a call and a list (the farmer's net payout), showing nested blocks laid out downwards so deep trees stay readable. |

## Open questions for the owner

1. Should the studio keep the last readable blocks visible while the text cannot be read (drawn), or hide them?
2. How are the blocks laid out for a deep tree: nested downwards (drawn) or in a single row that scrolls sideways?
3. Is the example table here the function's own examples only, or may a person type a one-off row?

## Link lines for the shared pages

The mockup is not yet linked from the console mockup index or the navigation page. The lead adds:

- In `mockups/console/index.html`, under Agency: `agency/function-formula.html`, "Function formula as blocks".
- In `mockups/console/components.html` nothing: the block is local to this page until the owner approves it.
