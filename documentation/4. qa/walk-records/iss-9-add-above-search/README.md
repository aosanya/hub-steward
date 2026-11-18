# Add above Search on every list

Shots of QA 5181 (preview built from hub-steward dev at e4a7aec6 on 2026-11-18, signed in as the QA council user) of every menu list that creates what it lists, at 390 and 1440 wide: `<screen>-phone.png` and `<screen>-wide.png`.

- **Carry the full-width primary Add above Search:** Departments (Add department), Crews (Add crew), Staff and People and Users & Roles (Add person), Businesses (Add business), Informal traders (Add trader), Holdings (Add holding), Wishes (Send a wish), Meetings, Resolutions, Bylaws, Committees (Add meeting, Add resolution, Add bylaw, Add committee), Work Orders (Add work order), Maintenance schedule (Add schedule), Service Catalogue (Add service), Boundaries & Areas (Add area).
- **Carry none on purpose:** Applications and Roles & Permissions. Applications lists what the signed-in person sent, and Start an application needs the person it is for, so it is an act on the person's page. A role is defined in the agency's design and given to a person from the person's page. The rule is written in `documentation/3. implementation/guides/menu-screen-pattern.md`.
- **Checked from the page on each shot:** one Add button of the expected name, before Search in the document, not in the header, about the width of the list pane (92 percent wide, 100 percent on a phone), and no other loose Add beside it. The result of the machine check is in `report.json`; the Businesses and Informal traders button waits for the hub to say the register may add rows, so the first Businesses pass read it too early and was taken again.
- The other buttons the check lists on People, Committees and Users & Roles (Add to a group, Start an application, Raise on their behalf, Add holding, Add member, Open the resident page) are acts in the open record's cards, not list Adds.

Not tried on QA: pressing Save on the Departments, Crews and the council Adds (the unit tests cover the calls; the area create and the work order, schedule and catalogue creates were accepted live earlier and their throwaways removed, and there is no group delete tool, so no throwaway department was made).

## One screen for Add and Edit (second pass)

The shots in `one-screen/` were taken on QA 5181 built from the dev tip after Add and Edit became one screen for Departments, Crews, Maintenance Schedule, Boundaries, work orders, catalogue entries and assets. Throwaway rows named "zz iss9fin2" were made and deleted afterwards.

| Shot | What it shows |
|---|---|
| work-order-add-wide, work-order-add-phone | Add work order: heading, empty Title, Save, Cancel |
| work-order-edit-wide, work-order-edit-phone | Edit work order: the same screen with the order's own title filled in |
| asset-list-wide, asset-list-phone | Add asset above the list, full width |
| asset-add-wide, asset-add-phone | Add asset: Name and Tag |
| asset-edit-wide | Edit asset: the same screen with the asset's own fields |

Pressed live: Save on a work order Add and on an asset Add listed the new row, and Save on each Edit changed it in the hub. Departments, Crews and Boundaries create groups and there is no group delete tool, so their Save is covered by the unit tests only.

A live Save on the work order Edit showed that the shared form sent `version` to `taskmanager_task_patch`, which takes none, so the screen stayed put. The catalogue entry Edit had the same fault with `forms_catalog_entry_upsert`. Both screens now send no version.
