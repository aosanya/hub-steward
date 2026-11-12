# Send a report

**Who:** a member.

**Goal:** A member sends a report, an idea or a complaint through a form type that opens as a full-screen chat, and gets a reference.

**Result:** Her report is filed with a reference and the two dates the council owes her.

Screens: [all three in order](../../../2.%20design/mockups/journeys/25-send-a-report/index.html).

This journey is drawn only. It uses the municipality template's Report, Idea or Complaint with a council's agent, which is not one of the eight demo agencies.

## Steps

1. **She picks what it is about.** [Mockup](../../../2.%20design/mockups/journeys/25-send-a-report/mockups/step-01-picks-what-it-is-about.html). The form type opens as a full-screen chat, Tell the council. The agent asks What is it about? and offers five themes as prompts she can tap, or she can write her own.
2. **She fills in the form.** [Mockup](../../../2.%20design/mockups/journeys/25-send-a-report/mockups/step-02-fills-in-the-form.html). Her chosen theme appears with the agent's next line. The form's other questions come as one block in the chat, with Send as her own button. The ward, phone number and answers are drawn for the page.
3. **She gets a reference.** [Mockup](../../../2.%20design/mockups/journeys/25-send-a-report/mockups/step-03-gets-a-reference.html). The agent says the report is filed. A card shows the reference, the theme and place, and the two dates the council owes: when it will acknowledge the report and when it will answer.

## What the drawings invent

The themes, the wording, the agent's name, the reference and the dates are drawn for the page from the municipality template.

## Not yet built

- None of the three steps is built in the phone app or the console. The app has no report screen, and no report, idea or complaint form type exists in its code. A workflow can open into a chat ([Design a chat workflow](../28-design-a-chat-workflow/README.md)), but none is a report.
- The server can mount a reports domain (reports, board items with a reference, the acknowledgement and answer clocks) from `code/wakala-api/internal/specs/wakala.reports.json`. It mounts only when its `REPORTS_` variables are set, which neither `docker-compose.yml` nor `.env.example` does, and no screen calls it.
- It is undecided whether the agency's phone app carries this journey at all.
- Ongoing, Done lists the forms a member sent as a step of an agency task (D157, D158). A report sent through this chat would only appear there once a report exists as a workflow step; none does.
