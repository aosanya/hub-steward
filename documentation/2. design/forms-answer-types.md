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
| address | a searchable list of the town's streets and addresses, and a free text box where the question allows it | value_text and place_ref | the street and number, or the typed words |
| number, currency | a number box | value_number | the number with its unit |
| photo, file | a file picker | file_ids | the count |

## Time range

- Both times are required, written HH:MM on a 24 hour clock, and To is strictly after From.
- value_time_to is a column of its own; the one-value check on an answer still counts value_time only, so a range is one value.
- The app keeps a draft as "09:00-22:00" and shows the question as one group with From and To under the prompt, shared by every form entry screen.
- A form that already holds free-text answers to a question keeps them; a question is retyped only while it has no answers.
- The agency work item steps have their own answer type set and do not use this one.

## Address

- The list is read from the digital twin's addresses; each street is offered once, then each address as street and number. A search narrows it, and at most six rows show at a time, with a line asking the person to keep typing while more match.
- value_text holds the words that read back ("Fő tér 2", "Fő tér" or the typed words). place_ref is a link, never shown: address: with the address's id, street: with the street's name, empty where the words were typed.
- allow_free_text is a setting of the question, off by default, and only an address question carries it. Without it an answer with no place_ref is refused; with it the form shows a "Something else" box beside the list.
- The forms module keeps no list of places, because the digital twin is another module. The registry hands each forms manager a check (AddressCheck) that asks the twin whether a place_ref names a held address or a street with at least one address; a send or a correction naming any other place_ref is refused as an invalid answer. Typed words with no place_ref are not looked up.
- The workflow designer's own answer type set (agency work item steps) offers both. A step answer is text: a time range reads from 09:00 to 17:00 and is refused unless To is after From, and an address reads as the words picked or typed. A step question carries allow_free_text only when it is an address question. The rule for the time range and the shape of a place reference live once in modules/shared/answerrules, which the forms and agency modules both use. The place reference travels with a step answer: the step answers request (and the agency_submit_step_answers tool) takes place_refs, by prompt, and the saved register row keeps them in place_refs beside the words. The same twin check as the forms refuses a place_refs entry for a question that is not an address, one the town does not hold, or one sent without its words; an address answer typed as words with no reference is refused unless the question allows free text. The step screen shows the same picker as the forms.
