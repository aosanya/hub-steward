# Run with another model

A hub's model is a *model account* in the API. Add one on the console's Models page, or with `POST /instances/{id}/ai/accounts`.

| Field | Value |
|---|---|
| `provider` | `openai_compatible`, `anthropic` or `gemini` |
| `base_url` | Must start with `https://` and point to a public host. `http://localhost` is refused |
| `model_name` | The provider's model name |
| `status` | `enabled` |

Meta's Muse Spark and any other server that speaks the OpenAI chat format use `openai_compatible` with that server's own `base_url`; the console's add-model test does this with `https://api.meta.ai/v1` and `muse-spark-1.3`. There is no provider value for Meta, Baseten or Hugging Face, and no default model: the manager marks one account as the agency's default.

Set the key with `PUT /instances/{id}/ai/accounts/{accountId}/key` and body `{"key":"..."}`, then use the Models page's test button. The API only stores keys when it starts with `AI_MASTER_KEY` set to 16, 24 or 32 characters.

Verified: account creation, and the refusal of a local address. Not verified: calls to any live provider, so a local model server needs a public HTTPS address.
