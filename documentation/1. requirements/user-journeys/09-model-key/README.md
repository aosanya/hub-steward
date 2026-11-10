# Model key

**Goal:** The agency's agents can read people's words with a key the agency holds.

**Result:** A manager never needs a shell variable.

Mockups: [all steps](../../../2.%20design/mockups/journeys/09-model-key/index.html).

## Steps

### 1. Sets the key

The manager opens Status, the page that helps set up the hub. Its heading reads "Finish setting up your hub" until everything is ready, then "Your hub is ready", with a count such as "3 of 4 ready" and a bar. Below it is a row of tiles, for example in a farmers' group: Group coordinator, Members, Farmers' agent and Suppliers' agent (one tile naming every AI role), and Model key. While the agency has no model key, the title row carries an Add a model button, and the Model key tile reads "Needed to reply".

Models, under Settings, lists the agency's models, one card each with the provider, the model id, whether a key is set or "No key", and "Used by N roles" as a link to the model's Users tab. Each card has an Edit link and a Remove link. A search box filters the cards, and below them "Available to add" lists the standard models of each provider with an Add link. With no model yet it shows "No model yet. Add one so the hub's agents can reply." and an Add a model button.

Adding a model is one page:

1. A Provider dropdown lists Meta Model API first, then Meta open weights (your own server), Hugging Face, Claude and Other (OpenAI-compatible). Meta Model API, Meta open weights and Other also ask for a base address, which must start with https://. Claude is stored as an Anthropic account; every other choice is stored as an OpenAI-compatible account and told apart by its base address. The API also accepts Gemini accounts, which this page does not offer.
2. A Model dropdown follows the provider. It shows the provider's standard list and Other model… for a name typed by hand, under the line "Save the key to see every model it can use". Meta Model API preselects its newest model; the other providers ask the manager to choose.
3. The Connect a model card says what the key is for: "This key lets the hub's agents read members' messages and write replies. It is used by this hub only, and never shown again after you save it." The manager types the key and presses Save. The first Save adds the model, shows the notice "Model added" and stores the key; the button then reads Saved and the key field is empty. The key is never shown again, not even in part.
4. The page then asks the provider for the models the key can use ("Loading models from…" in the Model dropdown), shows them under From your key above the standard list with a Refresh models link, and offers Try again, after "Could not read the list from … Showing the standard list.", if the list cannot be read.
5. If the manager then chooses a different model, Save model appears beside Test connection; a Back to Models link leaves the page. The page does not return to Models by itself.

An agency holds several models and adding a second never replaces the first. No default model is built in: the agency's default is a flag on one model, and when none is set the console marks the first enabled model with a key as the default (the API call is `ai_set_default_account`). Only the first is offered for the chat unless the manager ticks "Can be used in the chat" on another. The Model key tile then reads the provider and "set".

The agency's agents use this agency's key and model; another agency has its own. The key is sealed in the API's database with the server's `AI_MASTER_KEY`.

Mockup: [set the key](../../../2.%20design/mockups/journeys/09-model-key/mockups/step-01-set-the-key.html)

### 2. Tests the key

A model's page has four tabs: Key and test, Limits, Users and Usage. On Key and test the manager presses Test connection. The Connect a model card shows the provider and, where it has one, the base address as plain text, the Model dropdown, and a Replace the key field. One short request goes to the provider with the agency's key. The screen shows "Sending a short message to the provider…", then the line it sent ("Sent: …") and one result line: "Answered" with the model's reply and how long it took, for example "Answered: “…” · 640 ms". If it fails it says "Not working: " with one plain reason: no key is set for this account, the model refused the key, the model could not be reached, or the model answered with an error. The key never appears in the result.

Choosing a different model in the dropdown shows Save and Cancel; saving keeps the key. Remove is a link on the model's card in Models. It asks first ("Remove …? Agents that use it will have no model.") with a red Remove model button and Cancel, and the notice then reads "… was removed."

Mockup: [test the key](../../../2.%20design/mockups/journeys/09-model-key/mockups/step-02-test-the-key.html)

## Open

Checked against the console and the bundled API on 2026-11-04.

- What an agent does in a hub with no key. The API answers "no key is set for this account"; no code here skips the hub with one plain log line.
- A shell variable as a fallback for an agency's key. None was found; `AI_MASTER_KEY` only seals the keys the manager saves.
- The test-the-key mockup draws "Remove this model" on the model's page and the notice "Model removed". The console has Remove as a link on the Models card and says "… was removed."
