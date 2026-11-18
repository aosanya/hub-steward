# Menu screen pattern

How a screen in the menu is built once it has been restyled. The reference is the resident page (`code/app/src/app/menu/sections/residents/PersonScreen.tsx`) and its mockup, `residents/resident.html` in the municipality repo's `documentation/2. design/mockups/app/`. Every screen that shows a chosen record follows it; a screen with no record (a map, a calendar, a plain report) keeps its own body but takes the bottom bar and the chat.

## The page

- **Title:** the chosen record's name is the page title, with its status as one quiet line under it. There is no header band and no section caption above the title.
- **Cards:** each section is a square card from the shared `Section` (`shared/ui/Section.tsx`): a header with the large section word, the count and a chevron that collapses it; the rows divided by hairlines; a footer of full-width items divided by hairlines. A card shows at most three rows.
- **Footer:** at most two items, in a fixed order: See all with the count on the left (neutral text colour), the act on the right (accent colour, bold). With three rows or fewer there is no See all and the act is the whole footer. An act names its object ("Add to a group", "Start an application", "Raise on their behalf", "Add holding"); it shows only to a reader who holds its permission, and a footer that would be empty is not drawn. An empty card carries the same act in its footer.
- **Rows:** a list-type row is a media object (`ListRow` inside `Section`): a square icon tile, the title in a medium weight, a lighter line, a light square status tag (`statusTone` in `Chip.tsx`: Open and received in the warning hue, paid and done in the success hue, anything else neutral) and a chevron. Facts, such as the Personal detail card, are plain label and value rows with no tile (`plain`).
- **One Edit screen:** a record is edited on one screen opened by Edit in the first card's footer, not by several buttons on the page. A register row (business, informal trader) is edited by a replacing row, so its Edit shows only to someone who may add rows to the register (`can_add_rows`), and the Owner or Holder row opens the resident.
- **See all:** a section's own screen (`/:section`) carries the filter strip (`shared/ui/SectionFilter.tsx`): status tabs with counts when two or more statuses exist, a search row past three rows, a count line, and "Show all" when nothing matches.

## The shell

- The screen is a `MenuWindow` with `withTabs` and `bandless`: the usual bottom bar (Home, Chat, Notifications) sits under it, and the list stays beside the page on a wide screen.
- On a phone a record opened from a link has a Back arrow named after the list (when there is no origin), or an "All <list>" row above the page (when there is one), so the list is always reachable.
- **Chat:** the Chat tab opens the assistant about what is on screen, with an "About <name>" line that can be cleared. The carried subject (`app/chatAbout.ts`) names its kind: resident, group, registration, conversation, business, trader, and later the kinds of the other sections. The assistant reads the subject only through existing read tools and the asking user's own permissions, offers pressable choices for that kind, and answers a general question with an overview.

## Type scale

A card page uses three sizes and no others, all in rem against the 90% root: the page title at 1.5rem, and everything that carries content at 1rem (card heading, row title, the value under a label, the lighter line of a media-object row in list panes and detail panes alike, the quiet line under the title); counts, tags, the right-hand text of a row and tab counts sit one step below at .875rem. The value under a label is told apart from its label by weight and the soft ink, not by being smaller: the soft ink holds a contrast of 9.29 to 1 on the light surface and 7.28 to 1 on the dark one, so only the size was the problem. A multi-line value takes a line height of 1.4. The scale is set once in `section.css` and the row rules of `app.css`; a screen never sets its own font size.

## Where it was settled

The resident page and its cards are ISS-20 to ISS-25 and MUN1452 to MUN1465; the Households, Groups, Registrations, Communications, Businesses and Informal traders screens are ISS-28 to ISS-33; the chat subject is ISS-34. The other menu sections follow in ISS-35 (Properties & Addresses), ISS-36 (Issues & Requests), ISS-37 (Services & Permits), ISS-38 (Assets & Works), ISS-39 (Council & Decisions), ISS-40 (Staff & Departments), ISS-41 (Finance) and ISS-42 (Settings); each starts by walking its screens and recording which of them show a record.

The wording of the card guide for screens built in code is in [phone-app-structure.md](phone-app-structure.md).
