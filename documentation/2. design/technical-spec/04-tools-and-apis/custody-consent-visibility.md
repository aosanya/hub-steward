# Who sees the custody consent tools

Decision D153 of hub-steward-swe, built in SW404.

## The owner

The custody module has no mount (`"mount": ""` in `modules_catalog.json`). A module is listed to an agency's owner through its mounts, so the six consent tools were never listed, and an owner of an agency with every module on saw 640 of 646 module tools.

`shownWithoutMount` in `mcp_module_visible.go` lists the tools of a module with no mount to its owner whenever the module is on in the agency. `catalog` and `git` are named in `modulesServedThroughAnother`: their tools are served under the module that mounts them (`forms_catalog_*`, `forms_git_*`), so turning them on adds nothing. The owner now sees 646 of 646.

## The resident

A resident holds four of the six tools, through the role `resident_<agency>` that every resident is granted in the scope `module:custody`:

| Tool | Action |
|---|---|
| `custody_get_in_force_consent` | `custody.consent_text.read` |
| `custody_get_my_consent` | `custody.consent.mine` |
| `custody_agree_consent` | `custody.consent.give` |
| `custody_withdraw_consent` | `custody.consent.withdraw` |

`custody_list_consent_versions` (`custody.consent_version.list`) and `custody_publish_consent_version` (`custody.consent_text.publish`) stay with the owner and with an agent whose agency role holds the matching permission.

The four are `residentCustodyConsentActions` in `membership.go`, added to `residentActions` in `resident_grants.go`. They are seeded on the resident role at start-up and when a resident is admitted.

## The permissions catalog

`permissions_catalog.json` names the six actions in three permissions of the module `custody`, so an agency role can be given them:

| Permission | Actions |
|---|---|
| `consent.read` | `custody.consent_text.read`, `custody.consent.mine` |
| `consent.give` | `custody.consent.give`, `custody.consent.withdraw` |
| `consent.publish` | `custody.consent_version.list`, `custody.consent_text.publish` |

The consent gate on a form answer is unchanged: a resident with no live consent is refused with 403.
