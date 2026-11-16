import { forgetRuntimeConfig, setRuntimeConfig } from "../../../shared/wakala/config";
import { forgetSubject, loadSubject } from "../../../shared/wakala/me";
import { memberId, resolveMember } from "./api";

const answer = (status: number, body: unknown) => vi.fn().mockResolvedValue({ ok: status === 200, status, json: async () => body });

describe("the member the supply screens act as", () => {
  beforeEach(() => {
    forgetSubject();
    setRuntimeConfig({ wakala: "https://api.example" });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    forgetRuntimeConfig();
    window.localStorage.clear();
  });

  it("is the signed-in subject once wakala has answered", async () => {
    vi.stubGlobal("fetch", answer(200, { subject: "m7", agencies: [] }));
    await loadSubject();
    expect(memberId()).toBe("m7");
  });

  it("prefers an injected id and falls back to the stored one", async () => {
    vi.stubGlobal("fetch", answer(401, {}));
    expect(await resolveMember("injected")).toBe("injected");
    window.localStorage.setItem("hubsteward.member", "stored");
    expect(await resolveMember()).toBe("stored");
  });
});
