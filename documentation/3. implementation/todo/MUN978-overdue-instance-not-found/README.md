# MUN978 overdue.spec "does not list an issue raised just now" failed with "agencies: instance not found"

## Request

In the MUN973 runs 1 to 4, `code/console/e2e/menu-live/overdue.spec.ts:41` failed when run alone: the raise at `overdue.spec.ts:44` through `helpers/live.ts` answered `forms_catalog_raised_item_raise: agencies: instance not found`, so no issue was raised.

## Cause

The raise named an agency instance the hub did not hold. At that time `helpers/live.ts` chose the agency without regard to its name, and `own14` holds several agencies, among them the throwaway ones the mounts suites create. The first agency in the list was not always one the hub served.

## What changed

Nothing in this issue. Later work already removed the cause:

- MUN969 (86312118): `helpers/live.ts` picks the agency by name through `agencyNamed`, and keeps the first agency as the default.
- MUN958 (fd2559a8) and MUN976 (7004b8d0): `overdue.spec.ts` and the back-dating helper were reworked, and the raise now runs on an agency the hub holds.

## Proof

`overdue.spec.ts` was run alone twice in a row on `dev` at c134df8e, under the run lock, with `E2E_BASE_URL=http://127.0.0.1:5181`:

| Run | Result |
|---|---|
| 1 | exit 0, 2 passed (`:41` in 1.0 s, `:56` in 892 ms), 1 skipped (`:50`, `test.fixme`) |
| 2 | exit 0, 2 passed (`:41` in 1.2 s, `:56` in 1.0 s), 1 skipped |

The failure no longer happens. If it comes back, the first thing to check is which agency `signIn` returned for `own14` and whether that instance is in the hub.
