# Options

Status

- The Actor, Notifies and Who adds rows pickers read a typed list of four roles; a role used by a drawn step was missing from it (closed on 2026-10-29, decision 94; `studio/_generator/pages_workflows.py`).
- "Picks from" offers five sources typed in the generator; the forms `question` has no field naming a source (closed on 2026-10-29, decision 94; `mwanachama-backend-forms/forms.blueprint.json`).
- The drawn answer types are six; the forms module declares ten, so the editor hides four (closed on 2026-10-29, decision 94).
- Operators, step kinds and attachments have no declaring module; they are the framework's own vocabulary and need a home for the Test page and the app to share (open).
- The Proposed notes list four step kinds, the Kind picker six (see `step-kinds.md`).

Log

## 2026-10-29 14:40 UTC

First run of this file. Traced each picker's constant to the module that could produce it.
