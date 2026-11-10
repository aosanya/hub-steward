package http

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"net"
	"testing"
)

type sqlStateFailure struct{}

func (sqlStateFailure) Error() string    { return "constraint" }
func (sqlStateFailure) SQLState() string { return "23505" }

type networkFailure struct{}

func (networkFailure) Error() string   { return "dial" }
func (networkFailure) Timeout() bool   { return true }
func (networkFailure) Temporary() bool { return true }

var _ net.Error = networkFailure{}

func TestStoreFailuresAreRecognisedWhereverTheyAreWrapped(t *testing.T) {
	failures := []error{
		sql.ErrConnDone,
		fmt.Errorf("apply: %w", context.DeadlineExceeded),
		io.ErrUnexpectedEOF,
		sqlStateFailure{},
		networkFailure{},
		errors.New("sql: transaction has already been committed"),
	}
	for _, err := range failures {
		if !isStoreFailure(err) {
			t.Fatalf("%v must count as a store failure", err)
		}
	}
	for _, err := range []error{errors.New("title is required"), errors.New("task not found")} {
		if isStoreFailure(err) {
			t.Fatalf("%v is the caller's mistake, not a store failure", err)
		}
	}
}

func TestOwnerSeesAPlainSentenceForStoreFailuresAndTheRealErrorOtherwise(t *testing.T) {
	if shownToOwner(nil) != nil {
		t.Fatal("no error stays no error")
	}
	if got := shownToOwner(fmt.Errorf("write: %w", sql.ErrTxDone)); got != errStoreFailed {
		t.Fatalf("a store failure must be shown as the plain sentence, got %v", got)
	}
	mistake := errors.New("step name is taken")
	if got := shownToOwner(mistake); got != mistake {
		t.Fatalf("a refusal must reach the owner as it is, got %v", got)
	}
}
