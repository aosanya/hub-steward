# Form answer types

A form question has a type that fits what it asks, so the answer is entered with the right control and read back in plain words.

| Type | Entered with | Stored in | Read back as |
|---|---|---|---|
| yes_no | two choices | value_bool | the question's yes and no words |
| single_choice, multi_select | a list | option_ids | the labels |
| free_text | a text box | value_text | the text |
| date | a date picker | value_date | the day |
| time | a time picker | value_time | HH:MM |
| time_range | From and To time pickers | value_time and value_time_to | from 09:00 to 22:00 |
| number, currency | a number box | value_number | the number with its unit |
| photo, file | a file picker | file_ids | the count |

## Time range

- Both times are required, written HH:MM on a 24 hour clock, and To is strictly after From.
- value_time_to is a column of its own; the one-value check on an answer still counts value_time only, so a range is one value.
- The app keeps a draft as "09:00-22:00" and shows the question as one group with From and To under the prompt, shared by every form entry screen.
- A form that already holds free-text answers to a question keeps them; a question is retyped only while it has no answers.
- The agency work item steps have their own answer type set and do not use this one.
