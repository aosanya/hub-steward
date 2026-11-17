# Unit test findings
- code/wakala-api/modules/agency/models/step_cover_test.go: AnswerActionOf (and ActionOf's send_form/notify/yes_no sentences) via lowerFirst slice the first byte, so a form name starting with a multibyte letter such as "Édith" yields invalid UTF-8; expected "Answers the édith".
