# Git over HTTP from a per-repository file: memory and request limit, 16 November 2026

Hub issue ISS-94. Before this change every request, even the ref advertisement, copied every commit, tree and blob row of the repository into a go-git memory storage.

The tests are in `code/wakala-api/modules/git/git_smarthttp_file_memory_test.go` and `git_smarthttp_file_limit_test.go`. The repository is six files of 10 MiB each (60 MiB), written to the default branch through `WriteFile`. The handler runs in the test process, a real `git` binary clones and pushes against it, and the test reads `runtime.MemStats` while the request runs: `allocated` is the growth of `TotalAlloc` (every byte allocated, garbage included), `peak` is the highest `HeapAlloc` seen minus the heap before the request, sampled every 2 ms with the garbage collector set to 20 percent. Run with `go test -count=1 -run TestRepoFileGitHTTPMemory -v ./modules/git/` from `code/wakala-api`.

## Results

| Request | Before: allocated | Before: peak | After: allocated | After: peak |
|---|---|---|---|---|
| `GET info/refs` (upload-pack and receive-pack) | 280.3 MiB | 150.0 MiB | 0.1 MiB | 0.1 MiB |
| `git clone` (info/refs, then upload-pack) | 1954.9 MiB | 258.6 MiB | 162.7 MiB | 28.1 MiB |
| `git push` of one small commit on a new branch | 855.3 MiB * | 97.5 MiB * | 0.6 MiB | 0.6 MiB |

* The push row was not measured on the old code. Its "before" is the lazy storer with the blob rewrite not yet skipped, so it is the cost of re-reading every stored blob on a push. The clone peak is below half the repository size; the test fails above twice the size. For `info/refs` the test fails above 8 MiB allocated.

## What changed

- The ref advertisement reads the repository row, the branch rows and the tag rows. For each ref it checks with one indexed lookup that the commit row holds its bytes. No object is loaded.
- Every request now works on `lazyStorage` (`git_smarthttp_file_lazy.go`): refs, config and objects pushed in this request live in memory; every other object is read from its row when go-git asks. A commit or tree is read whole, checked against its hash and kept in a cache of at most 8 MiB that is emptied when full. A blob is never held: its size comes from the length of the stored base64 text, and its bytes are decoded from the row as the pack encoder writes them, checked against the hash as they pass.
- Upload-pack builds the list of objects with `revlist` from the wanted and have commits and writes the pack itself with no delta search (`git_smarthttp_file_upload.go`). go-git's own `UploadPack` loads every object to search for deltas, which would bring back the whole repository. The cost is a pack without deltas between objects; each object is still compressed.
- Recording a push no longer rewrites a blob whose row already holds its bytes.
- Requests are counted per process (`git_smarthttp_file_limit.go`). The cap is the environment variable `WAKALA_GIT_MAX_CONCURRENT_REQUESTS`, default 4, read once at start. A request over the cap waits up to 15 seconds for a slot, then answers 503 with `Retry-After: 5`. The slot is held until the response has been written, so a slow client holds one.

## What is still held in memory

During a clone: the commits and trees of everything sent (a few percent of a repository of large files, most of it for one with many small files), the list of object hashes, and one blob at a time as base64 text plus its decoded stream, about 2.3 times the largest blob. During a push: the pack as received, which has no size limit yet (TD-1464).

## Not covered

A repository of many small files, where trees and commits dominate. Two processes sharing one file. The receive-pack body size cap.
