# Reads for the Ongoing Done tab

Spike for ISS-79 (decisions 157 and 158). The first build of Ongoing has the Live tab only. This page records what the API can list today for finished work, so the Done tab can be built when the reads exist.

## What the API lists today

| Work | Read | What it gives | What is missing |
|---|---|---|---|
| Finished group order | `market_list_group_orders` with `state` `closed` and `mine` true | The member's closed group orders, paged by id (200 at most) | When it closed: a group order carries `created_at` only; the time is in `market_group_order_trail`, one call per order |
| Called-off group order | `market_list_group_orders` with `state` `cancelled` and `mine` true | The member's cancelled group orders | When it was called off, as above |
| Single order, delivered or cancelled | `market_list_orders` with `state` `delivered` or `cancelled` | The caller's orders in that state, paged by id (`limit` 50 by default, 200 at most, `after` the last id), each with `delivered_at` or `cancelled_at` (ISS-124) | Nothing yet sets `delivered_at`: the market module has no delivery step for an order, so a delivered order carries the time only once one is added |
| Answers a member sent | none for the caller | `agency_list_live_record_rows` lists rows per `record_code`, and a seat that adds rows to a record sees every row of it, so the app would filter on `added_by` | A row has no step id, step title or workflow name, so the list cannot be rebuilt from it; one call per record |
| Open steps | `agency_list_my_open_steps` | Steps to act on now, never steps already sent | Not a Done read |

`app/src/market/groupOrders.ts` (`listAllGroupOrders`) already takes `mine` and `state`, so the Done tab needs no new client code for group orders beyond the filter values.

## Issues filed

| Issue | Read |
|---|---|
| ISS-118 | `agency_list_my_sent_steps`: the steps the caller sent, with order, form, send time and answers |
| ISS-121 | `closed_at` and `cancelled_at` on a group order |
| ISS-124 | `market_list_orders`: a `state` filter, paging, `delivered_at` and `cancelled_at` |

## The Sent mark

`steps/sent.ts` keeps the steps a member sent in memory for the session. Home shows a sent step once as Sent and hides its start step meanwhile (`wasStarted`, `wasSent`, `sentSteps`).

It was not persisted from the existing reads, for two reasons.

- Rows from `agency_list_live_record_rows` carry a `record_code` and no step id, while the mark is keyed by step id and order. A match would need a second mapping that the server does not offer.
- A start step can be sent again and again. Reading the mark from rows would hide it for good after the first send, which changes what Home shows and is not what the in-memory mark does.

Persisting the mark waits on ISS-118. When it exists, `steps/sent.ts` hydrates from it, and the Done tab reads the same list.
