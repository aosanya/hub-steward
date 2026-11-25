package http

import (
	"context"
	"errors"
	"net/http"
	"strings"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const (
	createTagAction = "instance.tag.create"
	renameTagAction = "instance.tag.rename"
	deleteTagAction = "instance.tag.delete"
)

var errTagsNotServed = errors.New("tags are not available")

type tagRequest struct {
	Name string `json:"name"`
}

type groupTagRequest struct {
	GroupID string `json:"group_id"`
	TagID   string `json:"tag_id"`
}

type tagList struct {
	Items []agencies.Tag `json:"items"`
}

type groupTagLink struct {
	InstanceID string `json:"instance_id"`
	GroupID    string `json:"group_id"`
	TagID      string `json:"tag_id"`
}

type tagInUseBody struct {
	Error  string `json:"error"`
	Groups int    `json:"groups"`
	Rows   int    `json:"rows"`
}

func registerTagRoutes(mux *http.ServeMux, d *Deps, auth callers) {
	mux.HandleFunc("GET /instances/{instanceID}/tags", auth.require(d.listTagsRoute))
	mux.HandleFunc("POST /instances/{instanceID}/tags", auth.require(d.createTagRoute))
	mux.HandleFunc("PUT /instances/{instanceID}/tags/{tagID}", auth.require(d.renameTagRoute))
	mux.HandleFunc("DELETE /instances/{instanceID}/tags/{tagID}", auth.require(d.deleteTagRoute))
	mux.HandleFunc("POST /instances/{instanceID}/group-tags", auth.require(d.giveGroupTagRoute))
	mux.HandleFunc("DELETE /instances/{instanceID}/group-tags/{groupID}/{tagID}", auth.require(d.takeGroupTagRoute))
}

func (d *Deps) tagStore() (agencies.Tags, error) {
	kept, ok := d.Registry.(agencies.Tags)
	if !ok {
		return nil, errTagsNotServed
	}
	return kept, nil
}

func (d *Deps) tagsAsAdministrator(ctx context.Context, instanceID string) (agencies.Tags, error) {
	if _, err := d.groupRolesAsOwner(ctx, instanceID); err != nil {
		return nil, err
	}
	return d.tagStore()
}

func (d *Deps) tagsAsGroupAdministrator(ctx context.Context, instanceID, action string) (agencies.Tags, error) {
	if err := d.groupAdministered(ctx, instanceID, action); err != nil {
		return nil, err
	}
	return d.tagStore()
}

func (d *Deps) tagsAsManager(ctx context.Context, instanceID, action string) (agencies.Tags, error) {
	if err := d.tagManagementAdmitted(ctx, instanceID, action); err != nil {
		return nil, err
	}
	return d.tagStore()
}

func (d *Deps) tagManagementAdmitted(ctx context.Context, instanceID, action string) error {
	caller := accounts.IDFromContext(ctx)
	role, err := d.Registry.RoleOf(ctx, instanceID, caller)
	if caller == "" || err != nil {
		return agencies.ErrInstanceNotFound
	}
	switch role {
	case agencies.RoleOwner:
		return nil
	case agencies.RoleAgent:
		if d.callerHoldsAction(withPartitionContext(ctx, instanceID), role, action) {
			return nil
		}
		return permissionRefusal(action)
	}
	return d.admittedHoldingAction(ctx, instanceID, action)
}

func (d *Deps) checkTagGroup(ctx context.Context, instanceID, groupID string) error {
	if strings.TrimSpace(groupID) == "" {
		return errGroupRoleNeedsIDs
	}
	directory, err := d.Registry.ActorManager(ctx, instanceID)
	if err != nil {
		return err
	}
	if _, err := directory.GetGroup(ctx, groupID); errors.Is(err, mwanachamaactor.ErrGroupNotFound) {
		return errUnknownGroup
	} else if err != nil {
		return err
	}
	return nil
}

func tagStatus(err error) int {
	switch {
	case errors.Is(err, agencies.ErrTagNameTaken), errors.Is(err, agencies.ErrTagInUse):
		return http.StatusConflict
	case errors.Is(err, agencies.ErrTagNotFound):
		return http.StatusNotFound
	case errors.Is(err, agencies.ErrTagInvalid), errors.Is(err, agencies.ErrGroupTagInvalid), errors.Is(err, agencies.ErrSystemTag), errors.Is(err, errUnknownGroup), errors.Is(err, errGroupRoleNeedsIDs):
		return http.StatusUnprocessableEntity
	case errors.Is(err, errTagsNotServed):
		return http.StatusNotImplemented
	}
	return groupRoleStatus(err)
}

func writeTagErr(w http.ResponseWriter, err error) {
	var inUse *agencies.TagInUseError
	if errors.As(err, &inUse) {
		writeJSON(w, http.StatusConflict, tagInUseBody{Error: "the tag was not deleted: it is still carried", Groups: inUse.Groups, Rows: inUse.Rows})
		return
	}
	status := tagStatus(err)
	if status == http.StatusInternalServerError {
		writeErr(w, status, "internal error")
		return
	}
	writeErr(w, status, err.Error())
}

func (d *Deps) listTagsRoute(w http.ResponseWriter, r *http.Request) {
	instanceID := r.PathValue("instanceID")
	kept, err := d.tagsAsAdministrator(r.Context(), instanceID)
	if err != nil {
		writeTagErr(w, err)
		return
	}
	var tags []agencies.Tag
	if groupID := r.URL.Query().Get("group_id"); groupID != "" {
		tags, err = kept.GroupTags(r.Context(), instanceID, groupID)
	} else {
		tags, err = kept.ListTags(r.Context(), instanceID)
	}
	if err != nil {
		writeTagErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, tagList{Items: tags})
}

func (d *Deps) createTagRoute(w http.ResponseWriter, r *http.Request) {
	var req tagRequest
	if err := readJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid request body")
		return
	}
	instanceID := r.PathValue("instanceID")
	kept, err := d.tagsAsManager(r.Context(), instanceID, createTagAction)
	if err != nil {
		writeTagErr(w, err)
		return
	}
	tag, err := kept.CreateTag(r.Context(), instanceID, req.Name)
	if err != nil {
		writeTagErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, tag)
}

func (d *Deps) renameTagRoute(w http.ResponseWriter, r *http.Request) {
	var req tagRequest
	if err := readJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid request body")
		return
	}
	instanceID := r.PathValue("instanceID")
	kept, err := d.tagsAsManager(r.Context(), instanceID, renameTagAction)
	if err != nil {
		writeTagErr(w, err)
		return
	}
	tag, err := kept.RenameTag(r.Context(), instanceID, r.PathValue("tagID"), req.Name)
	if err != nil {
		writeTagErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, tag)
}

func (d *Deps) deleteTagRoute(w http.ResponseWriter, r *http.Request) {
	instanceID := r.PathValue("instanceID")
	kept, err := d.tagsAsManager(r.Context(), instanceID, deleteTagAction)
	if err != nil {
		writeTagErr(w, err)
		return
	}
	tagID := r.PathValue("tagID")
	if err := kept.DeleteTag(r.Context(), instanceID, tagID); err != nil {
		writeTagErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"instance_id": instanceID, "tag_id": tagID})
}

func (d *Deps) giveGroupTagRoute(w http.ResponseWriter, r *http.Request) {
	var req groupTagRequest
	if err := readJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid request body")
		return
	}
	instanceID := r.PathValue("instanceID")
	kept, err := d.tagsAsGroupAdministrator(r.Context(), instanceID, giveGroupTagAction)
	if err != nil {
		writeTagErr(w, err)
		return
	}
	if err := d.checkTagGroup(r.Context(), instanceID, req.GroupID); err != nil {
		writeTagErr(w, err)
		return
	}
	if err := kept.GiveGroupTag(r.Context(), instanceID, req.GroupID, req.TagID); err != nil {
		writeTagErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, groupTagLink{InstanceID: instanceID, GroupID: req.GroupID, TagID: req.TagID})
}

func (d *Deps) takeGroupTagRoute(w http.ResponseWriter, r *http.Request) {
	instanceID := r.PathValue("instanceID")
	kept, err := d.tagsAsGroupAdministrator(r.Context(), instanceID, takeGroupTagAction)
	if err != nil {
		writeTagErr(w, err)
		return
	}
	link := groupTagLink{InstanceID: instanceID, GroupID: r.PathValue("groupID"), TagID: r.PathValue("tagID")}
	if err := kept.TakeGroupTag(r.Context(), instanceID, link.GroupID, link.TagID); err != nil {
		writeTagErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, link)
}
