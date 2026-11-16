# Git on the local hub

What the owner's local stack (`hubsteward-local`) does with git today, read from the running containers on 2026-11-16 at 09:40 UTC without changing anything. The git-over-HTTP build is described on [git over HTTP](git-over-http.md); this page is only about this stack. Issues: G64 (git mounted in the SWE agency), ISS-86 (the hub repository as a real remote), G63 (nightly copy). Gaps found: ISS-97 (the `/git/` route is not committed, so the running container answers 404) and ISS-98 (`make backup` leaves out the repository files).

## Answers

| Question | Answer |
|---|---|
| Compose file | `deployment/local/docker-compose.yml`, env file `deployment/local/.env`. The wakala-api service builds from `code/wakala-api` (the working tree, not a commit) |
| Image the container runs | `hubsteward-local-wakala-api`, id `sha256:3832183dbb74`, built 2026-11-16 10:14:32 (Frankfurt time) from the working tree of `code/wakala-api` at that moment. The image carries no commit label |
| Has the per-repository git (G64 work, wakala-api `1d2d969` equivalents) | Yes. The git folder is configured and the SWE agency serves its repositories through it (the repository list answers) |
| Has the git over HTTP code of ISS-88, ISS-89, ISS-90 | The handler, sign-in and 503 code are in the binary: the strings "push to a merge request, not to the default branch", "only branches can be pushed to the hub" and "the git route could not check a request" are present. ISS-88 `7069cc7b` (10:14:09), ISS-89 `c723b72d` and ISS-90 `ab044b32` were all on disk when the build ran |
| Is the `/git/` route reachable | No. `GET /git/<agency>/hub-steward-flutter-app.git/info/refs?service=git-upload-pack` on port 8092 answers 404 (a mounted route answers 401 with a Basic challenge). The line `mux.Handle(gitRoutePrefix, d.GitRouteAuth(d.GitRoute()))` was added to `internal/api/http/router.go` at 10:18, four minutes after the build, and it is still not committed on `dev` (TD-1463) |
| Later commits not in the image | `625bd021` (concurrency tests), `72608dc0` (ISS-94, advertisement from branch and tag rows) and the uncommitted lazy-load files in `modules/git` were written after 10:14 |
| `GIT_REPOSITORY_FOLDER` | Set, to `/var/lib/wakala/git` inside the container (compose line under wakala-api `environment`) |
| Volume behind it | A bind mount, not a Docker volume: host `/Users/tony/Agents/workdir/CodeVald-AIProject/mwanachama/git-repositories` is `/var/lib/wakala/git`. The host path is the default of `${GIT_FOLDER}`; `.env` does not set `GIT_FOLDER` |
| Does a repository file survive a container restart or rebuild | Yes, it lives on the host. It also survives `docker compose down`. It would not survive deleting that host folder |
| Where is the `hub-steward-flutter-app` file | `git-repositories/agy60384f75/a023293d-88c4-4d7d-8fe1-9b13b1806431.db`, 848 KB, the only `.db` in the folder. `agy60384f75` is the agency's table slug; `a023293d-...` is the file name held in the repository catalogue, not the repository id (`cc6f0009-2269-41fb-84d2-b1c8687b67ff`) |
| Other state of the stack | Postgres (the catalogue entries, agencies, issues) is the named volume `hubsteward-local_db-data`. `/data` in the container is an anonymous volume holding `wakala.db`, not repositories. Logs are the bind mount `deployment/local/logs` |
| Published port and URL | Host `127.0.0.1:8092` maps to container 8082 (`API_PORT=8092` in `.env`). A git client uses `http://localhost:8092/git/6b5149a7-da75-4493-a5a0-2ffe550cdae7/hub-steward-flutter-app.git` once the route is built |
| SWE agency re-published after git was added to `agency.json` | Yes. `agency_list_mounts` shows `git` (mount `main`) beside auth, taskmanager, actor and comm. The latest publication is v2 on the production channel, 2026-11-14 08:50, after `agency.json` commit `874f46c` of 2026-11-13. No re-publish is needed for git over HTTP, which gates on the git mount |
| G63 nightly copy and this volume | Unrelated today. G63 is closed (Done) as a Kubernetes CronJob that mounts the claim `git-repos` in namespace `mwanachama-git`. The local stack has no copy job: `make backup` runs `pg_dump` of Postgres only (last file `backups/hubsteward-20261110-223911.sql.gz`, 10 November), so the git folder is in no backup. The catalogue rows (Postgres) and the `.db` files (host folder) must be restored together |

## Steps to run a build that serves git over HTTP

Run from `deployment/local`. Nothing below was run by the page's author.

1. Commit the router line first so the build is reproducible: in `code/wakala-api`, `internal/api/http/router.go` must contain `mux.Handle(gitRoutePrefix, d.GitRouteAuth(d.GitRoute()))` (it is in the working tree today; ISS-97 commits it). The build reads the working tree, so the line has to be on disk, committed or not.
2. Rebuild and restart only the API, keeping the database and the other containers: `make api`, which is `docker compose --env-file .env build wakala-api` and then `docker compose --env-file .env up -d --no-deps --no-build --wait --wait-timeout 120 wakala-api`.
3. Environment variable: nothing to add. `GIT_REPOSITORY_FOLDER=/var/lib/wakala/git` is already in the compose file. To keep the files somewhere else, put `GIT_FOLDER=/absolute/host/path` in `.env` before step 2 and move the `agy60384f75` folder into it; the catalogue only holds file names, so the move is safe while the container is stopped.
4. Volume: nothing to add. The bind mount is already in the compose file. Check that `git-repositories/agy60384f75/` still holds the `.db` file after the restart.
5. Re-publish: not needed. The SWE agency already lists `git`. Only an agency JSON that changes the mounts needs a new publication.
6. Check that the route exists: `curl -i "http://localhost:8092/git/6b5149a7-da75-4493-a5a0-2ffe550cdae7/hub-steward-flutter-app.git/info/refs?service=git-upload-pack"` must answer 401 with `WWW-Authenticate: Basic realm="hub"`, not 404.
7. Make a key while signed in with the session cookie (`POST /auth/api-keys`, or `POST /instances/6b5149a7-da75-4493-a5a0-2ffe550cdae7/api-keys` for one agency), then `git clone http://localhost:8092/git/6b5149a7-da75-4493-a5a0-2ffe550cdae7/hub-steward-flutter-app.git` with any user name and the key as password.
8. For ISS-86, in `projects/hub-steward-app-flutter`: `git remote add origin <that URL>` then `git push -u origin <branch>`. A push to `main` is refused by design; push a branch and open a merge request.
