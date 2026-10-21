# Running it

You need Node.js 22, which CI runs. Go 1.25 or newer is needed for the API.

## Tests

```sh
cd code/console && npm ci && npm test
cd code/app && npm ci && npm test
```

Once the dependencies are installed, neither needs a network, keys or a server.

## Build the two web apps

```sh
cd code/console && npm ci && npm run build
cd code/app && npm ci && npm run build
```

Each writes static files to `dist/` that any web server can serve.

## Start the API

```sh
cd code/wakala-api
go build -o /tmp/wakala-server ./cmd/server
PORT=8082 WAKALA_SQLITE_PATH=/tmp/wakala.db /tmp/wakala-server
```

`http://127.0.0.1:8082/healthz` answers `{"status":"ok"}`. Without further settings the optional modules are off and the server says so in its log. The container build is `code/wakala-api/Dockerfile`.

## Everything in Docker

```sh
cp .env.example .env
make up
```

`make up` is `docker compose up --build -d`: the API on port 8082, the console on 8080 and the phone app on 8081. The API keeps its SQLite file in the `wakala-data` volume. `make down` stops it. `make test` runs `go vet` and `go test` for the API and the tests of both web apps; `make build` builds both web apps; `make dev` starts the console dev server.

## Look at the apps

```sh
cd code/console && npm run dev
cd code/app && npm run dev
```

Open the address Vite prints. The console reaches the API at `http://localhost:8082`; to use another address, set `WAKALA_URL`:

```sh
WAKALA_URL=https://your-server.example npm run dev
```

The app reads its server address from `code/app/public/config.json`, the console from `code/console/public/config.json`. Every build of the app writes its own `config.json` into `dist/` from `HUBSTEWARD_WAKALA_URL`, replacing the one in `public/`; with the variable unset the address is empty, which suits a server that serves the API on the same origin. `npm run build:demo` stops unless the variable is set. `make run` inside `code/console` or `code/app` starts that dev server on a fixed port, 5170 for the console and 5171 for the app, and frees the port first if something holds it. The root `make dev` starts only the console.

## Guides

- [Architecture](../../guides/architecture.md)
- [Load the demo agencies](../../guides/load-demo-agencies.md)
- [Run with another model](../../guides/other-models.md)
- [Add or fix a language](../../guides/languages.md)
- [Local database](../../guides/local-database.md)
