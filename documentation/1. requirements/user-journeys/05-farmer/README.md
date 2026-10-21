# Farmer

**Goal:** Buys inputs together with other farmers.

**Result:** Farmers get a better price together than each could alone.

The setting is the farmers' agency, one example agency among the demo's eight. In its template this journey is the workflow Pool an input order: the Farmers' agent collects the farmers' input questions and drafts one pooled order, the Group coordinator approves it, the supplier answers, and each farmer is told her share and its price. The phone-app screens built for buying together are in [Buy inputs](../13-buy-inputs/README.md) and [Run a group order](../18-run-a-group-order/README.md); this page is the form-and-thread route the template declares.

Mockups: [all steps](../../../2.%20design/mockups/journeys/05-farmer/index.html).

## Steps

### 1. Fills in an inputs form with what is needed

The farmer opens a standing form in the phone app, fills in what she needs and sends it. The template means sending to open a chat thread titled with the form, with her answers one per line, where the Farmers' agent reads the request, acknowledges it in her language and drafts a pooled order for the Group coordinator to approve. The app opens no thread on sending: it shows Form sent, or a Your thread card for a standing form (see [Answer a form](../24-answer-a-form/README.md)), and no code in this repository runs the Farmers' agent (see Not yet built).

A request that arrives minutes after another for the same input and unit joins the pending order: the agent adds to the farmer's own line or appends one, and tells her she joined it. Sending the same request twice does not draft it twice.

Mockup: [inputs form](../../../2.%20design/mockups/journeys/05-farmer/mockups/step-01-inputs-form.html)

### 2. Sees the pooled order

She is told in her own thread that her request is in a pooled order, with its total and how many farmers are in it, and that the Group coordinator approves it first. Once it is approved and sent to the supplier she is told that too. Each message comes once.

Mockup: [pooled order](../../../2.%20design/mockups/journeys/05-farmer/mockups/step-02-pooled-order.html)

### 3. Sees the input costs and answers

The thread shows her own share and its price. She says yes, no or a smaller amount in the thread. She can change or cancel her own share until the Group coordinator sends the order; no one approves the change and the coordinator is told. In the app she does this with Change my bags on the open group order, and her bought order shows Your share, the price and the total. A form set to lock after sending refuses any resend.

Mockup: [share offer](../../../2.%20design/mockups/journeys/05-farmer/mockups/step-03-share-offer.html)

### 4. Sees whether her share is paid

The Group coordinator records each farmer's payment as a row in the group order's Payments record: Manage payments on the order page, Add a payment with the farmer and the amount, and a row can be corrected. A farmer who opens it sees only the rows that name her. On her own bought order the Status chip shows Paid once the order is paid; the supplier marks an order paid with Mark paid on his Orders screen. Nothing here takes a payment: a person records it. The coordinator's side is in [Run a group order](../18-run-a-group-order/README.md).

Mockup: [paid](../../../2.%20design/mockups/journeys/05-farmer/mockups/step-05-paid.html)

Selling the harvest is a separate journey: [Sell the harvest](../16-sell-the-harvest/README.md). The old "lists produce for sale" step and its [mockup](../../../2.%20design/mockups/journeys/05-farmer/mockups/step-04-produce-for-sale.html) are retired.

## Not yet built

Checked against the app, the bundled API and the farmers' template on 2026-11-04.

- A place where a member finds a standing form. The Forms screen has a section for them, but the app's live client returns an empty list, so no farmer sees the inputs form there.
- The sent form shown as a card in the thread, with Edit.
- A close time on a pooled order. Earlier versions of this page gave one (48 hours, set by the Group coordinator). A group order has no close time: its states are open, revising, sent, closed and cancelled, and the coordinator sends it.
- The app reading a form's lock after sending: it does not hide Edit or say so.
- "Not paid yet" and "Paid" on the farmer's own entry in Forms. The mark exists on a form send in the forms module; the app shows payment only in the places step 4 names.
- Agent behaviour with no code or test in this repo: joining a request to a pending order, drafting a repeated request once, and telling each farmer once. These rest on the workflow's steps and the Farmers' agent's instructions.
