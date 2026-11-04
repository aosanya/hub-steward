package main

import (
	"database/sql"
	"strconv"
	"strings"
	"time"
)

const (
	defaultPoolConnections = 12
	poolConnectionsEnv     = "WAKALA_DB_POOL_CONNECTIONS"
	poolIdleTime           = 5 * time.Minute
)

func poolConnections(get func(string) string) int {
	n, err := strconv.Atoi(strings.TrimSpace(get(poolConnectionsEnv)))
	if err != nil || n < 1 {
		return defaultPoolConnections
	}
	return n
}

func sizePool(pool *sql.DB, connections int) {
	pool.SetMaxOpenConns(connections)
	pool.SetMaxIdleConns(connections)
	pool.SetConnMaxIdleTime(poolIdleTime)
}
