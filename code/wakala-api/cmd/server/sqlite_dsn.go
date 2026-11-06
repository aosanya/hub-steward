package main

import (
	"fmt"
	"sync/atomic"
)

var memoryDatabases atomic.Int64

func sqliteDSN(path string) string {
	if path != "" {
		return path
	}
	return fmt.Sprintf("file:wakala_memory_%d?mode=memory&cache=shared", memoryDatabases.Add(1))
}
