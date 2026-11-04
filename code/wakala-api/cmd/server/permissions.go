package main

import (
	"log/slog"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	permissions "wakalaserver/modules/permissions"
)

var permissionsMount = specMount{
	module: "permissions",
	prefix: "PERMISSIONS",
	load:   permissions.LoadSpec,
	parse:  permissions.ParseSpec,
}

func buildPermissions(log *slog.Logger) permissions.PermissionsManager {
	dsn := os.Getenv("PERMISSIONS_DATABASE_URL")
	if dsn == "" || !permissionsMount.configured() {
		log.Info("no permissions mounted; every authenticated caller reaches every gated surface",
			"reason", "PERMISSIONS_DATABASE_URL, or both PERMISSIONS_INSTANCE and PERMISSIONS_SPEC, is unset")
		return nil
	}

	s, from, err := permissionsMount.resolve()
	if err != nil {
		log.Error("could not load the permissions spec", "from", from, "error", err.Error())
		os.Exit(1)
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		log.Error("could not open the permissions database", "error", err.Error())
		os.Exit(1)
	}
	limitModulePool(db)

	if err := permissions.Migrate(db, s); err != nil {
		log.Error("could not migrate the permissions tables", "error", err.Error())
		os.Exit(1)
	}

	pm, err := permissions.NewPermissionsManager(db, s)
	if err != nil {
		log.Error("could not build the permissions manager", "error", err.Error())
		os.Exit(1)
	}

	log.Info("permissions mounted", "instance", s.Instance, "module", s.Module, "domain", s.Domain, "from", from)
	return pm
}
