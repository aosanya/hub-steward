# Run the market

> Retired: the console has no Market pages. The Market manager's and the coordinator's steps are journeys [14](../14-supply-inputs/README.md) and [18](../18-run-a-group-order/README.md) on the phone, and the designer's steps 7 and 8 stand as journeys [19](../19-change-a-rule/README.md) and [20](../20-test-an-agency/README.md). The steps below are kept as the design the phone journeys grew from.

**Goal:** Runs the farmers' market for the group.

**Result:** Only suppliers the group trusts appear, group orders start from a posted price and go out when the coordinator says so.

**Who:** The group coordinator

The group coordinator and the Market manager approve the shops that sell to the group, start group orders at a shop's posted bulk price, decide for farmers who stay silent, send the order, and keep the product grouping right.

Mockups: [all steps in order](../../../2.%20design/mockups/journeys/15-run-the-market/index.html).

## Steps

### 1. Approves a supplier

This is the Market manager's step. Suppliers lists the shops that sell to the group with their area, what each sells, their state and how many offers each has; one shop waits for approval. Opening it shows what the shop typed when it applied. Approve and Decline are a card in the chat thread, and nothing is recorded until the Market manager presses one. After approval the row reads Approved, the shop shows on the farmers' page and can post prices, and the coordinator sees it.

Mockup: [step-01-approves-a-supplier.html](../../../2.%20design/mockups/journeys/15-run-the-market/mockups/step-01-approves-a-supplier.html)

### 2. Starts a group order

Group orders lists the group's orders with the product, whether the group is buying or selling, the shop or buyer, the state, the bags so far out of the minimum and the number of farmers, for example urea from Kisumu Agro Supplies open at 16 of 20 bags with 8 farmers. Start a group order opens a form where the coordinator picks a shop's posted bulk price and must set the minimum in bags before the order can start.

Mockup: [step-02-starts-a-group-order.html](../../../2.%20design/mockups/journeys/15-run-the-market/mockups/step-02-starts-a-group-order.html)

### 3. Decides for the silent farmers

The open urea order shows the terms it started with and the terms now, as revised by the shop, with 16 bags against a minimum of 20. Every farmer's line shows her bags and her answer: 3 yes, 2 no, 3 waiting. Each farmer who is waiting has a Keep and a Take off button, so the coordinator decides for each silent farmer herself. Call off and Send are at the top, and Send is locked.

Mockup: [step-03-decides-for-the-silent-farmers.html](../../../2.%20design/mockups/journeys/15-run-the-market/mockups/step-03-decides-for-the-silent-farmers.html)

### 4. Sends the order

Send stays locked while the order is below the minimum. With the silent farmers kept the total is still 16 bags, 4 short of 20. The Farmers' agent says so and shows a card, Ask Kisumu Agro Supplies about 16 bags, with Ask the shop and Cancel. It is one ask to the shop; its answer becomes new terms and the farmers say yes to them again. Nothing is recorded until the coordinator presses Ask the shop.

Mockup: [step-04-sends-the-order.html](../../../2.%20design/mockups/journeys/15-run-the-market/mockups/step-04-sends-the-order.html)

### 5. Marks paid or calls it off

Once the shop has said yes with a date the order is Confirmed, with the final terms and total. Each farmer's line shows her bags, the share she was told and whether she has paid. The coordinator presses Mark paid on a line, or Mark not paid to undo it, and the order counts how many have paid. Call off is at the top of the order.

Mockup: [step-05-marks-paid-or-calls-it-off.html](../../../2.%20design/mockups/journeys/15-run-the-market/mockups/step-05-marks-paid-or-calls-it-off.html)

### 6. Corrects a product grouping

Products lists the products the AI grouped the shops' rows under, with the number of rows and shops for each. There is no button to add a product, because suppliers type their own words and the AI groups them. Opening Urea shows each shop's own words and price. Move opens a form with that row, its shop and price, and the products to choose from, and Move row puts it under the product the coordinator picks.

Mockup: [step-06-corrects-a-product-grouping.html](../../../2.%20design/mockups/journeys/15-run-the-market/mockups/step-06-corrects-a-product-grouping.html)

### 7. Changes a rule

The designer opens the agency's rules and changes one. This is the walk in [Change a rule](../19-change-a-rule/README.md).

Mockup: [step-07-changes-a-rule.html](../../../2.%20design/mockups/journeys/15-run-the-market/mockups/step-07-changes-a-rule.html)

### 8. Tests the agency before publishing it

The designer runs the scenarios and publishes. Publish warns about any scenario that has not passed; journey 20 says what the API server does with it. This is the walk in [Test an agency](../20-test-an-agency/README.md).

Mockup: [step-08-tests-the-agency.html](../../../2.%20design/mockups/journeys/15-run-the-market/mockups/step-08-tests-the-agency.html)

## Not yet built

- The market's records and tools behind steps 1 to 6; the tool names in the mockups are illustrative.
- The product grouping and its correction.
