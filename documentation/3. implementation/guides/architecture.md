# Architecture

Two web apps talk to one API. The API holds all the data and calls the model.

```text
console ──┐
          ├── REST + MCP ──> wakala-api (:8082) ──> model provider
phone app ┘                        │
                           SQLite or Postgres
```

The console and the phone app are served on 5170 and 5171 by `make run` in each folder (`npm run dev` takes the port Vite picks), and on 8080 and 8081 by `make up` (Docker). The API is on 8082 in both.

- [code/wakala-api](../../../code/wakala-api): Go server. Agencies, people, groups, forms, approvals, chat and model accounts. REST routes plus MCP at `/mcp`. SQLite unless `DATABASE_URL` is set.
- [code/console](../../../code/console): the web app for an agency's managers and designers. Its dev server proxies `/auth`, `/instances`, `/services` and `/mcp` to `WAKALA_URL`, and sign-in sets the `wakala_session` cookie.
- [code/app](../../../code/app): the phone app for an agency's members. It reads the API address from `public/config.json`.
- [demo](../../../demo): eight synthetic agency templates, one of them the Siaya lab with its documents.

Each agent is an AI role declared on an agency: the API holds its instructions, its permissions and the agency's model accounts, and sends its model calls through its AI gateway. The loop that reads new messages in a room and replies is not part of this repository. An agency's model key is sealed in the API's database with `AI_MASTER_KEY`; see [other-models.md](other-models.md).
