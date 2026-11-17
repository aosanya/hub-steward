package http

import (
	"context"
	"net/http"

	"wakalaserver/internal/agencies"
)

const keyProbeAgencyCap = 100

type keyProbe func(r *http.Request, instanceID, key string) bool

func publicKeyOf(r *http.Request) string {
	if key := r.PathValue("key"); key != "" {
		return key
	}
	return r.URL.Query().Get("k")
}

func (d *Deps) agencyOfRequest(r *http.Request, public bool, holds keyProbe) (string, error) {
	named := r.URL.Query().Get(agencyQuery)
	if public && named == "" && holds != nil {
		return d.agencyHoldingKey(r, holds)
	}
	return d.agencyOfCaller(r.Context(), named, public)
}

func (d *Deps) agencyHoldingKey(r *http.Request, holds keyProbe) (string, error) {
	key := publicKeyOf(r)
	if key == "" {
		return "", agencies.ErrInstanceNotFound
	}
	instances, err := d.Registry.ListInstances(r.Context())
	if err != nil {
		return "", err
	}
	if len(instances) > keyProbeAgencyCap {
		return "", agencies.ErrInstanceNotFound
	}
	found := ""
	for _, instance := range instances {
		if !holds(withPartition(r, instance.ID), instance.ID, key) {
			continue
		}
		if found != "" {
			return "", agencies.ErrInstanceNotFound
		}
		found = instance.ID
	}
	if found == "" {
		return "", agencies.ErrInstanceNotFound
	}
	return found, nil
}

func (d *Deps) formsHoldKey(r *http.Request, instanceID, key string) bool {
	fm, err := d.Registry.IssuingFormManager(r.Context(), instanceID)
	if err != nil {
		return false
	}
	_, err = fm.OpenPublicLink(r.Context(), key)
	return err == nil
}

func (d *Deps) catalogHoldKey(mount string) keyProbe {
	return func(r *http.Request, instanceID, key string) bool {
		return d.catalogOfAgencyHoldsKey(r.Context(), r, instanceID, mount, key)
	}
}

func (d *Deps) catalogOfAgencyHoldsKey(ctx context.Context, r *http.Request, instanceID, mount, key string) bool {
	cm, err := d.Registry.CatalogManager(ctx, instanceID, mount)
	if err != nil {
		return false
	}
	if slug := r.PathValue("slug"); slug != "" {
		_, err := cm.OpenEntry(ctx, slug, key)
		return err == nil
	}
	if _, err := cm.OpenSharedBoardItem(ctx, key); err == nil {
		return true
	}
	_, err = cm.ShowFollowedRaisedItem(ctx, key)
	return err == nil
}
