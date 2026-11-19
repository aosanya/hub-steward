# Attribute properties

`actor_list_attribute_properties` lists the attribute names a person's record accepts. It is served at `GET /actors/attribute-properties`, from the action `actor.actor.list_attribute_properties`, by `UserManager.AttributeProperties` in `attribute_properties_impl.go` of `github.com/aosanya/mwanachama-backend-actor` (the hub imports it at v0.1.0).

## What it returns

The list comes from `models.DefaultActorProperties()` in `models/actor.go` of that repository. Each entry has:

| Field | Meaning |
|---|---|
| `name` | The key used when a value is written, such as `phone` |
| `label` | The words a screen shows for it, such as Phone |
| `range` | `text`, `number`, `boolean`, `enumeration` or `date` |
| `unique` | Whether two people may not hold the same value |
| `required` | Whether a person must have a value |
| `options` | The allowed values, only for an enumeration |
| `not_future` | Only for a date: a day that has not come yet is refused, as for a date of birth |

Today there are three entries. `phone` (Phone) and `email` (Email) are text, unique and not required. `date_of_birth` (Date of birth, MUN1518) is a date, not unique, not required and never in the future.

## A date

A date is a real day written `YYYY-MM-DD`; `1984-02-30` or `09/03/1984` is refused. The phone app shows a date picker for it on Edit details and Add person (`personProperties.ts` in `app/menu/sections/residents`) and reads it on the Personal detail card as a day in words with its year, such as Friday, 9 Mar 1984. Two people may share a day. For the backend custodian: `mwanachama-backend-actor` mirrors this module and needs the same range.

## Who may call it

Any signed-in resident, and anyone who holds the `member.edit` permission.

## Why it exists

Person detail shows only the attributes that already have a value, so a form cannot learn from it which names exist. This tool lists the names that have no value yet, so a form can show an empty field to fill in.

## Writing values

Values are written with `actor_set_actor_attributes` (staff, `member.edit`) and `actor_correct_my_attributes` (the person themselves). Both check the values against this same list.

## Used by

MUN1188, editing a person's attributes in People and Staff.

## Where to look

The tool arrived in commit 25ba7f46 and its test in commit 3f6e8a32. The test is `attribute_properties_test.go` in `mwanachama-backend-actor`.
