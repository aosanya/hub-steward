import { McpError } from "../wakala/mcp";
import { createFakeAiBackend, probeMessage, providerAnswered, providerRefused, testSentences } from "./fakeAiBackend";

const savedKey = "rk-saved-0123456789abcdef";
const typedKey = "rk-typed-0123456789abcdef";

const seen: string[] = [];
const backend = createFakeAiBackend({
  hubId: "h",
  roles: [],
  provider: async ({ key }) => {
    seen.push(key);
    return key === typedKey ? providerRefused(80) : providerAnswered("OK", 40);
  },
});

let minted = 0;

const accountArgs = () => ({
  name: `main ${++minted}`,
  provider: "openai_compatible",
  base_url: "https://api.meta.ai/v1",
  model_name: "muse-spark-1.3",
  status: "enabled",
});

const seeded = async () => {
  const made = (await backend.callTool("h", "ai_create_account", accountArgs())) as { id: string };
  await backend.callTool("h", "ai_set_account_key", { accountID: made.id, key: savedKey });
  return made.id;
};

describe("the fake AI backend tests a typed key the way the real one does", () => {
  it("asks the provider with the typed key, answers with the result, and stores nothing", async () => {
    const id = await seeded();
    const before = JSON.stringify(backend.accounts());

    const answer = (await backend.callTool("h", "ai_test_account", { accountID: id, key: typedKey })) as Record<string, unknown>;

    expect(seen.at(-1)).toBe(typedKey);
    expect(answer).toMatchObject({ last_test_result: testSentences.refused, last_test_prompt: probeMessage, last_test_ms: 80 });
    expect(JSON.stringify(backend.accounts())).toBe(before);
    expect(JSON.stringify(answer)).not.toContain(typedKey);
  });

  it("asks with the saved key and stores the result when no key is given", async () => {
    const id = await seeded();

    await backend.callTool("h", "ai_test_account", { accountID: id });

    expect(seen.at(-1)).toBe(savedKey);
    expect(backend.accounts().find((row) => row.id === id)).toMatchObject({ last_test_result: testSentences.working, last_test_reply: "OK" });
  });

  it("refuses a blank typed key without asking the provider", async () => {
    const id = await seeded();
    const asked = seen.length;

    await expect(backend.callTool("h", "ai_test_account", { accountID: id, key: "   " })).rejects.toBeInstanceOf(McpError);
    expect(seen).toHaveLength(asked);
  });
});
