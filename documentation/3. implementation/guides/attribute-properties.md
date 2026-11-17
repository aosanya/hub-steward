# Attribute properties

`actor_list_attribute_properties` lists the attribute names a person's record accepts. It is served at `GET /actors/attribute-properties`, from the action `actor.actor.list_attribute_properties`, by `UserManager.AttributeProperties` in `code/wakala-api/modules/actor/attribute_properties_impl.go`.

## What it returns

The list comes from `models.DefaultActorProperties()` in `modules/actor/models/actor.go`. Each entry has:

| Field | Meaning |
|---|---|
| `name` | The key used when a value is written, such as `phone` |
| `label` | The words a screen shows for it, such as Phone |
| `range` | `text`, `number`, `boolean` or `enumeration` |
| `unique` | Whether two people may not hold the same value |
| `required` | Whether a person must have a value |
| `options` | The allowed values, only for an enumeration |

Today there are two entries, `phone` (Phone) and `email` (Email). Both are text, unique and not required.

## Who may call it

Any signed-in resident, and anyone who holds the `member.edit` permission.

## Why it exists

Person detail shows only the attributes that already have a value, so a form cannot learn from it which names exist. This tool lists the names that have no value yet, so a form can show an empty field to fill in.

## Writing values

Values are written with `actor_set_actor_attributes` (staff, `member.edit`) and `actor_correct_my_attributes` (the person themselves). Both check the values against this same list.

## Used by

MUN1188, editing a person's attributes in People and Staff.

## Where to look

The tool arrived in commit 25ba7f46 and its test in commit 3f6e8a32. The test is `modules/actor/attribute_properties_test.go`.
