# AI accounts

**Goal:** An agency holds the models its agents use and knows that each one works and what it has used.

**Result:** A manager never types a model key into an agent's environment, and never learns a limit was reached from a bill.

**Who:** The agency manager

The agency manager adds the models the agency's agents will speak with, checks that each one works, caps what it may use, and reads what it has used. The console calls an AI account a model and lists the models under Settings, in Models.

Mockups: [all steps in order](../../../2.%20design/mockups/journeys/10-ai-accounts/index.html).

## Steps

### 1. Adds a model

On Models the manager chooses Add a model and picks a provider: Meta Model API, Meta open weights (Baseten, Modal or your own server), Hugging Face, Claude, or Other (OpenAI-compatible). A second list offers the standard models for that provider, and Other model… asks for the model's name. Meta Model API, Meta open weights and Other also show a base address, which must start with https://; Meta Model API's is prefilled. Claude is stored as an Anthropic account and every other choice as an OpenAI-compatible account, told apart by its base address; the API also accepts Gemini accounts, which this page does not offer. The manager types only the key, into a field named for the provider. The first Save adds the model and stores the key together, with the notice "Model added"; the button then reads Saved and the field empties. The console then asks the provider which models the key can use and lists them above the standard ones, with a Refresh models link; if the list cannot be read it says so, shows the standard list and offers Try again. Choosing another model from that list offers Save model, which changes the one just added, and Back to Models returns to the list, where each model is a card with its provider, model id, key and the number of roles that use it. An agency holds several models and adding one never replaces another. The key is never shown again. Who may add a model or set a key is decided by the API's permissions; the console hides Key and test from a staff seat.

Mockup: [step-01-add-an-account.html](../../../2.%20design/mockups/journeys/10-ai-accounts/mockups/step-01-add-an-account.html)

### 2. Tests the model

On the model's page, in Key and test, the manager chooses Test connection. One short request goes to the provider with the agency's key, and a log under the buttons shows the message sent and either the answer with the time, for example "Answered: “…” · 640 ms", or "Not working" with one plain reason: no key is set, the model refused the key, the model could not be reached, or the model answered with an error. The last result stays on the model, and the key never appears in it. The same page changes the model and replaces the key. A model is removed from the Models list, after a confirmation ("Remove … ? Agents that use it will have no model.").

Mockup: [step-02-test-the-account.html](../../../2.%20design/mockups/journeys/10-ai-accounts/mockups/step-02-test-the-account.html)

### 3. Sets the model's limits

In Limits the manager sets any of seven limits: tokens per call, day, week and month, and requests per minute, day and week. Each has an Applies switch, and with the switch off its field reads "No limit". Save limits keeps them, and they cap every AI role that uses the model. Owners and staff seats can do this.

Mockup: [step-03-set-the-limits.html](../../../2.%20design/mockups/journeys/10-ai-accounts/mockups/step-03-set-the-limits.html)

### 4. Sees usage

In Usage one table shows the use against each limit that applies: what is used, the maximum and the share. A second table splits this month's use by AI role, one row per agent. A reached limit reads as one plain sentence, for example "this account's monthly token limit is reached", and its row reads Reached. A staff seat sees Limits and Usage but not Key and test.

Mockup: [step-04-usage.html](../../../2.%20design/mockups/journeys/10-ai-accounts/mockups/step-04-usage.html)

## Not yet built and open

- Open: which of the listed models have been tried against a live provider is not recorded; the backend has adapters for OpenAI-compatible providers, Claude and Gemini, and the Models page offers the first two.
- Open: the console shows a staff seat the Limits, Usage and Users tabs and hides Key and test; whether the API lets that seat read limits and usage was not confirmed.
