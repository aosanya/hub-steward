# Sign in and choose an agency

**Who:** a member.

**Goal:** sign in with an emailed link and go into one of her agencies.

**Result:** she is on the Home screen of an agency, and is asked to sign in again when her session ends.

The mockups are in [mockups/](../../../2.%20design/mockups/journeys/21-sign-in-and-choose-an-agency/mockups/) and can be browsed in order from [index.html](../../../2.%20design/mockups/journeys/21-sign-in-and-choose-an-agency/index.html).

## Steps

1. **Signs in with an emailed link.** [Mockup](../../../2.%20design/mockups/journeys/21-sign-in-and-choose-an-agency/mockups/step-01-signs-in.html).
   - Sign in is an email field, one button that sends a link (Email me a sign-in link) and Change language.
   - After sending, the form stays on screen so a mistyped address can be corrected. The screen says only that a link is on its way if the address can sign in.
   - Opening the link has no screen of its own. It signs her in and lands on Your agencies. With one agency she goes straight to its Home.
   - A link that expired, was used already or carried no token lands on Sign in with one sentence above the field: That sign-in link did not work. It may have expired or been used already. Send yourself a new one.

2. **Picks a language.** [Mockup](../../../2.%20design/mockups/journeys/21-sign-in-and-choose-an-agency/mockups/step-02-picks-a-language.html).
   - Change language opens Select Language: the nine languages, each written in itself, with English shaded, and a Back link to Sign in.
   - Choosing one returns to Sign in in that language.

3. **Sees her agencies.** [Mockup](../../../2.%20design/mockups/journeys/21-sign-in-and-choose-an-agency/mockups/step-03-sees-her-agencies.html).
   - Your agencies has one card for each agency she belongs to, with its name and, where forms are waiting, their count, for example 2 forms waiting.
   - Find an agency sits under the list.
   - With none, one card says No agencies yet and that the agencies she joins will appear here.
   - A member of one agency never sees this screen; she goes straight to that agency.

4. **Finds an agency and joins it.** [Mockup](../../../2.%20design/mockups/journeys/21-sign-in-and-choose-an-agency/mockups/step-04-finds-an-agency.html).
   - Find an agency is one field and a Search button. With nothing typed, it lists the agencies by name, each with its kind.
   - An agency page says what the agency is for. One button reads Join or Ask to join, as the agency chose.

5. **Opens an agency's Home.** [Mockup](../../../2.%20design/mockups/journeys/21-sign-in-and-choose-an-agency/mockups/step-05-opens-home.html).
   - Home of the Siaya Farmers' Group opens with a strip, 'You have N things to do', that opens the Needs you section of Notifications (D157), then lists Start and Ongoing as option cards (Backlogs is a third card only when the task module is on, and Home shows only the cards the agency and role have, D158); the strip is left out when nothing is waiting, and it counts this agency only. Tapping a row opens that screen, which names the agency under its title (D154). Changed by D155: the notifications and the You are all caught up card are on the Notifications page, not on Home.
   - Start shows the agency's tasks as rows: Buy inputs, Sell harvest and Forms, then Join a group and Apply as a supplier. The Community Computer Lab's Start has Join a group as its only row.
   - Ongoing lists what she has begun and not finished. With nothing, it is one card, Nothing ongoing yet, with Go to Start inside it.
   - The bar holds the page title and a hamburger button at the top right. It opens a drawer with My profile, Switch agency, Change language and Sign out. Switch agency opens Your agencies; with one agency it returns her to that agency's Home.
   - The bottom bar reads Home, Chat and Notifications in every agency, on every screen, and the Notifications button carries the number of things waiting on her, the same as the Home strip, and a dot when unread updates exist (D155, D158). A screen opened from an option keeps the bar with none chosen, and Home is the way back (D154). Changed by D154: it was Do Something, Chat, Inbox. Changed by D155: Notifications is the third button.

6. **Is asked to sign in again.** [Mockup](../../../2.%20design/mockups/journeys/21-sign-in-and-choose-an-agency/mockups/step-06-signs-in-again.html).
   - A session that was refused or could not be renewed lands on Sign in with one sentence above the email field: Your session ended. Sign in again.

## Not yet built

- Choosing a language changes the entry screens' words in English and Kiswahili only. The other seven languages show English.
- My profile, Change language (from the drawer) and Sign out open no screen.
- A member of one agency has no route to Find an agency: the app sends her past Your agencies, where Find an agency sits.
- A live agency shows the Join a group and Apply as a supplier entries only after its template is published again.
