# Tags

Where the tags of an Instance and the tags of a group live in the API server, and what the routes refuse. The design and the owner's decisions are in [Tag management](../../2.%20design/technical-spec/tag-management.md). Paths are under `code/wakala-api`.

## Where tags live

| Table | Fields | Code |
|---|---|---|
| `agency_tags` | `id`, `instance_id`, `name`, `system`, `created_at`. The name is unique in the Instance | `internal/agencies/tags.go` |
| `agency_group_tags` | `instance_id`, `group_id`, `tag_id`, `created_at`. Indexed on the group and on the tag | `internal/agencies/group_tags.go` |

Both are hub registry tables beside `agency_group_roles`, migrated by `NewRegistry`. No tag is in the agency file or in a publication (D24). The interface is `agencies.Tags`; the account router passes it through in `internal/accounts/tags.go`.

## Rules

- The system tag `all` is made inside `CreateInstance` (D23). An Instance that existed before the table gets it inside its first tag call, so a first read lists it. Making it twice changes nothing.
- A name is trimmed and compared without regard to case; `all` is a name nobody else may take. A blank name is refused.
- A rename keeps the id, so rows and groups keep the tag. `all` can be neither renamed nor deleted.
- Giving a tag to a group a second time changes nothing. A tag of another Instance is refused as not found. The registry does not check that the group exists; the route does.
- A tag cannot be deleted while a group carries it or a row carries it (D53). The refusal is `*agencies.TagInUseError`, which answers `errors.Is(err, agencies.ErrTagInUse)` and carries the group count and the row count. Rows are not stored yet (ISS-186): the registry takes the count from an optional `agencies.WithTagRowCounter`, and counts none until the row store gives one.
- Any group may be given `all`, with or without other tags (D48).

## Routes

Under `/instances/{instanceID}`, in `internal/api/http/tag_routes.go`.

| Route | Answers |
|---|---|
| `GET /tags` | 200 `{"items": [{"id", "instance_id", "name", "system", "created_at"}]}`, `all` first. `?group_id=` lists only the tags of that group |
| `POST /tags` `{"name"}` | 201 with the tag. 409 when the name is taken, 422 when it is blank |
| `PUT /tags/{tagID}` `{"name"}` | 200 with the tag and the same id. 404 for an unknown tag, 409 when the name is taken, 422 for `all` |
| `DELETE /tags/{tagID}` | 200. 409 `{"error", "groups", "rows"}` while the tag is carried, 422 for `all`, 404 for an unknown tag |
| `POST /group-tags` `{"group_id", "tag_id"}` | 201. 422 when the group does not exist or is blank, 404 when the tag is not of this Instance |
| `DELETE /group-tags/{groupID}/{tagID}` | 200, also when the group did not carry the tag |

A group that is disabled keeps its tags: `agency_group_disabled` is a separate table and the tag routes do not read it (ISS-204, [the assumed group of a login session](../../2.%20design/technical-spec/assumed-group-session.md), section 7).

Who may call them:

| Routes | Guard | Refusal |
|---|---|---|
| `POST /tags`, `PUT /tags/{tagID}`, `DELETE /tags/{tagID}` | The permission `tag.manage` (`tagsAsManager`, ISS-202, D60). The owner of the Instance always passes. A seated agent or a resident passes when a role it holds carries `tag.manage`, which carries `instance.tag.create`, `instance.tag.rename` and `instance.tag.delete` | 403 naming the permission. 404 for a person with no seat in the Instance |
| `GET /tags`, `POST /group-tags`, `DELETE /group-tags/{groupID}/{tagID}` | The guard of the group-role routes (`groupRolesAsOwner`, through `tagsAsAdministrator`): the owner of the Instance. `tag.manage` does not open them (D48) | As the group-role routes answer: 403 for a seated agent, 404 for anyone else |

No role carries `tag.manage` by default. The permission is in the catalogue of the sibling `mwanachama-backend-agency` (`models/permissions_catalog.json`), and the hub reads it through `agencymodels.LookupPermission`, so the hub needs a sibling release that has the entry. The tests are `internal/api/http/tag_permission_test.go` and the resident case in `tag_routes_test.go`. There are no MCP tools yet.
