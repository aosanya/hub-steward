import { splitOptions } from "./optionLines";

describe("a question the model leaves hanging on a dash before its option lines", () => {
  it("ends on a question mark once the option lines are taken out", () => {
    const written = "Found 8 for walk-02 bulk, all in To do in Backlog. Which one did you mean —\n[[repo walk-02]]\n[[tag bulk]]\n[[title word bulk]]";
    expect(splitOptions(written)).toEqual({
      text: "Found 8 for walk-02 bulk, all in To do in Backlog. Which one did you mean?",
      options: ["repo walk-02", "tag bulk", "title word bulk"],
    });
  });

  it("also closes a question hung on a hyphen or an en dash", () => {
    expect(splitOptions("Which one do you mean -\n[[a]]").text).toBe("Which one do you mean?");
    expect(splitOptions("Which one do you mean –\n[[a]]").text).toBe("Which one do you mean?");
  });

  it("leaves a dash alone when there are no option lines", () => {
    expect(splitOptions("Which one did you mean —").text).toBe("Which one did you mean —");
  });

  it("leaves a sentence that is not a question alone", () => {
    expect(splitOptions("Give a narrower word —\n[[a]]").text).toBe("Give a narrower word —");
  });

  it("leaves a question that already ends well alone", () => {
    expect(splitOptions("Which one did you mean?\n[[a]]").text).toBe("Which one did you mean?");
  });
});
