# Search a live record's rows

`agency_list_live_record_rows` takes a `where` list, so a seat finds the rows it needs in one call instead of reading the whole record and narrowing by eye.

## The call

Each condition is a `question` (a prompt of the record's form), an `operator` and a `value`. Every condition must hold, and the order does not matter.

```json
{
  "tool": "agency_list_live_record_rows",
  "record_code": "RC-1",
  "where": [
    {"question": "Expertise areas", "operator": "contains", "value": "Financial inclusion"},
    {"question": "Free from", "operator": "on_or_before", "value": "2027-03-01"},
    {"question": "Status", "operator": "is", "value": "Active"}
  ]
}
```

A condition that names a question the record does not ask, an operator outside the list, a blank value, or a value the operator cannot read is refused with a message naming the condition. It is never ignored.

## Operators

| Operator | Holds when |
|---|---|
| `is`, `is_not` | the answer equals the value, ignoring case |
| `contains` | on a multi-select question, one chosen option equals the value; on any other question, the answer holds the value as text |
| `more_than`, `less_than` | the answer and the value are numbers and the answer is above or below |
| `on_or_before`, `on_or_after` | the answer and the value are written days (`2027-03-01`) and the answer is not after or not before the value |

## How a multi-select answer is stored

Several options in one answer are joined with a semicolon and a space: `Financial inclusion; Sustainable finance`. Writing a row checks that every part is an option of the question, that none is empty and that none repeats. `contains` therefore matches one whole option: `finance` finds no row whose option is `Sustainable finance`.

The step-answer path joins a multi-select with a comma and a space; rows written there are not split by this search.

## Who sees the rows

The seat that adds rows to the record sees every row, and the owner too. Anyone else sees only the rows that name them, and a search narrows within that, so it never shows more. The record's `viewer_role_id` is stored but this read does not use it, so a seat that searches a record must hold its adding role.

## Where it lives

- `internal/api/http/record_mcp.go`: the `where` parameter and the tool description
- `internal/api/http/record_rows.go`: `constraintsOf` reads the conditions and `liveRowsOf` applies them after the visibility rule
- `internal/api/http/step_routing.go`: the operators, shared with step routing rules
- `internal/api/http/record_rows_where_test.go`: the search over eight invented rows and the refusals
