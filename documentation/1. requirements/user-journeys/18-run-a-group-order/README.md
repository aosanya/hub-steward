# Run a group order

**Who:** the Group coordinator.

**Goal:** start the group order, record the farmers' payments and send the order.

**Result:** the farmers' order reaches the Supplier once, with the payments kept in the agency.

The mockups are in [mockups/](../../../2.%20design/mockups/journeys/18-run-a-group-order/mockups/), one HTML page per step, and can be browsed in order from [index.html](../../../2.%20design/mockups/journeys/18-run-a-group-order/index.html). The mockups draw the phone app with the bottom bar Home, Chat and Notifications (D154, D155) and the menu in a drawer.

## Steps

1. **Sees what waits.** [Mockup](../../../2.%20design/mockups/journeys/18-run-a-group-order/mockups/step-01-sees-what-waits.html).
   - Start, opened from Home, shows the step that waits on her first, named for its form, Create group order. The agency's tasks follow: Buy inputs, Sell harvest and Forms.
   - Notifications has a matching row, Start the group order, with the agency and the role and an unread dot.
   - Once she has started the order, Create group order stays in Start, because she can have several orders. Each live order is a row on Ongoing: Urea 50kg over Create group order · Open.
   - A farmer's Start has no such row. It holds the agency's tasks and the two steps a Farmer holds, Join a group and Apply as a supplier. A farmer who has begun nothing sees one card on Ongoing, Nothing ongoing yet, with Go to Start inside it.

2. **Fills the form.** [Mockup](../../../2.%20design/mockups/journeys/18-run-a-group-order/mockups/step-02-fills-the-form.html).
   - The form asks for Product, Price a bag and Minimum bags. She fills in Urea 50kg, 3,600 and 20, and presses Start, which opens the order.
   - With several approved suppliers the first question is Supplier, a searchable dropdown. She types bo and the list narrows to Bondo Agrovet.
   - With no approved supplier, one card says No poster is approved yet.

3. **Manages payments.** [Mockup](../../../2.%20design/mockups/journeys/18-run-a-group-order/mockups/step-03-manages-payments.html).
   - She opens Manage payments from the Records heading on the order page (step 4). Its back arrow returns to the order page.
   - The page lists the product and each farmer with the amount paid, with a Search by name field, a Show more button and Add a payment.
   - Add a payment asks two questions, Select the farmer and Enter the amount paid. Select the farmer is a searchable dropdown of every person in the agency, not only those who hold the role Farmer. She types au and the list narrows to Auma Oluoch.
   - A row opens Correct a payment, the same form filled with what was saved. The corrected row then shows its new amount and a Corrected on date under the farmer.
   - A repeat save of the same farmer and amount on the same order within a minute is refused with the line This payment was just saved. Wait a minute to save it again.
   - With no payments, the page is one card, No payments yet, with Add a payment inside it.
   - A farmer who opens the page sees only the rows that name her and no Add a payment.

4. **Sends the order.** [Mockup](../../../2.%20design/mockups/journeys/18-run-a-group-order/mockups/step-04-sends-the-order.html).
   - The row under Ongoing opens the order page, titled with its product, Urea 50kg, over the form's name, Create group order.
   - The page shows the terms, KES 3,600 a bag from 20 bags, then the bags so far and the farmers. Under a Records heading is a Manage payments row. Send the order is her own button.
   - After sending, the first row carries a Sent chip and the button is gone.
   - A called-off order carries a Called off chip, has no Send the order and keeps its Records.
   - If the order is called off, her Notifications page shows The Urea 50kg group order was called off, with its date. The notice opens the order.
   - The order stays on Ongoing, Live, after she sends it. It moves to Ongoing, Done only once it is closed or called off; nothing yet closes a sent order (ISS-163), so a sent order does not reach Done by itself.
   - Done is read-only and newest first. A closed or called-off order is a row with a Closed or Called off chip that opens the order page. A delivered order appears there once something sets its delivery date (ISS-154).
   - With nothing finished the tab is one card, Nothing finished yet. A list that cannot be read says Your finished tasks could not be loaded, with Try again; if only some can be read it says Some of your finished tasks could not be loaded and shows the rest. A long list ends with Show more.
