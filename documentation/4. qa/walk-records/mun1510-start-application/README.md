# MUN1510: Start an application lists only the forms that reach the person

Taken on QA 5181 (hub-steward dev tip 6a2d9fa9, instance Zöldhalom Town Council) as own14, phone 390 x 844 and wide 1440 x 900 at 2x.

| Shot | Person | What it shows |
|---|---|---|
| outside-wide.png, outside-phone.png | Takács Erzsébet, in the MUN1033 Services Desk group | The five MUN1033 forms sent to that group. "Street event permit application, Zöldhalom" is not offered, because it was sent only to the Zöldhalom Applications Desk and she is not in it. Before the change it was offered and filing it was refused with "the person is not in the audience of any group the form was sent to". |
| inside-wide.png, inside-phone.png | The signed-in clerk, in the Zöldhalom Applications Desk group | The Zöldhalom forms, "Street event permit application, Zöldhalom" among them. |

A person who is in no group the forms were sent to gets "There is no application for <Name> to start." (covered by the vitest case; no QA resident is in that position).
