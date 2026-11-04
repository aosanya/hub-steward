package main

import (
	"fmt"
	"log/slog"
	"os"

	"gorm.io/gorm"
	ratings "wakalaserver/modules/ratings"
	"wakalaserver/modules/shared/spec"

	"wakalaserver/internal/specs"
)

func ratingsAttachedTo(catalogSpec *spec.Spec, db *gorm.DB) (ratings.RatingsManager, error) {
	attached := catalogSpec.Attached(ratings.Module)
	if len(attached) == 0 {
		return nil, nil
	}
	raw, err := specs.For(ratings.Module, catalogSpec.Instance)
	if err != nil {
		return nil, err
	}
	rs, err := ratings.ParseSpec(raw)
	if err != nil {
		return nil, fmt.Errorf("the ratings declaration: %w", err)
	}
	if err := ratings.Provision(db, rs); err != nil {
		return nil, err
	}
	return ratings.NewRatingsManager(db, rs)
}

func buildRatings(log *slog.Logger) ratings.RatingsManager {
	m := catalogMount
	if !declaredDBConfigured(m.prefix) || !m.configured() {
		return nil
	}
	s, from, err := m.resolve()
	if err != nil {
		log.Error("could not load the catalog spec for its ratings", "from", from, "error", err.Error())
		os.Exit(1)
	}
	if len(s.Attached(ratings.Module)) == 0 {
		log.Info("no ratings attached to the catalog", "from", from)
		return nil
	}
	db, backend, err := openDeclaredDB(m.prefix)
	if err != nil {
		log.Error("could not open the catalog database for its ratings", "backend", backend, "error", err.Error())
		os.Exit(1)
	}
	rm, err := ratingsAttachedTo(s, db)
	if err != nil {
		log.Error("could not mount the catalog's ratings", "error", err.Error())
		os.Exit(1)
	}
	log.Info("catalog ratings mounted", "instance", s.Instance, "backend", backend)
	return rm
}
