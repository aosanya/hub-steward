# Catch up

**Goal:** A member sees what needs her and what is new in her agency: the Notifications page first, then her rooms.

**Result:** She knows what is waiting and which rooms have news.

Screens: [all four in order](../../../2.%20design/mockups/journeys/23-catch-up/index.html).

## Steps

1. **She opens Notifications.** [Mockup](../../../2.%20design/mockups/journeys/23-catch-up/mockups/step-01-opens-the-inbox.html). On Home the strip 'You have N things to do' opens the Notifications page at its Needs you section; the Notifications button on the bottom bar opens the same page. Needs you sits above Updates: Needs you holds what is waiting on her (steps, invitations, asks, forms, drafts and issues), Updates holds what reached her in the Siaya Farmers' Group, newest first. A dot marks each unread update, and Mark all read sits in the Updates heading while any update is unread and clears Updates only. The strip and the Notifications button show the same number, the things waiting on her, and the button reads it aloud as "N things to do"; unread updates are a separate dot on the button, read aloud as "New updates", and never add to the number. Reading the last unread update clears the dot and leaves the number as it was. Read rows have no dot.
2. **She sees nothing new.** [Mockup](../../../2.%20design/mockups/journeys/23-catch-up/mockups/step-02-sees-nothing-new.html). In an agency where nothing has arrived, such as the Siaya Community Computer Lab, the Notifications page shows one card that says so. There is no count, no dot and no Mark all read.
3. **She opens the Chat tab.** [Mockup](../../../2.%20design/mockups/journeys/23-catch-up/mockups/step-03-opens-the-chat-tab.html). The tab lists her rooms, each with its latest message, the time and an unread count. Asha Otieno's room has two unread.
4. **She sees a busy room.** [Mockup](../../../2.%20design/mockups/journeys/23-catch-up/mockups/step-04-sees-a-busy-room.html). A room with more than 99 unread messages shows 99+, and the count stops there.

## What Needs you holds

Each row counts once in the Home strip and in the bell number.

- **A step that waits on her after another role sent.** When the Group coordinator has sent her part on, her next step is a row under Needs you, named by the group and her role, and it counts in the strip and the bell on a fresh session without her opening anything first. Tapping it opens that step with the run it belongs to (ISS-157, D158). The Create group order start is not a row here; it stays on the Start tab.
- **An issue assigned to her.** It is a row by its code and title, marked "Issue assigned to you", and tapping it opens the issue (ISS-106, D158). The announcement that an issue was assigned is left out while the issue is listed, so the same issue is never counted twice; when the issues cannot be read, the announcement stays so she still hears of it. An agency without the task module has no issue rows.
- **A task notice whose task is done.** It clears from Needs you by itself and is marked read (ISS-127).
- **A notice whose form or task has vanished.** Tapping it does not open anything; the page says "That form is no longer there." (or "That task is no longer there.") and she stays where she is (ISS-127).

Built behaviour, not yet confirmed by the owner: a tapped notice whose form or task has vanished is marked read, so its row leaves Needs you; and a task that is done but whose notice she taps before it has cleared still opens.

## What the drawings invent

The names, messages and times are drawn for the page; they are not data from a real agency.

## Not yet built

- None of the four steps is missing from the app.
