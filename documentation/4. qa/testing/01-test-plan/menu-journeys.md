# Menu journeys

Ten small journeys, one per section of the phone app's Menu, check the drawings of the Menu screens and save a picture of each step.

## What they test

The drawings are the pages `documentation/2. design/mockups/app/menu.html` and `menu-<section>.html`. They are static pages opened as files. The journeys do not call the API server and need no running stack; they check that each drawing is on its page, reads as the design says, and opens from `menu.html`.

| Journey | Page | Path of the person |
|---|---|---|
| MUN940, Home | `menu.html` | Home shows the section rows, a section lists its submenus, a submenu with no screen says Not available yet, Back returns to Home |
| MUN941, Residents | `menu-residents.html` | Residents, All Residents, a resident, then Households, Registrations, Groups & Associations, Communications |
| MUN942, Properties & Addresses | `menu-properties.html` | Properties, a property, then Addresses, Ownership & Tenure, Land Use & Zoning |
| MUN943, Issues & Requests | `menu-issues.html` | All Issues, an issue, then Assigned to Me, Overdue, Map View, Service Types |
| MUN944, Services & Permits | `menu-services.html` | Applications, an application, then Permits, Licences, Fees & Payments, Service Catalogue |
| MUN945, Assets & Works | `menu-assets.html` | Roads & Paths, a road or path, then Buildings, Water Points, Street Lights, Work Orders, Maintenance Schedule |
| MUN946, Council & Decisions | `menu-council.html` | Meetings, a meeting, then Agendas & Minutes, Resolutions, Bylaws, Committees |
| MUN947, Staff & Departments | `menu-staff.html` | Staff, a staff member, then Departments, Crews, Roles & Permissions |
| MUN948, Finance | `menu-finance.html` | Budget (phone and wide drawing), a budget line, then Revenue & Billing, Procurement, Payments, Financial Reports |
| MUN949, Settings | `menu-settings.html` | Municipality Profile, then Users & Roles, Boundaries & Wards, Integrations, Audit Log |

## Rules every journey follows

- Each figure has its caption rows Landing, Filled by and Example data.
- Where no tool fills a field, the caption says so.
- Example data is marked as sample.
- The top bar's Back reads the name of the screen the person came from.
- The bottom bar has Home chosen.
- The page opens from `menu.html`.
- A drawing that is wrong or missing fails its own step only; the defect is filed as its own issue and the test is not weakened.

## Run them

From `code/console`:

```sh
npm run e2e:menu
```

One spec for each journey is in `code/console/e2e/menu/`. The first run needs the browser once: `npx playwright install chromium`.

## Where the pictures land

`documentation/4. qa/testing/03-screenshots/menu/<NN-section>/<step>.png`, with `00-home` for Home and `01` to `09` for the sections in the order above. Each run replaces the pictures of the journeys it runs. They are listed in [Screenshots](../03-screenshots/README.md#menu-drawings).
