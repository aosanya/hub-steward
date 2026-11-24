package routes

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	mwanachamagit "wakalaserver/modules/git"
	"wakalaserver/modules/git/models"
)

type stubManager struct {
	mwanachamagit.GitManager
	getByName    func(name string) (models.Repository, error)
	list         func() ([]models.Repository, error)
	branchByName func(repoID, name string) (models.Branch, error)
	branchFilter func(repoID string, f mwanachamagit.BranchFilter) ([]models.Branch, error)
	branches     func(repoID string) ([]models.Branch, error)
	merge        func(branchID string) (models.Branch, error)
}

func (s stubManager) GetRepositoryByName(_ context.Context, name string) (models.Repository, error) {
	return s.getByName(name)
}

func (s stubManager) ListRepositories(context.Context) ([]models.Repository, error) {
	return s.list()
}

func (s stubManager) GetBranchByName(_ context.Context, repoID, name string) (models.Branch, error) {
	return s.branchByName(repoID, name)
}

func (s stubManager) ListBranchesFiltered(_ context.Context, repoID string, f mwanachamagit.BranchFilter) ([]models.Branch, error) {
	return s.branchFilter(repoID, f)
}

func (s stubManager) ListBranches(_ context.Context, repoID string) ([]models.Branch, error) {
	return s.branches(repoID)
}

func (s stubManager) MergeBranch(_ context.Context, branchID string) (models.Branch, error) {
	return s.merge(branchID)
}

func serveUndeclared(gm mwanachamagit.GitManager) *http.ServeMux {
	mux := http.NewServeMux()
	for _, rt := range undeclared(gm) {
		mux.HandleFunc(rt.Pattern(""), rt.Handler)
	}
	return mux
}

func send(mux *http.ServeMux, method, target string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(method, target, nil))
	return rec
}

func TestReposWithANameAnswersThatRepositoryOnly(t *testing.T) {
	var asked string
	mux := serveUndeclared(stubManager{
		getByName: func(name string) (models.Repository, error) {
			asked = name
			return models.Repository{ID: "r1", Name: name}, nil
		},
		list: func() ([]models.Repository, error) {
			t.Fatal("listing must not run when a name is given")
			return nil, nil
		},
	})
	rec := send(mux, http.MethodGet, "/repos?name=docs")
	if rec.Code != http.StatusOK || asked != "docs" {
		t.Fatalf("status %d asked %q", rec.Code, asked)
	}
	var got models.Repository
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || got.ID != "r1" || got.Name != "docs" {
		t.Fatalf("body %s", rec.Body.String())
	}
}

func TestReposWithoutANameListsEveryRepository(t *testing.T) {
	mux := serveUndeclared(stubManager{
		list: func() ([]models.Repository, error) {
			return []models.Repository{{ID: "a"}, {ID: "b"}}, nil
		},
	})
	rec := send(mux, http.MethodGet, "/repos")
	var got []models.Repository
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || len(got) != 2 || got[0].ID != "a" || got[1].ID != "b" {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
}

func TestAnUnmappedFailureIsAnOpaqueInternalError(t *testing.T) {
	mux := serveUndeclared(stubManager{
		list: func() ([]models.Repository, error) { return nil, errors.New("pq: secret connection detail") },
	})
	rec := send(mux, http.MethodGet, "/repos")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status %d", rec.Code)
	}
	var body map[string]string
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body["error"] != "internal error" {
		t.Fatalf("body leaked %s", rec.Body.String())
	}
}

func TestAMappedFailureKeepsItsStatusAndMessage(t *testing.T) {
	mux := serveUndeclared(stubManager{
		getByName: func(string) (models.Repository, error) { return models.Repository{}, mwanachamagit.ErrBranchNotFound },
	})
	rec := send(mux, http.MethodGet, "/repos?name=x")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status %d", rec.Code)
	}
	var body map[string]string
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body["error"] != mwanachamagit.ErrBranchNotFound.Error() {
		t.Fatalf("body %s", rec.Body.String())
	}
}

func TestBranchesByNameWinsOverTheWorkflowRunFilter(t *testing.T) {
	mux := serveUndeclared(stubManager{
		branchByName: func(repoID, name string) (models.Branch, error) {
			return models.Branch{ID: repoID + "/" + name}, nil
		},
		branchFilter: func(string, mwanachamagit.BranchFilter) ([]models.Branch, error) {
			t.Fatal("name must take precedence")
			return nil, nil
		},
	})
	rec := send(mux, http.MethodGet, "/repos/r9/branches?name=main&workflow_run_id=w1")
	var got models.Branch
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || got.ID != "r9/main" {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
}

func TestBranchesByWorkflowRunPassesTheRunToTheFilter(t *testing.T) {
	var gotRepo, gotRun string
	mux := serveUndeclared(stubManager{
		branchFilter: func(repoID string, f mwanachamagit.BranchFilter) ([]models.Branch, error) {
			gotRepo, gotRun = repoID, f.WorkflowRunID
			return []models.Branch{{ID: "b1"}}, nil
		},
	})
	rec := send(mux, http.MethodGet, "/repos/r2/branches?workflow_run_id=run-7")
	if rec.Code != http.StatusOK || gotRepo != "r2" || gotRun != "run-7" {
		t.Fatalf("status %d repo %q run %q", rec.Code, gotRepo, gotRun)
	}
}

func TestBranchesWithNoQueryListsTheRepositorysBranches(t *testing.T) {
	mux := serveUndeclared(stubManager{
		branches: func(repoID string) ([]models.Branch, error) {
			return []models.Branch{{ID: repoID + "-b"}}, nil
		},
	})
	rec := send(mux, http.MethodGet, "/repos/r3/branches")
	var got []models.Branch
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || len(got) != 1 || got[0].ID != "r3-b" {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
}

func TestMergeReturnsTheMergedBranch(t *testing.T) {
	mux := serveUndeclared(stubManager{
		merge: func(id string) (models.Branch, error) { return models.Branch{ID: id}, nil },
	})
	rec := send(mux, http.MethodPost, "/branches/b5/merge")
	var got models.Branch
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || rec.Code != http.StatusOK || got.ID != "b5" {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
}

func TestMergeConflictAnswers409NamingTheTaskAndFiles(t *testing.T) {
	mux := serveUndeclared(stubManager{
		merge: func(string) (models.Branch, error) {
			return models.Branch{}, &mwanachamagit.ErrMergeConflict{TaskID: "t-1", ConflictingFiles: []string{"a.go", "b.go"}}
		},
	})
	rec := send(mux, http.MethodPost, "/branches/b5/merge")
	if rec.Code != http.StatusConflict {
		t.Fatalf("status %d", rec.Code)
	}
	var body struct {
		Error string   `json:"error"`
		Task  string   `json:"task_id"`
		Files []string `json:"conflicting_files"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Task != "t-1" || len(body.Files) != 2 || body.Files[0] != "a.go" || body.Error == "" {
		t.Fatalf("body %s", rec.Body.String())
	}
}

func TestMergeOfAMissingBranchIsNotFound(t *testing.T) {
	mux := serveUndeclared(stubManager{
		merge: func(string) (models.Branch, error) { return models.Branch{}, mwanachamagit.ErrBranchNotFound },
	})
	if rec := send(mux, http.MethodPost, "/branches/none/merge"); rec.Code != http.StatusNotFound {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestEveryRouteIsGatedAndTheUndeclaredThreeJoinThem(t *testing.T) {
	gm := stubManager{}
	if len(PublicRoutes(gm)) != 0 {
		t.Fatal("no address of this module is anonymous")
	}
	split := Split(gm, Mount{})
	gated := OperatorRoutes(gm, Mount{})
	if len(split.Gated) != len(gated) || len(gated) < len(undeclared(gm)) {
		t.Fatalf("gated %d split %d", len(gated), len(split.Gated))
	}
	have := map[string]bool{}
	for _, rt := range gated {
		have[rt.Method+" "+rt.Path] = true
	}
	for _, want := range []string{"GET /repos", "GET /repos/{repoID}/branches", "POST /branches/{branchID}/merge"} {
		if !have[want] {
			t.Fatalf("%s missing from the gated routes", want)
		}
	}
}
