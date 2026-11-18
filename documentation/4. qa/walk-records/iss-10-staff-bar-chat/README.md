# Staff and Departments screens: bottom bar and Chat

Shots of QA 5181 (preview built 21:47 on 2026-11-18, hub-steward dev with 884c075b), signed in as the QA council user.

- `<screen>-phone-390.png` and `<screen>-wide-1440.png`: Staff, Departments, Crews and Roles & Permissions each carry the bottom bar (Home, Chat, Notifications). Departments and Crews carry the detail card with Edit and the Members card; Roles & Permissions carries the role page cards.
- `<screen>-chat-wide-1440.png`: the Chat tab opened from each screen, about the subject on screen.

The screens were already built when the owner's screenshots were taken, so these are the before and the after at once: the owner's screenshots came from an older preview. The shots predate the Add department and Add crew buttons of ISS-9.

The tests that pin this are `code/app/src/app/menu/sections/staff/staffBarAndChat.test.tsx`: 16 tests, all four screens at wide and phone, the bar with Home and Chat, and Chat opening About the page on screen.
