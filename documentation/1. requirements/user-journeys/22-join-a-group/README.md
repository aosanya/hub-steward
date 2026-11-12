# Join a group

**Who:** a member.

**Goal:** ask to join a group, or accept an invitation to one, and find its room.

**Result:** she is in the group and its room is on Chat.

Join a group is a workflow of the agency. The group's Admin decides who joins. The mockups are in [mockups/](../../../2.%20design/mockups/journeys/22-join-a-group/mockups/) and can be browsed in order from [index.html](../../../2.%20design/mockups/journeys/22-join-a-group/index.html).

## Steps

1. **Asks to join a group.** [Mockup](../../../2.%20design/mockups/journeys/22-join-a-group/mockups/step-01-asks-to-join.html).
   - Join a group is a row on Start, which she opens from Home (D154).
   - It opens Join a group, which asks Have a group code? with a code field and a Find button. Under them are the groups the agency lists, each with its code and marked Approval needed, with Ask to join beside it.

2. **Waits for the Admin.** [Mockup](../../../2.%20design/mockups/journeys/22-join-a-group/mockups/step-02-waits-for-the-coordinator.html).
   - After she asks, the group's row reads Requested until the Admin decides. There is no countdown. Go to Chat is offered under the rows.
   - The request is also a row on Ongoing: the group's name over Join a group · Requested. It opens the page where she asked.

3. **Is let in.** [Mockup](../../../2.%20design/mockups/journeys/22-join-a-group/mockups/step-03-is-let-in.html).
   - After the Admin approves (how the Admin decides is not built, see below), the group's row on that page reads You are in, and it opens the room. The room is also on Chat.
   - Her request leaves Ongoing, which lists only requests still waiting.

4. **Is invited from Notifications.** [Mockup](../../../2.%20design/mockups/journeys/22-join-a-group/mockups/step-04-is-invited.html).
   - An invitation is a row under Needs you on the Notifications page, and the bell counts it. Opened, it names the group and who invited her, shows how long it has left, and has Decline and Join.
   - After Join, the card says she joined and where the room is, and has no buttons.

## Not yet built

- A live agency shows the Join a group entry only after its template is published again.
- The Admin's decide step reaches the Admin's Notifications page as a workflow step. It is drawn as a proposed Notifications row and is not built.
- The reply shapes of the actor tools the screens rely on are assumed.
