# Hub Steward

A platform for running a member organization, called an agency. A manager or designer sets up the agency in the console: its groups, roles, workflows, forms, rules and documents. They review it, test it with scenarios and publish approved changes. Members use the agency on the phone app: chat rooms, an inbox, forms, reports, groups and a market. AI roles work beside the people. Each acts only through declared, permission-checked tools and waits for approval where the agency says so. The agents call a model through an OpenAI-compatible, Anthropic or Gemini account. No default model is built in: each hub adds its accounts on the console's Models page and sets its own default.

The demo holds eight synthetic agencies. One is a community computer lab in Siaya, Kenya, used as the worked example: members ask Hub Steward in chat, in English, Swahili or German, about the lab's rules and Wi-Fi, and it drafts access requests (a seat, a Wi-Fi account, member set-up with a barcode) for the lab manager to approve with one tap. The others are boda-boda riders, farmers, a clinical research organization, an electric grid utility, a logistics company, a mobile money operator and a crop-spraying drone service.

## What is in this repo

| Folder | What it holds |
|---|---|
| [code/console/](code/console/) | The console: the manager's and designer's web app, for building, reviewing, testing and running an agency |
| [code/app/](code/app/) | The phone app |
| [code/wakala-api/](code/wakala-api/) | The API server both apps talk to, with its agents, approvals and tools |
| [code/supabase/](code/supabase/) | Configuration and migration for the local Supabase database |
| [demo/](demo/) | The eight demo agencies, including the Siaya lab and its documents in three languages, all synthetic |
| [documentation/](documentation/) | Requirements, design, implementation and QA |

## Before you start

You need Node.js 22, which is what CI runs, and Go 1.25 or newer for the API server. The console and the app show their sign-in screens without a server. Every page after sign-in needs the API server at the address in their `config.json`.

## Run it

[documentation/3. implementation/build/02-running-it](documentation/3.%20implementation/build/02-running-it/README.md) starts the API server, the console and the app. The variables are in [.env.example](.env.example).

## Test and build

```sh
cd code/console
npm ci
npm test
npm run build
```

```sh
cd code/app
npm ci
npm test
npm run build
```

Each build writes static files to `dist/` that any web server can serve. Once the dependencies are installed, the tests need no network, no keys and no server.

## Look at the apps

```sh
cd code/console
npm ci
npm run dev
```

Open the address Vite prints. Signing in or creating a hub calls the API server, which `npm run dev` reaches at `http://localhost:8082`. To use another address:

```sh
WAKALA_URL=https://your-server.example npm run dev
```

The phone app is the same: `cd code/app && npm ci && npm run dev`. Its server address is `code/app/public/config.json`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). To report a vulnerability, see [SECURITY.md](SECURITY.md).

## Licence

Apache License 2.0. See [LICENSE](LICENSE). The dependencies are listed in the `go.mod` file of `code/wakala-api` and the `package-lock.json` files. The demo organisations, people, numbers and addresses are invented. Meta, Muse Spark and Muse Image are named in [TRADEMARKS.md](TRADEMARKS.md).
