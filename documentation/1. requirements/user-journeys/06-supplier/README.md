# Supplier

**Goal:** Receives one order from many farmers instead of many small ones.

**Result:** One conversation instead of one per farmer.

The setting is the farmers' agency, one example agency among the demo's eight. This is the supplier's side of the workflow Pool an input order (see [Farmer](../05-farmer/README.md)). The screens built for a supplier are in [Supply inputs](../14-supply-inputs/README.md); this page is the thread-and-form route the template declares.

Mockups: [all steps](../../../2.%20design/mockups/journeys/06-supplier/index.html).

## Steps

### 1. Is asked for a price on the pooled order

Once the Group coordinator has approved the order, the Farmers' agent opens a thread for it in the supplier's room, titled with what is bought and the order id, for example "Urea · approval-7". It posts one message: the combined amount, how many farmers, the needed-by date, and a form inside the message asking for a price per kg and the amount the supplier can fill.

Nothing is sent before approval, and a second look sends nothing again. Each order has a thread of its own.

Mockup: [order asked](../../../2.%20design/mockups/journeys/06-supplier/mockups/step-01-order-asked.html)

### 2. Replies with a price

The supplier fills in the form and sends it: a price per kg and an amount. The order id comes from the thread, so the supplier is not asked for it. The Farmers' agent shares a short fill between the farmers in proportion and tells each farmer their share and its price. The supplier is sent nothing at this point.

Mockup: [price reply](../../../2.%20design/mockups/journeys/06-supplier/mockups/step-02-price-reply.html)

### 3. Receives the confirmed order

When the Group coordinator sends the order, the supplier gets one message: the total, the price, and one line for each farmer who is in, with their amount and price at the amounts they last settled on. If no farmer is in, it says the order is not going ahead. Before it is sent the supplier hears nothing. In the app he reads the same order under Group order, with each farmer's name and bags and no contact details, and under Orders once it is a yes he can mark paid ([Supply inputs](../14-supply-inputs/README.md)).

Mockup: [confirmed order](../../../2.%20design/mockups/journeys/06-supplier/mockups/step-03-confirmed-order.html)

## Not yet built

Checked against the app, the bundled API and the farmers' template on 2026-11-04.

- A close time that sends the order to the supplier. Earlier versions of this page gave one (48 hours, set by the Group coordinator). A group order has no close time: its states are open, revising, sent, closed and cancelled, and the coordinator sends it.
- The thread, the price form and the one confirming message of steps 1 to 3. No code or test was found in this repo that posts them; the supplier's built screens use unit prices such as a bag, and the Suppliers' agent holds no farmer threads and cannot open an order.
