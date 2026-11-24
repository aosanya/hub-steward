# Unit test findings
- mwanachama-backend-agency/models/step_cover_test.go: AnswerActionOf (and ActionOf's send_form/notify/yes_no sentences) via lowerFirst slice the first byte, so a form name starting with a multibyte letter such as "Édith" yields invalid UTF-8; expected "Answers the édith".
- code/app/src/shared/language/placeholders.test.ts: wordsFor("constructor") returns Object's own function instead of the English words; expected the English table for any code that is not a language.
