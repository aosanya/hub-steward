package http

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"io"
	"log/slog"
	"net"
	"strings"
)

var errStoreFailed = errors.New("the store could not complete the write")

var storeFailures = []error{
	sql.ErrConnDone,
	sql.ErrTxDone,
	driver.ErrBadConn,
	context.Canceled,
	context.DeadlineExceeded,
	io.EOF,
	io.ErrUnexpectedEOF,
}

type sqlStateError interface{ SQLState() string }

func isStoreFailure(err error) bool {
	for _, known := range storeFailures {
		if errors.Is(err, known) {
			return true
		}
	}
	var network net.Error
	var state sqlStateError
	return errors.As(err, &network) || errors.As(err, &state) || strings.Contains(err.Error(), "sql: ")
}

func shownToOwner(err error) error {
	if err == nil || !isStoreFailure(err) {
		return err
	}
	slog.Error("an approved write hit the store and failed", "error", err.Error())
	return errStoreFailed
}
