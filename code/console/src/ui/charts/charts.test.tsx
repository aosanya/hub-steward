import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DonutChart, Heatmap, RankedBars, StackedBars, heatLevel, shortTokens } from "./index";

describe("shortTokens", () => {
  it("writes thousands and millions as the design does", () => {
    expect(shortTokens(950)).toBe("950");
    expect(shortTokens(720000)).toBe("720k");
    expect(shortTokens(1950000)).toBe("1.95M");
    expect(shortTokens(2000000)).toBe("2M");
  });
});

describe("StackedBars", () => {
  const series = [
    { name: "Alpha", color: "var(--m1)", values: [100000, 0, 20000] },
    { name: "Beta", color: "var(--m2)", values: [50000, 30000, 0] },
  ];

  it("stacks each day by series and gives every segment its value as text", () => {
    const { container } = render(<StackedBars labels={["1 Oct", "2 Oct", "3 Oct"]} series={series} title="Tokens per day" />);
    const titles = [...container.querySelectorAll("title")].map((t) => t.textContent);
    expect(titles).toContain("1 Oct · Alpha: 100,000 tokens");
    expect(titles).toContain("1 Oct · Beta: 50,000 tokens");
    expect(titles).toContain("1 Oct · 150,000 tokens in all");
    expect(titles).toContain("2 Oct · Beta: 30,000 tokens");
    expect(titles).not.toContain("2 Oct · Alpha: 0 tokens");
  });

  it("names the peak day and the legend totals", () => {
    render(<StackedBars labels={["1 Oct", "2 Oct", "3 Oct"]} series={series} title="Tokens per day" />);
    expect(screen.getByText("Peak 1 Oct: 150k")).toBeTruthy();
    expect(screen.getByText("Alpha").parentElement?.textContent).toContain("120k");
    expect(screen.getByRole("img", { name: "Tokens per day" })).toBeTruthy();
  });

  it("keeps the peak note clear of the axis title when the peak day is early in the month", () => {
    const { container } = render(<StackedBars labels={["3 Oct", "4 Oct", "5 Oct"]} series={[{ name: "Alpha", color: "var(--m1)", values: [400000, 100000, 50000] }]} title="Tokens per day" />);
    const axisY = Number(container.querySelector(".ch-axis")?.getAttribute("y"));
    const peakY = Number(container.querySelector(".ch-peak")?.getAttribute("y"));
    expect(peakY - axisY).toBeGreaterThanOrEqual(20);
  });

  it("says so plainly when there is nothing to draw", () => {
    render(<StackedBars labels={["1 Oct"]} series={[{ name: "A", color: "red", values: [0] }]} title="t" emptyText="Nothing yet" />);
    expect(screen.getByText("Nothing yet")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("DonutChart", () => {
  const slices = [
    { name: "Chat", color: "var(--k1)", value: 750000 },
    { name: "Test run", color: "var(--k4)", value: 250000 },
    { name: "Unused", color: "var(--k2)", value: 0 },
  ];

  it("lists each slice with its tokens and share, and skips an empty one", () => {
    const { container } = render(<DonutChart slices={slices} center="1M" sub="tokens" title="Share by kind of work" />);
    expect(screen.getByText("750k · 75%")).toBeTruthy();
    expect(screen.getByText("250k · 25%")).toBeTruthy();
    expect(screen.queryByText("Unused")).toBeNull();
    const titles = [...container.querySelectorAll("circle title")].map((t) => t.textContent);
    expect(titles).toEqual(["Chat: 750,000 tokens, 75%", "Test run: 250,000 tokens, 25%"]);
    expect(screen.getByText("1M")).toBeTruthy();
  });

  it("draws nothing but a message when every slice is zero", () => {
    render(<DonutChart slices={[{ name: "A", color: "red", value: 0 }]} center="0" sub="tokens" title="t" emptyText="Nothing yet" />);
    expect(screen.getByText("Nothing yet")).toBeTruthy();
  });
});

describe("RankedBars", () => {
  it("shows shares of the total and the input and output of each row as text", () => {
    render(
      <RankedBars
        rows={[
          { name: "Farmers' agent", tokensIn: 900000, tokensOut: 300000 },
          { name: "Suppliers' agent", tokensIn: 500000, tokensOut: 250000 },
        ]}
      />,
    );
    expect(screen.getByText("1.2M · 62%")).toBeTruthy();
    expect(screen.getByText("750k · 38%")).toBeTruthy();
    expect(screen.getByLabelText("Farmers' agent: 900,000 tokens in, 300,000 tokens out")).toBeTruthy();
  });

  it("makes a row with onOpen a button that fires it", () => {
    const open = vi.fn();
    render(
      <RankedBars
        rows={[
          { name: "Farmers' agent", tokensIn: 10, tokensOut: 5, onOpen: open },
          { name: "Suppliers' agent", tokensIn: 4, tokensOut: 1 },
        ]}
      />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Farmers' agent/ }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("renders the empty message for no rows", () => {
    render(<RankedBars rows={[]} emptyText="Nothing yet" />);
    expect(screen.getByText("Nothing yet")).toBeTruthy();
  });
});

describe("Heatmap", () => {
  const columns = [
    { name: "Chat", color: "var(--k1)" },
    { name: "Test run", color: "var(--k4)" },
  ];

  it("shades by share of the biggest cell and writes a dash for zero", () => {
    const { container } = render(<Heatmap rowNames={["Alpha", "Beta"]} columns={columns} matrix={[[720000, 85000], [0, 390000]]} title="Model by kind of work" />);
    const cells = [...container.querySelectorAll("td")];
    expect(cells.map((c) => c.textContent)).toEqual(["720k", "85k", "–", "390k"]);
    expect(cells.map((c) => c.className)).toEqual(["h5", "h2", "h0", "h4"]);
    expect(cells[0].getAttribute("aria-label")).toBe("Alpha · Chat: 720,000 tokens");
    expect(screen.getByRole("table", { name: "Model by kind of work" })).toBeTruthy();
  });

  it("levels follow the design's thresholds", () => {
    expect([0, 10, 25, 45, 70, 100].map((v) => heatLevel(v, 100))).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("renders the empty message when every cell is zero", () => {
    render(<Heatmap rowNames={["Alpha"]} columns={columns} matrix={[[0, 0]]} title="t" emptyText="Nothing yet" />);
    expect(screen.getByText("Nothing yet")).toBeTruthy();
  });
});

describe("words", () => {
  it("takes the page's own words for the fixed ones", () => {
    render(<RankedBars rows={[{ name: "A", tokensIn: 3, tokensOut: 1 }]} words={{ input: "Eingabe", output: "Ausgabe", tokensIn: "Token ein", tokensOut: "Token aus" }} />);
    expect(screen.getByText("Eingabe")).toBeTruthy();
    expect(screen.getByLabelText("A: 3 Token ein, 1 Token aus")).toBeTruthy();
  });
});
