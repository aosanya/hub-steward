# Git over HTTP

A person or an agent can clone an agency's repository, push a branch to it and open a merge request with an ordinary git client. This page says how that is built, which files hold it, the rules it enforces, how a person uses it and what it cannot do yet. What the client sees was decided on [the git remote design page](../2.%20design/git-remote.md); the decisions are not repeated here. The issues are ISS-86 (the whole), ISS-87 (design), ISS-88 (the file handler) and ISS-89 (sign-in).

## What is built and what is not

| Part | State |
|---|---|
| Clone and fetch from a repository's SQLite file, including work written by the MCP file tools | Built, committed on `dev` (ISS-88) |
| Push to a branch other than the default, indexed back into the file | Built, committed on `dev` (ISS-88) |
| Push to the default branch refused with a per-ref message | Built, committed on `dev` (ISS-88) |
| Sign-in with an API key and the read and write check (`GitRouteAuth`) | Built, committed on `dev` (ISS-89) |
| The `/git/` route registered in the router behind `GitRouteAuth` | Written in the working tree at `internal/api/http/router.go` line 79, not yet committed on `dev` when this page was written. It is TD-1463. Until it is committed, a running server built from `dev` answers `/git/` with 404 |
| Tag pushes, a size cap on a push, serialised concurrent pushes | Not built (TD-1464) |
| The same handler in `mwanachama-backend-git` and `mwanachama-wakala-api` | Not built (TD-1465) |
| A screen in the console or the phone app to make and revoke a key | Not built; the routes exist |

Check `git log dev -- code/wakala-api/internal/api/http/router.go` for the mount before relying on the fifth row.

## How it is built

Each repository is one SQLite file, and the file already holds real git objects. When a file tool writes a file, it stores each commit, tree and blob row with the raw object bytes (base64 in the `data` column) and the real SHA, and each branch and tag row holds its tip. Git over HTTP reuses that instead of keeping a second copy of the repository.

1. **A temporary repository per request.** For each request the handler reads the file's commit, tree and blob rows that carry data and puts them into a go-git in-memory repository. Rows whose bytes do not hash to their SHA are skipped. It sets one reference per live branch and per live tag, and points `HEAD` at the repository's default branch. Nothing is kept between requests, so a clone always sees the file as it is now, including work written by the MCP file tools a second ago.
2. **go-git's server answers.** The in-memory repository is handed to go-git's own transport server, which does the advertisement (`info/refs`), the clone and fetch (`git-upload-pack`) and the push (`git-receive-pack`) wire work unchanged. The hub's code only decides what is refused before go-git sees a push.
3. **The push is indexed back.** After go-git accepts a push, the handler writes the pushed branch's row and then, for every new commit reachable from the tip, writes the commit, tree and blob rows with their bytes, size, entries and content. A clone made afterwards, and the file tools, both see the pushed work, and the app shows the branch with its commits like a branch made through the tools. A delete push removes the branch row.

Why a temporary repository and not a go-git storer over the file: the branch refs would have to be built from the branch rows anyway, and a push brings objects with no path while tree and blob rows are keyed by sha and path, so the walk from the pushed tip would still be needed. A storer would add a second object layer to keep consistent with the rows. The cost of the chosen way is work proportional to the repository's size on every request; a cache can be added later without changing what a client sees.

Shallow requests (a depth or shallow lines in an upload-pack request) are refused with 501, which is the answer to question 7 on the design page for now.

## The files

All paths are under `code/wakala-api`.

| File | What it holds |
|---|---|
| `internal/api/http/git_route_auth.go` | `GitRouteAuth`: signs the caller in, reads agency and repository from the path, checks read or write per endpoint, puts the account id on the request context |
| `internal/api/http/git_route_serve.go` | `GitRoute`: strips `/git/<agency>`, finds that agency's `GitManager` in the registry and hands the rest of the path to its `SmartHTTPHandler` |
| `internal/api/http/router.go` | The line that mounts `gitRoutePrefix` (`/git/`) behind `GitRouteAuth`; see the table above for its state |
| `internal/agencies/gits_files.go` | `repositoryFolderGit.SmartHTTPHandler`: splits `/<repository>[.git]/...`, opens that repository's file by its catalogue name and calls its `GitHTTPHandler`. An unknown name answers 404. It used to answer 501 for every request |
| `modules/git/git_smarthttp_file.go` | `RepoFile.GitHTTPHandler`: the three endpoints, the push refusals, delete pushes and the indexing after an accepted push |
| `modules/git/git_smarthttp_file_snapshot.go` | Builds the in-memory repository from the file's rows and refs |
| `modules/git/git_smarthttp_file_store.go` | After a push, writes the bytes, size, entries and content of each new commit, tree and blob onto its rows |
| `modules/git/git_impl_push.go` | `indexPushedBranchFrom`, split out of `IndexPushedBranch` so the file handler and the older bare-clone handler (`modules/git/git_smarthttp.go`) share the branch indexing; the older path is unchanged |
| `modules/git/git_smarthttp_file_test.go` | Tests with a real git binary against temporary `.db` files: clone, commit, push a new branch, clone again, a tool write after a push is cloneable, push to `main` refused, delete a pushed branch |
| `internal/agencies/gits_files_http_test.go` | Two repositories in one agency each served by name; an unknown name is 404 |

## The rules

- **Default branch.** A push that touches the default branch is refused with the per-ref status "push to a merge request, not to the default branch", nothing is written, and the client shows the reason. If one ref of a push is refused, the others in that push report "not applied because another ref in this push was refused". A delete of the default branch is refused the same way; a delete of any other branch removes its row.
- **Branches only.** A ref outside `refs/heads/` is refused with "only branches can be pushed to the hub". Tags are in the advertisement and can be cloned and fetched, but not pushed.
- **Who may read and write.** `GitRouteAuth` requires a signed-in caller (an API key, below), then an owner or agent role in the agency in the URL, then the git module mounted in that agency, then a repository of that name in the agency's catalogue. Owners and agents get both clone and push; the code has one access level, not a separate read-only one, so the 403 for a read-only caller is in place but nothing grants read-only today. A key made for one agency only works in that agency. Every failure to find the agency, the module or the repository answers 404 with no name, so an unmounted agency does not show that it has repositories. A wrong verb answers 405.
- **Sign-in.** The API key is the HTTP Basic password, with any user name, or a `Bearer` token. A missing or revoked key answers 401 with `WWW-Authenticate: Basic realm="hub"`, which is what makes a git client ask for a password. The session cookie is not accepted. The key is verified on every request, so revoking it stops the next request.

Why these rules were chosen is on the design page, decisions 2 and 3.

## The URL and the key

The URL a person types is `http://<host>/git/<agency>/<repository>.git`, where `<agency>` is the agency's instance id and `<repository>` is the repository's name in the agency's catalogue; the `.git` suffix is optional. For the QA hub that is, for example, `http://localhost:8183/git/<instance id>/<repository>.git`.

A person makes an account-wide key with `POST /auth/api-keys` while signed in with the session cookie; an owner makes a per-agency key for an agent with `POST /instances/{instanceID}/api-keys`; a key is revoked with `DELETE /auth/api-keys/{keyID}`. Keys start with `wak_`. There is no screen for any of this yet, so today a key is made with those routes.

## How a person uses it

```
git clone http://localhost:8183/git/<instance id>/<repository>.git
```

Git asks for a user name and a password. Type anything as the user name and the key as the password. To stop being asked, store the credential with the system's git credential helper rather than writing the key into the URL, where it would end up in `.git/config` and shell history.

```
cd <repository>
git switch -c my-change
git add .
git commit -m "What changed"
git push origin my-change
```

A push of `main` is refused with the message above; push a branch instead. The branch then appears in the app where branches already appear. To bring it into `main`, open a merge request from the branch to `main` with the merge request tool (`forms_git_merge_request_create`) or its button, and someone completes it. Further commits pushed to the same branch move it, and a branch can be removed with `git push origin --delete my-change`.

**A first push of an existing folder.** The folder's history shares no commit with `main`, so push it to a branch and open a merge request, as above. Completing the request finds no common ancestor and merges against an empty base: where the folder's paths are not on `main`, the merge succeeds, `main` gets both trees, and its log shows both roots under one two-parent merge commit. Where the same path (for example `README.md`) holds different text on both sides, the merge stops with a conflict naming the path, `main` does not move and the request ends as failed; which side should win is for the owner to say, and nothing is chosen for them. The tests are `TestRepoFileUnrelatedHistory_` and `TestCompletingAMergeRequestOfAnUnrelatedPushedHistory` in `modules/git`.

## Known limits

These are the todos TD-1464 and TD-1465 on ISS-88 and the open questions 3 and 6 on the design page.

- **Tags.** A push of a tag is refused. Accepting tags needs a rule for who may move one.
- **Size.** A push has no cap. The only limit in the code, 64 MB, is how much of a refused push the handler reads and discards before it answers. A single large push can fill the repository's file; file writes have a cap in `filesize.go` and a push does not yet.
- **Concurrent pushes.** Two pushes to one file at once are not serialised. Each builds its own temporary repository from the rows it saw, so the second can index against a view that is already out of date.
- **Cost per request.** Every request rebuilds the repository from the rows, so a big repository makes every clone, fetch and push slower.
- **Shallow clones.** Refused with 501.
- **Sibling repositories.** The handler exists in the hub's `code/wakala-api` only (TD-1465).
- **Tests.** The tests above were run with `-race` for `modules/git`, `internal/agencies` and the `TestGitRoute_` tests; the whole `internal/api/http` package timed out on a loaded machine in an unrelated test and has not been re-run in full.
