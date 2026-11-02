export const rowBars = (container: ParentNode): string[][] =>
  Array.from(container.querySelectorAll(".row-tools")).map((bar) =>
    Array.from(bar.querySelectorAll("button")).map((button) => button.textContent?.trim() ?? ""),
  );
