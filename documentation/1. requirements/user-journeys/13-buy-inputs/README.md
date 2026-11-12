# Buy inputs

**Goal:** Buys farm inputs from the shops she picks, alone or together with other farmers.

**Result:** She sees every shop's price, buys at the price she saw, and finds what is not listed.

**Who:** The farmer

The setting is the farmers' agency, one example agency among the demo's eight; any agency with a market for its members works the same way.

A farmer opens Buy inputs in her group's chat with the Farmers' agent, compares the shops' own prices, buys alone or joins a group order for a bulk price, asks shops for what is not listed, and follows her orders.

Mockups: [all steps in order](../../../2.%20design/mockups/journeys/13-buy-inputs/index.html).

## Steps

### 1. Opens the market

She opens Buy inputs, a row on Start, which she opens from Home. The Farmers' agent asks what she wants to buy and lists nothing up front, because the products may be many. She answers "Urea" and sees the cheapest shops, one card each, in the shop's own words with its price and its own Buy now button: Kisumu Agro Supplies, Urea 50kg, KES 3,800 a bag; Siaya Farm Stores, UREA 46% 50KG, KES 3,950 a bag; and Show 1 more shop brings Bondo Agrovet, urea (bag), KES 4,100 a bag. A bulk price sits under a shop's price: KES 3,750 from 30 bags at Siaya Farm Stores, and at Kisumu Agro Supplies an open group order at KES 3,600 from 20 bags with Buy together beside it. She sees every price before she chooses, and nobody is asked anything, because a posted price answers by itself.

Mockup: [step-01-opens-the-market.html](../../../2.%20design/mockups/journeys/13-buy-inputs/mockups/step-01-opens-the-market.html)

### 2. Buys now

She presses Buy now beside Kisumu Agro Supplies' Urea 50kg and fills in how many (2 bags) and the day she needs them (Friday, 6 Nov). Her order shows Waiting with the price she saw, KES 3,800 a bag and KES 7,600 in all, and the agent says it is asking the shop. There is no timer: a shop that has not answered simply has no answer yet. When the shop says yes the order shows Yes with the shop's date, at the price she saw. Cancel is her own button on an order that is waiting or has a yes; after it the order shows Cancelled and the agent says it is telling the shop.

Mockup: [step-02-buys-now.html](../../../2.%20design/mockups/journeys/13-buy-inputs/mockups/step-02-buys-now.html)

### 3. Joins a group order

From Join beside the open group order she sees the Urea order: the terms it started with, the bags ordered so far and the number of farmers. She sees the total and the count, never another farmer's name or amount. Join the group order asks one thing, how many (2 bags), and Join is her own button. If the shop changes its bulk price, the order's page asks her, "Do you accept KES 3,700 a bag from 20 bags?", beside the terms it started with and her own share (2 bags, KES 7,400); the agent does not yet tell her in the thread (see Not yet built). Yes and No are her own buttons, and if she says nothing her line waits, with no timer. Once the order is sent and the shop says yes, her order shows Confirmed with her share, the confirmed price and the total. The shop's date and its note, "Collect at the shop", are not shown yet (see Not yet built).

Mockup: [step-03-joins-a-group-order.html](../../../2.%20design/mockups/journeys/13-buy-inputs/mockups/step-03-joins-a-group-order.html)

### 4. Finds something not listed

When what she wants is not on the market she opens Ask for something not listed and fills in what she wants (Hybrid maize seed 614), how much (10 kg) and when (Friday, 6 Nov). The agent says no shop has listed it, and she chooses Ask shops or Put up a notice. Ask shops lists the shops and she ticks the ones to ask; only those are asked, once each. Her page then shows who answered: one shop said yes with a price for 10 kg and a Buy now, another said no, and a third still shows Waiting. A notice shows what she wants, how much and by when to every shop and stays up until she presses Take it down.

Mockup: [step-04-finds-something-not-listed.html](../../../2.%20design/mockups/journeys/13-buy-inputs/mockups/step-04-finds-something-not-listed.html)

### 5. Sees her orders

My orders lists her Buy now orders and group orders, each with its quantity, how she ordered, the price it was made at and its state, for example Paid for the group order and Cancelled for the Buy now. Opening one shows the order as it was made: the supplier, her share, the price, the total and the date. A group order she joined adds a trail of plain dated lines (she joined, the shop asked to revise, she said yes, the shop said yes for Friday, the coordinator marked her paid); a Buy now order has no trail yet. She sees only her own line of a group order.

Mockup: [step-05-sees-her-orders.html](../../../2.%20design/mockups/journeys/13-buy-inputs/mockups/step-05-sees-her-orders.html)

## Not yet built

- Tappable prompts and shop cards inside the agent's thread; today the thread links to the shops page.
- The Needed by date reaching the shop from Buy now. The form takes it and the order page shows it, but it is passed to the order page in the browser and not sent with the order, so it is gone after a reload. On a not-listed request it is sent (`needed_by`).
- A No state on an order, and the agency's own cancel workflow. Not checked against the code.
- On a confirmed group order: the coordinator's name, the shop's date and note, the agent telling her in the thread, and a link to her order.
- A unit on a not-listed request: the request has a quantity and no unit, so the farmer types the unit into the quantity. An order has its unit, taken from the offer's unit words.
- A shop's yes on the not-listed page that names no offer: it shows what the shop wrote, with no price and no button. A yes that names one of the shop's offers shows its price and a Buy now.
- A trail on a Buy now order. A group order the farmer joined shows a dated trail (`market_order_trail`) on its page; the Buy now order's page has none.
