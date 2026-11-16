# Git over HTTP for the hub

A person or an agent can clone an agency's repository and push a branch to it with an ordinary git client, so work done in an editor or by a coding agent reaches the hub without going through the MCP file tools. This page decides how it is addressed, how it signs in, who may do what, and what the app shows. How it is built is on [Git over HTTP](../3.%20implementation/git-over-http.md). The issue is ISS-87, part of ISS-86.

## What exists today

| Piece | State |
|---|---|
| Each agency has its own repositories, one SQLite file per repository, behind `GitManager` (`code/wakala-api/internal/agencies/gits_files.go`). | Exists |
| `GitManager` has a `SmartHTTPHandler()` method. The per-repository-file manager resolves `/<repository>[.git]/...` to that repository's file by catalogue name and serves it from the file; an unknown name is 404. | Exists, serves |
| The older single-tenant Smart HTTP handler (`code/wakala-api/modules/git/git_smarthttp.go`) serves `info/refs`, `git-upload-pack` and `git-receive-pack` from a bare clone keyed by one repository name, and calls `IndexPushedBranch` after each accepted push so the pushed branch gets its row. It has no sign-in and no rule against pushing to the default branch. | Exists, not mounted per agency |
| The git tools over MCP and HTTP sit at `/instances/{instanceID}/forms-git/...`, behind the caller check, an owner or agent role in the agency, and the git module being mounted. | Exists |
| A caller is identified from a `Bearer` token (an API key starting `wak_`, or a project sign-in token) or from the `wakala_session` cookie (`callers.identify` in `internal/api/http/middleware.go`). | Exists |
| An account-wide API key is minted with `POST /auth/api-keys`, listed with `GET`, and revoked with `DELETE /auth/api-keys/{keyID}`, all behind the session cookie so a leaked key cannot mint another. An owner mints a per-agency key, which becomes an agent member of that agency, with `POST /instances/{instanceID}/api-keys`. | Exists |

## Decisions

1. **The URL.** A git client uses `http://<host>/git/<agency>/<repository>.git`, for example `http://localhost:8183/git/siaya-farmers/harvest.git`. `<agency>` is the agency's instance id and `<repository>` is the repository's name in that agency's catalogue. The three Smart HTTP endpoints sit under it (`/info/refs`, `/git-upload-pack`, `/git-receive-pack`) and are served by the same API process on the same port as the MCP and `/instances/...` routes, as a separate route prefix `/git/`. Reason: one process and one port means one deployment and one place for sign-in, and the prefix keeps a git client's request from ever matching an MCP or REST route. The handler picks the agency's `GitManager` from the registry for `<agency>`, then the repository file by name, so a request never reaches another agency's file. The `.git` suffix is optional, as in the existing handler. The instance id is used rather than the agency's display name because the name can change and the id cannot.

2. **Sign-in.** A git client signs in with a token the person makes, sent as the password of HTTP Basic. The user name is ignored, so a client can send anything, and the password is checked with the same API key check the MCP route uses (`apikeys.Verify`). The handler also accepts the same key as a `Bearer` header, for clients and agents that set headers. A refusal answers 401 with `WWW-Authenticate: Basic realm="hub"`, because a git client only prompts for credentials on a Basic challenge; the existing refusal offers only a Bearer challenge, which git ignores. Which token a person uses:
   - A person makes an account-wide API key (`POST /auth/api-keys`). It identifies the person, so what they may do in each agency is whatever their role there allows, and removing them from an agency removes their git access with it.
   - An agent gets a per-agency key an owner mints (`POST /instances/{instanceID}/api-keys`), which makes it an agent member of that one agency. This is how agents already reach the hub.
   - Revoking: the person revokes the key (`DELETE /auth/api-keys/{keyID}`, or the matching control once the app shows keys). The next request with it is refused, because each request verifies the key against the live, non-revoked rows. Reason for these choices: a cookie cannot be sent by a git client without hand-written headers, and a cookie that a browser also holds would let a web page make the browser push, so the git route does not accept the session cookie at all. Project sign-in tokens (magic link and member sign-in) expire within the hour, which is too short for a clone that runs from a script. An API key is the one credential that already exists, already revokes, and already stands for either a person or an agent.

3. **Who may clone and who may push.**
   - Clone and fetch: anyone who may read Files in that agency. The check is the one the read tools use for the same repository, so a person who cannot see a file in the app cannot clone it.
   - Push: anyone who may write Files in that agency, again by the check the write tools use.
   - A push to the default branch, `main` for every repository today, is refused for everyone, owners and agents included. The refusal is a per-ref rejection in the push's own status ("push to a merge request, not to the default branch") so the client shows the reason, and nothing is written.
   - A push to any other branch is accepted, creates or moves that branch, and calls `IndexPushedBranch` so the branch has its row. Its work reaches `main` the way agents' work reaches it today: someone opens a merge request from the branch, and completing it merges it.
   - Deleting a branch by push follows the same rule: the default branch cannot be deleted, other branches can.
   - An agency where the git module is not mounted answers 404 to every `/git/<agency>/...` request, as the other git routes do, so an unmounted agency does not show it has repositories.
   Reason: a merge request is the review step an agency already has, and a push path that bypassed it would make the git route the one way to change `main` unseen.

4. **What the app shows.** Nothing new. A pushed branch appears where branches already appear, with its commits and its merge request button, because `IndexPushedBranch` gives it the same row a branch made through the tools gets. Reason: the person who pushed and the person who reviews should look at one screen, not two.

## Questions for the owner

1. Should `<agency>` in the URL be the instance id (as written, stable but not readable) or the agency's short name, with the id still accepted? A readable name makes a remote easier to recognise in a terminal.
2. Where does a person make and revoke a token? Today only the routes exist, and the member-facing app has no screen for API keys. Should keys live in the console only, or also in the phone app's settings? Decision 4 says nothing is new in the app for branches, but a token screen would be new.
3. Should a push of a tag be accepted? The old handler indexed only branches. Accepting tags needs a rule for who may move one; refusing them is the smaller first step.
4. Should the cap on live API keys per account (`throttle.MaxLiveAPIKeysPerAccount`) hold for git tokens, or should git get its own, since a person with several machines needs more than one?
5. May a per-agency agent key push at all, or only clone? Agents push to branches today through the file tools; allowing it over git makes a coding agent's workflow natural, and the merge request still gates `main`.
6. Large pushes: should there be a size cap on one push, as there is on file writes (`filesize.go`)? Without one, a single push can fill the repository's SQLite file.
7. The old handler served shallow clones through its own code path. Should the per-agency handler keep that, or refuse shallow requests until a need appears?

## Not in this decision

How the per-repository SQLite file stores git objects so go-git's server can read them is the work of the other issues under ISS-86. This page only fixes what a client sees.
