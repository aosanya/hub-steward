const files = Object.keys(import.meta.glob("./sections/**/*.tsx"));

const separateAddScreens = ["GroupNewScreen", "WorkOrderNewScreen", "ScheduleNewScreen", "ServiceNewScreen", "BoundaryNewScreen"];

describe("one edit screen for Add and Edit", () => {
  it.each(separateAddScreens)("has no separate %s beside its Edit screen", (name) => {
    expect(files.filter((file) => file.endsWith(`/${name}.tsx`))).toEqual([]);
  });

  it("has no shared AddScreen that only the separate Add screens used", () => {
    expect(Object.keys(import.meta.glob("./*.tsx")).filter((file) => file.endsWith("/AddScreen.tsx"))).toEqual([]);
  });
});
