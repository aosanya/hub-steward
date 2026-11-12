# Markets mounted by name

Decision 80: an agency names the markets it runs. Each name is a mount of the market module with its own records, the way the catalog module is already mounted by name. This page is what wakala-api does for it (HS272). The module itself needs no market id (HS273).

## Where the names live

A module the agency has on carries a list of mounts, each with a name, a key and an optional icon. The key is the mount the module's tables are made under; the name is what members read. A module with no stored mounts has the one default mount its catalog entry gives it, which for the market is the key `market`. The existing market therefore stays the first mount and keeps its tables untouched.

The list is read from the agency's published document, the same read that decides whether a module is on at all, and is kept for 30 seconds with it (decision 409). A rename reaches members when the agency publishes.

An agency with nothing published yet has no module gate; every module counts as on with its default mount.

## One manager for each mount

`MarketManager(ctx, id, mount)` is pooled on `id/mount` as `CatalogManager` is. The mount is required; there is no default inside the registry. A manager is built from the module's spec for that mount, so two mounts in one agency read and write different tables.

## REST

| Path | Meaning |
|---|---|
| `/instances/{id}/market/{name}/posters` and every other market route | The market called `{name}`. `{name}` is the mount's key, or its name in any case |
| `/instances/{id}/market/posters` and every other market route | No name. Works only while the agency runs one market; with two or more it answers 400 asking for the name, and with none it answers 404 |
| `GET /instances/{id}/mounts` | Each module the agency has on with its mounts, in the module catalog's order |

A name the agency does not run answers 404, the same as a stranger. A mount whose key is also the first segment of a market route (`posters`, `offers`, `orders`, `asks`, `notices`, `quotes`, `requests`, `yeses`, `stock`, `drafts`, `group-orders`) cannot be reached by name over REST, because the unnamed route wins. The tools below still reach it.

## Tools

Every `market_*` tool takes an optional `market`, the same key or name. The rule for leaving it out is the REST rule. `agency_list_mounts` takes the agency and returns the same list as `GET /instances/{id}/mounts`, under the action `instance.mount.list`.

## The list for Start and the studio menu

Each entry is a module with its icon and its mounts. A module appears only if the agency has it on and the caller's role may use it:

- an agent is limited to the modules for which its agency role's permissions include an action under the module's code, for example `market.` for the market;
- everyone else is limited by the permission gate's actions under the module's code, and sees every module while the gate is off;
- a stranger gets 404.

## What does not change

The permission gate maps a tool to one action whatever the mount, so a role's grant of `market.poster.approve` holds for every market. REST and tools run the same agent permission check for each mount. The caller is bound from the session, not the body, in every mount.

## Not done here

- An approved proposal for a market tool applies to the only market while the agency runs one; a proposal does not yet carry the market's name, so with two markets it is refused until it does.
- The reaction to a closed ask reads the first market, `market`.
- A mount key with a dash (the key made from "Bus market" is `bus-market`) is not a usable segment for table names; the module refuses to build it. Keys must be letters and digits, starting with a letter.
- Role grants for `instance.mount.list` are not seeded here.
