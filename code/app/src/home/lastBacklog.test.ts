import { forgetOpenAgency, openAgency } from "../agency/open";
import { backlogIdOfPath, forgetLastBacklogs, lastBacklogId, rememberBacklog } from "./lastBacklog";

afterEach(() => {
  forgetOpenAgency();
  forgetLastBacklogs();
});

describe("last opened backlog", () => {
  it("is empty until a backlog is opened and then holds the latest one", () => {
    openAgency("alego");
    expect(lastBacklogId()).toBe("");
    rememberBacklog("b1");
    rememberBacklog("b2");
    expect(lastBacklogId()).toBe("b2");
  });

  it("is kept for each agency on its own", () => {
    openAgency("alego");
    rememberBacklog("b1");
    openAgency("siaya");
    expect(lastBacklogId()).toBe("");
    rememberBacklog("b9");
    openAgency("alego");
    expect(lastBacklogId()).toBe("b1");
  });

  it("reads the backlog id out of a backlogs path and ignores the other screens", () => {
    expect(backlogIdOfPath("/a/alego/backlogs/b1/board")).toBe("b1");
    expect(backlogIdOfPath("/a/alego/backlogs/s%201/smart")).toBe("s 1");
    expect(backlogIdOfPath("/a/alego/backlogs/b1")).toBe("b1");
    expect(backlogIdOfPath("/a/alego/backlogs")).toBe("");
    expect(backlogIdOfPath("/a/alego/backlogs/all")).toBe("");
    expect(backlogIdOfPath("/a/alego/backlogs/new")).toBe("");
    expect(backlogIdOfPath("/a/alego/backlogs/new/smart")).toBe("");
    expect(backlogIdOfPath("/a/alego/backlogs/issue/abc")).toBe("");
  });
});
