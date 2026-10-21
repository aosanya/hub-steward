# Agency member

**Goal:** Gets answers and access in an agency without waiting for the one manager.

**Result:** A member is set up and answered in their own language, the same day.

The steps below follow a member of the Siaya computer lab, the worked example. A member of another agency asks its agents the same way, about that agency's documents and requests.

Mockups: [all steps](../../../2.%20design/mockups/journeys/02-member/index.html).

## Steps

### 1. Asks a question in the chat

The member writes in the phone app's chat in English, Swahili or German. Hub Steward is meant to reply in a thread in the agency's room, in the same language, naming the document it answered from, finding passages in the agency's own documents (the sources module ranks them by embedding similarity, not by shared words) and saying "I don't know" rather than guess. Not built here: no code in this repository runs the agent that reads the room and replies (see Not yet built).

Mockup: [ask in chat](../../../2.%20design/mockups/journeys/02-member/mockups/step-01-ask-in-chat.html)

### 2. Asks for a seat and a Wi-Fi account

In the lab the member asks in the chat, and the lab's Access request workflow has the agent draft the request for the manager, who approves it (see [Agency manager](../01-hub-manager/README.md)). The mockup draws an access form; the app has no such form.

Mockup: [access form](../../../2.%20design/mockups/journeys/02-member/mockups/step-02-access-form.html)

### 3. Collects a barcode and a card

Once the manager has approved the request, the member finishes set-up at the lab terminal (the Swahili documents say the reception computer) and receives a member barcode there, which connects them to the lab's agency; later they show it at the desk. An image model makes the member's card, with their name, role and code. The lab's documents describe the barcode; no screen or tool for it is built (see Not yet built).

Mockup: [barcode and card](../../../2.%20design/mockups/journeys/02-member/mockups/step-03-barcode-and-card.html)

### 4. Asks which equipment is theirs

In the riders' agency the Assets Keeper is meant to answer who holds what, by serial number and login; the lab's template declares no Assets Keeper. Not built here: the agent that answers, and the Equipment page the mockup draws (see Not yet built).

Mockup: [my equipment](../../../2.%20design/mockups/journeys/02-member/mockups/step-04-my-equipment.html)

## Not yet built

- The agent that reads the room and answers: the API can grant Hub Steward a role and the app shows an agent's replies with an agent chip, but no code in this repository runs the agent. The app's own screens have words for English and Swahili only.
- The real member set-up call and the seat behind an approved request.
- The Equipment page: the console menu draws it for riders' hubs, but no page is built.
- The hub terminal, its barcode scan and the member's card: no screen, tool or image call for them is in the code of this repository.
