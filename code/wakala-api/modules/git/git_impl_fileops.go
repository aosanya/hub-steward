package mwanachamagit

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm/clause"

	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/filemode"
	"github.com/go-git/go-git/v5/plumbing/object"

	"wakalaserver/modules/git/models"
)

type treeRecord struct {
	path    string
	sha     string
	rawData []byte
	size    int64
	entries string
}

func buildNestedTrees(files map[string]plumbing.Hash) (plumbing.Hash, []treeRecord, error) {

	dirSet := map[string]bool{"": true}
	for p := range files {
		parts := strings.Split(p, "/")
		for i := 1; i < len(parts); i++ {
			dirSet[strings.Join(parts[:i], "/")] = true
		}
	}

	dirs := make([]string, 0, len(dirSet))
	for d := range dirSet {
		dirs = append(dirs, d)
	}
	sort.Slice(dirs, func(i, j int) bool {
		di := strings.Count(dirs[i], "/")
		dj := strings.Count(dirs[j], "/")
		if di != dj {
			return di > dj
		}
		return dirs[i] > dirs[j]
	})

	subtreeHashes := map[string]plumbing.Hash{}
	var records []treeRecord

	for _, dir := range dirs {
		var entries []object.TreeEntry

		for filePath, blobHash := range files {
			if dirPath(filePath) == dir {
				entries = append(entries, object.TreeEntry{
					Name: fileName(filePath),
					Mode: filemode.Regular,
					Hash: blobHash,
				})
			}
		}

		for subPath, subHash := range subtreeHashes {
			if dirPath(subPath) == dir {
				entries = append(entries, object.TreeEntry{
					Name: fileName(subPath),
					Mode: filemode.Dir,
					Hash: subHash,
				})
			}
		}

		sort.Slice(entries, func(i, j int) bool {
			return entries[i].Name < entries[j].Name
		})

		treeObj := &object.Tree{Entries: entries}
		memObj := &plumbing.MemoryObject{}
		if err := treeObj.Encode(memObj); err != nil {
			return plumbing.ZeroHash, nil, fmt.Errorf("buildNestedTrees: encode %q: %w", dir, err)
		}
		r, _ := memObj.Reader()
		raw, _ := io.ReadAll(r)
		r.Close()

		h := memObj.Hash()
		subtreeHashes[dir] = h

		entryMaps := make([]map[string]string, len(entries))
		for i, e := range entries {
			mode := "100644"
			if e.Mode == filemode.Dir {
				mode = "040000"
			}
			entryMaps[i] = map[string]string{"name": e.Name, "mode": mode, "sha": e.Hash.String()}
		}
		entriesJSON, _ := json.Marshal(entryMaps)

		records = append(records, treeRecord{
			path:    dir,
			sha:     h.String(),
			rawData: raw,
			size:    memObj.Size(),
			entries: string(entriesJSON),
		})
	}

	rootHash, ok := subtreeHashes[""]
	if !ok {
		return plumbing.ZeroHash, nil, fmt.Errorf("buildNestedTrees: root tree missing")
	}
	return rootHash, records, nil
}

func (m *gitManager) WriteFile(ctx context.Context, req WriteFileRequest) (models.Commit, error) {
	var result models.Commit
	lockErr := m.locker.WithMergeLock(ctx, func() error {
		c, err := m.writeFileLocked(ctx, req)
		if err != nil {
			return err
		}
		result = c
		return nil
	})
	if lockErr != nil {
		return models.Commit{}, lockErr
	}
	return result, nil
}

func (m *gitManager) writeFileLocked(ctx context.Context, req WriteFileRequest) (models.Commit, error) {
	if err := m.checkFileSize(req); err != nil {
		return models.Commit{}, fmt.Errorf("WriteFile: %w", err)
	}
	branch, err := m.GetBranch(ctx, req.BranchID)
	if err != nil {
		return models.Commit{}, fmt.Errorf("WriteFile: %w", err)
	}
	repo, err := m.GetRepository(ctx, branch.RepositoryID)
	if err != nil {
		return models.Commit{}, fmt.Errorf("WriteFile: %w", err)
	}

	req.Path = strings.TrimLeft(req.Path, "/")

	encoding := req.Encoding
	if encoding == "" {
		encoding = "utf-8"
	}
	message := req.Message
	if message == "" {
		message = "Update " + req.Path
	}
	commitTime := time.Now().UTC()
	now := commitTime.Format(time.RFC3339)

	blobObj := &plumbing.MemoryObject{}
	blobObj.SetType(plumbing.BlobObject)
	blobW, _ := blobObj.Writer()
	_, _ = blobW.Write([]byte(req.Content))
	_ = blobW.Close()
	blobR, _ := blobObj.Reader()
	blobRaw, _ := io.ReadAll(blobR)
	_ = blobR.Close()
	blobDataB64 := base64.StdEncoding.EncodeToString(blobRaw)
	blobHash := blobObj.Hash()
	blobSHA := blobHash.String()

	blobRow := models.Blob{
		SHA:       blobSHA,
		Path:      req.Path,
		Name:      fileName(req.Path),
		Extension: fileExtension(req.Path),
		Size:      int64(len(req.Content)),
		Encoding:  encoding,
		Content:   req.Content,
		CreatedAt: now,
	}
	blobRow.Data = blobDataB64
	ensureID(&blobRow)
	if err := m.db.WithContext(ctx).Table(m.tables.Blobs).Create(&blobRow).Error; err != nil {
		return models.Commit{}, fmt.Errorf("WriteFile: create blob: %w", err)
	}

	var parentIDs []string
	var parentHashes []plumbing.Hash
	if branch.HeadCommitID != "" {
		parentIDs = []string{branch.HeadCommitID}
		var parentRow models.Commit
		if err := m.db.WithContext(ctx).Table(m.tables.Commits).
			Where("id = ?", branch.HeadCommitID).First(&parentRow).Error; err != nil {
			return models.Commit{}, fmt.Errorf("WriteFile: get parent commit: %w", err)
		}
		if parentRow.SHA != "" {
			parentHashes = []plumbing.Hash{plumbing.NewHash(parentRow.SHA)}
		}
	}

	fileMap := map[string]plumbing.Hash{}

	blobEntityByPath := map[string]string{}

	if len(parentIDs) > 0 {
		parentBlobs, err := m.allBlobsAtCommit(ctx, parentIDs[0])
		if err != nil {
			log.Printf("WriteFile: allBlobsAtCommit parent=%s: %v (continuing with empty parent)", parentIDs[0], err)
		}
		for _, b := range parentBlobs {
			if b.Path != "" && b.SHA != "" {
				fileMap[b.Path] = plumbing.NewHash(b.SHA)
				blobEntityByPath[b.Path] = b.ID
			}
		}
	}

	fileMap[req.Path] = blobHash
	blobEntityByPath[req.Path] = blobRow.ID

	rootTreeHash, treeRecords, err := buildNestedTrees(fileMap)
	if err != nil {
		return models.Commit{}, fmt.Errorf("WriteFile: %w", err)
	}

	var rootTreeID string
	for _, tr := range treeRecords {
		treeRow := models.Tree{SHA: tr.sha, Path: tr.path, CreatedAt: now}
		treeRow.Entries = tr.entries
		treeRow.Data = base64.StdEncoding.EncodeToString(tr.rawData)
		treeRow.Size = tr.size
		ensureID(&treeRow)
		if err := m.db.WithContext(ctx).Table(m.tables.Trees).Create(&treeRow).Error; err != nil {
			return models.Commit{}, fmt.Errorf("WriteFile: create tree row path=%q: %w", tr.path, err)
		}
		if tr.sha == rootTreeHash.String() {
			rootTreeID = treeRow.ID
		}
	}

	authorName := req.AuthorName
	if authorName == "" {
		authorName = "mwanachama-bot"
	}
	authorEmail := req.AuthorEmail
	if authorEmail == "" {
		authorEmail = "bot@mwanachama.local"
	}
	gitCommitObj := &object.Commit{
		TreeHash:     rootTreeHash,
		ParentHashes: parentHashes,
		Author:       object.Signature{Name: authorName, Email: authorEmail, When: commitTime},
		Committer:    object.Signature{Name: authorName, Email: authorEmail, When: commitTime},
		Message:      message,
	}
	commitMemObj := &plumbing.MemoryObject{}
	if err := gitCommitObj.Encode(commitMemObj); err != nil {
		return models.Commit{}, fmt.Errorf("WriteFile: encode commit: %w", err)
	}
	commitR, _ := commitMemObj.Reader()
	commitRaw, _ := io.ReadAll(commitR)
	_ = commitR.Close()
	commitDataB64 := base64.StdEncoding.EncodeToString(commitRaw)
	commitSHA := commitMemObj.Hash().String()

	commitRow := models.Commit{
		SHA:            commitSHA,
		Message:        message,
		AuthorName:     req.AuthorName,
		AuthorEmail:    req.AuthorEmail,
		AuthorAt:       now,
		CommitterName:  req.AuthorName,
		CommitterEmail: req.AuthorEmail,
		CommittedAt:    now,
		TreeID:         rootTreeID,
		CreatedAt:      now,
	}
	commitRow.RepositoryID = repo.ID
	commitRow.Data = commitDataB64
	commitRow.Size = commitMemObj.Size()
	ensureID(&commitRow)
	if err := m.db.WithContext(ctx).Table(m.tables.Commits).Create(&commitRow).Error; err != nil {
		return models.Commit{}, fmt.Errorf("WriteFile: create commit: %w", err)
	}

	if len(parentIDs) > 0 {
		parentRows := commitParentsOf(commitRow.ID, parentIDs)
		ensureID(&parentRows)
		if err := m.db.WithContext(ctx).Table(m.tables.CommitParents).Create(&parentRows).Error; err != nil {
			return models.Commit{}, fmt.Errorf("WriteFile: link parents: %w", err)
		}
	}

	treeBlobRows := make([]models.TreeBlob, 0, len(blobEntityByPath))
	for _, blobID := range blobEntityByPath {
		treeBlobRows = append(treeBlobRows, models.TreeBlob{TreeID: rootTreeID, BlobID: blobID})
	}
	if len(treeBlobRows) > 0 {
		if err := m.db.WithContext(ctx).Table(m.tables.TreeBlobs).
			Clauses(clause.OnConflict{DoNothing: true}).CreateInBatches(&treeBlobRows, 200).Error; err != nil {
			log.Printf("WriteFile: link tree_blobs: %v (non-fatal)", err)
		}
	}

	if _, err := m.advanceBranchHead(ctx, branch.ID, commitRow.ID, ""); err != nil {
		return models.Commit{}, fmt.Errorf("WriteFile: advance branch head: %w", err)
	}

	commit := commitRow
	commit.RepositoryID = repo.ID
	commit.ParentIDs = parentIDs
	m.publish(ctx, TopicFileWritten, FileWrittenPayload{
		Repository:    repo.Name,
		BranchName:    branch.Name,
		Path:          req.Path,
		CommitSHA:     commitSHA,
		WorkflowRunID: branch.WorkflowRunID,
	})
	return commit, nil
}

func (m *gitManager) ReadFile(ctx context.Context, branchID, path string) (models.Blob, error) {
	branch, err := m.GetBranch(ctx, branchID)
	if err != nil {
		return models.Blob{}, fmt.Errorf("ReadFile: %w", err)
	}
	if branch.HeadCommitID == "" {
		return models.Blob{}, ErrFileNotFound
	}
	blob, err := m.findBlobAtCommit(ctx, branch.HeadCommitID, path)
	if err != nil {
		return models.Blob{}, fmt.Errorf("ReadFile: %w", err)
	}

	if blob.Content == "" {
		content, encoding, loadErr := m.loadBlobContentFromBareClone(ctx, branch, blob)
		if loadErr != nil {
			return models.Blob{}, ErrBlobContentUnavailable
		}
		blob.Content = content
		blob.Encoding = encoding
	}
	if err := verifyBlobContent(blob); err != nil {
		return models.Blob{}, fmt.Errorf("ReadFile: %w", err)
	}
	return blob, nil
}

func (m *gitManager) DeleteFile(ctx context.Context, req DeleteFileRequest) (models.Commit, error) {

	existingBlob, err := m.ReadFile(ctx, req.BranchID, req.Path)
	if err != nil {
		return models.Commit{}, err
	}

	m.deleteDocEdgesForBlob(ctx, existingBlob.ID, req.BranchID)

	message := req.Message
	if message == "" {
		message = "Delete " + req.Path
	}

	return m.WriteFile(ctx, WriteFileRequest{
		BranchID:    req.BranchID,
		Path:        req.Path,
		Content:     "",
		Encoding:    "utf-8",
		AuthorName:  req.AuthorName,
		AuthorEmail: req.AuthorEmail,
		Message:     message,
	})
}

func (m *gitManager) ListDirectory(ctx context.Context, branchID, path string) ([]FileEntry, error) {
	branch, err := m.GetBranch(ctx, branchID)
	if err != nil {
		return nil, fmt.Errorf("ListDirectory: %w", err)
	}
	if branch.HeadCommitID == "" {
		return []FileEntry{}, nil
	}

	blobs, err := m.allBlobsAtCommit(ctx, branch.HeadCommitID)
	if err != nil {
		return nil, fmt.Errorf("ListDirectory: %w", err)
	}

	queryDir := strings.Trim(path, "/")

	seen := make(map[string]bool)
	var entries []FileEntry
	for _, b := range blobs {
		bPath := b.Path
		bDir := dirPath(bPath)
		bDirClean := strings.Trim(bDir, "/")

		if queryDir == "" {

			rel := bPath

			parts := strings.SplitN(strings.Trim(rel, "/"), "/", 2)
			if len(parts) == 1 {

				if !seen[parts[0]] {
					seen[parts[0]] = true
					entries = append(entries, FileEntry{
						Name:  parts[0],
						Path:  parts[0],
						IsDir: false,
						Size:  b.Size,
					})
				}
			} else {

				if !seen[parts[0]] {
					seen[parts[0]] = true
					entries = append(entries, FileEntry{
						Name:  parts[0],
						Path:  parts[0],
						IsDir: true,
					})
				}
			}
		} else {

			if bDirClean == queryDir {
				name := fileName(bPath)
				if !seen[name] {
					seen[name] = true
					entries = append(entries, FileEntry{
						Name:  name,
						Path:  bPath,
						IsDir: false,
						Size:  b.Size,
					})
				}
			} else if strings.HasPrefix(bDirClean, queryDir+"/") {

				rel := bDirClean[len(queryDir)+1:]
				topLevel := strings.SplitN(rel, "/", 2)[0]
				if !seen[topLevel] {
					seen[topLevel] = true
					entries = append(entries, FileEntry{
						Name:  topLevel,
						Path:  queryDir + "/" + topLevel,
						IsDir: true,
					})
				}
			}
		}
	}
	if len(blobs) > 0 && len(entries) == 0 && queryDir != "" {
		return nil, ErrFileNotFound
	}
	return entries, nil
}

func (m *gitManager) Log(ctx context.Context, branchID string, filter LogFilter) ([]CommitEntry, error) {
	branch, err := m.GetBranch(ctx, branchID)
	if err != nil {
		return nil, fmt.Errorf("Log: %w", err)
	}
	if branch.HeadCommitID == "" {
		return nil, nil
	}

	commits, err := m.walkCommitChain(ctx, branch.HeadCommitID, filter.Limit)
	if err != nil {
		return nil, fmt.Errorf("Log: %w", err)
	}

	out := make([]CommitEntry, 0, len(commits))
	for _, c := range commits {
		if filter.Path != "" {
			if !m.commitTouchesPath(ctx, c.ID, filter.Path) {
				continue
			}
		}
		if err := verifyCommitObject(c); err != nil {
			return nil, fmt.Errorf("Log: %w", err)
		}
		out = append(out, commitToEntry(c))
	}
	return out, nil
}

func (m *gitManager) Diff(ctx context.Context, fromRef, toRef string) ([]FileDiff, error) {
	fromCommitID, err := m.resolveRef(ctx, fromRef)
	if err != nil {
		return nil, fmt.Errorf("Diff: fromRef %s: %w", fromRef, ErrRefNotFound)
	}
	toCommitID, err := m.resolveRef(ctx, toRef)
	if err != nil {
		return nil, fmt.Errorf("Diff: toRef %s: %w", toRef, ErrRefNotFound)
	}

	fromBlobs, err := m.allBlobsAtCommit(ctx, fromCommitID)
	if err != nil {
		return nil, fmt.Errorf("Diff: from blobs: %w", err)
	}
	toBlobs, err := m.allBlobsAtCommit(ctx, toCommitID)
	if err != nil {
		return nil, fmt.Errorf("Diff: to blobs: %w", err)
	}

	return diffBlobs(fromBlobs, toBlobs), nil
}

func (m *gitManager) findBlobAtCommit(ctx context.Context, commitID, path string) (models.Blob, error) {
	blobs, err := m.allBlobsAtCommit(ctx, commitID)
	if err != nil {
		return models.Blob{}, err
	}
	for _, b := range blobs {
		if b.Path == path {
			return b, nil
		}
	}
	return models.Blob{}, ErrFileNotFound
}

func (m *gitManager) walkCommitChain(ctx context.Context, startCommitID string, limit int) ([]models.Commit, error) {
	ids, err := CommitChainIDs(m.db.WithContext(ctx), m.tables, startCommitID, limit)
	if err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return nil, nil
	}
	var rows []models.Commit
	if err := m.db.WithContext(ctx).Table(m.tables.Commits).
		Where("id IN ?", ids).Find(&rows).Error; err != nil {
		return nil, err
	}
	byID := make(map[string]models.Commit, len(rows))
	for _, r := range rows {
		byID[r.ID] = r
	}
	out := make([]models.Commit, 0, len(ids))
	for _, id := range ids {
		if r, ok := byID[id]; ok {
			out = append(out, r)
		}
	}
	return out, nil
}

type pathState struct {
	sha     string
	present bool
}

func (m *gitManager) pathStateAt(ctx context.Context, commitID, path string) (pathState, error) {
	b, err := m.findBlobAtCommit(ctx, commitID, path)
	if errors.Is(err, ErrFileNotFound) {
		return pathState{}, nil
	}
	if err != nil {
		return pathState{}, err
	}
	return pathState{sha: b.SHA, present: true}, nil
}

func (m *gitManager) commitTouchesPath(ctx context.Context, commitID, path string) bool {
	own, err := m.pathStateAt(ctx, commitID, path)
	if err != nil {
		return true
	}
	parentIDs, err := CommitParentIDs(m.db.WithContext(ctx), m.tables, commitID)
	if err != nil {
		return true
	}
	if len(parentIDs) == 0 {
		return own.present
	}
	for _, parentID := range parentIDs {
		parent, err := m.pathStateAt(ctx, parentID, path)
		if err != nil {
			return true
		}
		if parent == own {
			return false
		}
	}
	return true
}

func (m *gitManager) resolveRef(ctx context.Context, ref string) (string, error) {

	branch, err := m.GetBranch(ctx, ref)
	if err == nil {
		if branch.HeadCommitID == "" {
			return "", fmt.Errorf("branch %s has no HEAD commit", ref)
		}
		return branch.HeadCommitID, nil
	}

	var row models.Commit
	if err := m.db.WithContext(ctx).Table(m.tables.Commits).
		Where("id = ?", ref).First(&row).Error; err == nil {
		return ref, nil
	}

	if err := m.db.WithContext(ctx).Table(m.tables.Commits).
		Where("sha = ?", ref).First(&row).Error; err == nil {
		return row.ID, nil
	}
	return "", ErrRefNotFound
}

func commitToEntry(r models.Commit) CommitEntry {
	ts, _ := time.Parse(time.RFC3339, r.CommittedAt)
	if ts.IsZero() {
		ts, _ = time.Parse(time.RFC3339, r.AuthorAt)
	}
	return CommitEntry{
		SHA:       r.SHA,
		Author:    r.AuthorName,
		Message:   r.Message,
		Timestamp: ts,
	}
}

func diffBlobs(fromBlobs, toBlobs []models.Blob) []FileDiff {
	fromMap := make(map[string]models.Blob, len(fromBlobs))
	for _, b := range fromBlobs {
		fromMap[b.Path] = b
	}
	toMap := make(map[string]models.Blob, len(toBlobs))
	for _, b := range toBlobs {
		toMap[b.Path] = b
	}

	var diffs []FileDiff
	for path, toBlob := range toMap {
		if fromBlob, ok := fromMap[path]; !ok {
			diffs = append(diffs, FileDiff{Path: path, Operation: "added"})
		} else if fromBlob.SHA != toBlob.SHA {
			diffs = append(diffs, FileDiff{Path: path, Operation: "modified"})
		}
	}
	for path := range fromMap {
		if _, ok := toMap[path]; !ok {
			diffs = append(diffs, FileDiff{Path: path, Operation: "deleted"})
		}
	}
	sort.Slice(diffs, func(i, j int) bool { return diffs[i].Path < diffs[j].Path })
	return diffs
}

func dirPath(p string) string {
	idx := strings.LastIndex(p, "/")
	if idx < 0 {
		return ""
	}
	return p[:idx]
}

func fileName(p string) string {
	idx := strings.LastIndex(p, "/")
	if idx < 0 {
		return p
	}
	return p[idx+1:]
}

func fileExtension(p string) string {
	name := fileName(p)
	idx := strings.LastIndex(name, ".")
	if idx <= 0 {
		return ""
	}
	return name[idx+1:]
}
