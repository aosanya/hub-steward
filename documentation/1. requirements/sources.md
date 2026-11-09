# Sources

Every source a question's research used, kept after the question is settled,
one section per question. **Official** is the owner's own page (Meta, a
regulator, a statute); **secondary** is a blog, vendor or press report and is
to be confirmed against an official page before a decision rests on it.
The hackathon's own rules and event facts are in
[hackathon/details/sources.md](../../hackathon/details/sources.md).

## Q58 · WhatsApp's Meta AI options

Checked 2026-10-22. [Q58](questions.md)

| Fact | Source | Kind |
|---|---|---|
| From 15 Jan 2026 the WhatsApp Business Solution terms bar general-purpose AI assistants (ChatGPT, Copilot, Perplexity named); task-specific bots such as support, bookings and order status stay allowed; new API users from 15 Oct 2025 bound at once | [respond.io](https://respond.io/blog/whatsapp-general-purpose-chatbots-ban), [Alibaba Cloud guide](https://www.alibabacloud.com/help/en/chatapp/use-cases/whatsapp-ai-policy-2026-guide), [Gulf News](https://gulfnews.com/technology/no-more-chatgpt-and-perplexity-on-whatsapp-meta-bans-major-ai-chatbots-from-2026-1.500316016), [windowsforum](https://windowsforum.com/news/whatsapp-bans-general-purpose-chatbots-in-business-api-by-jan-2026.391291/) | Secondary |
| Meta AI is the only general-purpose assistant allowed on WhatsApp | [chatboq](https://chatboq.com/blogs/third-party-ai-chatbots-ban) | Secondary |
| The ban was lifted for the EU/EEA on 13 Jul after antitrust pressure | [foxaf](https://foxaf.com/blog/whatsapp-chatbots-2026-meta-chatgpt-policy-2) | Secondary, single source, unconfirmed |
| Meta Business Agent: Meta's own agent on a business's WhatsApp number, set up from the WhatsApp Business app's Tools; learns from past chats, website, Facebook Page, catalogs, price lists, documents, photos; tone, audience and hand-off rules | [whatsappbusiness.com](https://whatsappbusiness.com/products/business-app-ai-agent/) | Official |
| Business Agent setup takes 10 to 45 minutes; audience can be limited to new customers or ad traffic | [greentick](https://greentick.ai/blogs/meta-business-agent-whatsapp/), [wappbiz](https://www.wappbiz.com/blogs/meta-business-agent/) | Secondary |
| Business Agent launched 1 Jul 2026 as its own message category, billed per token from 1 Aug 2026 | [zernio](https://zernio.com/blog/meta-business-agent-pricing) | Secondary |
| Chats with an AI-enabled business may be used to improve Meta's models | [software.informer](https://software.informer.com/Stories/whatsapp-business-ai-agents-how-to-use-meta-business-agent-in-2026.html) | Secondary |
| WhatsApp Business Tools MCP server (Sep 2026) lets a coding agent create the account, add and verify the number, register for Cloud API access, check terms | [TechCrunch, 2026-09-15](https://techcrunch.com/2026/09/15/meta-now-lets-ai-agents-handle-the-boring-parts-of-whatsapp-business-setup/), [TechBriefly](https://techbriefly.com/2026/09/16/meta-ai-agent-whatsapp-business-tools/) | Press |
| AI Studio makes custom AI characters shared on Instagram, Messenger, WhatsApp and the web | [Meta, 2024-07](https://about.fb.com/news/2024/07/create-your-own-custom-ai-with-ai-studio/) | Official |
| AI Studio is a no-code creator tool on Llama, with no automation or tool hooks | [COEY, 2025-09](https://coey.com/resources/blog/2025/09/17/metas-ai-studio-goes-wide-custom-ais-for-instagram-whatsapp-and-messenger-but-can-you-automate-them) | Secondary |
| A WhatsApp-native AI Studio was reported in testing | [Tech Times, 2025-06](https://www.techtimes.com/articles/310622/20250604/whatsapp-ai-studio-create-your-own-custom-chatbots-via-meta-ai-coming-soon-per-reports.htm) | Press, not confirmed shipped |
| Build-vs-buy routes for a WhatsApp agent (MCP, API, no-code) | [Blueticks](https://blueticks.co/blog/whatsapp-ai-agent) | Secondary |

Not found yet: Meta's own WhatsApp Business Solution terms text, whether
Business Agent can call outside tools, its availability in Kenya and Germany,
and Meta's own pricing page.

## HS184 · Which models the Meta Model API hosts, and where the open weights run

Checked 2026-10-28. [HS184](../3.%20implementation/todo.md)

| Fact | Source | Kind |
|---|---|---|
| The Meta Model API's base address is `https://api.meta.ai/v1`; it supports the Responses API, the Chat Completions API and an Anthropic Messages-compatible endpoint | [Meta Model API docs](https://dev.meta.ai/docs/) | Official |
| The hosted text models and their ids are Muse Spark 1.3 `muse-spark-1.3` (recommended for new work, the default in Meta's examples), Muse Spark 1.2 `muse-spark-1.2`, Muse Spark 1.1 `muse-spark-1.1`, and the Contributor variants `muse-spark-1.3-contributor` and `muse-spark-1.2-contributor`, all with a 1,048,576-token context window | [Meta Model API, Models](https://dev.meta.ai/docs/models.md) | Official |
| Contributor mode may use your content for training in exchange for a lower price | [Meta Model API, Models](https://dev.meta.ai/docs/models.md) | Official |
| Muse Wonder `muse-wonder-1.0` is a preview; Muse Image `muse-image-1.0`, Muse Voice Transcribe `muse-voice-transcribe-1.0` and SAM 3.1 `sam-3.1` are hosted too and are not chat models | [Meta Model API, Models](https://dev.meta.ai/docs/models.md) | Official |
| Muse Spark Open (a mixture-of-experts model, 816B parameters with 42B active) and Muse Glimmer (distilled from Muse Spark, for self-hosting) are open-weight and are not on the Meta Model API; the page lists no API id for them, so they are self-hosted or served by a hosting provider | [Meta Model API, Models](https://dev.meta.ai/docs/models.md) | Official |
| Muse Glimmer is a 30-billion-parameter open-weight model released in August 2026 under Apache 2.0 | [Campus Technology](https://campustechnology.com/articles/2026/08/26/meta-releases-muse-glimmer-an-open-weight-ai-model-designed-to-run-on-consumer-hardware.aspx?p=1) | Secondary |
| LiteLLM lists `muse-spark-1.1` as supporting function calling, parallel function calling, structured outputs and prompt caching | [LiteLLM, Meta Model API](https://docs.litellm.ai/docs/providers/meta) | Secondary |

Not found yet: one tool call with a key from dev.meta.ai, and whether a hosting
provider such as Baseten or Modal serves Muse Spark Open or Muse Glimmer with
tool calling and under which model id.

## HS57 · How Muse Image is called

Checked 2026-10-26. [HS57](../3.%20implementation/todo.md)

| Fact | Source | Kind |
|---|---|---|
| Muse Image is served through the Meta Model API at base address `https://api.meta.ai/v1`, with the OpenAI SDK and a key from dev.meta.ai | [Meta for Developers, Build with Muse Image](https://developer.meta.com/ai/resources/blog/build-with-muse-Image/) | Official |
| `POST /v1/images/generations` makes an image from text; `POST /v1/images/edits` edits or composes images | [Meta for Developers, Build with Muse Image](https://developer.meta.com/ai/resources/blog/build-with-muse-Image/) | Official |
| The model is `muse-image-1.0`; the request takes `model`, `prompt`, `n` and an optional `size` that sets the aspect ratio; the answer holds `data[].b64_json` and a `usage` field | [Meta for Developers, Build with Muse Image](https://developer.meta.com/ai/resources/blog/build-with-muse-Image/) | Official |
| Exact text rendering varies between runs; each call is non-deterministic; $0.01 per image | [Meta for Developers, Build with Muse Image](https://developer.meta.com/ai/resources/blog/build-with-muse-Image/) | Official |
| Third-party routers list the model as `meta/muse-image` | [OpenRouter](https://openrouter.ai/meta/muse-image), [AIML API](https://docs.aimlapi.com/api-references/image-models/meta/muse-image) | Secondary; not the id used here |

Not found yet: the "Generate an image" reference page's full request schema
(dev.meta.ai `/docs/api-reference/images/create-image`), and whether the
answer can also be a signed URL.

## Q64 · Recording who has paid

Checked 2026-10-26. [Q64](questions.md), [Q65](questions.md), [HS100](../3.%20implementation/todo.md)

| Fact | Source | Kind |
|---|---|---|
| The accounting module is a double-entry ledger; the working consumer mounts it per registered agency under `/instances/{instanceID}/accounting` | [mwanachama-backend-accounting README](../../../../mwanachama-backend-accounting/README.md) | Repo |
| An entry can carry a `due_at`; the overdue read lists an account's entries past due, most overdue first | [Due dates and the overdue read](../../../../mwanachama-backend-accounting/documentation/2.%20design/due-dates.md) | Repo |
| An entry can name the charge it pays in `settles_entry_id`; the overdue read nets payments against their charges and gives `outstanding` beside the charge's `amount`; a charge with nothing outstanding is left out; a reversed payment does not count | [Due dates and the overdue read](../../../../mwanachama-backend-accounting/documentation/2.%20design/due-dates.md) | Repo |
| Not enforced: that a payment touches the charge's accounts, that it does not exceed what is outstanding | [Due dates and the overdue read](../../../../mwanachama-backend-accounting/documentation/2.%20design/due-dates.md) | Repo |
| This project's build log of 23 Oct says payments are not yet matched to the charges they settle; the design note above is later | [What was built](../../submission/documentation/04-build/01-what-was-built/README.md) | Repo |
| Each accepted form send already writes the sender's record into the lab's forms catalogue, for the group they answered through; only countable answers go in (yes or no, numbers and choices) | [Technical spec, Mwanachama modules](../../submission/documentation/03-technical-spec/02-mwanachama-modules/README.md) | Repo |
| A second send replaces the sender's record, so a paid mark set on that record would be cleared by a resend unless it is kept beside the answers | [Technical spec, Mwanachama modules](../../submission/documentation/03-technical-spec/02-mwanachama-modules/README.md) | Repo |
| The catalogue module names no domain: an entry carries a free-form document filtered by path, so a field such as a paid mark needs no change to the module | [mwanachama-backend-catalog README](../../../../mwanachama-backend-catalog/README.md) | Repo |

Not found yet: whether the deployed Mwanachama API has the settling payment, and whether the farmers' agency template switches the accounting module on. Nothing in this project takes a payment or reads a mobile-money statement.

## Q61, Q68 and Q69 · The risk-owner journey

Checked 2026-10-26. [Q61](questions.md)

| Fact | Source | Kind |
|---|---|---|
| A bow-tie puts one centre event in the middle, its threats on the left and its consequences on the right, with preventive barriers on the left and mitigating ones on the right; a safeguard is judged on its design, its coverage, whether it has been tested and the evidence that it works, and a written policy is not a barrier until there is evidence | The owner's shared conversation "Add Enterprise AI Safety Bow Tie", https://chatgpt.com/share/6adf3e7a-2560-83eb-bf01-5c41839ed633 (the page is drawn by script; its text was recovered by decoding the page's data) | The owner's own working |
| The risk manager answers the six questions the journey asks (threats, consequences, preventive measures, mitigating measures, what relies on a control, gaps) as REST addresses and MCP tools, and returns a bow-tie whole | [The risk manager's questions](../../../../mwanachama-backend-riskmanager/documentation/2.%20design/questions.md) | This organisation's own documents |
| The lab's documents are readable by every member today; each turn is sent to Meta's Model API; the agent's key reaches its own lab only | [Data and privacy](../../submission/documentation/03-technical-spec/06-data-and-privacy/README.md) | Hub Steward's own documents |
| Hub Steward's replies are visible to the whole room | Decision 5 | Hub Steward's own documents |
| The agent's key is kept from every administrator, and the choice is to be reviewed with the MCP and agents design | Decision 38 | Hub Steward's own documents |

Not found yet: the consequences side of the owner's bow-tie, which the conversation drew only as an image. The consequences in the hub's own bow-tie are
the owner's to confirm.

## Q74 · Recording who has paid, a tick or a Payments list

Checked 2026-10-29. [Q74](questions.md), related to [Q64](questions.md) and [Q65](questions.md)

Chain, link by link:

1. Screen: `2. design/studio/agency/workflow-records.html` screen 2 draws the Payments record (rows, an Add form, "Made from this record for the Group coordinator in the group order"); `workflow-edit.html` screen 1 draws a third tab, Records, beside Workflow and Steps. Decision 87 settles two tabs. Tools named: `agency_create_record`, `agency_list_records`, `agency_update_record`, `catalog_list_entries`, all marked illustrative.
2. wakala-api: no `agency_*record*` route or tool exists (`mwanachama-backend-agency/agency.operations.json` has workflow and work_item tools only). The built route is `PUT /instances/{id}/forms/{form_id}/submissions/{member_id}/paid` (`internal/api/http/forms_mark_paid_test.go`: coordinator allowed, Farmer answered as missing agency). `market_mark_paid` is also registered (`internal/api/http/mcp_tools_market.go`).
3. Module: `mwanachama-backend-forms/forms.operations.json` `forms.submission.mark_paid`; blueprint `submission.paid_at`, `paid_by`. `mwanachama-backend-catalog/catalog.blueprint.json` has `entry` (visibility, `approved_at`, `submitted_by`) and a different object also named `record` (subject_id, holder_id, scope_id, doc), which is not the design's record.
4. Storage and rights: an `entry` document change returns an approved entry to pending (`catalog.entry.upsert`), and approval is `catalog.entry.set_visibility`; which role holds that action for a hub is not declared by the design.
5. Front end: the studio has no workflows, test or records route (`mwanachama-wakala-studio/app/routes.ts`); the member app has no Manage payments route (`mwanachama-frontend-member/app/routes.ts`; only `chat/order`).
6. Agent: nothing exists for an agent to propose a row.

Answered 2026-10-29: [decision 90](decisions.md).

## Q75 · An order's version against a changed workflow

Checked 2026-10-29. [Q75](questions.md)

1. Screen: `workflow-detail.html` screen 1 (Version 2, one order started on version 1) and `workflow-records.html` screen 2 ("the order no longer has a Paid step"). Decision 72 and `2. design/market.md` (Order and Group order carry "the workflow version").
2. wakala-api: workflow and work_item tools only (`agency_*_workflow`, `agency_*_work_item`); no version tool.
3. Module: `mwanachama-backend-agency/agency.blueprint.json` `workflow` and `work_item` have no version field; the version is `agency_publication.version` with the whole workflow in `document`. `mwanachama-backend-market` is a `replace` target of wakala-api's go.mod (`../mwanachama-backend-market`) but is not checked out, so how an order stores the version could not be read.
4. Rights and storage: published documents are immutable rows; a record added in version 2 has no home for a version 1 order.
5. Front end: no studio or member route draws either.
6. Agent: unchanged.

Answered 2026-10-29: [decision 91](decisions.md).

## Q76 · A Farmer leaving a group order

Checked 2026-10-29. [Q76](questions.md)

1. Screen: `workflow-detail.html` screen 1 ("Can be called off By the Group coordinator, at any step"); `test.html` screen 1 tests a Farmer cancelling only on Buy now; `market.md` names the picker as who cancels.
2. wakala-api: `market_cancel_order` registered in `internal/api/http/mcp_tools_market.go`; `market_get_group_order`, `market_list_group_orders` exist.
3. Module: `mwanachama-backend-market` not readable here.
4. Rights: `market_cancel_order` is refused for an agent holding only `market.browse` (`market_mount_test.go`); who may call it for a group order line is not shown.
5. Front end: the member app has `chat/order` (`routes/group-order.tsx`) only.
6. Agent: the agent never cancels for a person.

Answered 2026-10-29: [decision 92](decisions.md); the Supplier-approves part is parked as Q77.

## Q78 · Where the studio's lists of choices come from

Checked 2026-10-29. [Q78](questions.md) Answered 2026-10-29: [decision 94](decisions.md).

1. Screen: `workflow-steps.html` screens 1 and 2 (Kind, Actor, Notifies, Attaches, Sends to), `workflow-records.html` (Who adds rows, Picks from); generator constants in `2. design/studio/_generator/pages_workflows.py`: `HUMAN_ROLES` (four), `ACTORS`, `NOTIFY_TARGETS`, `ATTACHMENTS`, `OPTION_SOURCES` (five), `ANSWER_TYPES` (six), `OPERATORS`.
2. wakala-api: no tool lists any of these; the only role list the agency exposes is `agency_list_roles`.
3. Module: `mwanachama-backend-agency/agency.blueprint.json` has a `role` object (name, powers, staff) and `role_assignment` to objectives only; `mwanachama-backend-forms/forms.blueprint.json` `question.answer_type` offers ten values (adds multi_select, time, photo, file) against six drawn, and has no field saying where a pick-one question's choices come from; nothing declares operators or attachments.
4. Rights and storage: roles are agency rows in a draft; the groups are the actor module's.
5. Front end: the Rider step (`pages_workflows.py` lines 250 and 255) names a role the Actor list does not contain; the app's role chips come from `kit.py` `member_roles` and `roles`, a second typed copy that also holds "Farmers' coordinator", which the studio calls "The agency".
6. Agent: the agent's tools cannot read a workflow's pickers either.

## Q79 · The Group coordinator in the app

Checked 2026-10-29. [Q79](questions.md) Answered 2026-10-29: [decision 93](decisions.md).

1. Screen: `app/` has journeys 13, 14, 16, 17 for Farmer, Supplier, Buyer and Rider; "Group coordinator" appears only as a chip or as "waiting on" in `14-supply-inputs/step-04-sees-a-group-order.html`, `13-buy-inputs/step-03-joins-a-group-order.html` and `04-chat/farm-room.html`.
2. wakala-api: market group-order tools exist per `review/step-kinds.md` and `review/workflows.md`; the market module repo is not checked out.
3. Module: the forms module sends and collects the coordinator's forms; the catalog holds Payments rows as entries.
4. Rights: who may add a row is the design's "Who adds rows" (decision 89/90); the agency `role.powers` field is the only place a power is stored.
5. Front end: `mwanachama-frontend-member/app/routes.ts` has `chat/order` and no Manage payments or coordinator route.
6. Agent: the agent proposes rows; the coordinator approves them, with no drawn screen.


## Q80 · Going back to an earlier version with orders under way

Checked 2026-10-29. [Q80](questions.md) Answered 2026-10-29: [decision 95](decisions.md).

1. Screen: `2. design/studio/agency/workflows.html` (orders under way, started on version 1) and `publish.html`; decision 91.
2. wakala-api: no route sets a channel except what the agency routes generate; no tool for go-back was found in the design.
3. Module: `mwanachama-backend-agency/publication_impl.go` `SetPublicationChannel` updates the channel column of two rows and reads no run. `mwanachama-backend-taskmanager/taskmanager.blueprint.json` `workflow_run` has no version or publication field (columns listed: name, status, trigger_event, initiator, parent and root run, failure budget, last_event_at, current_step_id).
4. Storage: publications are never deleted (`PublishAgency` only inserts and archives the channel), so an old document stays readable.
5. Front end: not read.
6. Agent: not read.

## Q81 · How soon a publish reaches members

Checked 2026-10-29. [Q81](questions.md) Answered 2026-10-29: [decision 96](decisions.md).

1. Screen: `publish.html`, `workflows.html`.
2. wakala-api: `internal/api/http/module_switch.go`: `mustBeMounted` per request, `mountedSets` map per process, `mountedModulesExpiry = 30 * time.Second`, `forget` deletes one process's entry.
3. Module: `GetPublicationForChannel` reads the whole publication row, document included, and `readMountedSet` keeps only the module set.
4. Storage: `agency_publication.channel` has a plain index, not unique (`agency.blueprint.json`).
5. Other readers of the published document: none found in the repos read.

## Q82 · A scenario that waits

Checked 2026-10-29. [Q82](questions.md) Answered 2026-10-29: [decision 101](decisions.md).

1. Screen: `test-run.html` screen 1 (Stop this run, tokens, the Supplier row "Saying yes to 8 bags").
2. wakala-api: `agency_run_scenarios`, `agency_get_test_run` are illustrative; no scenario object in `agency.blueprint.json`.
3. Module: `agency.inactivity_timeout_seconds`, `workflow_run.last_event_at`, `timeout_published`; the code that publishes the timeout was not found in the repos read.
4. Not verified: whether a clock can be passed in.

## Q83

Answered 2026-10-29: [decision 97](decisions.md).

1. Screen: `04-chat/rooms.html` (unread count per room).
2. wakala-api: comm chat routes mounted under the instance; not traced further.
3. Module: `mwanachama-backend-comm/chat_read_impl.go` `UnreadCounts` (raw SQL, left join of every group post to the reader's marker, grouped by thread) and `LatestPosts` (max created_at per thread over the same rows). Blueprint indexes on `chat_message`: (structure_id, created_at) and (thread_id, created_at); none on author_id.
4. Not verified: the size of a real room; whether the app calls it on every open.

## Q84

Answered 2026-10-29: [decision 98](decisions.md).

1. Screen: the group roster in the app (journeys 14-supply-inputs, the Manage payments list); not drawn with a page limit.
2. wakala-api: actor module mounted per agency; list route not traced further.
3. Module: `mwanachama-backend-actor/registration_impl.go` `ListGroupActors` (`group_id = ?` and `actor_id NOT IN (outsiderActors)`), `outsider_impl.go` (nested NOT IN over active seats), `actor.blueprint.json` (actor_group_assignment indexed on group_id only; role seats on actor_id, group_id, kind_id separately). Engine: `mwanachama-backend-shared/specstore/store_listcap_test.go` (S24, open: no default cap).
4. Not verified: whether the roster route applies a limit in the dispatch layer; real group sizes.

## Q85

Answered 2026-10-29 by [decision 92](decisions.md) (a Farmer changes or takes out her share until the Group coordinator sends the order); not asked again. What the order does when the coordinator removes a Farmer from the group is left to the first running workflow's later edge cases (decision 92: no edge cases now).

1. Screen: `13-buy-inputs/step-03-joins-a-group-order.html` screen 2 (Join with 2 bags: one field, Join); `14-supply-inputs/step-04-sees-a-group-order.html` screen 1 (bags so far, per-farmer lines).
2. Tools named in the captions: `market_join_group_order`; no change or take-out tool is named. The client in `submission/code/market/market.go` has `JoinGroupOrder` (line 317), `AskRevision`, `GetGroupOrder`, no leave or change call; `marketfake/rules.go` has only `market_withdraw_notice` for notices.
3. Module: the market module itself is not among the repos checked out, so the join write, any lock on the order and the Send check against the minimum could not be read. Not verified.
4. Group removal: `mwanachama-wakala-api/internal/api/http/member_removal_test.go` shows an owner removing a resident from a group keeps the agency membership; nothing found says what happens to a line in an order under way.
5. Cost note: standings are cached for at most 5 seconds (`internal/authz/cache.go` MaxTTL), so a removed Farmer may still pass the membership check for that long.

## Q86

Answered 2026-10-29: [decision 99](decisions.md).

1. Screens: `17-pick-a-rider/step-02-picks-a-rider.html` screen 1 (Waiting, with no timer, Cancel is her own button) and screen 4 (after his no, she picks another); `16-sell-the-harvest/step-03-buyer-posts-a-price-and-answers.html` screen 3 (the ask waiting for his answer).
2. Tools named: `market_ask`, `market_get_order`, `market_list_asks`, `market_answer_ask`, `market_set_availability`. The client `submission/code/market/market.go` has `Ask` (line 206), `ListAsks`, `AnswerAsk` (line 221). `type Ask` has id, poster, request, offer, picker, kind, question, answer, detail: no created time, no closing time, no state beyond the answer.
3. Module: the market module is not among the repos checked out, so whether the server stamps a time on an ask or sweeps old ones could not be read. Not verified. `mwanachama-wakala-api/internal/api/http/market_mount_test.go` mentions the tools only in a test.
4. Task manager: `workflow_run` has a failure budget and inactivity timeout in its blueprint, but no link to a market ask, so no timer is driven by it (see review/engine.md).
5. Cost note: a sweep by closing time needs an index on open asks; it runs on a clock, not on a request.

## Q87

Answered 2026-10-29: [decision 100](decisions.md).

1. Rule: `decisions.md` row 39, a tool call is checked against what the agent's agency role may do.
2. Check: `mwanachama-wakala-api/internal/api/http/agent_powers.go` `agentPowered` (lines 29 to 50): for a caller whose membership role is agent it reads the linked agency role id; when that id is empty it skips the powers lookup and falls through to the mount's own authorizer.
3. How an empty link arises: `internal/agencies/member.go` `AddMember` (lines 33 to 50) writes `AgencyRoleID` empty and defaults the role to agent; `agent_grant.go` `GrantAgentRole` is the only writer that sets it.
4. Pinned as intended: `agent_powers_comm_forms_test.go` `...LeavesOwnerAndUnlinkedAgentUnchanged` for comm, forms, sources, assets and accounting; `agency_role_link_test.go` line 88 expects an unlinked agent to show every unlocked power.
5. Cost: a linked agent costs one cached powers read per role and tenant (`caches.go` lines 59 to 73); an unlinked agent costs none.


## Q88

Parked 2026-10-29, revisit 9 Nov; the owner said it can be designed in the workflow and asked for it to be noted for review.

1. Screens: `04-chat/farm-room.html` screen 1 (the group order card with Join) and the last screen (the shop's revision, Yes and No); `13-buy-inputs/step-03-joins-a-group-order.html` screen 1.
2. Tools named: `comm.chat_message.list`, `market_get_group_order`, `market_answer_revision`. `mwanachama-wakala-api/internal/api/http/mcp_tools_market.go` mounts the market tools from `mwanachama-backend-market` (not checked out, so not read).
3. Storage: `mwanachama-backend-comm/comm.blueprint.json` `chat_message` has `attachment_kind` and `attachment_id`, both opaque, and a body that is never edited. `manager_chat.go` `PostChatMessageFor` stores them as given.
4. Read: `manager_chat.go` `ListChatMessagesFor` returns every post of the thread when no `after` is given (`chat_impl.go` `ListMessages`, no limit); it carries the reference, not the order, so each card needs a second read.
5. Front end: no file under `mwanachama-frontend-member/app` mentions an attachment; `routes/room.tsx` takes `room.messages` as initial and draws text only.
6. Not verified: any batched read of orders in the market module.

## Q89

Read 2026-10-29, from code only.

1. Screens: `studio/agency/test.html` screen 1 (Run all scenarios, "a test copy of the draft"); decision 85 in decisions.md.
2. Engine: `mwanachama-backend-shared/spec/migrate.go` `Migrate`, `migrateTable`, `createTable` (test branch adds `run_id` and a `(run_id, key)` primary key); `spec/alter.go` `AlterDDL`; `spec/spec.go` `TestSuffix`, `RunIDColumn`, `TestTableFor`; `documentation/2. design/declared-domains.md` "A test copy beside every table".
3. Counts: `*.blueprint.json` of actor (17 objects, 28 indexes), agency (18, 40), catalog (19, 20), comm (22, 30), forms (14, 18), taskmanager (21, 36): 111 objects, 172 declared indexes. Live: 111 tables, 111 primary keys, 172 indexes, 394 relations. With twins: about 788 relations, more for each unique field (a unique index on `(run_id, field)`).
4. Who builds: `mwanachama-wakala-api/internal/agencies/registry.go` `buildAgencyManager` and the sibling builders call `Provision` before returning (see performance.md, the cold-start entry). The market, voting and ai modules are not counted; the market and ai repos are not checked out for reading here.
5. Used: `specstore/store.go` `TestTable(role)` is the only reference outside `spec/`; no store reads or writes a twin, and removal of a run's rows by `run_id` is left to a test runner that does not exist (declared-domains.md, last line of the section).
6. Not verified: time of one `Migrate` on the real Postgres through the pooler; whether the six modules are all mounted per agency in the live deployment.

## Q90

Read 2026-10-29, from code only.

1. Screens: `app/17-pick-a-rider/step-02-picks-a-rider.html` screen 1 (Waiting); decision 99 (time limit set in the workflow, Closed state drawn).
2. Run record: `mwanachama-backend-taskmanager/taskmanager.blueprint.json` `workflow_run` has `last_event_at`, `timeout_published`, `paused_at`, `current_step_id`, `current_step_started_at`; indexes on `name` (unique), `status`, `parent_workflow_run`, `root_workflow_run`, `last_event_at`; none on `current_step_started_at`, none on status together with time.
3. Sweep: `workflow_run_watchdog.go` `ListWorkflowRunsStaleSince` and `ListWorkflowRunsStepStaleSince` filter on time, paused and `timeout_published`, `Limit(maxListPage)` (500, `list_limit.go`), then skip terminal runs in Go. No ORDER BY. `timeout_published` is written only by `MarkTimeoutPublished`.
4. Callers: only `mwanachama-backend-api-shared/mcp_tools_taskmanager*.go` lists them as tools; no loop that sweeps was found in any repo read, consistent with `mwanachama-backend-taskmanager/CLAUDE.md` ("the dispatcher is dropped").
5. Per agency: the board is one table set per agency (`taskmanager-mount.md` in wakala-api), so a sweep visits each agency's table set.
6. Not verified: the market module's own ask table (repo `mwanachama-backend-market` is listed in `go.mod` but not checked out); whether a run is created per ask at all.

## Q91

Read 2026-10-29, from code and the design.

1. Screens: `app/13-buy-inputs/step-03-joins-a-group-order.html` (Join form, captioned "Filled by: market_join_group_order"); `app/03-apps/form-app.html` (form type as an app, "Filled by: get_form, list_questions" and "submit_answers"); commit b001425 redrew 13 and 17 as chats with the agent.
2. Tools: grep of `mwanachama-wakala-api` and the `mwanachama-backend-*` repos for `market_join_group_order`, `market_buy_now`, `market_create_wanted`, `market_list_offers`, `market_get_order`, `market_ask`, `market_answer_revision` finds nothing; `market_answer_ask`, `market_send_quote`, `market_accept_quote`, `market_list_quotes`, `market_list_posters`, `market_get_group_order`, `market_group_order_trail`, `market_mark_paid` exist in `internal/api/http/market_*_test.go`. `get_form`, `list_questions`, `submit_answers` exist in `mwanachama-backend-forms/forms.operations.json`.
3. Studio: `studio/agency/workflow-steps.html` draws a step that sends a form the hub manager writes.
4. Cache: `internal/api/http/module_switch.go` keeps the live version's module set 30 seconds per process.
5. Not verified: the market module (`mwanachama-backend-market`, not checked out); whether a group order has a workflow run at all.

## Q92

Read 2026-10-29, from the design only.

1. Screens: `app/13-buy-inputs/step-02-buys-now.html` screens 1 to 3: "KES 3,800 a bag, the price you saw", "Shop's date".
2. Tools in the caption: `market_buy_now`, `market_ask`, `market_get_order`; none exists in `mwanachama-wakala-api`.
3. Decisions: none on a price changed between viewing and sending (searched decisions.md and questions.md for "price you saw").
4. Not verified: the market module's order and offer tables (repo not checked out).


## Q94

Read 2026-10-30, from code and the design.

1. Screen: `2. design/studio/agency/workflow-steps.html` (Group order step 4 "Sort the answers", Route, "Routes the answers of Send the invitation", rules "Match all/any", Otherwise); decision 89 (c) and decision 99.
2. Tool: no Route evaluator exists in any repo read; `agency_*` declares steps and does not execute them (see `review/engine.md`).
3. Module: `mwanachama-backend-forms/public_impl.go` `ListAllAnswers` (route `GET /forms/{form_id}/answers`, action `forms.answer.list_all`, `forms.operations.json` line 533) reads every answer of a form with only a `form_id` filter (index `form`), no limit, no paging; `answersInPromptOrder` then calls `findQuestion` for each distinct question and sorts in Go. The send path (`SubmitAnswersFor`) replaces the member's set, so an answer can change until the form closes (`hs90_edit_until_close_test.go`).
4. Storage: forms `answer` unique index `(question_id, member_id, chapter_id, period_key)` and `form` on `form_id` (`forms.blueprint.json` lines 217 to 219).
5. Missing: when a Route step runs, which answer of a farmer counts, and who calls the read. Only illustrative; nothing built.

## Q95

1. Screen: `2. design/app/18-run-a-group-order/step-03-manages-payments.html` screens 1 and 2, `step-04-sends-the-order.html` screen 1 (Manage payments reached from the order page).
2. Tool: captions name `market_list_payments` and `market_add_payment`; neither exists in `mwanachama-wakala-api` (its market tools are `market_accept_quote`, `market_answer_ask`, `market_approve_poster`, `market_cancel_order`, `market_get_group_order`, `market_list_group_orders`, `market_mark_paid` and others). The real routes are `GET` and `POST /instances/{instanceID}/live-records/{recordCode}/rows` (`internal/api/http/record_rows.go`). Illustrative.
3. Module: `mwanachama-backend-agency/agency.blueprint.json` role `record_row`: fields `record_id`, `record_code`, `role_id`, `added_by`, `answers`; indexes `record` and `record_code`. No order, run or draft index.
4. Storage: `record_impl.go` `CreateRecordRow` and `ListRecordRows`; rows are kept on the draft that was live when they were added and never copied on publish.
5. Missing: any link from a row to an order.

## Q96

1. Screen: same as Q95.
2. Tool: `agency_create_record_row` and `agency_list_record_rows` (`agency.operations.json` lines 1865 to 1909); no update or delete operation.
3. Module: `record_impl.go` `CreateRecordRow` (id minted each call, no unique key), `validateRowAnswers` (only checks the answer fits the question).
4. Route: `record_rows.go` `addLiveRecordRow` allows only the agency owner role (`callerMayAddRows`).
5. Missing: correction, retraction, a double-press guard, and any audit beyond `added_by` and `created_at`.

## Q98

1. Screen: Manage payments, ../2. design/app/18-run-a-group-order (step 3) and ../2. design/studio/agency/workflow-records.html.
2. Route: `mwanachama-wakala-api/internal/api/http/record_rows.go` `registerRecordRowRoutes` (`/instances/{instanceID}/live-records`); exists.
3. Module: `mwanachama-backend-agency/publication_impl.go` `PublishAgency` (lines 239-310) writes the publication and does not change the draft; `draft_impl.go` `validateOpenDraftID` (lines 40-52) keeps an open draft editable; `record_impl.go` `ListRecords` (line 101) reads rows by draft id.
4. Storage: records and rows are rows with `draft_id`; the publication holds a copy in `document`. The app reads the rows, not the copy.
5. Front end: `mwanachama-frontend-member/app/api/payments.ts` `loadPayments` from `routes/home.tsx` `useKeepsPayments`.
6. Missing: no rule closes or freezes a published draft; no read of the record from the document.

## Q99

1. Screen: `2. design/app/17-pick-a-rider/step-04-rider-answers-the-ask.html` screens 3 and 4 (Mark paid, then Paid); generator `2. design/app/_generator/pages_chat_ride.py` and `pages_j17_*.py` (`mark_paid` button).
2. Tool: caption names `market_mark_paid`; it appears only as a name in `mwanachama-wakala-api/internal/api/http/market_mount_test.go` line 56 and `documentation/2. design/payments-record.md` lines 5 to 7; no definition found in a non-test Go file. Treated as not confirmed.
3. Module: decision 90 and 91 in `1. requirements/decisions.md`; the studio Paid step (`2. design/studio/agency/workflow-steps.html`, step "3 · Paid", actor Supplier 1).
4. Storage: not found for a ride or Buy now order's paid mark.
5. Missing: any rule on who may confirm money for a single order.

## Q100

1. Screen: `2. design/app/18-run-a-group-order/step-03-manages-payments.html` screens 1 and 2.
2. Route: `mwanachama-wakala-api/internal/api/http/record_rows.go` `registerRecordRowRoutes`, `namesAStranger`, `rowNames`; exists.
3. Module: `mwanachama-backend-agency/record_impl.go` `CreateRecordRow`; `agency.blueprint.json` role `record_row` (no order key).
4. Storage: answers kept as text under the question prompt; the person is the caller id picked from a list.
5. Missing: a link from a row to an order lines list, so "in the order" cannot be checked. Unverified: where an order's lines live for a check.

Added 2026-11-04: the built Add payment picker (`mwanachama-frontend-member/app/routes/payment-new.tsx` line 42, `app/api/payments.ts` `loadPeople`) fills the 'Select the farmer' list from `GET /actors` (`mwanachama-backend-actor/actor.operations.json` `list_actors`, `actor_impl.go` `ListActors`: every actor, no filter, no limit) and tests only that `options_from` is not empty, so today the list offers every member of the agency whichever option the coordinator picks in Q100. The question's own text is unchanged.

## Q101

1. Screen: `2. design/studio/agency/test.html` screen 1 (scenario table, Not run yet), the Publish page in decision 82 d.
2. Route/tool: `agency_run_scenarios`, `agency_list_scenarios` are named in the captions; the Test agent's run is a background job (decision 102); not traced to a wakala-api route in this run.
3. Module: `mwanachama-backend-agency/scenario_travel_impl.go` lines 20 to 30 (copy into a new draft) and 103 to 125 (apply a document): every scenario is written with `Result: models.ScenarioNotRun`. `scenario_sendback_impl.go` `sendBackInDraft`, `scenarioUses` (send back only the scenarios that show a changed thing) and `checkScenarios` (line 174: a scenario not Passed is an error issue). `publication_impl.go` `PublishAgency` runs `validationErrors` first.
4. Storage: `agency.blueprint.json` roles `scenario` (result, last_run_id), `test_run` (draft_id, draft_version, steps); the published document carries scenarios without result (`scenario_travel_impl.go` `scenarioDocuments`).
5. Front end: the Test page and the Publish page are drawings; not built.
6. Missing: nothing stores that a published version passed all its scenarios other than the publish gate itself; a fork cannot read a pass from the document.

## Q102

1. Screen: `2. design/studio/agency/test-run.html` screen 1, `test.html` screen 1, the Publish page of decision 82 d.
2. Route: the Run all call is illustrative in the captions; the executor is wired in `mwanachama-wakala-api/cmd/server/testruns.go` (`testRunSeat.build`) and `internal/agencies/test_copy_stage.go` (`TestCopy.Stage`); exists.
3. Module: `internal/testruns/stage.go` `Ready` (only module `market`), `Respond` (send group order, ask the buyer; word match on `block.Action`); `mwanachama-backend-agency/scenario_sendback_impl.go` `checkScenarios`.
4. Storage: `test_run` rows in the agency blueprint (`result`: waiting, running, passed, failed, stopped).
5. Missing: a result for "cannot be played"; play for forms, comm, catalog, taskmanager. Unverified: whether `ModulesTouched` lists forms for a fill-form block.

## Q103

1. Screen: `2. design/studio/agency/test-run.html`, `test-failure.html` screen 1.
2. Route: as Q102.
3. Module: `internal/testruns/judge.go` `judge`, `agent.go` `playBlock`, `act.go` (maxMoves 6), `aimodel.go` `AIMeter`.
4. Storage: `test_run.steps` JSON holds expected and found per step.
5. Missing: a deterministic check; any record that a verdict came from a model. Unverified: model temperature (the ai module is not checked out).

## Q104

1. Screen: `2. design/studio/agency/workflow-steps.html` screen 2 (Who is told), `publish.html` (What is not published).
2. Route: `PUT /instances/{instanceID}/notification-rules/{event}` (`mwanachama-wakala-api/internal/api/http/notification_rule_routes.go`, owner only); applied on use in `market_announced.go` `toldOf`, `internal/agencies/ask_closed.go`, `rooms.go`, `room_recipients.go`.
3. Module: `internal/notifyrules/rules.go` (18 events, 6 audiences), `store.go` `Rule`, `Stored`, `Put`; no agency-module operation.
4. Storage: `agency_notification_rules`, primary key (instance_id, event), AutoMigrate at start, outside the draft and the publication.
5. Missing: a draft copy of the rules, a place for them in `mwanachama-backend-agency/document.go`, a line for a changed rule in What is not published. The studio's Who is told picker (decision 94) reads roles and groups, not the six audiences.

## Q105

1. Screen: `2. design/studio/agency/workflow-steps.html` screen 2 (Kind picker), `publish.html`.
2. Route: the draft step create and update operations in `mwanachama-backend-agency/agency.operations.json`, mounted per instance by `mwanachama-wakala-api`. The run side of a `run_workflow` step has no route or tool in `mwanachama-wakala-api` (only `internal/api/http/instance_import_steps.go` reads the field).
3. Module: `workitemstep_impl.go` lines 121-135 (self-run refused, existence checked); `issue_impl.go` lines 178-200 (the scan loads all work items and workflows, checks that run and cancel targets exist); `models/workitemstep.go` `StepKindRunWorkflow`.
4. Storage: `run_workflow_id` and `cancel_workflow_id` on the draft's work item rows, copied into the published document by `document.go`.
5. Missing: a cycle check over run and cancel edges at save or in the scan; any run depth guard; any engine that starts the child run. Nothing here was run.


## Q106

1. Screen: `2. design/app/03-apps/form-app.html` screen 3 (After sending), journey `25-send-a-report` step 3.
2. Route: the caption names `submit_answers` (forms); `mwanachama-wakala-api/internal/api/http/reports_routes.go` mounts a different path, the catalog's anonymous `catalog.suggestion.file`.
3. Module: `mwanachama-backend-forms/forms.blueprint.json` send object, lines 225 to 240: no reference, no due date; `mwanachama-backend-catalog/catalog.blueprint.json` suggestion fields: title, why, source, status, priority.
4. Storage: nowhere for a due date or a reference string; send ids are opaque.
5. Missing: a reference counter for a send, the two durations, a clock that notices a missed one. Illustrative: all three in `app/_generator/pages_form_app.py` lines 13 to 15. Nothing was run.

## Q107

1. Screen: `2. design/studio/agency/modules.html` screens 1 and 2 (the switch writes into the working draft); Publish page of decision 86; `2. design/app/18-run-a-group-order/step-03-manages-payments.html`.
2. Route and gate: `mwanachama-wakala-api/internal/api/http/module_switch.go` (`mustBeMounted`, `readMountedSet`, 30 second `agencyMountedSets`; `GetPublicationForChannel` reads the whole publication, document included, once per 30 seconds per agency per server); 15 callers of `mustBeMounted` outside tests.
3. Module: `mwanachama-backend-agency/module_impl.go` (`SetModuleEnabled`, `effectiveModules`, `withEffectiveEnabled`), `agency.blueprint.json` module and work_item indexes (draft, code, draft with code unique; work_item has an index on draft_id but none on kind, so `draftStepKinds` filters kind after the draft index; small, read when the Modules page opens).
4. Storage: a module's flag lives on the module row of the draft and in the published document; no run row names a module or a version (`mwanachama-backend-taskmanager` workflow_run, see engine.md).
5. Missing: a link from a run to its version, a count of runs by module at Publish, a clear of the gate cache at Publish. Existing and not illustrative: the Modules page's tools `agency_list_modules`, `agency_set_module_enabled`. Nothing was run.


## Q108

1. Screen: `2. design/studio/agency/publish-review.html` (a finding row with Apply, Details, Dismiss); `2. design/agency-review.md` steps 3 and 4 and the `review_finding` table.
2. Route and tool: `mwanachama-wakala-api/internal/api/http/review_runs.go` (`POST /instances/{instanceID}/review-runs`, MCP `agency_run_review`); Apply runs the finding's own `tool` and `arguments` as the Chat response tab does today.
3. Module: `mwanachama-backend-agency/agency.blueprint.json` `review`, `review_area`, `review_finding` (fields `tool`, `arguments`, `then_steps`, `status`, `fate`), `review_start_impl.go`, `review_read_impl.go`.
4. Storage: findings keep no hash, version or read time of the draft; `review.started_at` is the only time.
5. Missing: a check at Apply. Existing: `last_updated` on draft rows. Nothing was run.

## Q109

1. Screen: none drawn in this repo; the launch is started by the agency shop (`mwanachama-wakala-api/internal/api/http/launch.go` header names the website).
2. Route: `POST /launch` (`beginLaunch`, line 101) answers 202 with status `creating` and runs `Runner.Run` in a goroutine detached from the request, 20 minute limit (`launchTimeout`); progress through `launchlog`.
3. Module: none; `internal/launch/launch.go` `run` (grant, document, `SpendGrant`, token exchange, `chooseTarget`, `CreateProject` or existing, `SetProject`, `Ready`, create-user function, `SetCredentials`, `Import`, `secure`, `SeedUserSQL`, `RestrictNetwork`, `SetStatus ready`); `Run` records `failed` on any error.
4. Storage: the shop database `launch_grant` (`used_at`) and `launched_agency` (`shopdb/shopdb.go` lines 85 and 100); the project itself lives in the customer's account.
5. Missing: a resume point, a delete of the made project, a sweep of rows left `creating`. Existing: `SetProject` before the slow steps, so the project is traceable. Not read: the idempotence of `Import` (`apihttp.ImportIntoLaunched`) and `create_user`. Nothing was run.

## Q110

1. Screen: `2. design/studio/agency/agency-detail.html` (objective, workflows and steps, "each with its roles and their labels"); `2. design/studio/agency/workflow-steps.html` screen 2 (Actor select).
2. Route and tool: `agency_set_raci`, `agency_list_role_assignments_for_work_item`, applied through the approvals path in `mwanachama-wakala-api/internal/api/http/approvals_apply_raci.go`; import in `instance_import.go` line 362.
3. Module: `mwanachama-backend-agency/agency.blueprint.json` `work_item.role_id` (the one acting role), `role_assignment` (label only, unique `role_label_unique`), `workflow_objective` (unique `wf_obj_unique`); `roleassignment_impl.go`, `workflowobjective_impl.go`, `issue_impl.go` `checkWorkflowObjectives`; `document.go` lines 100 and 132 carry both lists into the document.
4. Storage: two separate tables; no link between the acting role and any label row.
5. Missing: any reader of the labels at run time, any check that the acting role holds a label, a studio field to set a label on a step. Existing: label rows, objective links, the scan rule that a workflow has no objective. Nothing was run.

## Q111

1. Screen: `2. design/app/18-run-a-group-order/step-01-sees-what-waits.html` screen 1; `2. design/app/02-home/home.html`; `1. requirements/decisions.md` 54, 94, 112.
2. Route and tool: `PUT` of an agency role on a member in `mwanachama-wakala-api/internal/api/http/agency_role_link.go`; the open-steps read of decision 112 was not found in the repos read (the member app checkout has no coordinator route).
3. Module: `internal/agencies/member.go` `memberRow` (one `AgencyRoleID`), `SetAgencyRole`, `AgencyRoleOf`; `caches.go` `Standing`; `mwanachama-backend-agency/role_brief_impl.go` resolves a role by id or code from the production document; `agency.blueprint.json` `role` has name, permissions and staff, no person link; the actor module's `ListRoleAssignmentsForActor` serves a different role list.
4. Storage: `agency_instance_members` in the registry database.
5. Missing: any link from a human member to an agency role, more than one role per person, the Users page control for it. Existing: the link for an agent, one role. Nothing was run. Q72 was not found in the questions file; only references remain (`decisions.md` 94, `3. implementation/todo.md` HS165 and HS268).

## Q112

1. Screen: `2. design/app/16-sell-the-harvest/step-03-buyer-posts-a-price-and-answers.html` screen 1; decision 99.
2. Route and tool: market ask creation wrapped by `mwanachama-wakala-api/internal/api/http/market_ask_run.go` `CreateAsk`.
3. Module: `internal/agencies/ask_run.go` `StartAskRun`, `firstTimedYesNoStep`; the task manager's `StartWorkflowRun` and `BeginWorkflowRunStep`; `step_limit.go` sweep; `workflow_run` index `step_due`.
4. Storage: `workflow_run` per agency, named `ask-<ask id>`; the ask lives in the market module (not checked out).
5. Missing: a link from an ask to its workflow, a retry of a failed start, a sweep for asks with no run. Existing: the clock, the sweep, the index. Nothing was run.

## Q113

1. Screen: `2. design/studio/agency/workflow-steps.html` screens 1 and 2 and `test-blocks.html` draw no tool field; `test-run.html` screen 1 shows a run.
2. Route and tool: the Run button reaches wakala-api's test runner (`internal/testruns/act.go` `act`, `namedTool`); Publish goes through `internal/api/http/definition_role_kinds.go` `rolesPublished.PublishAgency`.
3. Module: `mwanachama-backend-agency` `agency.blueprint.json` line 246 (`work_item.tool`), `workitemstep_impl.go` `validateStepTool`, `document.go` lines 88 and 348, `publication_impl.go` line 118; the scan files read no tool.
4. Storage: one string on the work_item row and on the document's step and the scenario block.
5. Missing: a drawn field, a check that the name exists and that the role may use it, any read at live run time. Existing: the test-time check against the role's allowed tools. Nothing was run.

## Q114

1. Screen: `2. design/studio/agency/test-blocks.html` and `test-run.html` screen 1 draw the actors and the result; no screen shows a role's permissions against a block.
2. Route and tool: the Run button reaches wakala-api's test runner (`internal/testruns/agent.go` `RunReporting` line 62, `stage.go` `Derive`, `allowedActions`, `Tools`; `act.go` `namedTool`).
3. Module: `mwanachama-backend-agency` permission catalog (`agencymodels.LookupPermission`), role permissions loaded in `cmd/server/testruns.go` line 135.
4. Storage: none new; derived permissions live in memory on the run's stage.
5. Missing: a check of a block's tool against the role's own permissions. Existing: the role's real permissions, merged with the block's own. Nothing was run.

## Q115

1. Screen: `2. design/app/03-apps/apps.html` and the journey 18 step 1 Start card; the drawn design has no state for an open order.
2. Route and tool: the built Apps page (`submission/code/app/src/pages/apps/AppsPage.tsx`) calls `mcpAgencyClient.read` (`agency/modules.ts`: `agency_get_agency`, `agency_list_modules`) and `mcpStartClient.waiting` (`coordinator/start/api.ts` lines 58 to 66: `agency_list_my_open_steps`, `market_list_group_orders`, `agency_get_agency`). `agency_list_my_open_steps` and `market_start_group_order` exist in no checked-out backend (only named in `mwanachama-wakala-api/internal/testruns/endpoint.go`); decision 113 says HS275 follows.
3. Module: market module not checked out; agency has no open-steps operation yet.
4. Storage: none read.
5. Front end: `start.test.tsx` lines 185 to 202 pin the hide rule. `market_list_group_orders` is called unbounded from five screens (`buy/orders/api.ts` 114, `sell/now/api.ts` 147, `supply/groupOrder/api.ts` 69, `market/api.ts` 87, `coordinator/start/api.ts` 60).
6. Missing: a decision on how many orders a coordinator may have open; the filter by coordinator. Existing: the hide rule in the app. Nothing was run.

## Q116

1. Screen: `2. design/app/03-started/started.html` screens 1 and 2 (rows Open, Requested, Asked; empty state), decision 115.
2. Route and tool: the caption names `market_list_group_orders`, `actor_list_my_join_requests`, `market_list_posters`, `actor_list_joinable_groups`, `actor_list_my_groups`. The built app has no Started route yet (`mwanachama-frontend-member/app/routes/` lists none). `actor_list_my_join_requests` exists (`mwanachama-backend-actor/actor.operations.json` line 899, every request in any state, oldest first, caller bound). `market_list_posters` is gated by `market.browse` (`mwanachama-wakala-api/internal/api/http/market_mount_test.go` 45 to 54); whether an applicant holds it was not checked.
3. Module: actor join request with decline and reason (`join_decision_impl.go`); market module not checked out.
4. Storage: no row for "a workflow begun" exists; Started is assembled from five module lists, not from runs.
5. Notice: `notifyrules/rules.go` has `JoinDeclined`, `SupplierApproved`, no refusal event.
6. Missing: the ended state of a request on Started; a refusal event for a supplier application. Existing: the join decline event. Nothing was run.

## Q117

1. Screen: `2. design/app/05-inbox/inbox.html` screens 1 to 4 (`_generator/pages_inbox.py`: joined, invited and form rows only).
2. Route: `GET /notifications` (`comm.operations.json` `list_notifications`, limit default 200 in `models/notification.go`), mounted per agency by wakala-api.
3. Module: comm `notification` role has no title or body; `civic.comm.json` declares 32 events, 12 categories, 25 subject kinds.
4. Raisers: `internal/agencies/ask_closed.go`, `case_notices.go`, `internal/api/http/market_names.go`, `member_removal.go`.
5. Front end: `mwanachama-frontend-member/app/notification-text.ts` (9 event titles, 8 categories, none for market, task, case, item, post), `routes/inbox.tsx` `opensAt` (6 events open a place), `api/inbox.ts` `mutableCategories` (5 mutable categories, market not among them).
6. Missing: a title, a line and a target for the workflow-step events. Existing: the three drawn rows. Nothing was run.

## Decision 123 · Chat workflows

Checked 2026-11-02. [Decision 123](decisions.md). Five read-only research reports came first; the notes are kept in the session's scratchpad and summarised here. The vendor documentation pages are official; the three blog posts are secondary and are to be confirmed against an official page before a decision rests on them. The Agentforce and Slack rows of the comparison came from search summaries, and one Trailhead page answered 404.

1. Agency backend (read in `mwanachama-backend-agency`, `mwanachama-wakala-api`): `models/workflow.go:3-20` (a workflow has no type, icon or actor), `models/workitem.go:3-28`, `models/workitemstep.go:7-19` (one role and one of six kinds for a step), `issue_impl.go:176-179,226-229` (a workflow with no objective, and one with no work items, block Publish), `publication_impl.go:35-38,394` (the publish hash covers only today's fields), `module_impl.go:130-137` (modules switch on from step kinds), `role_brief_impl.go:64-81` (the role brief is built from steps), `internal/api/http/caller_open_steps.go:75-103` (the open-steps read lists steps only), `internal/testruns/agent.go:18,135` (a scenario with no steps stops). Options for where a type lives: fields on the workflow, a `chat` step kind, a companion object like Record. Chosen: a locked first step.
2. AI and chat runtime (read in `mwanachama-backend-ai`, `mwanachama-backend-comm`): `ai.blueprint.json` (an AI role holds a prompt, an account, limits and a link to an agency role, and no tools), `chat.go:46` (tools arrive with every model call), `comm.blueprint.json` (a chat message is a body and an opaque attachment pair; no prompts, cards or forms), `documentation/2. design/subject-threads.md` (a private thread per subject), `documentation/2. design/gaps.md` (polling only, no chat tools over MCP).
3. Live phone app (`submission/code/app/src`): `home/cards.ts:8-9`, `App.tsx:88-89`, `apps/thread/marketSource.ts:5-11,49-52`, `apps/thread/sellSource.ts:115-121`, `apps/blocks/types.ts:1,13-17`. The chat is a script with keyword matching and no model; every card button leaves the chat for a page; the agent's name is passed only in tests.
4. Console patterns (`documentation/2. design/studio/_generator`): `pages_workflows.py:679,786,70-75` (tabs Workflow, Steps, Records; a step's Actor list holds no AI role), `pages_agency.py:116,130-152` (each human role lists its agents), `pages_settings_detail.py:54-58` (an agent's Instructions read the work items that serve its objectives), `pages_test_scenarios.py:252` (blocks are a workflow's steps). Decisions 72, 84, 86, 87, 89, 94, 99, 103, 105, 106, 112, 113, 114, 118.
5. Prior art, how conversational builders let a designer define a chat flow (no product read marks a chat-driven item in a list; the closest precedent is a type filter or separate groups):
   - Official: https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-create-edit-topics
   - Official: https://learn.microsoft.com/en-us/microsoft-copilot-studio/configure-starter-prompts
   - Official: https://learn.microsoft.com/microsoft-copilot-studio/authoring-test-bot
   - Official: https://docs.cloud.google.com/dialogflow/cx/docs/concept/playbook
   - Official: https://docs.cloud.google.com/gemini-enterprise-cx/cx-agent-studio/flow
   - Official: https://trailhead.salesforce.com/content/learn/modules/agent-builder-basics/customize-agent-topics (answered 404 on the day)
   - Official: https://www.intercom.com/help/en/articles/7836459-workflows-explained
   - Official: https://intercom.com/help/en/articles/10032299-use-fin-ai-agent-in-workflows
   - Official: https://botpress.com/docs/studio/concepts/nodes/autonomous-node/
   - Official: https://www.voiceflow.com/docs/documentation/build/overview
   - Official: https://www.rasa.com/docs/studio/build/flow-building/trigger-flows.md
   - Official: https://slack.com/intl/en-in/help/articles/32843655109395-Use-AI-to-build-Slack-workflows
   - Official: https://help.zapier.com/hc/en-us/articles/35859160812685
   - Secondary: https://validity.com/blog/top-6-learnings-from-building-my-first-agentforce-agent
   - Secondary: https://www.eesel.ai/blog/landbot
   - Secondary: https://www.salesforce.com/blog/ai-implementation-pitfalls/
   The smallest common set across them: a name, one or two sentences on when it is used, instructions with what the agent must not do, the short list of things the agent may do, and a test window beside the form. An opening line and tappable prompts are optional in nearly all.

## Q118
- mwanachama-backend-agency/agency.blueprint.json: work_item kind enum has no chat value; tool is a single string; workflow has no opens-in field (checked 2026-11-02).
- mwanachama-wakala-api/internal/api/http/ai_gateway.go (aiGatewayCaller, seatBriefSource) and agent_permissions.go (allowedActions, agentPermissioned): an agent's reach is its role's permission codes, its brief is the role brief; no step is read.
- meta-global-ai-hackathon-community-hubs documentation/2. design/studio/agency/workflow-chat.html screens 2 and 3 and decisions 123, 131, 122.
- Chain: screen (drawn, illustrative tools) exists; tool agency_list_module_tools is illustrative and exists nowhere; blueprint has no field for the chat step's tool list, can-start list or opens-in; the chat runtime (ai module) is not checked out, so how a turn chooses its tools is unverified.

## Q119
- mwanachama-backend-actor/join_impl.go lines 274-352 (ApproveJoinRequest, decide: mustLead check, state=pending compare-and-swap, ErrJoinRequestDecided) and leader_impl.go (leadsIn, mustLead, ListGroupLeaders): any active seat of a role kind with leads_group may decide.
- mwanachama-backend-actor/actor.blueprint.json role_kind (leads_group boolean, capabilities list never read in Go) and seat (actor_id, group_id, kind_id).
- mwanachama-wakala-api/internal/agencies/join_threads.go line 82 (IsGroupLeader for the join thread).
- decisions 126, 128, 130, 133; 05-inbox/inbox.html; 04-chat/group-page.html.
- Chain: join request and decide exist; two leaders cannot both decide; a Vice Admin as a second leader seat exists; an Admin being away, an order between leaders or a takeover time exist nowhere.

## Q120
- mwanachama-backend-actor/registration_impl.go lines 84-99 (Deregister deletes the registration row only), removal_impl.go (RemoveFromGroup ends active seats with reason eviction and inserts a group_removal receipt), role_assignment_impl.go lines 57-82 (StepDownRole, deactivateRole), leader_impl.go lines 36-89 (leadingSeats, leadsIn: active seat of a leading role kind, no registration test).
- mwanachama-wakala-api/internal/agencies/rooms.go lines 87-124 (inRoom reads registrations through groupsOf; leadsRoom calls IsGroupLeader) and groups.go lines 22-44 (groupsOf).
- 2. design/app/04-chat/group-page.html (Leave group, Confirm); decisions 129, 130, 133.
- Chain: the Leave button is drawn; no leave operation is declared in actor.operations.json; Deregister exists in the manager but is not an operation; a leave built on it leaves the seat and splits the two room checks; no last-leader guard exists.

## Q121

- mwanachama-wakala-api/internal/controlenforce/enforce.go, log.go (whole package); grep of every .go file for `controlenforce` finds no importer outside the package.
- mwanachama-wakala-api/internal/api/http/ai_parts.go lines 20-45 (controls become instruction text); internal/api/http/approvals_apply_groupgate.go lines 44-75 (the gate is keyed on tool names); internal/reviewruns/risks_reader.go (reads controls.approve only for the review).
- mwanachama-backend-agency/models/control.go (strength, on breach, operator, workflow id).
- 2. design/studio/agency/controls.html (C-1 and C-2 as Enforced).
- Chain: page draws Enforced and Block (exists as a drawing) -> agency_list_controls and the published document hold the fields (exists) -> enforcer compares a call to the controls (exists, unused) -> no call site, no persistent log (missing) -> the agent sees only text (exists). The ai and market modules are not checked out, so a second enforcement point there could not be ruled out.

## Q122

- mwanachama-wakala-api/internal/api/http/member_invite.go (handle, admit), member_invite_batch.go (handleBatch, accountFor, sentEmails, sendPaced), member_signin.go (magicLinkSender, reserve, release, sendReserved, magicLinksInFlight 16, magicLinkSendTimeout 15 s), invitation_mail.go (describe, deliver, sendMailReserved).
- mwanachama-wakala-api/internal/invitemail/invitemail.go (Compose) and smtp.go (Send).
- mwanachama-backend-actor/invitation_batch_impl.go lines 140-175, models/invitation_batch.go, actor.blueprint.json group_invitation.
- 2. design/studio/people/members.html (Invite a user button, screens 1, 2, 4).
- Chain: button drawn (exists as a drawing) -> POST /instances/{id}/invitations/batch (exists, no studio page) -> account and admission per row inside the request (exists) -> invitation row, status Sent (exists) -> mail in a goroutine, result only logged (exists, no stored outcome, lost at restart) -> batch mail has no sender and responsibility text (missing; the single route has it).


## Q123

- mwanachama-wakala-api/internal/languages/languages.go, store.go (whole files); internal/api/http/language_routes.go (all six routes); internal/api/http/translation_routes.go (`draftTranslations`, `agencyContentLanguages`).
- mwanachama-backend-forms/forms.blueprint.json lines 14, 236, 264-280 (language on form and send, role translation, indexes subject_language and form_language).
- mwanachama-backend-agency/agency.blueprint.json (grep for language and translation: no hit); testdata/hub-demo/*/agency.json.
- mwanachama-frontend-member/app/languages.ts, i18n/ (labels only).
- 2. design/studio and 2. design/app: no page names content languages.
- Chain: the hub manager lists languages (route exists, no studio page) -> assistant drafts translations (route exists, stores nothing) -> a text per step field and language (missing in the agency module; exists in forms for forms only) -> Publish freezes it (missing: languages live in a side table) -> the app shows it (labels only; no mark for an untranslated text).

## Q126

- mwanachama-wakala-api/internal/reviewruns/model.go lines 41-56 (AIModel.Complete: GetDefaultAccount then ChatAccount, tokens read into the result only); internal/reviewruns/pieces.go, service.go (AIResolver).
- mwanachama-wakala-api/internal/testruns/agent.go lines 195-215 (complete: Meter.Check, Model.Chat, Meter.Record), aimodel.go lines 10-47 (NewAI leaves RoleID empty; a Record error aborts the run after the paid call).
- mwanachama-wakala-api/internal/agencies/token_budget.go, scenarios_at_once.go (per-call account read for the budget; accounts listed for the lowest scenarios-at-once).
- grep of every .go file for RecordUsage, CheckLimits, ChatAccount, ListUsage: only testruns and reviewruns call them; no call site passes a kind of work or a person.
- 2. design/usage.md, decision 162, 2. design/studio/settings/usage-work.html, board HS741 to HS743.
- Chain: the donut draws Agency review (drawing) -> ai_usage_breakdown (built in the AI module per the board, not checked out, not read) -> usage rows with kind and person (HS741, not read) -> the review's call (exists, no check, no record from this repo). The AI module is not checked out, so whether counting happens inside ChatAccount is unverified.

## Q127

- mwanachama-wakala-api/cmd/server/main.go lines 196-230 (resolver over shopdb, `accounts.NewRouter(reg, resolve, accounts.OpenPostgres, 32, ...)`).
- mwanachama-wakala-api/internal/accounts/router.go lines 60-190 (`Router`, `pick`, `pooledFor`, `openFor`, `drop`), pool.go (AccountPool 12 connections, TenantLimitFromEnv).
- mwanachama-wakala-api/internal/agencies/registry.go lines 180-199 (`NewRegistry`: AutoMigrate of the instance and member tables on every open).
- mwanachama-wakala-api/internal/session/cached.go and session.go (sign-in check, ledger read, touch).
- Chain: a request names an account (exists) -> `resolutions` cache of at most 5 seconds says whether the account has its own database (exists) -> pooled registry found or opened under one mutex (exists; dial and migrate inside the lock) -> oldest of 32 closed to make room (exists; no check for requests still running on it) -> module managers built per agency on top (traced earlier, Q89).

## Q128

- mwanachama-wakala-api/internal/agencies/schedule_sweep.go (Sweep, sweepRepeatingTasks, sweepStandingMessages, RunScheduleSweep), cmd/server/schedule_sweep.go (interval 5 minutes, SCHEDULE_SWEEP_INTERVAL).
- mwanachama-backend-taskmanager/repeating.go, repeating_store.go (MakeRepeatingTaskDue, ListRunningRepeatingTasks, StopRepeatingTask, periodMade), taskmanager.blueprint.json lines 1375-1515 (repeating_task and repeating_task_period indexes).
- mwanachama-backend-comm/standing_impl.go (SendDueStandingMessages); mwanachama-backend-shared/recur, specstore/store.go (DefaultListCap, cappedQuery); mwanachama-wakala-api/internal/api/http/journey_45_repeating_test.go.
- Grep for CapLists in wakala-api, taskmanager and comm: no caller, so lists are uncapped.
- 2. design/studio/agency/workflow-*.html and 2. design/app: no page names a schedule or a repeating start.
- Chain: a clock tick (exists, 5 minutes) -> repeating task period (exists, makes a plain task) -> workflow run start (missing; only a buyer's ask starts one) -> pinned published version (would follow StartAskRun) -> Ongoing list (exists for runs).

## Q129

- mwanachama-backend-agency/bowtie_scan.go (checkBowties, checkBowtie, checkPartControls, warnUnguarded), issue_impl.go (scan severities), publication_impl.go (publish gate on severity error), document.go lines 129-175 and 273-278 (risks in the published document), agency.blueprint.json risk, risk_pathway, risk_threat, risk_consequence.
- mwanachama-wakala-api: grep for risk readers finds only internal/reviewruns, approvals_apply_risk.go and instance_import.go; no run-time reader.
- 2. design/studio/agency/bowties.html, publish.html, generator pages_risks.py.
- Chain: bow-tie screens (drawn) -> agency risk objects in the draft (exist) -> scan at publish (exists, warnings only) -> published document (carries them) -> run time (nothing reads them).

## Q130

- mwanachama-backend-actor/definition_role_impl.go (SyncDefinitionRoles, retireDroppedKind), documentation/2. design/definition-roles.md, role_assignment_impl.go (GrantRole needs a live group), role_holder_impl.go, actor.blueprint.json actor_role_assignment indexes.
- mwanachama-wakala-api/internal/api/http/definition_role_kinds.go (rolesPublished.PublishAgency, SetPublicationChannel, syncDefinitionRoleKinds), caller_roles.go (heldRoleKeys), membership.go line 30; mwanachama-backend-agency/agency.operations.json publish and set_publication_channel.
- 2. design/studio/agency/roles.html, publish.html.
- Chain: Roles page (drawn) -> definition role in the draft (exists) -> Publish on a channel (exists) -> role kind sync (exists, any channel, only logged on failure) -> seats ended (exists, no count shown) -> rollback by channel move (exists, no sync, seats not restored) -> member app open-steps read by held role (exists).

## Q131

- mwanachama-frontend-member/app/routes/inbox-preferences.tsx, app/api/inbox.ts (mutableCategories, loadPreferences, setMuted), app/i18n/en.ts (category labels), app/routes.ts line 27.
- mwanachama-backend-comm/notification_impl.go (Raise, refuseIfMuted, IsMuted, SetPreference, ListPreferences), manager.go (SetNotificationPreferenceFor), models/notification_category.go (join_requested category, unmutable event list), comm.blueprint.json and civic.comm.json (notification_preference category values).
- mwanachama-wakala-api/internal/notifyrules/rules.go (JoinAsked, JoinApproved, JoinDeclined, FormSent FixedMute), mutable.go (Mutable), store.go (Stored, Rule), internal/agencies/registry.go line 538 (UseMutable).
- 2. design/app/05-inbox: no mute or settings screen drawn.
- Chain: Inbox settings screen (built, not drawn) -> comm preference row per actor and category (exists, unique on actor and category) -> Raise checks the preference and the agency rule before inserting (exists; a muted line is dropped, not stored) -> leaders' join-asked line is membership and mutable (exists). Nothing tells her the switch also covers requests waiting on her.


## Q132

- mwanachama-frontend-member/app/routes/group-settings.tsx, app/api/join-requests.ts (loadGroupSettings, ledGroups, setGroupOpen, setGroupHidden), app/routes.ts line 19.
- mwanachama-backend-actor/join_impl.go (SetGroupJoinMode, SetGroupHidden, setGroupColumn, join, joinOpen, settlePendingJoinRequest), actor.blueprint.json (join_mode, hidden), actor.operations.json (set_group_join_mode).
- mwanachama-wakala-api/internal/api/http/group_leaders.go (groupInPath fence on set_join_mode and set_hidden), resident_actor.go.
- 2. design/app/04-chat/group-page.html: no settings screen drawn.
- Chain: group settings screen (built, not drawn) -> PUT join-mode or hidden (exists, leader fenced) -> one column update, pending requests untouched (exists) -> pending requests settle only on the person's own join or a leader's decision. Nothing tells the waiting people or the leader.


## Q133

- mwanachama-wakala-api/internal/api/http/mcp_body_guard.go (guardMCPBody, measureJSON), limits.go (maxMCPBatchElements, maxRequestBody), bodylimit.go, mcp.go (registerMCPRoutes), mcp_batch_cost_security_test.go (WK69), router.go line 78 (withTenantSlot).
- mwanachama-wakala-api/internal/dbpool/gate.go (DefaultTenantLimit, DefaultMaxWait, Acquire), internal/accounts/pool.go (pool sizes).
- 2. design/app/18-run-a-group-order/step-03-manages-payments.html: the page a member waits on.
- Chain: agent POST /mcp with a batch (guard caps at 16, exists) -> each message runs a tool concurrently (per the WK69 test) -> agency manager bound to the tenant -> gate allows 4, admits a waiter after 10 s (exists) -> member's read queues in the same gate. Missing: any separation of agent and member share.

## Q134

- mwanachama-frontend-member: app/routes.ts, app/routes/group-order.tsx (the only group-order route is the priority picker, not a join page).
- meta-global-ai-hackathon-community-hubs: submission/code/app/src/buy/join/api.ts (join, answerRevision, findMyOrder), GroupOrderPage.tsx (OpenOrder, Revision, Confirmed).
- 2. design/app/16-sell-the-harvest/step-02-sells-together.html, 13-buy-inputs step 3, decisions 69 and 70.
- mwanachama-wakala-api: internal/testruns/endpoint.go (market_join_group_order), internal/api/http/approvals_apply_groupgate.go (the send, call-off and paid appliers).
- Chain: screen caption (market_join_group_order) -> built page button 'Change my bags' -> tool call to the market module -> market module not checked out, so the order-state check on a join is unread. Exists: the button and the revise step. Missing: any drawn state for a change or a withdrawal, and any statement of what Send freezes.

## Q135

- mwanachama-frontend-member: app/chat/share-offer.ts, app/chat/ShareCard.tsx, app/chat/ThreadView.tsx (line 178), app/languages.ts.
- mwanachama-backend-comm: comm.blueprint.json (chat_message fields attachment_kind, attachment_id, indexes thread_created).
- meta-global-ai-hackathon-community-hubs: 2. design/app/components.html, _generator/pages_components.py (line 110), 3. implementation/todo_done.md (HS70, HS94).
- Chain: offer message in the trade thread (text from the farmers agent, not checked out) -> app regex reads quantity, price, currency and close time out of the sentence -> ShareCard buttons post plain words back -> the agent reads the words. Exists: the card, the pointer columns on the message. Missing: any decision that the sentence is a contract, any translation of it, any server-side closing time the card reads. Unverified: whether the agent can set the pointer.

## Q136

- mwanachama-wakala-api: documentation/2. design/assetmanager-mount.md, documentation/2. design/agent-role-permissions.md (Not built; the asset tools line), internal/api/http/assetmanager_routes.go, mcp_assets_permissions.go, internal/api/http/testdata/agencies/siaya-lab/agency.json.
- mwanachama-backend-agency: models/permissions_catalog.json (line 65, asset.manage).
- meta-global-ai-hackathon-community-hubs: 2. design/app/02-member/step-04-asks-which-equipment-is-theirs.html, _generator/pages_chat_lab.py (lines 8, 29, 123), decisions 16 and 25.
- Chain: chat question -> Assets Keeper agent (not a role of the lab's agency.json) -> assetmanager tool (exists on /mcp as assetmanager tools, guarded by guardToolPermissions) -> permission asset.manage (only permission; read and write bundled) -> holds/movements read (module not checked out; holder filter unverified). Exists: the mount, the tools, one bundled permission. Missing: the Assets Keeper role, a read-only permission, a caller-bound read. Illustrative: the caption names only chat tools.


## Q137

- mwanachama-backend-agency: agency.blueprint.json (roles review, review_area, review_finding, indexes draft and running_unique, lines 692 to 745), review_start_impl.go (StartReview), review_record_impl.go (RecordReviewArea, settleReview), review_read_impl.go (ListRunningReviews), review_areas.go.
- mwanachama-wakala-api: internal/reviewruns/service.go (Start, Resume), runner.go (Launch, claim, review, settleFailure), cmd/server/reviewruns.go (resumeReviews, reviewResumeDelay 10 seconds).
- meta-global-ai-hackathon-community-hubs: decisions 105 and 107, 2. design/agency-review.md.
- Chain: Run review button -> StartReview inserts review (running) and one review_area per part (reading) -> Runner.Launch runs one reviewer per part in the process -> RecordReviewArea writes findings and settles the review when no part is reading. Exists: all of it, plus a resume at boot. Missing: a stop time for a part that never answers, and a claim that works across replicas. Not read: the AI module (not checked out), so whether the model call has its own timeout is unknown.

## Q138

- mwanachama-backend-comm: push_delivery.go (raised, deliver, record), push_impl.go (SubscribePush, ListPushSubscriptions, RecordPushDelivery, PrunePushDeliveries), webpush.go (Send, pushTTL, publicOnlyClient), manager_push.go (UseWebPush, DrainPushes, PushDeliveryRetention), comm.blueprint.json (push_subscription and push_delivery indexes, lines 1270 to 1345).
- mwanachama-wakala-api: internal/agencies/registry.go (UseWebPush per built manager), internal/agencies/schedule_sweep.go (prunePushDeliveries).
- Chain: Raise inserts the notification -> onRaised starts a goroutine -> deliver lists the actor's subscriptions -> Send once per subscription -> one push_delivery row per attempt. Exists: all of it, plus a 90-day prune in the schedule sweep. Missing: any retry of a failed push, any reader of failed rows, a payload that names the agency. Not read: the browser or the push service's own behaviour.

## Q139

Repos and files read: mwanachama-backend-comm (`moderation_impl.go`, `moderation_dismissal_impl.go`, `models/moderation.go`, `comm.blueprint.json` report, removal and dispute, `comm.operations.json` list_report_queue); mwanachama-frontend-member (`app/api/inbox.ts`, `app/api/generated/comm.ts`, route list); design `2. design/app/04-chat` (no report or withheld screen found).

Chain: screen (none drawn for report, queue or dispute) -> route `GET /groups/{structure_id}/moderation/reports` exists in the operations file -> store `ListReportQueue` exists -> tables report, removal, dispute exist -> app: only the removal receipt in the Inbox is built. The rights check on the queue route and the studio side were not read.

## Q140

Repos and files read: mwanachama-backend-forms (`public_impl.go` ResolveLinkKey, OpenPublicLink, RegisterRespondent, UpsertRespondent, DeclareChapter; `declarable_impl.go`; `forms.blueprint.json` public_link, respondent, declaration; `routes/routes.go` AnonymousActions); mwanachama-wakala-api (`internal/api/http/anonymous_door.go`, `limits.go`, `signin_guard.go`, `forms_routes.go`, `internal/throttle/window.go`).

Chain: shared link tap -> register respondent (route exists, guarded 60 a minute per address in memory) -> declare group (guarded) -> answer. Open and questions reads exist and are not guarded. Missing: any removal of unclaimed respondents, any proxy-aware address. Not read: the deployment (proxy, replica count).

## Q141

Repos and files read: mwanachama-backend-agency (`record_row_correction.go` settleReplacement, refuseDuplicate; `record_impl.go` CreateRecordRow, ListRecordRows; `store.go` insert; `agency.blueprint.json` record_row); mwanachama-wakala-api (`internal/api/http/record_rows.go`); mwanachama-backend-api-shared (`audit_impl.go`, `gormstore/auditevent.go`; `go.mod` of wakala-api does not require it).

Chain: Manage payments correction (screen drawn) -> route `live-records/{code}/rows` with `replaces` (exists) -> `CreateRecordRow` (exists, check then insert, no transaction, no unique key) -> table record_row (indexes record, record_code, record_order; none on replaces or created_at). Missing: an atomic one-correction rule. Not read: how the app screen shows a refused correction.

## Q142

Repos and files read: mwanachama-frontend-member (`app/forms/drafts.ts`, `send.ts`, `outbox.ts`, `useOutbox.ts`, `Review.tsx`, `kept.ts`; `pwa/worker.ts`, `pwa/plugin.ts`, `app/pwa/register.ts`); mwanachama-backend-forms (`public_impl.go` SubmitAnswersFor, `submission_impl.go` writeSubmission, `forms.blueprint.json` indexes, `documentation/3. implementation/todo.md` F36, F37).

Chain: Send on the answer screen -> `sendAnswers` writes the draft to localStorage (result ignored) -> `post` (claim, then `submitAnswers`) -> on network failure or 408, 429, 5xx the outcome is `queued` and the draft is rewritten as `waiting` -> `useOutbox` retries every 60 seconds and on the online event. Exists: the queue, the retry, the notice. Missing: a check that the draft was kept, an idempotency key on the send (safe today only because a send replaces the whole set per form, member, group and period). Not read: the browser's quota behaviour on real phones.

## Q143

Repos and files read: mwanachama-backend-comm (`comm.blueprint.json` chat_message, `manager_chat.go` PostChatMessageFor, inThread, inStructure, `chat_impl.go` Post, `validate.go`); mwanachama-wakala-api (`internal/agencies/rooms.go` belongingIn, authorKindIn, inRoom; `groups.go` groupsOf; `caches.go` standingOf; `internal/api/http/limits.go`); mwanachama-backend-actor (`registration_impl.go` ListGroupsForActor, `actor.blueprint.json` actor_group_assignment); mwanachama-frontend-member (`app/chat`).

Chain: message box in a room (drawn) -> comm.chat_message.post (exists) -> belonging check (one actor_group_assignment query by its key, uncached), thread read twice, author kind from the cached standing, then one insert -> table chat_message (index thread, created_at). Missing: any length rule on body, in the spec, the manager or the phone box.

## Q144

Repos and files read: mwanachama-backend-taskmanager (`workflow_run_step_limit.go`, `workflow_run.go` saveRun, `store.go` encode, `taskmanager.blueprint.json` workflow_run step_due index, CLAUDE.md); mwanachama-wakala-api (`internal/agencies/step_limit.go`, `ask_closed.go` by reference, `cmd/server/step_limit_sweep.go`, `documentation/2. design/step-limit-sweep.md`); mwanachama-backend-agency (`publication_impl.go` GetPublication, findPublicationBy).

Chain: a step with a time limit (drawn, decision 99) -> `limitedBoard.BeginWorkflowRunStep` reads the limit from the pinned published version -> `BeginWorkflowRunStep` writes `step_due_at` -> a person answers (`UpdateTask`/`MoveTaskToState` -> `AnswerWorkflowRunStep`) or the minute sweep (`SweepStepLimits` -> `CloseWorkflowRunsPastLimit` -> `closePastLimit`) closes it and `tellClosedAsks` raises the notice. Exists: all of it. Missing: any condition on the closing write or the answer write, any lock between replicas.

## Q145

Repos and files read: mwanachama-backend-forms (`results_impl.go`, `forms.blueprint.json` result_report, `forms.operations.json` publish_results and read_latest_results); mwanachama-wakala-api (`internal/api/http/results_announcements.go`, `cmd/server/selftest/selftest_results_published.go`); mwanachama-frontend-member (`app/notification-text.ts`, grep of `app/` for a results read); the design `05-inbox/inbox.html`, `06-forms/forms.html`.

Chain: coordinator publishes the results of a closed form (no drawn screen in either surface) -> forms `PublishResults` stores a git path and commit, version = count + 1 -> wakala-api `announceResults` raises `results_published` per member -> Inbox row text exists in the app -> tap: no route reads `results/latest`, nothing drawn. Exists: the record, the read route, the notice. Missing: any screen that shows a result, any place the report text itself is kept.

## Q146

Repos and files read: mwanachama-backend-forms (`paid_impl.go`, `submission_impl.go` writeSubmission and GetSubmission, `manager.go` replace, replaceTx and take, `forms.blueprint.json` submission fields and indexes, `forms.operations.json` mark_paid); mwanachama-wakala-api (`internal/api/http/forms_mark_paid_test.go`, which pins who may mark and not a concurrent send); mwanachama-frontend-member (`app/api/generated/forms.ts`, the only mention of the route).

Chain: the Group coordinator taps Paid on a row (drawn, Manage payments) -> `PUT /forms/{form_id}/submissions/{member_id}/paid` -> `MarkPaid` read and whole-row write; a Farmer's Send again -> `SubmitAnswersFor` -> `writeSubmission` read and whole-row write in a transaction. Exists: both writes, the permission, the test of who may mark. Missing: any condition on either write, any test that a send leaves the mark alone while the two run together.

## Q147

Repos and files read: mwanachama-wakala-api (`internal/agencies/report_promises.go`, `internal/api/http/promise_outcome_route.go`, `publish_promises.go`, `report_promises_routes.go`), mwanachama-backend-taskmanager (`models/task.go` CanTransitionTo, `overdue.go` ListOverdueTasks and closedStatuses, `task_impl_task.go` ListTasks and UpdateTask, `list_limit.go`, `taskmanager.blueprint.json` task context column).

Chain: publishing results with promises -> `surveysAnnounced.filePromises` -> `PromisesAsTasks` creates one pending task per promise, the link (form, report version, who answers) written as JSON into `context` -> a resident reads `GET` report with promises -> `ReportPromises` lists the board and filters in Go -> the operator (owner or agent role only) records an outcome -> `RecordPromiseOutcome` rewrites `context` and leaves the status alone -> `ListOverdueTasks` still lists the task. Exists: all of it. Missing: any link between outcome and task status; no studio or app screen that draws the promise list (only the route). Not read: the studio code for the task board (no screen draws promises).

## Q148

Repos and files read: mwanachama-backend-agency (`agency.operations.json` agency.work_item.update, `workitem_impl.go` UpdateWorkItem, `store.go` writeUpdate, `models/workitem.go`), mwanachama-backend-shared (`dispatch/bind.go`, `specstore/store.go`), mwanachama-wakala-studio (`app/chat/useAgencyDashboard.ts` around line 1420, `app/chat/tool-helpers.ts`).

Chain: studio chat Edit Work Item -> tool `agency_update_work_item` with title, description, workflow and ordinality only (exists) -> operation bound whole, no merge (exists) -> `UpdateWorkItem` copies code, draft, created-at, validates, `writeUpdate` writes every declared column by id only (exists; no version compare anywhere) -> `sendBack` resets the step's scenarios (exists). Missing: any partial update, any stale-save check. Not traced: the studio step editor's own save body.

## Q149

Repos and files read: mwanachama-backend-agency (`agency.blueprint.json` role measure, `agency.operations.json` set_measure and list_measures, `measure_impl.go`, `models/measure.go`, `document.go`, `publication_impl.go` contentHashFor), mwanachama-wakala-api and mwanachama-wakala-studio (searched for any writer of the reading or any measure screen).

Chain: Add an objective card (`agency_set_measure`, exists) -> measure row with name, target, unit, status (exists) -> `current` reading (column exists; nothing writes it) -> published document and change hash carry `current` (exists). Missing: any producer of the reading, any declared source for a measure, any studio measure screen. Illustrative: the caption "Counted from the farmers in Users".

## Q150

Repos and files read: mwanachama-backend-agency (`agency_impl.go` UpdateAgency and findAgency, `agency.operations.json` update_agency, `document.go` buildDocument and applyDocumentToDraft, `publication_impl.go` contentHashFor and PublishAgency, `import.go`), mwanachama-wakala-api (`internal/api/http/approvals_apply.go` applyUpdateAgency, `internal/reviewruns/profile.go`).

Chain: Profile page rename (`agency_update_agency`, exists, no draft argument) -> approval apply calls UpdateAgency (exists) -> the single agency row is rewritten at once (exists) -> the next document build and hash read the live row for every draft (exists). Missing: any draft-scoped profile, any entry for the rename in a draft's changes, any restore of the name from a version. Illustrative: the captions "in the draft" and "the published version stays until you publish" on screens 3 and 4. Not traced: where the member app and the hub list read the agency name from.

## Q151

Repos and files read: mwanachama-backend-agency (`actor_pick_impl.go`, `picker_impl.go`, `workitemstep_impl.go` lines 185 to 215, `issue_impl.go` line 349, `publication_impl.go` line 390, `models/picker.go`), mwanachama-wakala-api (`internal/agencies/picker_groups.go`, `internal/agencies/registry.go` line 296, `internal/api/http/caller_open_steps.go`), mwanachama-backend-actor (`group_impl.go` ListGroups), mwanachama-backend-shared (`specstore/store.go` list cap), decisions 94, 112 and 113, `studio/agency/workflow-steps.html` screens 1 and 2.

Chain: the Who does it dropdown (`agency_list_pickers`, exists, returns roles, groups and the agency) -> a step saved with that id in `role_id` (`UpdateWorkItem` accepts a group id through `actorOfDraft`, exists) -> the scan and Publish accept it (exists) -> the published step is read for a person by `caller_open_steps.go`, which keeps a step only when its id is in the roles the person holds (exists, roles only) -> the person's Start list and Do Something. A group id never matches a role, so the step reaches nobody. Missing: any rule saying who in a group may act.

## Q152

Repos and files read: mwanachama-backend-agency (`agency.blueprint.json` record role line 572, `models/record.go`, `record_impl.go` lines 34 and 35, `record_issue_impl.go` line 83, `document.go` lines 114 and 367, `publication_impl.go` line 139), mwanachama-wakala-api (`internal/api/http/record_rows.go` `liveRowsOf`, `rowNames`, `callerMayAddRows`; no other file reads the field), mwanachama-frontend-member and mwanachama-wakala-studio (searched `viewer_role`, `Who sees`: no match), studio design `workflow-records.html` and `pages_workflows.py` (commit 8b2c508).

Chain: Who sees rows dropdown (drawn; no tool named) -> `viewer_role_id` on the record (column, validation, scan and document carry exist) -> published document and hash carry it (exists) -> row read for a caller (`liveRowsOf`, exists) ignores it and shows a row to the adder or to a person a picked-from-a-list answer names (exists). Missing: any read of the viewer role, any save check that the record has a question naming a person. Illustrative: the studio dropdown itself, which no studio code writes.


## Q153

Repos and files read: mwanachama-frontend-member (`app/routes/home.tsx`, `app/api/forms.ts`, `app/forms/` listing), mwanachama-wakala-api (`internal/api/http/form_thread_landing.go`, `market_ask_run.go`, `ai_gateway.go`, `ai_chat_stamp.go`, `ai_weekly_limits_test.go`), mwanachama-wakala-studio (`app/chat/providers/chat-completions.ts`), this repo (`2. design/gaps.md`, decisions 123 and 147, board rows HS566 and HS643, `2. design/app/02-do-something/do-something.html`, `02-member/step-01-asks-a-question-in-chat.html`).

Chain: Ask in Chat button on the empty Start card (drawn, decision 147, HS566) -> Chat tab room of the agency (exists, comm) -> a member's post stored by comm (exists) -> something reads the post and calls the model (missing: only HS643 plans it; no starter in wakala-api reacts to a chat post) -> the model call goes through the AI gateway (`/v1/chat/completions`, exists, stamped as chat with the person) -> the account's weekly request and token limits are checked (exists, tests only; module unread) -> the reply is posted (missing) -> what the member sees when the check refuses (not drawn, not decided; HS643 lists it as open and calls it daily).

## Q154

Repos and files read: mwanachama-backend-forms (`forms.blueprint.json`, `models/answer.go`, `models/files.go`, `approval_impl.go`, `public_impl.go`), mwanachama-frontend-member (`app/forms/controls.tsx`, `app/forms/answers.ts`), mwanachama-wakala-api (`internal/api/http/form_answer_lines.go`, `internal/specs/`, `cmd/server`), this repo (studio and app generators searched for a photo question).

Chain: a form question of type photo or file (forms module accepts it, exists) -> studio picker for the answer type (offers no photo; not drawn) -> member app answer control (returns nothing for photo and file, missing) -> upload of the picture (no files module checked out, none mounted, missing) -> file ids stored on the answer (column exists, opaque) -> capture proof set by the host (`captured_file_ids`, nothing sets it) -> the coordinator's read of the answers (shows '<n> attached' only, `form_answer_lines.go` line 84, no way to open a file).


## Q155

Repos and files read: mwanachama-wakala-api (`internal/api/http/voting_routes.go`, `membership.go`, `operation_routes.go`, `mcp*.go` searched, `internal/agencies/registry.go`, `caches.go`, `mounts.go`, `internal/notifyrules` searched, `go.mod`), mwanachama-frontend-member (`app` searched for polls), this repo (`studio/_generator/pages_modules.py` line 19, decisions and questions searched; decision 17 is issue votes, a different thing).

Chain: Modules page row "voting" (drawn, off) -> polls REST routes per agency (`voting_routes.go`, exist) -> manager built and tables created on first call (`buildPollManager`, exists) -> agent tool to create a poll (no voting tool in any `mcp_*.go`, missing) -> notice to the people it reaches (no notify rule, missing) -> Do Something card, Inbox row, answer screen in the member app (none, missing) -> the module's reach and count rules (module not checked out, unread).

## Q156

Repos and files read: mwanachama-backend-engage (`engage.blueprint.json`, `engage.operations.json`, `post.go`, `notice.go`, `documentation/2. design/engage.md`), mwanachama-backend-agency (`models/modules_catalog.json`, `models/permissions_catalog.json`, `models/module.go` MaxMountsFor), mwanachama-wakala-api (`go.mod`, `internal/api/http/studio_journey_14_modules_test.go`, `documentation/3. implementation/todo.md` row WK209, search for engage in all Go files), meta design (`2. design/studio/agency/modules.html`, `2. design/app` searched for notice, event, volunteer).

Chain: Modules page (no Engage row drawn) -> agency module catalog entry `engage`, mount `main`, off (exists) -> posting permissions notice.post, event.post, volunteer_call.post naming `engage.post.create` (exist) -> wakala-api mount (missing: no go.mod line, no registry builder, row WK209 on hold) -> list of posts for a member's groups (missing: no operation; groups are a JSON column) -> notification to the people reached (host raises comm events per engage.md, not built) -> phone screens (none drawn, none built).

## Q157

Repos and files read: mwanachama-backend-engage (`volunteer.go` PickOffer, `notice.go` MarkRead, CountUnread, `engage.blueprint.json` indexes, `store.go`, `manager.go`), mwanachama-backend-shared (`specstore/store.go` DefaultListCap, CapLists, cappedQuery, List).

Chain: Pick tap -> `PickOffer` (reads the offer, reads an existing pick, counts picks, inserts; no transaction; exists) -> unique index on (post_id, offer_id) only (exists; does not bound the count) -> unread badge -> `CountUnread` (lists all sent notices and all of the caller's markers, filters groups in Go; exists, uncapped because `CapLists` is never called by this module).

## Q158

Repos and files read: mwanachama-backend-permissions (`permissions.blueprint.json`, `grant.go`, `access.go`, `action.go`, `permissions_manager.go`, `list_cap.go`), mwanachama-wakala-api (`internal/api/http/caches.go`, `record_grants.go`, `authorize.go`, `internal/authz/cache.go`), mwanachama-backend-shared (`specstore/store.go` DefaultListCap).

Chain: access given in the app or studio -> CreateGrant (exists; refuses a duplicate, reinstates a withdrawn row) -> grant row keyed (subject, scope, partition, role_code) with `deleted`, `granted_by`, `granted_at`, `ends_at` (exists) -> WithdrawGrantIn sets `deleted` only (exists; no who, no when) -> reinstate overwrites giver and date (exists) -> history list of access (missing: no table, no route). Illustrative: no screen draws a history of access.


## Q159

Repos and files read: mwanachama-backend-market (`group.go` `viewAll`, `assembleView`, `ListGroupOrdersBy`, `GroupOrderTrail`; `workflows.go` `nameOf`; `market.blueprint.json` indexes), mwanachama-wakala-api (`internal/agencies/groups.go` `namesIn`, `registry.go` lines 636 to 655), design `_generator/pages_do_something.py`, `pages_j18_run_a_group_order.py` (tool `market_list_group_orders`), decisions.md 70.

Chain: Do Something and the supply journeys call `market_list_group_orders` (exists; named in the captions) -> `ListGroupOrdersBy` (page 50 default, 200 largest) -> `viewAll` loads all lines of the page's orders in one query (uncapped) -> per order `assembleView`, one `nameOf` per visible line -> `namesIn` one `GetActor` each, error swallowed to an empty name. The list needs only total and count, which `assembleView` computes in Go from the same lines. Missing: a grouped sum, a batched name read. Read from code, not measured.

## Q153 (addendum, 2026-11-08)

Also read: mwanachama-backend-ai (`usage.go` `windowStarts`, `RecordUsage`, `sum`, `checkLimits`, `limitSpecs`; `usage_hold.go`; `usage_day.go` `recordDay`; `chat.go` lines 50 to 90; `weekly-limits.md`; `ai.blueprint.json` usage objects). Chain: chat call -> `HoldRequest` (limit check, per account and role) -> refusal `ErrLimitReached` with the owner-and-limit sentence -> nothing in the checked-out code turns that into a post in the room (HS643 is planned). The week is rolling, so 'until Monday' was not right.

## Q160

Repos and files read: mwanachama-backend-market (`orders.go` `BuyNow`, `CancelOrder`, `MarkPaid`, `visibleOrder`; `manager.go` `update`, `updateGroupFrom`; `workflows.go` `gate`, `workflow`), mwanachama-wakala-api (`internal/agencies/registry.go` lines 630 to 655). Chain: Cancel or Mark paid tapped in 13-buy-inputs step 2 -> market tool (exists; named in the captions) -> `CancelOrder` or `MarkPaid` -> read order, gate by the workflow (always the built-in, nothing calls `UseWorkflows`), state check (`Placed` for a cancel, none for Mark paid) -> whole-row `update` by id with no state condition -> `order` row. Missing: a state condition on the write and a rule for cancel after paid; the group order has both.

## Q161

Repos and files read: mwanachama-backend-market (`orders.go`, `asks.go` `AnswerAskWithMinutes`, `workflows.go` `closeYeses`, `market.blueprint.json` yes indexes), mwanachama-wakala-api (grep for yes delivered: none). Chain: ask answered yes -> `yes` row open (exists) -> `BuyNow` with `yes_id` (exists; checks open and same poster, does not consume) -> `CancelOrder` -> `closeYeses` by picker and poster (exists; broad). Missing: a state change on the yes when an order uses it, and a cancel limited to the order's own yes.

## Q162

Repos and files read: mwanachama-backend-riskmanager (`riskmanager.blueprint.json` objects and indexes, `gaps.go`, `gaps_bulk.go`, `queries.go`, `manager.go` `listOf`, `documentation/2. design/gaps.md` Scale), mwanachama-wakala-api (`internal/api/http/membership.go` `riskManagerFor`, `mcp_tools_risk.go`, `documentation/3. implementation/risk-manager-mount.md`), mwanachama-backend-agency (`models/modules_catalog.json`).

Chain: studio Risks pages, then agency draft `risk` and `risk_pathway` objects, then the publication document: exists (mount page, Risks inside the draft). Register: `/instances/{id}/risks/...` and `riskmanager_*` tools, per agency tables, members only: exists. Link between the two: missing; the register blueprint names no agency code, publication or version. App screen for the register: none drawn. The mount page's 'module code not yet in the catalogue' is stale (`modules_catalog.json` line 17). The plain-language question was checked against decisions.md: no decision on the register.
