import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { useUsageQuery } from "./useUsageQuery";

const future = { v7_startTransition: true, v7_relativeSplatPath: true };

const open = (search: string) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter future={future} initialEntries={["/h/h1/usage" + search]}>
      {children}
    </MemoryRouter>
  );
  return renderHook(() => ({ query: useUsageQuery(), location: useLocation() }), { wrapper });
};

describe("the Usage query in the address", () => {
  it("defaults to this month by agent with no role", () => {
    const { result } = open("");
    expect(result.current.query).toMatchObject({ span: "month", group: "agent", role: "" });
  });

  it("reads a known span, the person grouping and a role", () => {
    const { result } = open("?span=last_month&group=person&role=r9");
    expect(result.current.query).toMatchObject({ span: "last_month", group: "person", role: "r9" });
  });

  it("falls back to the defaults for words it does not know", () => {
    const { result } = open("?span=forever&group=planet");
    expect(result.current.query).toMatchObject({ span: "month", group: "agent" });
  });

  it("writes a changed span and group into the address", () => {
    const { result } = open("");
    act(() => result.current.query.change({ span: "7d", group: "person" }));
    expect(new URLSearchParams(result.current.location.search).get("span")).toBe("7d");
    expect(new URLSearchParams(result.current.location.search).get("group")).toBe("person");
    expect(result.current.query).toMatchObject({ span: "7d", group: "person" });
  });

  it("takes a value out of the address when it goes back to its default", () => {
    const { result } = open("?span=7d&group=person&role=r1");
    act(() => result.current.query.change({ span: "month", group: "agent", role: "" }));
    expect(result.current.location.search).toBe("");
  });

  it("keeps the other values when it changes one", () => {
    const { result } = open("?span=today&role=r1");
    act(() => result.current.query.change({ group: "person" }));
    expect(new URLSearchParams(result.current.location.search).toString()).toBe("span=today&role=r1&group=person");
  });

  it("replaces the history entry instead of adding one", () => {
    const { result } = open("");
    act(() => result.current.query.change({ role: "r2" }));
    expect(result.current.location.search).toBe("?role=r2");
  });
});
