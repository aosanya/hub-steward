package main

import (
	"log/slog"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	forms "wakalaserver/modules/forms"
)

func buildForms(log *slog.Logger) forms.FormManager {
	dsn, instance := os.Getenv("FORMS_DATABASE_URL"), os.Getenv("FORMS_INSTANCE")
	if dsn == "" || instance == "" {
		log.Info("no forms mounted", "reason", "FORMS_DATABASE_URL or FORMS_INSTANCE is unset")
		return nil
	}

	s, err := forms.SpecFor(instance)
	if err != nil {
		log.Error("could not load the forms spec", "instance", instance, "error", err.Error())
		os.Exit(1)
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		log.Error("could not open the forms database", "error", err.Error())
		os.Exit(1)
	}
	limitModulePool(db)
	if err := forms.Provision(db, s); err != nil {
		log.Error("could not provision the forms tables", "error", err.Error())
		os.Exit(1)
	}

	fm, err := forms.NewFormManager(db, s)
	if err != nil {
		log.Error("could not build the forms manager", "error", err.Error())
		os.Exit(1)
	}

	log.Info("forms mounted", "instance", s.Instance, "module", s.Module, "domain", s.Domain)
	return fm
}
