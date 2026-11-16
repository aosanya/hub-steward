# Git over HTTP: options for the open questions

This page answers the questions at the end of [Git over HTTP for the hub](git-remote.md), one recommendation each, with one plain reason and what it costs. The owner decides; nothing here is filed as an issue. It also records what was measured for todo TD-1464 on ISS-88 (tag pushes, a push size cap, concurrent pushes).

## How this was measured

A copy of `code/wakala-api` was taken on 2026-11-16 into the session scratch folder, with the uncommitted work of the other agents on ISS-88 included, so the repository itself was not touched. Scratch tests in the copy ran a real `git` 2.48.1 against a repository kept in a scratch `.db` file, behind `httptest`, using the same `RepoFile.GitHTTPHandler()` the route mounts. Nothing from the copy is in the repository. Heap figures are Go heap growth in the server's process while the push ran; the client is a separate process and is not counted.

## What the measurements showed

### 1. A push over about 1 MiB fails before any cap is involved

Git sends a four byte probe (`0000`) to `git-receive-pack` before any push larger than its `http.postBuffer` (1 MiB). The file handler tries to read that as a push and answers 400 "malformed receive-pack request: capabilities delimiter not found". The client prints `error: RPC failed; HTTP 400 curl 22 The requested URL returned error: 400` and `fatal: the remote end hung up unexpectedly`. This is the same for a 2 MiB push and a 300 MB push, with any cap. The handler needs to answer a request whose body is exactly `0000` with an empty 200 and `Content-Type: application/x-git-receive-pack-result`. In the copy, a check on `r.ContentLength == 4` before decoding did it, and every figure below was taken with that in place. I found no test that pushes more than 1 MiB through git, which is how this went unnoticed; the push tests use a few bytes.

### 2. What the global body limit does to a large push

`limitRequestBody` (`internal/api/http/bodylimit.go`) wraps the whole router. At the last commit it allows 1 MiB for every route, and the `/git/` route is not mounted. The uncommitted change on the working tree mounts `/git/` and gives it 64 MiB (`maxGitPushBody`). Git sends a large push with chunked encoding, so there is no `Content-Length` to refuse early; the body is cut off as it is read.

| Case (random binary file, one commit) | What git prints | Time | Server heap peak | File size after |
|---|---|---|---|---|
| 50 MB, limit 1 MiB | `error: RPC failed; HTTP 500 curl 22 The requested URL returned error: 500` | 3.6 s | 2 MiB | 0.5 MiB, nothing stored |
| 50 MB, limit 64 MiB | accepted, `* [new branch] big -> big` | 2.4 s | 747 MiB | 134 MiB |
| 300 MB, limit 64 MiB | the same HTTP 500 line | 10.6 s | 169 MiB | 0.5 MiB, nothing stored |
| 100 MB, no limit | accepted | 4.1 s | 1226 MiB | 268 MiB |

What follows from it:

- The refusal is a 500 with the body "internal error: http: request body too large". The client shows only "HTTP 500", because git hides the body of an HTTP error. A person cannot tell a size refusal from a server fault, and a 500 is also logged as a fault.
- A push costs 12 to 15 times its size in server memory (747 MiB for 50 MB, 1226 MiB for 100 MB), because go-git's receive-pack holds the whole pack in memory before the hub stores it, and the file then grows to about 2.7 times the push, since a binary blob is kept twice, as `data` and as `content`, both base64. A 300 MB push with no limit would need about 4 GiB of heap and an 800 MB file by that ratio; it was not run.
- Nothing is stored when the limit trips: the file stayed at 0.5 MiB.
- A write deadline of 5 minutes (`responseWriteTimeout`) covers receiving and storing a push this size. The server's `ReadTimeout` of 10 seconds (`cmd/server/main.go`) was not exercised by `httptest`, which has none. By its value, a 32 MiB push needs an upload of at least 26 Mbit/s to finish reading in 10 seconds, so the `/git/` route needs its own, longer read deadline (as `withWriteDeadline` already does for writes) or most real uploads will be cut off. This is the one figure here read from code, not measured.

### 3. A readable refusal is possible, but not through the HTTP status

In the copy, a wrapper that counts the push body and, past 32 MiB, answers 200 with a receive-pack status carrying the message made git print:

```
error: remote unpack failed: this push is over the 32 MiB limit; push fewer files at a time
error: RPC failed; HTTP 400 curl 22 The requested URL returned error: 400
```

The first line is the readable one. The second is the client's own report of the dropped upload and cannot be removed. The refusal took 22 seconds, because git keeps sending the rest of the 50 MB before it reads the answer; refusing early on a `Content-Length` is not possible for a chunked push.

## The questions

### Q3 and TD-1464: tag pushes

Recommendation: accept a push that creates a tag, lightweight or annotated, and refuse a push that moves or deletes one.

Reason: the file tools already treat a tag as a row that is made once and never moved (`CreateTag` returns `ErrTagAlreadyExists`, and `forms_git_tag_create` is the only writer), so git should follow the same rule.

What is in place today:

- Both kinds are refused now, with `! [remote rejected] light-1 -> light-1 (only branches can be pushed to the hub)`, because `pushRefusals` allows only `refs/heads/`.
- A tag made with `forms_git_tag_create` is already served: a clone shows it in `git tag -l` and `ls-remote` as `refs/tags/v1.0`, pointing straight at the commit (`git cat-file -t v1.0` says `commit`). So a tag already looks like a lightweight tag to git.
- A Tag row holds name, the commit's SHA and id, a message, a tagger name and a time. `forms_git_tag_list` and `forms_git_tag_read` show those.

What a lightweight tag push needs: allow `refs/tags/` in `pushRefusals`, check the name with `TagNameAllowed`, refuse a name that already has a row, store the tagged commit's objects (the same `storePushedObjects` call a branch push makes), and file the row. The older `indexPushedTag` in `git_impl_push_tag.go` does the filing but opens an on-disk clone (`BareClonePath`), so it cannot be called from the file handler; it needs a version that takes the repository the handler already has. The push shows in the tools as an ordinary tag row, with the commit it points to.

What an annotated tag push adds: the tag object has a message and a tagger. The file stores commits, trees and blobs only, and `lazyStorage.stored` answers "not found" for a tag object, so the object itself cannot be served back. Two ways:

| Way | Effect | Cost |
|---|---|---|
| Keep the message and tagger on the row, serve it as a lightweight tag | the tools show the message and tagger; a clone shows a lightweight tag; pushing the same tag again is refused as already present | about one day with tests; no new column, the row already has the fields |
| Also keep the tag object and serve it | a clone gets the same annotated tag object and the same SHA | the above plus a column and a store and serve path for tag objects, one to one and a half days more |

Recommended: the first. The second only matters to someone who verifies tag SHAs, and nobody asked for that.

A tag that points at something other than a commit is refused with "a tag must point at a commit". Deleting a tag by push is refused with "tags are made once; delete one with the file tools". Anyone who may push may create a tag; a tag does not move `main`, so the merge request rule is untouched.

### Q6: a size cap on one push

Recommendation: 32 MiB per push, answered with a message the client prints, and a longer read deadline on the `/git/` route.

Reason: tool writes are held to 1 MiB by the same body limit, the hub holds forms and documents and not media, and a push costs 12 to 15 times its size in server memory, so 32 MiB is about half a gigabyte at worst where 64 MiB is a gigabyte.

Cost: a larger first import has to be pushed in pieces (each push may still add 32 MiB), and the cap does not limit the size of the whole repository. The pieces are real work for the person importing, and a per-repository cap is a separate decision not made here. Building it: count the body in the handler and answer with the status shown in section 3 instead of the generic 500, set the read deadline, and add the missing test with a push over 1 MiB and one over the cap. About half a day, with the 1 MiB probe fix first.

### Concurrent pushes

Recommendation: let two pushes run at once per server process and make the third wait up to 30 seconds, then answer 503 with `Retry-After`.

Reason: correctness is already covered, so what is left is memory. The tests `TestRepoFileGitHTTPConcurrency_TenPushesOfTenBranchesAtTheSameTime`, `TestPushGuard_*` and `TestAtomicPush_*` cover ten simultaneous pushes, a push that arrives after the branch moved (refused with "the branch moved while you were pushing; fetch and try again"), and a push that fails half way leaving nothing behind. But each push holds 12 to 15 times its size, so ten 30 MiB pushes at once is about 4.5 GiB; that sum is by calculation from the single-push figures above and was not run.

Cost: pushes queue under load, and a limit shared across agencies on one server lets one agency's push delay another's. About half a day.

### Q7: shallow clones

Recommendation: keep them, by porting the older handler's code.

Reason: an agent that clones to read one directory should not download the whole history, and the code to serve it already exists and works.

What happens today: the file handler never advertises the `shallow` capability, so `git clone --depth 1` stops on the client with `fatal: Server does not support shallow clients`, and the handler's 501 "shallow requests are not supported" is never reached by a real client (it appears only for a hand-made request). What go-git's server needs: it refuses every shallow request and never advertises the capability, so the handler has to advertise `shallow` on the upload-pack advertisement, recognise a request with a depth, and write the shallow boundary and a pack of the last N commits itself. `git_smarthttp_shallow.go` already does that for the bare-clone path (`shallowObjects`, `serveShallowClone`), and only its first lines depend on the bare clone, so it is not a rewrite.

Measured in the copy, with the port made: the port changed about 35 lines in three files, `serveShallowClone` takes the open repository instead of looking up a clone, and the file handler passes `snap.repository()`. Results against the file handler:

| Command | Result |
|---|---|
| `git clone --depth 1` | works, one commit, `git fsck --strict` clean |
| `git clone --depth 1 --branch topic`, `--single-branch` | work |
| `git clone --depth 2` on a two commit history | works, the full history, not marked shallow |
| `git clone --shallow-since=...` | refused by the client: `Server does not support --shallow-since` |
| `git fetch --unshallow` in a shallow clone | refused: `RPC failed; HTTP 501` |
| `git fetch --deepen 1` | refused by the client: `Server does not support --deepen` |

Cost: one to two hours in the repository, with the tests above added to the suite. The refusals of unshallow and deepen are the old handler's choice (a fresh `--depth N` only), kept as is.

### Q4: the live key cap for git tokens

Recommendation: keep the one cap of 100 live keys per account (`throttle.MaxLiveAPIKeysPerAccount`), shared with every other key.

Reason: 100 is far more than a person's machines and agents, and a second cap would be a second number for people to learn; a person who reaches it already gets a 409 that says to revoke one.

Cost: none now. If agents mint a key per task this could be reached, and then the answer is revoking finished keys, not a bigger cap.

### Q5: whether a per-agency agent key may push

Recommendation: yes, as it is built.

Reason: the route already lets the `owner` and `agent` roles read and write (`accessIn` in `internal/api/http/git_route_auth.go`), a per-agency key is tied to one agency (`gitAccessOf` refuses a key from another agency), and `main` is refused for everyone, so the merge request still gates it. Agents push to branches today through the file tools.

Cost: a leaked agent key can write branches, and, with the tag recommendation, tags, until it is revoked, and can fill the repository up to the cap on each push. Revoking is immediate because each request checks the key.

### Q1: instance id or readable name in the URL

Recommendation: the instance id only.

Reason: an owner can rename an agency (`instance_rename`), and the id cannot change; a remote that breaks on a rename is worse than one that is hard to read.

Cost: a remote is not recognisable at a glance. The Access keys page (drawn under ISS-100) can show the full remote URL ready to copy, so nobody types the id.

## Order of work if all are accepted

1. The probe fix and a test that pushes more than 1 MiB (everything else depends on it).
2. The 32 MiB cap with its message and the `/git/` read deadline.
3. Shallow clone port.
4. Tag pushes, lightweight and annotated by the first way.
5. The two-at-a-time push limit.
