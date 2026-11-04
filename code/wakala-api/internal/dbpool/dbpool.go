package dbpool

import (
	"context"
	"database/sql"
	"sync"

	"gorm.io/gorm"
)

type Event struct {
	Kind string
	SQL  string
}

type Options struct {
	Gate   *Gate
	Record func(Event)
}

type pool struct {
	base gorm.ConnPool
	opt  Options
}

func Install(db *gorm.DB, opt Options) {
	p := &pool{base: db.ConnPool, opt: opt}
	db.ConnPool = p
	if db.Statement != nil {
		db.Statement.ConnPool = p
	}
}

func (p *pool) note(kind, query string) {
	if p.opt.Record != nil {
		p.opt.Record(Event{Kind: kind, SQL: query})
	}
}

func (p *pool) acquire(ctx context.Context) (func(), error) {
	if p.opt.Gate == nil {
		return func() {}, nil
	}
	return p.opt.Gate.Acquire(ctx, TenantOf(ctx))
}

func (p *pool) GetDBConn() (*sql.DB, error) {
	if sqldb, ok := p.base.(*sql.DB); ok {
		return sqldb, nil
	}
	if connector, ok := p.base.(gorm.GetDBConnector); ok {
		return connector.GetDBConn()
	}
	return nil, gorm.ErrInvalidDB
}

func (p *pool) PrepareContext(ctx context.Context, query string) (*sql.Stmt, error) {
	return p.base.PrepareContext(ctx, query)
}

func (p *pool) ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	release, err := p.acquire(ctx)
	if err != nil {
		return nil, err
	}
	defer release()
	p.note("exec", query)
	return p.base.ExecContext(ctx, query, args...)
}

func (p *pool) QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	release, err := p.acquire(ctx)
	if err != nil {
		return nil, err
	}
	defer release()
	p.note("query", query)
	return p.base.QueryContext(ctx, query, args...)
}

func (p *pool) QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row {
	release, err := p.acquire(ctx)
	if err != nil {
		return p.base.QueryRowContext(ctx, query, args...)
	}
	defer release()
	p.note("query", query)
	return p.base.QueryRowContext(ctx, query, args...)
}

func (p *pool) BeginTx(ctx context.Context, opts *sql.TxOptions) (gorm.ConnPool, error) {
	release, err := p.acquire(ctx)
	if err != nil {
		return nil, err
	}
	var inner gorm.ConnPool
	switch beginner := p.base.(type) {
	case gorm.TxBeginner:
		inner, err = beginner.BeginTx(ctx, opts)
	case gorm.ConnPoolBeginner:
		inner, err = beginner.BeginTx(ctx, opts)
	default:
		err = gorm.ErrInvalidTransaction
	}
	if err != nil {
		release()
		return nil, err
	}
	committer, ok := inner.(gorm.TxCommitter)
	if !ok {
		release()
		return nil, gorm.ErrInvalidTransaction
	}
	p.note("begin", "BEGIN")
	return &tx{ConnPool: inner, committer: committer, pool: p, release: once(release)}, nil
}

type tx struct {
	gorm.ConnPool
	committer gorm.TxCommitter
	pool      *pool
	release   func()
}

func (t *tx) ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	t.pool.note("exec", query)
	return t.ConnPool.ExecContext(ctx, query, args...)
}

func (t *tx) QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	t.pool.note("query", query)
	return t.ConnPool.QueryContext(ctx, query, args...)
}

func (t *tx) QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row {
	t.pool.note("query", query)
	return t.ConnPool.QueryRowContext(ctx, query, args...)
}

func (t *tx) Commit() error {
	defer t.release()
	t.pool.note("commit", "COMMIT")
	return t.committer.Commit()
}

func (t *tx) Rollback() error {
	defer t.release()
	t.pool.note("rollback", "ROLLBACK")
	return t.committer.Rollback()
}

func once(f func()) func() {
	var o sync.Once
	return func() { o.Do(f) }
}
