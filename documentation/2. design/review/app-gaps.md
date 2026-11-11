# App gaps

Fill list: one entry for each gap inside the member app design, biggest first. Each says the person, the journey and step, the screen to draw, where it comes from, and whether it can simply be drawn.

Status
73. A Farmer, 13-buy-inputs step 2 (Buy now, the order card with Cancel) and the Supplier's Mark paid in 14-supply-inputs step 4: the design draws Cancel and Mark paid side by side with no state for an order already paid or already cancelled, and no card for a yes that was called off by another order's cancel. Screens to draw once decided: the order card after Mark paid (Cancel gone, a line 'Paid, ask the Supplier to change it'), the Supplier's card refusing Mark paid on a cancelled order, and the yes row marked Called off. Needs an owner decision. Turned into Q160 and Q161. Open.
72. A Farmer, 05-inbox and 02-do-something (engage module, `mwanachama-backend-engage`): a notice, an event with I'm going and check-in, and a call for volunteers have no row, card or screen in the app design and nothing is built; the module also has no list of posts. Screens to draw once decided: Inbox rows for a post, and a post detail with Mark read, I'm going or Not going, Offer to help; for the Group coordinator a way to post and pick. Needs an owner decision. Turned into Q156. Open.
71. A Farmer (any member of a group a poll is put to), Do Something, Inbox and a screen to answer (studio `modules.html` voting row, `mwanachama-wakala-api/internal/api/http/voting_routes.go`): the polls routes are mounted but the app draws no poll card, row or answer screen, and no notify rule or agent tool exists for polls. Screen to draw: a poll card in Do Something and an answer-and-count screen in the form-answer pattern; needs an owner decision first. Turned into Q155. Open.
70. A Farmer, 06-forms answer a form (and the Group coordinator reading the answers): the forms module takes photo and file questions, with a file limit and a 'taken now' rule, but the built app draws no control for them (`mwanachama-frontend-member/app/forms/controls.tsx` `AnswerControl` returns nothing) and counts them unanswered (`app/forms/answers.ts` `isAnswered`), so a required one blocks Submit; the design draws only text boxes and the studio offers no photo type; the coordinator's read shows only '<n> attached'. Screens to draw once decided: the photo question with Take photo and Choose file, the uploading and failed-upload lines, and the coordinator's attachment row. Turned into Q154. Open.
69. A Member with nothing to start, 02-do-something Start, empty card (decision 147): the card's Ask in Chat button leads to the Chat tab where the lab's agent is to answer, but nothing in the checked-out code reads her post and starts the agent (board row HS643, planned), and no screen shows what she sees while it works, when it is slow, or when the agent's weekly allowance is used up. Screens to draw once decided: the room with the agent's waiting line and the allowance-out line. Needs an owner decision, turned into Q153. Open.
68. Any member, Home and 02-do-something (commit e50e1ba, HS1021): the design now draws the Forms card only for a member with a form waiting or answered, but the built Home always draws it (`mwanachama-frontend-member/app/routes/home.tsx` line 56) and the condition is not free: it needs the waiting list (3 reads per open form, `mwanachama-backend-forms/waiting_impl.go` `waitingRow`) and the answered list (every send she ever made, `answered_impl.go`, no limit) read on every Home open, which today costs Home no forms read. Nothing to draw; the build needs one cheap yes-or-no read (see performance 75). Open; can simply be drawn (already drawn).
67. A Farmer or a Supplier, 18-run-a-group-order step 3 (Manage payments) and the Payments row: the studio's Who sees rows is saved and not applied, so which rows a non-adding role sees is undrawn; the app shows a row only to the person it names. Screen to draw once decided: the Manage payments list as the Supplier sees it (rows that name her, or none) and the empty state 'No payments recorded for you'. Turned into Q152. Open.
65. Any member, 05-inbox row 'results published' (`mwanachama-backend-forms/results_impl.go`, `mwanachama-wakala-api/internal/api/http/results_announcements.go`, `mwanachama-frontend-member/app/notification-text.ts` line 20): the backend tells every member of the chosen groups that results are published and serves the record at `results/latest`, but the app has no screen that reads it and the design draws none; the record is a git path and commit, not text. Screen to draw: a results detail from the Inbox row in the Answered read-back pattern. Turned into Q145 for what she sees. Open.
66. Any member, 02-do-something Start list, workflow-steps.html screen 2 (Who does it picker, decision 94): the studio picker offers the agency's groups as the one actor of a step, but the Start list is built from the roles the person holds, so a step whose actor is a group is shown to nobody; no screen says so and nothing in the studio warns. Needs an owner decision, turned into Q151. Open.
64. Any member, 06-forms Answered (`06-forms/forms.html` screens 3 and 4, `_generator/pages_forms.py`): the Answered list draws a title and a sent day, but the built app also has the read-back page of her own answers (`routes/form-answers.tsx`: each question with her answer, a 'Skipped' line for an unanswered one), an Edit send link under a card while the form is open and its send is not locked (`forms/edit.ts` `canEditSend`, decision 41), a 'Changes close <date and time>' line, a 'Final' tag once it cannot be changed (a form composed locked after send, or closed), and a month-grouped page 'Every form you answered' (`routes/answered.tsx`). The design draws the button for that page and none of these four screens. Screens to draw, copied from the Forms card pattern: (a) the read-back page, question above answer, Skipped in the quiet colour, Edit at the foot only while open; (b) an Answered card with its 'Changes close' line and Edit link; (c) an Answered card marked Final; (d) the month-grouped history. Decision 41 backs all four; can simply be drawn. Open.
63. Any member, 04-chat rooms and 05-inbox (built `api/inbox.ts` line 98 reads the removed-message receipt; `mwanachama-backend-comm/moderation_impl.go` holds report, queue, removal, dispute): the whole moderation chain exists in the backend and the app has only the receipt line. Screens to draw: a Report on a post in the room (reason list, note), the Group coordinator's queue of reported posts with Withhold and Leave standing, a withheld post as the author sees it, and Ask for a second look with its statement and outcome. Turned into Q139. Open.
62. A Member, 02-member step 4 (screen 1, `_generator/pages_chat_lab.py` lines 29 and 123): the Assets Keeper answers 'which equipment is mine' but is not a role of the lab's agency.json (the page's own note says so), the caption lists chat tools only, and the one asset permission bundles read with write. Screen to draw: none new; the caption needs the assets tool and the role, and the answer needs an empty state ('You hold nothing yet'). Turned into Q136. Open.
61. A Farmer, 13-buy-inputs step 3 and the trade thread (built `chat/share-offer.ts`, `ShareCard.tsx`, `ThreadView.tsx` line 178): the order card exists only when the supplier's message matches one English sentence, so a reworded or translated message shows no card, and 'closed' is decided by the phone clock. The design draws the card (`components.html`) but not the state without it. Screens to draw: the thread when the offer is plain text, and the closed state read from the order. Turned into Q135. Open.
60. A Farmer, 13-buy-inputs step 3 and 16-sell-the-harvest step 2 (screen 3 'After joining', `_generator` journey pages): the built page offers 'Change my bags' on an open order and the design draws no screen for changing or taking back a line, nor for the state after Send ('Closed to changes'). Screens to draw: the line with a Change button, the field prefilled with her bags, and the closed state. Needs an owner decision on what Send freezes. Turned into Q134. Open.
59. Any member, Profile and Signed-in devices (built `routes/profile.tsx`, `routes/sessions.tsx`, routes `home/profile` and `home/sessions`): both screens exist in the app and no page in `2. design/app` draws them. Profile shows first and last name with a Save, the member code and a card into the devices list; the devices list shows one row per session with when and what device, 'This device' on the current one and Sign out on each other one (`api/sessions.ts` reads `GET /me/sessions`, ends one with `DELETE /me/sessions/{id}`; the session in use is refused with 409 in `session_routes.go` `endOwnMemberSession`). States nobody drew: the list when the session functions are not applied (503), a device already gone (404 treated as ended), the failed-save banner. Screens to draw from the existing list-row and banner patterns. Can simply be drawn; the name rule (who sees it) is the profile page's own caption. Open.
58. A Group Admin, group settings (built `routes/group-settings.tsx`, route `home/join-requests/:groupId/settings`): the screen with 'How people join', the group code and 'Who finds this group' is drawn nowhere, and `04-chat/group-page.html` is the only group page drawn. The way in from the join requests page, the two segmented switches, the failed-change banner and the state after the switch are the screens to draw; what the switch does to people already waiting is Q132. Turned into Q132 (the waiting-requests part); the drawing itself can simply be drawn. Open.
57. Any member, 05-inbox Notification settings (built `routes/inbox-preferences.tsx`, route `inbox/preferences`): the screen exists in the app but is drawn nowhere in `2. design/app`, so nothing shows its five switches, the 'Off' note, the failed-save banner or the way into it from the Inbox. A muted category is dropped at the moment a line is raised (comm `Raise`), so switching back on does not restore missed lines; and the Membership switch also covers a request waiting on a Group coordinator. Screen to draw: the settings list with one row per category, the caption that missed lines are not kept, and the Inbox entry point; the wording of the leader case needs an owner decision. Turned into Q131.
56. Farmer, 13-buy-inputs step 5 (both screens, `_generator/pages_j13_step5.py` lines 18 and 44): her group order carries a green Paid chip and the note lists Paid among 'the app's status words', but a group order has no Paid state any more. Who has paid is a row in the Payments record added by the Group coordinator (decisions 90 and 145), the Paid step is gone, and the built member app has no Paid word anywhere (`mwanachama-frontend-member/app`, no match outside generated types; the market module that owned the old mark is not checked out, so the old mark could not be read). The chip therefore has no producer, and the card shows no Payments row of her own (entry 36). Screens to draw: the group order card with the chip of the order's state (Confirmed, Delivered) and, beside it, a line 'Payment recorded KES x, date' only when her own Payments row exists, none when it does not; the Buy now card keeps Paid because the Supplier's Mark paid still sets it (entry 14). Can simply be drawn (chip and line copied from the existing card); which words the app keeps for a group order is covered by entry 36. Open.
55. Any member, 06-forms standing forms (detail screen, `_generator/pages_forms.py` line 101): the caption says where a member finds a standing form 'is not decided there (Q64)', but Q64 is the payments question and the member app's board (`mwanachama-frontend-member/documentation/3. implementation/todo_done.md` MF160, 2 November 2026) records the owner's answer: a standing form is a workflow found as a row on Start in Do Something, and no list of standing forms is built. The 'Ask for something' list in the Forms screen is therefore a screen the owner has already dropped, and Start has no standing-form row drawn (`pages_do_something.py` Start rows). That answer cites 'hub decision 155', but `decisions.md` here stops at 136, so the decision is not filed in this repo: this needs the owner to confirm and file it. Screens to draw once confirmed: delete the Ask for something screen from 06-forms and draw one Start row for a standing form ('Inputs I need', 'Open any time') opening the existing answer screen. Can simply be drawn after the filing; wording fix of the caption now. Open.

54. Any member, 06-forms and every step message: the app switches its own labels in nine languages (`app/languages.ts`) but the design draws no state for a form or step text that has no text in her language (which language shows, any mark that it is a translation, a draft translation not yet approved). Screen to draw once decided: the form and the step message with a small 'not translated yet' line in the agency's default language. Needs an owner decision, turned into Q123.
53. Any member invited by email (01-entry Sign in, 05-inbox invited row): the invitation mail text is sender, role, agency, responsible party and a misuse contact for a single invitation but only the bare project link for a batch (`invitation_mail.go`, `member_invite_batch.go` `sendPaced`), so the same person sees two different first messages depending on how she was invited; the Sign in screen draws neither. Screen to draw: the Sign in screen reached from the mail with the agency name and who invited her. Wording follows Q122; open.
52. Any member, 04-chat group-page.html: the page is Proposed and no screen shows how she reaches it (the room header holds Threads and the menu only); a leader's Leave group has no drawn confirm (Admin, last leader). Screens to draw: the entry from the room header to the page, and for a leader the confirm card with Leave greyed and the line 'Step down first'. The entry can simply be drawn; the leader's case is turned into Q120. Open.
51. Any member, 02-do-something Ongoing segment (decision 118): the drawn rows are built from nine reads (`agency_get_agency`, `agency_list_modules`, `agency_list_my_open_steps`, `market_list_group_orders`, `market_list_offers`, `actor_list_my_join_requests`, `market_list_posters`, `actor_list_joinable_groups`, `actor_list_my_groups`) and carry no time, so the order of rows from five different lists is undrawn; the state words Open, Requested and Asked are the app's own and the design says the owner has not confirmed the empty-state words (`do-something.html` note). `agency_list_my_open_steps` (`caller_open_steps.go` `callerOpenSteps`) returns every published step whose role she holds, with no run state, so the Start list cannot tell a begun step from a fresh one and the Ongoing rows cannot come from it. Screens to draw: newest-first order stated in the caption, and a state word for a declined request (see Q116). Can simply be drawn; the read cost is in performance.md. Open.
49. Any member, whole app (decision 118, 2026-11-02): the app now has three tabs, Do Something, Chat and Inbox, and the Started tab is gone, so entries 41, 43, 47 and the Apps and Started wording in 11 describe screens that no longer exist under those names. The Do Something page draws a Start and an Ongoing tab (`app/02-do-something/do-something.html`); captions and any gap text naming "Apps", "Home" or "Started" need reading against it. Can simply be drawn: no screen, a caption pass on `_generator` is the owner's. Open.
50. Group Admin and Vice Admin, 05-inbox: a join request row that the other leader has already decided has no drawn state. Screen to draw: the row turning into "<name> approved/declined <person> at <time>" with no buttons. Turned into Q119 for who sees the row at all. Open.
48. Any member, 05-inbox: the design draws three row kinds (joined, invited, new form) but comm raises 32 events in 12 categories; the built app names 9 events and 8 categories (`notification-text.ts`), so events of category market, task, case, item and post (ask closed, task assigned, member removed, record change refused) show the word "Notification" with no line, and only 6 events open a place (`routes/inbox.tsx` `opensAt`); market cannot be muted either (`api/inbox.ts` `mutableCategories`). Screens to draw: a generic workflow-step row (step title, one line, time) and its tap target. Turned into Q117.
47. Any member, 03-started (decision 115): the Started rows come from five lists (`market_list_group_orders`, `actor_list_my_join_requests`, `market_list_posters`, `actor_list_joinable_groups`, `actor_list_my_groups`), none of them a run of a workflow, so "begun and not finished" is whatever each list returns; the drawn page has no state for a request that was declined or refused, and the built app has no Started route yet. Turned into Q116. Screens to draw once decided: the ended row (or its absence) after a decline; the caption can name the five lists as filled by, with the open-steps read marked illustrative. Open.
46. Any member, 01-entry Your agencies caption: it still says "Filled by: agency_list_instances", but decision 117 (2026-11-01) and the built app read `GET /me/agencies` because `agency_list_instances` leaves out residents. Caption fix on `app/_generator/pages_entry_agencies.py` (both Your agencies screens); the cards can stay as drawn. Open; can simply be drawn (wording and tool name only).
45. Any member, account menu (decision 115): Sign out is drawn in the drawer, but the built app sends `/sign-out` to the agency's Home (`app.test.tsx` lists it as unbuilt), and no screen shows what she sees after she signs out. wakala-api has `POST /auth/revoke` (`member_session.go` `revoke`, ends only this phone's session). Screen to draw: the Sign in screen reached from Sign out, with no banner or the line "You signed out."; the drawn Sign in already exists (`01-entry/sign-in.html`). Open; can simply be drawn.
44. Any member, 01-entry Sign in, link did not work (decision 116): the screen asks her to send herself a new link but the field is empty again, so she retypes the address she just used; the screen after sending says nothing about which phone to open the link on beyond "Open it on this device". Wording only, no owner decision. Open; can simply be drawn (keep the address typed in the field, copied from the drawn "After sending" screen).
43. Group coordinator, 03-apps / 18 step 1: the built Apps page (`pages/apps/AppsPage.tsx`, decision 113) lists open steps but clears the Start card whenever any buy group order of the agency is open (`coordinator/start/api.ts` lines 52 and 63), a rule the design never draws and no decision backs; the page then reads "Nothing is waiting on you". The page lists only fill-form steps with questions (`startsGroupOrder`), so a Farmer's or Supplier's open step has no tile. Turned into Q115. Screen to draw once decided: the Apps page with an open-order line under the Start card; the other step kinds' tiles can simply be drawn from the existing tile pattern.
42. Any member, 02-home join-group (journey 22 steps 1 to 3): the three screens draw "Ask to join" and "Requested" only, and the group row always reads "Approval needed". The actor module has more states the screens never show: an open group registers her at once with no request (`mwanachama-backend-actor/actor.operations.json` `join_group`, "An open group registers the actor at once"), a request can be declined and kept, and asking again after a decline is an appeal (`join_group`, `decline_join_request`); `find_group_by_code` returns her state as member, requested, declined or none. A note of up to 500 characters goes with the request (`join_group` body `message`), and a decline can carry a reason (`join_decision_impl.go` `recordDecision` stores `Reason`). Screens to draw: the row of an open group reading "Join" and landing her in the room; the row after a decline reading "Not accepted" with the reason line and "Ask again"; an optional note box on the ask. The group code is also printed on every listed row, although a hidden group is reachable only by its code and never listed (`join_impl.go` `ListJoinableGroups` leaves hidden ones out): drop the code from the rows and keep it for the Find box. Can simply be drawn; the caption tools `list_joinable_groups`, `find_group_by_code`, `join_group`, `list_my_join_requests` exist in the actor module and only need the `actor_` prefix. Open.
41. Any member, 03-apps landing: the Apps page draws module tiles ("Buy inputs", "Sell harvest") filled by `agency_get_agency` and `agency_list_modules`, but decision 113 (2026-11-01) says the Apps page lists the workflow steps open for the person, every member gets the tab, and a member with none sees the empty state. Screens to draw: the Apps list as rows of open steps (step title, the workflow it belongs to, who is waiting, copied from the Inbox row), the empty state "Nothing is waiting for you", and the same caption for Home; the caption's tool names are the draft read of entry 10 and should name the open-steps read of decision 112 as illustrative. Who gets which row depends on how a person holds a role (Q111). Entries 5, 10 and 11 are superseded by this one in part: the "waiting on you" card of entry 5 is now the Apps row; the module-tile caption of entries 10 and 11 is stale. Rows can simply be drawn; the role link is turned into Q111.
40. Any member, 06-forms answer (step 24-answer-a-form): every question is drawn as a free-text box (`pages_forms_answer.py` `question_phone` calls `field_textarea` for both questions), yet the forms module asks ten answer types (yes or no, one choice, several choices with a minimum and maximum, free text with a length cap, date with bounds, time, number and currency with bounds, photo, file; `mwanachama-backend-forms/models/answer.go` `ValidateAnswerWithin`) and a question can be required (`models/question.go`). The app kit already has the fields (`kit.py` `field_yes_no`, `field_single`, `field_multi`, `field_number`, `field_currency`, `field_date`, `field_time`, `field_for`). Screens to draw: one question screen for each type from those fields; a required mark and an error line that stops Next on an empty required answer, a number outside its bounds or too few or too many choices picked; a line "This form changed; check your answers" when the question was replaced while the phone held a draft (`ErrNotCurrentVersion`); and a line "This form is closed" when Submit lands after the window (`ErrOutsideWindow`, joins entry 8). Comes from forms operations and the kit; can simply be drawn, no question.
38. Any member, Home: the built Home calls the led-groups list, the pending requests of each group and the live-records list for every member just to decide whether three cards show (`home.tsx`); the design draws no state for those cards, and the Group coordinator's Manage payments card appears only after the record has rows or the list is read. Wording and states to draw with Q97; the card test itself is a build matter. Open.

1. Group coordinator: no journey in the app. They start the order, fill and send forms, add Payments rows and are told of cancels, yet appear only as a name others wait on. Screens to draw: a Home card and Inbox row for what waits on them, the form they fill (the existing Form pattern), Manage payments as a list with an Add form (the Records pattern). From decisions 89, 90, 92 and `workflow-records.html`. Closed on 2026-10-29, decision 93: drawn as the Group coordinator journey (HS298).
2. Manage payments has no route and no drawn screen in the app (`mwanachama-frontend-member/app/routes.ts`); see also `app-pages.md`. Closed on 2026-10-29, decision 93, drawn in the Group coordinator journey (HS298): a list of rows with amount and name, an Add button opening the record's form, copied from the Forms list.
3. Hub manager: appears in the app only on the index, with no journey; whether the manager uses the app at all is not drawn. Needs an owner decision (covered by Q79's answer on who works where; open as its own gap).
4. Role chips in the app (`_generator/kit.py` `member_roles`, `roles`) are a typed copy of the studio's roles and include "Farmers' coordinator" where the studio says "The agency" (closed on 2026-10-29, decision 94; role chips read the agency, HS299).
5. A step that waits on a Supplier or Buyer has screens only inside its own workflow's journey; a generic "waiting on you" card for any step kind is not drawn on Home (open; can simply be drawn from the Inbox row pattern).
6. Any member: an Inbox row other than an invitation has no detail screen. `05-inbox/inbox.html` draws a detail only for the invitation; the "New form" row and a notify step's message with its attachment open nothing in the design, though the app has a `notification/:notificationId` route (`mwanachama-frontend-member/app/routes.ts`). Screen to draw: a notification card with the message, the attachment as a read-only card, and one button that opens the form or room it names, copied from the invitation detail card. From the notify and attach step kind (`step-kinds.md`). Can simply be drawn.
7. Any member: a "say yes or no" step that waits on them has no generic screen. Yes and no appear only inside the trade thread (`_generator/pages_chat_trade.py`), so a step of that kind in another workflow has nowhere to be answered. Screen to draw: an Inbox detail card with the question and Yes and No buttons, then a quiet "You said yes" note, copied from the trade thread. Can simply be drawn.
8. Any member: a form that closes without their answer has no screen. `06-forms/forms.html` draws Waiting (open forms) and Answered only, so a form never answered, or sent back, or closed while the phone held a Draft, vanishes. Screen to draw: a Closed, not sent group in Answered with the Draft kept, copied from the Answered rows. Needs no owner decision for the row itself; what the step does after a missed close is a workflow-level question already covered by step-kinds.md.
9. Any member: Chat rooms list shows unread counts whose largest value is not drawn (Q83). Closed on 2026-10-29, decision 97: "99+" past 99.
10. Any member: Home and Apps name `agency_list_modules` as the tool that fills the cards and tiles, but that tool takes a `draft_id` and reads the draft (`mwanachama-backend-agency/module_impl.go` `ListModules`, `agency.operations.json` `list_modules`). The member app must read the published version only (premise h). The only published read in the API keeps just the set of module codes for 30 seconds (`mwanachama-wakala-api/internal/api/http/module_switch.go` `mountedModules`), so the name the agency gave a module (decision 80) is not available to a member. Caption on `02-home/home.html` and `03-apps/apps.html` should name a published read, not the draft tool. Open; build finding, no owner decision.
11. The built Home (`mwanachama-frontend-member/app/routes/home.tsx`) draws fixed cards (Forms, Join Group, profile) and `tabs.ts` has three tabs; no Apps tab and no module-driven card exists yet, so Home and Apps (`02-home`, `03-apps`) are drawings only. One screen to mark "not built" in the captions. Can simply be drawn (caption fix).
12. Home draws "Join requests" only when a count is above zero (`home.tsx` `useWaitingRequests`); the design's Home never shows that card, so the Group coordinator's first waiting item has no drawn Home state. Part of entry 1 and Q79. Open.
13. Farmer, 13-buy-inputs step 3, after Join: the order she joined has a Confirmed screen only; there is no screen to see her line before Send, change the bags or take them out, and 14-supply-inputs step 4 shows lines the Supplier cannot see change. Screen to draw: her Join form reopened with the bags prefilled and a Take out button, copied from the Join form. Closed on 2026-10-29, decision 92 (Q85 settled by it): draw her Join form reopened with the bags prefilled and a Take out button.
14. Supplier, 14-supply-inputs step 5: Mark paid is drawn for a single Buy now order only. A group order's money is the Group coordinator's Payments row (decision 90), and no screen shows the Supplier what happens to a group order after it is confirmed. Screen to draw: a read-only Confirmed card on the group order with the date and note, copied from step 4. Can simply be drawn.

15. Buyer, 16-sell-the-harvest step 3: the ask waits with no timer and nothing shows what happens when nobody answers. Screen to draw: an Inbox row "Nobody answered". Closed on 2026-10-29, decision 99: a time limit in the workflow, a Closed state drawn.
16. Removed 2026-11-01 with the ride feature (journey 17 is gone; there is no rides workflow).
17. Supplier and Buyer, 16-sell-the-harvest steps 1 and 3: the Buyer's Home has no screen for a group sale he has answered yes to, only the single ask; same read-only Confirmed card as entry 14. Can simply be drawn.
18. Supplier, 14-supply-inputs step 1: the application has Asked and Approved screens only; if the Group coordinator refuses it, nothing is drawn. Screen to draw: an Inbox row "Your application was not accepted" and the Your application card with that state, copied from the approved Inbox row. Can simply be drawn.
19. Supplier, 14-supply-inputs step 2: an offer can be added and edited but no screen removes one or marks it out of stock, and the stock list is a separate private list from the offers (`market_set_stock`). Screen to draw: a Remove button at the foot of the edit form. Wording needs the owner to say whether a removed offer leaves open asks alone; can be drawn with a plain confirm, no question yet.
20. Supplier, 14-supply-inputs step 3: only the Yes form is drawn; the No button has no form and no reason field, and the ask "by Friday" shows nothing once Friday has passed. Screen to draw: a No form with an optional note, and a Closed group in Asks. Can simply be drawn; the closing time itself is decision 99.
24. Hub manager (lab manager), 02-member: the journey has steps 1, 2 and 4 and no step 3. Step 2 ends on "the lab manager will approve it" and step 4 starts as if it had been approved; the manager's side (a request in Threads, Approve or Refuse, and the member being told) is drawn nowhere in the app. Screen to draw: the leaders' view of the access request thread with Approve and Refuse, and the member's thread after the decision. Can simply be drawn, copied from the Threads list; the approval itself is a join/approve route that exists (`mwanachama-wakala-api/internal/api/http/join_routes.go`).
25. Any member, 01-entry agencies: each agency card and the Find an agency list print the agency's raw id (a UUID) under its name; the studio and the other app pages never show an id. Wording fix: show the kind or place instead, keep the id out of the screen. Can simply be drawn.
26. Any member, 01-entry Find an agency: the directory screen has no empty result ("nothing matches") and no state for an agency that is not listed or not approved, which the route answers as an empty list (`internal/agencies/directory.go` `SearchDirectory`). Screen to draw: the empty search result with a sentence. Can simply be drawn.
27. Group coordinator, 15-run-the-market steps 1 to 5: the journey is drawn as console pages (`submission/documentation/06-user-journeys/15-run-the-market/mockups/`), and decision 93 names only a Home card, an Inbox row, one form and Manage payments for her on the phone. Her other actions have no phone screen: Approve or Decline a supplier (a card in the thread), Start a group order (pick a posted price, set the minimum), decide each silent farmer (kept or dropped, decision 70), Send locked below the minimum, Call off (decision 92), and the Inbox row "A Farmer changed their share" (decision 92). Screens to draw: the Approve and Decline card copied from the trade thread's Yes and No card, the Start form copied from the Form pattern, the lines list copied from the Join form's lines, one Send button with its locked reason line. Can simply be drawn; whether she does these on the phone or only in the console is for decision 93's scope, not a new question.
28. Farmer, 13-buy-inputs step 3 and 03-apps form-app: the chat forms of 13 and 17 are captioned as filled by market tools, the form-type app by forms tools, so a hub manager's edit to a workflow's form reaches only the second. Screen to draw: the Join form with the workflow's questions after the bags field, or a note that it is fixed. Needs an owner decision (turned into Q91).
29. Farmer, 13-buy-inputs step 2: nothing is drawn for a price that changed between seeing the offer and tapping Buy now. Screen to draw: a "The price changed" line on the form, or the order card showing the sent price. Needs an owner decision (turned into Q92).
30. Any member, 13-buy-inputs captions: `market_buy_now`, `market_join_group_order`, `market_answer_revision`, `market_create_wanted`, `market_list_offers`, `market_get_order` and `market_ask` do not exist in `mwanachama-wakala-api` (it has `market_answer_ask`, `market_send_quote`, `market_accept_quote`, `market_list_quotes`, `market_get_group_order`); none is marked "(illustrative)". Fix: mark each as illustrative or rename to the existing tool. Can simply be fixed.
31. 13 step 2: the cancel and Mark paid buttons stay as drawn after the redraw; the Waiting card of step 2 has no Closed state although decision 99 puts a limit on it (see entry 15, Q90). Open.
32. Group coordinator, 18-run-a-group-order step 2 to 3: Start goes straight to Manage payments (`pages_j18_run_a_group_order.py` `start_form`, Start links to `PAYMENTS` screen 1) before the order has been sent or any farmer has joined; the next screen should be the order page (step 4 screen 1). Link fix; can simply be drawn.
33. Group coordinator, 18 step 3: Manage payments lists name and amount with no total, no count against the farmers in the order, no way to correct a row, and "Farmer" is a typed text field, while the Payments record picks from "The farmers in the order" (`records` Picks from, decision 94). Screens to draw: a picker for Farmer and a "3 of 8 farmers paid" line. The picker can simply be drawn; correcting a row is turned into Q96, and which order the list belongs to is turned into Q95.
34. Group coordinator, 18 step 4: the order page offers Send the order only; Call off (decision 92), the silent-farmer decisions and Send locked below the minimum (see entry 27) are not drawn, yet screen 3 shows the cancel notice. The Inbox row has no detail. Screens to draw: a Call off button with a confirm and a locked Send with its reason line. Can simply be drawn.
35. Group coordinator, 18 screens 1 to 4 captions: `market_create_group_order`, `market_list_payments`, `market_add_payment`, `market_send_group_order` do not exist in `mwanachama-wakala-api`; `market_list_group_orders` and `market_get_group_order` do. Mark the four as illustrative. Can simply be fixed.
36. Farmer, payments: a Farmer sees only their own payment row (`record_rows_test.go`), but no screen in 13-buy-inputs or the Inbox draws "Your payment of KES 7,200 was recorded". Screen to draw: an Inbox row and a read-only card on the order, copied from the group order card. Can simply be drawn.
37. Group coordinator, 18: example data shows Dennis Ojwang paying KES 14,400 who is not in the order's three listed payments and the order says 8 farmers; the sums do not tie to 24 bags at KES 3,600. Example data fix; can simply be redrawn.


Log
57. Group coordinator, 18-run-a-group-order step 3 (Add payment form, `_generator/pages_j18_run_a_group_order.py`; built in `mwanachama-frontend-member/app/routes/payment-new.tsx` line 42 and `app/api/payments.ts` `loadPeople`): the drawn form types the farmer in a text field and the built form shows a drop-down, but the drop-down is every person of the agency, not the list the question names. `StepQuestion.OptionsFrom` is a free string (`mwanachama-backend-agency/models/workitemstep.go` line 81; the bundled demo document uses `"Farmer"`), the app only tests that it is not empty (`listName !== ''`) and then fills the drop-down from `GET /actors` (`actor_list_actors`, `actor.operations.json` `list_actors`: every actor not deleted, in id order, no filter, no limit, whole rows including phone and email attributes). So 'Select the farmer' offers hub staff, suppliers and every other member, and the name of the list is never read. Screen to draw: the picker with a search box and the list's own name as its label, showing only people the list names, plus the empty state 'Nobody to choose' already built (`paymentsNobodyToChoose`). Needs the owner decision already open as Q100 (who the list may offer); the size and privacy side is in `performance.md` entry 41. Open.

## 2026-10-29 14:40 UTC

First run of this file. Traced the roles named in the app captions against the studio's step roles and the app routes. One entry turned into Q79 and one into Q78.

## 2026-10-29 15:05 UTC

Traced 05-inbox and 06-forms against comm.notification and forms.form.list_waiting. Opened entries 6 to 8 (inbox detail for any notification, generic yes or no card, forms closed unanswered). All can simply be drawn; no question added.

## 2026-10-29 15:45 UTC

Looked at 04-chat room list against comm unread; one entry.

## 2026-10-29 16:15 UTC

Traced 02-home and 03-apps from caption to the module list and to the built Home. Opened entries 10 to 12; no question, all are drawing or build fixes under the premise.

## 2026-10-29 17:10 UTC

Walked 13-buy-inputs step 3 and 14-supply-inputs steps 4 and 5 screen by screen. Opened entries 13 and 14; entry 13 turned into Q85.

## 2026-10-29 17:35 UTC

Walked 16-sell-the-harvest screen captions against the market client. Opened entries 15 to 17; entry 15 closed on 2026-10-29, decision 99.

## 2026-10-29 18:05 UTC

Walked 14-supply-inputs steps 1 to 3 screen by screen. Opened entries 18 to 20; all can simply be drawn.

21. Farmer, 04-chat farm-room: the group order card in General is a post with a reference to the order; the member app has no code that draws a reference (`mwanachama-frontend-member/app/routes/room.tsx`), and the card's price can differ from the live one after a revision. Screen to draw: the card with a live or as-posted state. Needs an owner decision (turned into Q88).
22. Any member, 04-chat rooms: a long room has no drawn "earlier posts" control; the list opens at the start of the history (`ListChatMessagesFor` returns all). Screen to draw: the room opening on the newest posts with an "Earlier" row at the top, copied from the Answered list's older rows. Can simply be drawn.
23. Farmer, 04-chat farm-room last screen: the shop's revision asks Yes or No in the thread, but nothing is drawn for a farmer who does not answer before the order is Sent. Wording and a closed state to draw under decision 99 (a time limit in the workflow). Open.

## 2026-10-29 18:35 UTC

Walked the four 04-chat room pages. Opened entries 21 to 23; entry 21 turned into Q88 (parked 2026-10-29).

## 2026-10-29 19:15 UTC

Walked 01-entry (agencies, sign-in) and 02-member against the join and directory routes. Opened entries 24 to 26; all can simply be drawn, no question added.

## 2026-10-29 20:50 UTC

Read 15-run-the-market against the app folders and decision 93. Opened entry 27 (the Group coordinator's actions with no phone screen).

## 2026-10-29 22:35 UTC

Traced commit b001425 (13 and 17 redrawn as chats with the agent, new 03-apps/form-app.html) against wakala-api's market tool names and the forms operations. Opened entries 28 to 31; 28 turned into Q91, 29 into Q92. Market module not checked out, so its side is unread.

## 2026-10-30 02:40 UTC

Walked journey 18 (all four steps) against the generator and wakala-api tools. Added entries 32 to 37.

## 2026-10-30 06:35 UTC

Read built Home against the design; opened entry 38.

## 2026-10-30 08:40 UTC

Re-read entry 16 against decisions 90 and 91 and `payments-record.md`: no rule covers who confirms a Buy now payment. Turned into Q99.

## 2026-10-31 02:40 UTC

Traced journeys 21 to 25 against forms and the reports mount. Opened entry 39, turned into Q106.

39. Resident, 25-send-a-report step 3: the confirmation draws a reference and two dates the council owes (`pages_form_app.py` lines 13 to 15); neither exists in forms or catalog, and the caption's `submit_answers` is not the `/reports` filing path. Turned into Q106. Screen to fix once decided: the After sending card.

## 2026-10-31 12:35 UTC

Read 06-forms/answer.html against the forms answer validation. Opened entry 40; can simply be drawn.

## 2026-11-01 20:40 UTC

Read decision 113 against 03-apps/apps.html: the page still draws module tiles. Opened entry 41; entries 5, 10 and 11 marked as partly superseded in it. Role link turned into Q111.

## 2026-11-02 00:50 UTC

Traced journey 22 (join-group.html) against the actor join operations. Entry 42; can simply be drawn, no question.

## 2026-11-02 06:35 UTC

Read the built Apps page and tab bar (commit cbfd523) against decision 113. Opened entry 43, turned into Q115.

## 2026-11-02 09:40 UTC

Read journey 21 and decisions 115 to 117 against the built entry code and `me_agencies.go`. Opened entries 44 to 46.

## 2026-11-02 10:40 UTC

Traced 03-started against decision 115 and the five lists it names. Opened entry 47, turned into Q116.

## 2026-11-02 12:50 UTC

Traced the Inbox end to end (comm notification list, unread, raisers, app row text and targets). Opened entry 48, turned into Q117.

## 2026-11-02 18:40 UTC

Traced the Do Something Ongoing segment against `caller_open_steps.go` and the five lists. Opened entry 51; no question (Q116 and Q115 already hold the owner's choices).

## 2026-11-02 20:40 UTC

Added entry 52 from the group page and Leave group.

## 2026-11-03 03:00 UTC
Added entry 53.

## 2026-11-03 04:40 UTC
One entry added (54), from the languages trace.

## 2026-11-03 08:50 UTC
Traced the standing-form screens in 06-forms against the member app board (MF160) and forms `standing_impl.go`. One entry added (55). The member checkout on this machine is the claude/cool-gates branch with Home, not Do Something, so the built Start list could not be read; the Start row is judged from the board only.

## 2026-11-04 00:35 UTC

Traced 13-buy-inputs step 5 against decisions 90 and 145 and the built app. Opened entry 56 (Paid chip on a group order has no producer). No question: it can simply be drawn.

## 2026-11-04 02:40 UTC

Read the Add payment form in the built member app against the record's `options_from` and the actor list. Opened entry 57 (the picker ignores the list name and loads every actor). No new question: it joins Q100. Also: the demo farmers document (agency 0b154f9, 265 entities, 127 KB) is under the 1000-entity import cap and carries no scenarios.

## 2026-11-04 14:40 UTC

Traced the Notification settings screen from the built app through comm's preference and Raise to the agency's mute rule. Opened entry 57.

## 2026-11-04 17:00 UTC

Walked the built routes that no design page draws (Profile, Signed-in devices, group settings) against wakala-api and actor. Opened entries 58 and 59; entry 58 turned into Q132.

## 2026-11-04 20:40 UTC

Walked 16-sell-the-harvest step 2 against the built join page. Opened entry 60, turned into Q134.

## 2026-11-05 00:40 UTC

Traced 02-member step 4 against the assetmanager mount and the permission catalog. Opened entry 62, turned into Q136.

## 2026-11-05 UTC (third run)

Traced comm moderation against the app. One entry (63), turned into Q139.

Walked 06-forms Answered against the built read-back and history pages. Opened entry 64; can simply be drawn, no question added. (2026-11-06)

## 2026-11-06 UTC (sixth run)

Traced the forms results publish and read path against the member app; entry 65 added; Q145 asked.

## 2026-11-07 UTC (third run)

Entry 66 added (group-actor steps have no Start row); Q151 asked.

## 2026-11-07 UTC (fourth run)

Entries 68 (Home Forms card against HS1021 and its read cost) and 69 (Ask in Chat leads to a room nothing answers; allowance out) added; 69 turned into Q153.

## 2026-11-07 UTC (fifth run)

Entry 70 added (photo and file answer questions have no control, no files module, no way to open a file); turned into Q154.

## 2026-11-08 UTC (third run)

Entry 71 added (polls module has routes and no phone screen); turned into Q155.

## 2026-11-08 UTC (fourth run)

Engage module traced; app gap 72 opened, turned into Q156.

## 2026-11-08 UTC (files)

Entry 70 (photo and file answers) gains its missing evidence: the files module exists but is not mounted and its upload cannot pass the host's body limit. The size part is Q163; the control itself stays with Q154.
