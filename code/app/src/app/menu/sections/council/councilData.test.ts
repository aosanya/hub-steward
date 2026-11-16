import { describe, expect, it } from "vitest";
import { councilTools, readBylawArgs, readMeetingArgs, readResolutionArgs } from "./councilData";
import { councilPaths } from "./paths";

describe("council data contract", () => {
  it("names the real council tools", () => {
    expect(councilTools).toEqual({
      meetingCreate: "council_meeting_create",
      meetingList: "council_meeting_list",
      meetingRead: "council_meeting_read",
      agendaSet: "council_agenda_set",
      agendaRead: "council_agenda_read",
      minutesSet: "council_minutes_set",
      minutesRead: "council_minutes_read",
      resolutionCreate: "council_resolution_create",
      resolutionList: "council_resolution_list",
      resolutionRead: "council_resolution_read",
      bylawCreate: "council_bylaw_create",
      bylawList: "council_bylaw_list",
      bylawRead: "council_bylaw_read",
    });
  });

  it("builds read arguments with the path parameter names", () => {
    expect(readMeetingArgs("m1")).toEqual({ meetingID: "m1" });
    expect(readResolutionArgs("r1")).toEqual({ resolutionID: "r1" });
    expect(readBylawArgs("b1")).toEqual({ bylawID: "b1" });
  });

  it("has the council screen path patterns", () => {
    expect({
      committees: councilPaths.committees.pattern,
      meetings: councilPaths.meetings.pattern,
      agendas: councilPaths.agendas.pattern,
      resolutions: councilPaths.resolutions.pattern,
      bylaws: councilPaths.bylaws.pattern,
    }).toEqual({
      committees: "/a/:agencyId/menu/council/committees",
      meetings: "/a/:agencyId/menu/council/meetings",
      agendas: "/a/:agencyId/menu/council/agendas",
      resolutions: "/a/:agencyId/menu/council/resolutions",
      bylaws: "/a/:agencyId/menu/council/bylaws",
    });
  });
});
