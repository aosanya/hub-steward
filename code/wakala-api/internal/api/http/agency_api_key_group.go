package http

import (
	"context"
	"errors"
	"net/http"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

var errKeyGroupNotSeated = errors.New("you hold no seat in that group, so a key cannot act as it")

type createAgencyAPIKeyRequest struct {
	Name    string `json:"name"`
	GroupID string `json:"group_id"`
}

func ownerSeatedIn(ctx context.Context, reg agencies.Registry, instanceID, groupID string) error {
	directory, err := reg.ActorManager(ctx, instanceID)
	if err != nil {
		return err
	}
	seats, err := directory.ListRoleAssignmentsForActor(ctx, accounts.IDFromContext(ctx), true)
	if err != nil {
		return err
	}
	for _, seat := range seats {
		if seat.Active && seat.GroupID == groupID {
			return nil
		}
	}
	return errKeyGroupNotSeated
}

func checkKeyGroup(ctx context.Context, reg agencies.Registry, instanceID, groupID string) error {
	if groupID == "" {
		return nil
	}
	return ownerSeatedIn(ctx, reg, instanceID, groupID)
}

func writeKeyGroupErr(w http.ResponseWriter, err error) {
	if errors.Is(err, errKeyGroupNotSeated) {
		writeErr(w, http.StatusForbidden, err.Error())
		return
	}
	writeInstanceErr(w, err)
}
