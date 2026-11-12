# Who sees the consent tools

Settled in D153 (2026-11-12), asked in SW401. The consent tools belong to the custody module, which has `"mount": ""` in `modules_catalog.json`; `addModulesShownIn` in `mcp_module_visible.go` shows a module's tools through its mount, so the owner of an agency with every module on saw 640 of 646 tools and the six custody tools were never listed.

## The choice

| Option | What the owner sees | Chosen |
|---|---|---|
| Show a mount-less module's tools whenever the module is on | The six consent tools appear as soon as custody is on; no new mount, no new setting | Yes |
| Give custody a mount named Consent | A named part with its own studio entry, switched on by the owner; every existing hub shows a new part | No |

## What the rule is

- A module with no mount shows its tools to the owner when the module is on in the agency.
- The tools of `catalog` and `git` keep their own rules and are not shown by this one.
- The owner holds all six tools.
- A resident holds four by default: `custody_get_in_force_consent`, `custody_get_my_consent`, `custody_agree_consent`, `custody_withdraw_consent`. `custody_list_consent_versions` and `custody_publish_consent_version` stay with the owner.
- The consent gate on a form answer is unchanged: a resident with no live consent is refused (403), as the HTTP routes refuse.

## What it changes

| Part | Change | Issue |
|---|---|---|
| `mcp_module_visible.go` | the visibility rule above | SW404 |
| `permissions_catalog.json` | the custody consent actions | SW404 |
| resident grants | the four resident actions, beside `residentFormsActions` | SW404 |
| roster and pinned counts | the owner sees 646 of 646 | SW404 |

The studio page Settings > Consent text and the phone Consent screens (SW392, SW395, SW398) wait on SW404.
