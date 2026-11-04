package accounts

import (
	"log"
	"os"
	"time"

	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

// GormConfig is the gorm.Config every database this API opens is built with —
// the launched projects it dials through OpenPostgres, and cmd/server's own
// store.
//
// It exists for one setting. GORM's default logger reports ErrRecordNotFound as
// an error, and mwanachama-backend-agency asks questions whose answer is
// routinely "not yet": the next code in a sequence before that sequence has a
// row, the open draft of an agency that has none. Importing one agency printed
// nine of those, each with a stack line and a query, and a log where the normal
// case is an error is a log nobody reads.
//
// Slow queries are still reported. Those are worth seeing, and a launch running
// against someone else's Supabase across a region is exactly where they turn up.
func GormConfig() *gorm.Config {
	return &gorm.Config{Logger: gormLogger()}
}

func gormLogger() gormlogger.Interface {
	return gormLoggerTo(log.New(os.Stdout, "", log.LstdFlags))
}

// gormLoggerTo is gormLogger against a given sink, so a test can read what
// would have been printed.
func gormLoggerTo(w gormlogger.Writer) gormlogger.Interface {
	return gormlogger.New(
		w,
		gormlogger.Config{
			SlowThreshold:             500 * time.Millisecond,
			LogLevel:                  gormlogger.Warn,
			IgnoreRecordNotFoundError: true,
			Colorful:                  false,
		},
	)
}
