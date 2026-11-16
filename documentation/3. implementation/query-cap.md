# The query cap

A request whose query string has more than 10,000 `&`-separated segments is refused with a 400. This page says why, which code does it and what is covered. The issue is S71; the catalog's own guard was CAT135 and its wording was corrected by CAT136.

## Why

From Go 1.24.12, 1.25.6 and 1.26, `net/url.ParseQuery` returns an error and an empty map for a query of more than 10,000 segments (the setting is `GODEBUG=urlmaxqueryparams`, default 10000, `0` switches the cap off). `r.URL.Query()` throws the error away. A handler that reads its filter or limit from `r.URL.Query()` then sees no query at all and answers an unfiltered request: `GET /suggestions` with 40,000 `status` values answered 200 with every status.

Only the cap error returns an empty map. A bad percent escape or an unencoded semicolon returns an error together with every good pair, and `r.URL.Query()` serves those with the bad pair dropped. They are answered as before and are not refused.

## The rule

| Request | Answer |
|---|---|
| 10,000 segments or fewer | Answered as before |
| 10,001 segments or more | 400, `{"error":"the query string could not be read: too many parameters"}` |
| A bad percent escape or an unencoded semicolon | Answered as before, the bad pair dropped |
| `GODEBUG=urlmaxqueryparams=0` | Nothing is refused, there is no cap to hit |

The cap error is not compared with a number or a text written in this repo. At start-up `querycap.go` parses a million empty segments, keeps the error it gets and compares each request's error with it, so a toolchain that changes the number or the wording changes nothing here.

## Where

`refuseOversizedQuery` in `internal/api/http/querycap.go` is one router middleware, wrapped beside `limitRequestBody` in `router.go`, outside `refuseControlCharactersInAddress` and before sign-in. It covers every route the router mounts: the routes dispatched from a module's declared operations, the hand-written handlers (about 25 `r.URL.Query()` sites) and `/git/`. Shared dispatch has no guard of its own; the owner chose one middleware in each wakala-api on 2026-11-16 over a guard in dispatch.

`refuseControlCharactersInAddress` is unchanged: it checks the path and the names and values of the pairs it can read, and a cap-sized query never reaches it.

## The catalog's own guard

`mwanachama-backend-catalog` `routes/query_guard.go` guards the catalog's routes when the catalog is served alone. It stays until both `mwanachama-wakala-api` and this hub copy carry the middleware, then it is removed.

## Tests

`internal/api/http/query_cap_test.go`: 10,001 segments answer 400 naming the cap on a module route, a hand-written route and `/git/`; exactly 10,000 segments get the same answer as a one-parameter query; a bad escape and a semicolon get the same answer as a plain query.
