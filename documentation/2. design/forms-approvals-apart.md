# Forms and agency approvals: where the give-back lives (F88, TD-1589)

Status: waiting for the owner. Written 2026-11-16, read-only study.

## The problem in plain words

An agency keeps its own approvals (a change someone proposes and an owner approves) in a table named `<agency>_approvals`. The forms module also has an approval object, and its table is called the same thing. When both ran against one database, forms renamed the agency's table into its own, and the agency's approvals were swallowed into forms.

Hub commit 4df627b4 fixed this in two parts:

1. Forms now leaves an agency-shaped `<agency>_approvals` table alone instead of renaming it. This needs only a check that the table has the columns `kind` and `summary`. It imports nothing outside forms.
2. On provision, forms gives back to the agency's store any agency approval it already swallowed, in one transaction, only for ids the store lacks. This is `approvals_apart.go` (113 lines) and a call in `provision.go`. It imports `wakalaserver/internal/approvals` for two things only: `approvals.Open(db, agency)`, which makes sure the store's table exists, and `approvals.TableFor(agency)`, which names it.

The backend `mwanachama-backend-forms` is public and cannot import `wakalaserver/internal/approvals`: Go forbids importing another module's `internal/` package, and the hub is not a module the backend may depend on. So part 2 cannot be moved into the backend as written. Part 1 can move as it is.

## Facts found

- The agency approvals store is `internal/approvals` in the hub (357 lines, plus tests) and its own copy in `mwanachama-wakala-api/internal/approvals` (324 lines, plus tests). No backend repo holds either.
- The package is a leaf. It imports only the standard library, `gorm` and `uuid`, and no other hub-internal package.
- The two copies already differ. The hub's copy has `DecideSeen` and `ErrChangedSinceRead` (a decision refused when the approval was amended after it was read). The private API's copy lacks them. So the store is already copied twice and drifting, which is the thing the owner ruled out for backends.
- Outside forms, the hub imports the store in 7 files (5 of them not tests: accounts, the approvals routes and apply code, the agency caches and registry). The private API imports it in 6 files (5 not tests, the same areas).
- Both APIs call forms provision from one place each: the agency registry in each. The backend forms copy has neither part of the fix, so the private API still has the swallowing problem until the fix reaches the backend.
- Public repos that forms may import: `mwanachama-backend-shared` (public). `mwanachama-backend-agency` is private and so is `mwanachama-wakala-api`, so forms may not import either.

## The three options

### Option A: move the approvals store into a backend repo and import it

Put `approvals` in `mwanachama-backend-shared` (public, and already a dependency of forms). A private home such as the agency backend is not possible, because forms is public.

- Cost: reconcile the two copies into one (the hub's is the newer), move the package and its six test files, cut a new shared tag, then a forms tag, then change the imports in both APIs (7 files in the hub, 6 in the private API) and delete both copies.
- Gain: ends the second copy of the store, a drift that exists today. The give-back can be tested in forms with the real store.
- Cost against the owner's rule: none, since it removes copies. But it makes the shared repo hold an agency concept, and it makes forms depend on the agency store's schema and table-name habit.
- Risk: the largest change of the three, and the shared tag is already needed for ISS-105, so the two would have to be sequenced together.

### Option B: forms takes the table name and an open function through a small interface

Forms declares an interface with two methods, the table name for an agency and a call that makes sure that table exists. Each API passes in an adapter that forwards to its own store (two one-line functions). Forms keeps all of `approvals_apart.go` except the import.

- Cost: forms provision gets one extra input (an option or argument), and both APIs change their one call site. Forms tests use a stand-in that creates a plain table, so forms needs no store at all. The check against the real store stays as one small test in each API.
- Gain: no new repo, one forms tag, forms stays ignorant of the agency store. Both APIs get the fix by importing forms.
- Risk: an API that forgets to pass the interface would silently skip the give-back. To avoid that, forms must fail provision with a clear error when it finds swallowed agency approvals and no interface was given, instead of skipping.
- Does not remove the two diverged store copies. That is a separate follow-up (a small issue, whichever option is chosen).

### Option C: keep the give-back in the hub mount

The backend forms gets part 1 only (leave the agency table alone). The give-back stays as hub code.

- Cost: the hub then has code that belongs to forms, so the hub keeps a second home for a forms fix, and the private API, which needs the same give-back, would have to copy it too. Both break the owner's rule (both APIs import the backends, no copy of backend code, no `vendor/`).
- Gain: nothing to build now.
- Only acceptable if the owner confirms that no database outside the hub ever swallowed approvals (see the question below). Even then the hub carries a one-off migration forever.

## Recommendation: option B

It is the smallest change that keeps both owner rules: the backend stays public and imports nothing private, there is exactly one copy of the give-back (in forms), and both APIs import it. It needs no new repo and no new shared tag, so it does not wait on ISS-105. Option A is the better long-run home for the store, but it is a second project (reconcile and retire two copies) and should be filed on its own, not bolted onto F88. Option C leaves a hub-only copy of a forms fix.

What B means for TD-1589: the backend gets part 1 and part 2 with the interface; the clash test is ported with a stand-in table; the hub and the private API each pass their store adapter when they call forms provision; provision fails loudly if swallowed approvals exist and no adapter was passed.

## What the owner must answer

1. Option B, A or C?
2. If B: may forms fail provision when it finds swallowed approvals and no adapter was passed (recommended), or should it skip quietly?
3. Did any database outside the hub (the private API's databases) have an agency and forms mounted together before 4df627b4? If none did, the give-back is needed in the hub only, and option C becomes safe for that one-off migration.
4. Should the two diverged copies of the approvals store be reconciled in one shared home as its own issue (option A later)?
