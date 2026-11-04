package main

import (
	"log/slog"
	"os"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	catalog "wakalaserver/modules/catalog"
	"wakalaserver/modules/shared/spec"
)

var catalogMount = specMount{
	module:      "catalog",
	declaration: "wakala.catalog",
	prefix:      "CATALOG",
	load:        catalog.LoadSpec,
	parse:       catalog.ParseSpec,
}

var reportsMount = specMount{
	module:      "catalog",
	declaration: "wakala.reports",
	prefix:      "REPORTS",
	load:        catalog.LoadSpec,
	parse:       catalog.ParseSpec,
}

func openDeclaredDB(prefix string) (*gorm.DB, string, error) {
	cfg := &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)}
	if dsn := os.Getenv(prefix + "_DATABASE_URL"); dsn != "" {
		db, err := gorm.Open(postgres.Open(dsn), cfg)
		if err == nil {
			limitModulePool(db)
		}
		return db, "postgres", err
	}
	dsn := os.Getenv(prefix + "_SQLITE_PATH")
	db, err := gorm.Open(sqlite.Open(dsn), cfg)
	return db, "sqlite " + dsn, err
}

func declaredDBConfigured(prefix string) bool {
	return os.Getenv(prefix+"_DATABASE_URL") != "" || os.Getenv(prefix+"_SQLITE_PATH") != ""
}

func buildCatalog(log *slog.Logger) catalog.CatalogManager {
	return buildCatalogMount(log, catalogMount, "catalog")
}

func buildReports(log *slog.Logger) catalog.CatalogManager {
	return buildCatalogMount(log, reportsMount, "reports")
}

func buildCatalogMount(log *slog.Logger, m specMount, name string) catalog.CatalogManager {
	if !declaredDBConfigured(m.prefix) || !m.configured() {
		log.Info("no "+name+" mounted",
			"reason", m.prefix+"_DATABASE_URL or "+m.prefix+"_SQLITE_PATH, and one of "+
				m.prefix+"_SPEC / "+m.prefix+"_INSTANCE, must be set")
		return nil
	}

	s, from, err := m.resolve()
	if err != nil {
		log.Error("could not load the "+name+" spec", "from", from, "error", err.Error())
		os.Exit(1)
	}

	db, backend, err := openDeclaredDB(m.prefix)
	if err != nil {
		log.Error("could not open the "+name+" database", "backend", backend, "error", err.Error())
		os.Exit(1)
	}
	if err := spec.Migrate(db, s); err != nil {
		log.Error("could not provision the "+name+" tables", "error", err.Error())
		os.Exit(1)
	}

	cm, err := catalog.NewCatalogManager(db, s)
	if err != nil {
		log.Error("could not build the "+name+" manager", "error", err.Error())
		os.Exit(1)
	}

	log.Info(name+" mounted",
		"instance", s.Instance, "module", s.Module, "domain", s.Domain,
		"mount", s.MountName(), "backend", backend, "from", from)
	return cm
}
