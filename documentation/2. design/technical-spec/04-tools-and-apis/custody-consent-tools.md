# Custody consent tools

Six MCP tools put the consent sheet on the same surface as the other modules'
tools: the owner writes the text residents agree to, and a resident reads it,
agrees to it, reads their own state and withdraws. They were added in commit
`36920a5` (MUN181) and are served from `code/wakala-api/internal/api/http/mcp_tools_custody.go`.
Each is a custody operation declared in `code/wakala-api/modules/custody/custody.operations.json`,
so the tool and its REST route are one declaration.

The studio page for the consent text and the phone screens for agreeing and
withdrawing are built from these tools, which is why they are written down here.

## Not final yet

Two things on this page are not final.

- **Who may read the version list and publish.** Today the owner can; a stranger is told the agency is not found; a resident is refused the same way; a seated agent is refused as forbidden. How visible the consent text and its versions are to the owner is not final until SW401 lands.
- **What a resident may call.** Today a resident may call exactly the four resident tools below and nothing else in custody. The resident permissions are not final until SW404 lands.

Read the tables below as the behaviour at commit `36920a5`, not as a settled rule.

## Common to all six

| Fact | Value |
|---|---|
| Argument on every tool | `instance_id`: the agency whose consent text the call reads or writes |
| Scope and language | `scope` is `mechanics`, `appendix` or `public_sheet`; left out means `mechanics`. Any other scope is refused with 400 |
| Language | left out means the agency's content default language, lower-cased (`en`, `sw`, `luo`, `hu`); filled in by the API before the call for list, read, publish and agree |
| Module | the agency must have custody mounted, otherwise the agency is answered "not found" |
| Answer of a list | `{"items": [...]}` with the text "Found N item(s)" |
| Answer of any other tool | the object itself as structured content, with the text "<tool name> completed" |
| A refusal | a tool error carrying the message; the call does not fail at the protocol level |

## Who may call

| Caller | The two owner tools | The four resident tools |
|---|---|---|
| Owner | allowed | allowed |
| Resident of the agency | refused: instance not found | allowed |
| Seated agent | refused: forbidden; no agency permission names a custody action, so an agent role cannot be given them | refused: forbidden, for the same reason |
| Stranger, or no signed-in caller | refused: instance not found | refused: instance not found |

The owner tools are `custody_list_consent_versions` and
`custody_publish_consent_version`. The resident tools are
`custody_get_in_force_consent`, `custody_get_my_consent`,
`custody_agree_consent` and `custody_withdraw_consent`. A resident is a person
who has joined the agency without being its owner or an agent; the owner and a
seated agent also pass the resident check, the agent is then stopped by the
permission check.

## The consent gate

The gate is the rule that an actor without a live consent is refused with 403 on
the acts that need it: chat and direct-message posts, RSVP and offer of help,
form answers, check-in, read markers and declarations from a claimed respondent
(see the bundled API row in `documentation/3. implementation/build/what-exists.md`).
An agent's own post is not asked for consent.

None of the six tools is behind the gate. They are how consent is read, given
and taken back, so a resident with no consent, or with a withdrawn one, can
call the four resident tools. Their effect on the gate:

- `custody_agree_consent` opens the gate from that moment, including after an earlier withdrawal.
- `custody_withdraw_consent` closes it. Later acts that need consent are refused with 403 until the resident agrees again, and the withdrawal reaches the modules that subscribed (engage, forms and comm hide or unlink the resident's rows and keep them).

## The tools

### custody_list_consent_versions

| | |
|---|---|
| Route it wraps | `GET /instances/{agency}/custody/consent/versions` |
| Input | `instance_id`; optional `scope`, `language` |
| Answer | `items`: every version of that scope and language, newest first. Each has `id`, `scope`, `version` (`v1`, `v2`, ...), `language`, `clauses` (`key`, `text`), `translated`, `published_at`, `superseded_at` and `in_force` (true for the one published and not superseded). `published_by` is always left out |
| Who | owner |
| Gate | none |

### custody_get_in_force_consent

| | |
|---|---|
| Route it wraps | `GET /instances/{agency}/custody/consent/in-force` |
| Input | `instance_id`; optional `scope`, `language` |
| Answer | the version in force, with the fields above except `in_force`. When nothing is published for that scope and language the answer is not found, which is an ordinary state before the owner has published |
| Who | owner, resident |
| Gate | none |

### custody_publish_consent_version

| | |
|---|---|
| Route it wraps | `POST /instances/{agency}/custody/consent/text` |
| Input | `instance_id`; `text` (required, trimmed, at most 2000 characters); optional `scope`, `language` |
| What it does | creates the next version and publishes it in one step, so there is no draft left over. The label is `v<N>`, N being the number of versions already there for that scope and language, plus one. The version that held that scope and language is superseded. The text is stored as one clause with the key `consent`. The publisher is the signed-in caller and cannot be sent |
| Answer | the published version, with `published_at` set |
| Refusals | empty text or longer than 2000 characters: 400, "text is required" or "text is longer than 2000 characters"; an unknown scope: 400 |
| Who | owner |
| Gate | none |

### custody_get_my_consent

| | |
|---|---|
| Route it wraps | `GET /instances/{agency}/custody/consent/mine` |
| Input | `instance_id` only; the actor is the signed-in caller and nobody reads another person's state |
| Answer | `status`, one of `none` (never agreed), `agreed`, `withdrawn`; and, once the caller has agreed, `agreed_at`, `mechanics_version_id` and `language` |
| Who | owner, resident |
| Gate | none |

### custody_agree_consent

| | |
|---|---|
| Route it wraps | `POST /instances/{agency}/custody/consent/agree` |
| Input | `instance_id`; optional `language` (the language the caller read the sheet in), optional `structure_id` (where the record is stamped) |
| What it does | records that the caller agreed to the sheet now in force. Calling it again while the consent is live returns the standing record and writes nothing new |
| Answer | the record: `id`, `actor_id`, `mechanics_version_id`, `agreed_at`, `language`, `structure_id` |
| Refusals | no mechanics version in force in that language: 409, "no mechanics version" |
| Who | owner, resident |
| Gate | none; it is what opens the gate |

### custody_withdraw_consent

| | |
|---|---|
| Route it wraps | `POST /instances/{agency}/custody/consent/withdraw` |
| Input | `instance_id` only; nobody withdraws for someone else |
| What it does | records the withdrawal now in the database ledger and tells every module that subscribed |
| Answer | `actor_id` and `withdrawn_at` |
| Who | owner, resident |
| Gate | none; it is what closes the gate |

## Reading the tools from a screen

| Screen | Tool |
|---|---|
| The owner's consent text page: the versions and which is in force | `custody_list_consent_versions` |
| The owner's "publish new text" action | `custody_publish_consent_version` |
| The resident's sheet before agreeing | `custody_get_in_force_consent` |
| The resident's "I agree" button | `custody_agree_consent` |
| The resident's "my consent" line and the withdraw button | `custody_get_my_consent`, `custody_withdraw_consent` |

## Checked by

`code/wakala-api/internal/api/http/custody_consent_mcp_test.go` walks the
owner publishing two versions, a resident reading, agreeing and withdrawing with
a form answer refused before and after, and a stranger refused on all six. The
roster pin `testdata/mcp_roster/no-mounts.txt` lists the six names.
