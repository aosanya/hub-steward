package http

import "time"

const (
	maxRequestBody = 1 << 20

	ServerReadTimeout       = 10 * time.Second
	ServerIdleTimeout       = 60 * time.Second
	ServerReadHeaderTimeout = 5 * time.Second
	responseWriteTimeout    = 5 * time.Minute

	maxMCPNesting       = 64
	maxMCPBatchElements = 16
)

const (
	anonymousTrackedClients = 20000

	anonymousJSONBodyBytes = max(anonymousFormBodyBytes, anonymousReportBodyBytes)

	anonymousReportsPerMinute = 20
	anonymousReportBodyBytes  = 32 << 10

	anonymousFormWritesPerMinute = 60
	anonymousFormBodyBytes       = 64 << 10
)
