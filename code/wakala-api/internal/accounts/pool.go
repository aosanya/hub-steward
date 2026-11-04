package accounts

import (
	"database/sql"
	"strconv"
	"strings"
	"time"
)

const maxPoolConns = 200

type PoolSettings struct {
	MaxOpen     int
	MaxIdle     int
	MaxIdleTime time.Duration
	MaxLifetime time.Duration
}

var (
	AccountPool = PoolSettings{MaxOpen: 12, MaxIdle: 12, MaxIdleTime: 5 * time.Minute, MaxLifetime: 30 * time.Minute}
	ShopPool    = PoolSettings{MaxOpen: 4, MaxIdle: 4, MaxIdleTime: 5 * time.Minute, MaxLifetime: 30 * time.Minute}
	ModulePool  = PoolSettings{MaxOpen: 4, MaxIdle: 4, MaxIdleTime: 5 * time.Minute, MaxLifetime: 30 * time.Minute}
)

func PoolFromEnv(prefix string, defaults PoolSettings, getenv func(string) string) PoolSettings {
	out := defaults
	if n, ok := positiveInt(getenv(prefix + "_MAX_CONNS")); ok && n <= maxPoolConns {
		out.MaxOpen = n
		if defaults.MaxIdle == defaults.MaxOpen {
			out.MaxIdle = n
		}
	}
	if n, ok := positiveInt(getenv(prefix + "_MAX_IDLE_CONNS")); ok && n <= maxPoolConns {
		out.MaxIdle = n
	}
	if out.MaxIdle > out.MaxOpen {
		out.MaxIdle = out.MaxOpen
	}
	if d, ok := positiveDuration(getenv(prefix + "_CONN_MAX_IDLE")); ok {
		out.MaxIdleTime = d
	}
	if d, ok := positiveDuration(getenv(prefix + "_CONN_MAX_LIFETIME")); ok {
		out.MaxLifetime = d
	}
	return out
}

func TenantLimitFromEnv(fallback int, getenv func(string) string) int {
	if n, ok := positiveInt(getenv("WAKALA_TENANT_DB_LIMIT")); ok && n <= maxPoolConns {
		return n
	}
	return fallback
}

func (p PoolSettings) Apply(db *sql.DB) {
	db.SetMaxOpenConns(p.MaxOpen)
	db.SetMaxIdleConns(p.MaxIdle)
	db.SetConnMaxIdleTime(p.MaxIdleTime)
	db.SetConnMaxLifetime(p.MaxLifetime)
}

func positiveInt(raw string) (int, bool) {
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	return n, err == nil && n > 0
}

func positiveDuration(raw string) (time.Duration, bool) {
	d, err := time.ParseDuration(strings.TrimSpace(raw))
	return d, err == nil && d > 0
}
