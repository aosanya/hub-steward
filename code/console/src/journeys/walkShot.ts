import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const styles = ["design.css", "ui/ui.css", "ui/notice.css", "ui/draftBar.css", "ui/segmented.css"].map((file) => readFileSync(resolve(__dirname, "..", file), "utf8")).join("\n");

const keepChoices = (root: HTMLElement) => {
  root.querySelectorAll("select").forEach((select) => {
    Array.from(select.options).forEach((option) => (option.selected ? option.setAttribute("selected", "") : option.removeAttribute("selected")));
  });
  root.querySelectorAll("input").forEach((input) => {
    input.setAttribute("value", input.value);
    if (input.checked) input.setAttribute("checked", "");
    else input.removeAttribute("checked");
  });
};

export const savePage = (root: HTMLElement, folder: string, name: string) => {
  keepChoices(root);
  mkdirSync(folder, { recursive: true });
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${styles}</style></head><body><div data-theme="dark" style="padding:1.5rem;min-height:100vh;box-sizing:border-box;background:var(--bg)"><div style="max-width:60rem">${root.innerHTML}</div></div></body></html>`;
  writeFileSync(join(folder, name), page);
};
