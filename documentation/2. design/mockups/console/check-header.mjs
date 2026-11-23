import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { htmlFiles, lineOf, read, rel, report } from "./check-lib.mjs";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const findings = [];
const files = htmlFiles().filter((file) => /shell\.js/.test(read(file)));

const DECLARED = [
  { name: ".top", open: /<div class="top"[^>]*>/g, pattern: /^<div class="top" data-title="[^"]*"[^>]*><\/div>$/ },
  { name: ".section-head", open: /<div class="section-head"[^>]*>/g, pattern: /^<div class="section-head" data-title="[^"]*"[^>]*><\/div>$/ },
  { name: ".notice", open: /<div class="notice[^"]*"[^>]*>/g, pattern: /^<div class="notice" data-tone="(ok|bad)" data-text="[^"]*"><\/div>$/ },
  { name: ".draft", open: /<section class="draft"[^>]*>/g, pattern: /^<section class="draft"[^>]*data-text="[^"]*"[^>]*data-button="[^"]*"[^>]*><\/section>$/ }
];

for (const file of files) {
  const text = read(file);
  for (const { name, open, pattern } of DECLARED) {
    for (const match of text.matchAll(open)) {
      const end = text.indexOf("</", match.index + match[0].length);
      const closing = name === ".draft" ? "</section>" : "</div>";
      const block = text.slice(match.index, end + closing.length);
      if (!pattern.test(block)) findings.push(`${rel(file)}:${lineOf(text, match.index)}: ${name} is not written as the shared declaration`);
    }
  }
  for (const match of text.matchAll(/class="top-end"|class="top-meta"|class="actions"/g)) {
    findings.push(`${rel(file)}:${lineOf(text, match.index)}: ${match[0]} is written by hand; parts.js draws it`);
  }
}

const probe = `(() => {
  const found = [];
  const px = (css) => {
    const el = document.createElement("div");
    el.style.cssText = "position:absolute;visibility:hidden;" + css;
    document.body.append(el);
    const measured = { height: el.getBoundingClientRect().height, fontSize: parseFloat(getComputedStyle(el).fontSize) };
    el.remove();
    return measured;
  };
  const head = px("height:var(--head-h)").height;
  const titleSize = px("font-size:var(--head-title-size)").fontSize;
  const chip = px("height:var(--head-chip-h)").height;
  const near = (a, b) => Math.abs(a - b) < 0.6;
  const tops = [...document.querySelectorAll(".top")];
  tops.forEach((top, i) => {
    const at = "screen " + (i + 1);
    const h1 = top.querySelector(":scope > h1");
    if (!h1) found.push(at + ": .top has no h1");
    else if (!near(parseFloat(getComputedStyle(h1).fontSize), titleSize)) found.push(at + ": the title is not --head-title-size");
    if (!near(top.getBoundingClientRect().height, head)) found.push(at + ": the header is not --head-h high");
    const end = top.querySelector(":scope > .top-end");
    if (end) {
      [...end.children].forEach((child) => {
        if (!child.matches("label.toggle, .actions")) found.push(at + ": a loose " + child.tagName.toLowerCase() + " stays in .top-end");
      });
      if (end.querySelectorAll(".actions").length > 1) found.push(at + ": more than one Actions menu");
      const button = end.querySelector(".actions > .btn");
      if (button) {
        const box = button.getBoundingClientRect();
        if (!near(box.height, chip)) found.push(at + ": the Actions button is not --head-chip-h high");
        if (!near(parseFloat(getComputedStyle(button).fontSize), parseFloat(getComputedStyle(document.querySelector(".chat-ctx") || button).fontSize))) {
          found.push(at + ": the Actions button font differs from the chat tag");
        }
        if (!end.querySelector(".actions-menu .actions-item svg, .actions-menu .actions-item .tool-spin")) found.push(at + ": an action has no icon");
        end.querySelectorAll(".actions-item").forEach((item) => {
          if (!item.querySelector("svg, .tool-spin")) found.push(at + ": the action " + item.textContent.trim() + " has no icon");
        });
      }
    }
  });
  document.querySelectorAll(".cols").forEach((cols, i) => {
    const top = cols.querySelector(":scope > .main > .top");
    const chatHead = cols.querySelector(":scope > .chat > .chat-head");
    if (!top || !chatHead) return;
    const main = cols.querySelector(":scope > .main").getBoundingClientRect();
    const chat = cols.querySelector(":scope > .chat").getBoundingClientRect();
    if (Math.abs(main.top - chat.top) > 2) return;
    if (!near(top.getBoundingClientRect().bottom, chatHead.getBoundingClientRect().bottom)) found.push("screen " + (i + 1) + ": the header line and the chat head line differ");
  });
  const result = document.createElement("pre");
  result.id = "header-result";
  result.textContent = JSON.stringify({ tops: tops.length, found });
  document.body.append(result);
})()`;

const decode = (text) => text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

let covered = 0;
if (!existsSync(CHROME)) {
  findings.push("no Chrome at " + CHROME + "; set CHROME to run the layout part of this check");
} else {
  const work = mkdtempSync(join(tmpdir(), "check-header-"));
  for (const file of files) {
    const base = pathToFileURL(dirname(file) + "/").href;
    const page = read(file)
      .replace("<head>", `<head><base href="${base}">`)
      .replace(/(<script src="[^"]*shell\.js"><\/script>)/, `$1<script>${probe}</script>`);
    const copy = join(work, rel(file).replace(/\//g, "__"));
    writeFileSync(copy, page);
    const run = spawnSync(CHROME, ["--headless=new", "--disable-gpu", "--window-size=1440,900", "--virtual-time-budget=4000", "--dump-dom", pathToFileURL(copy).href], {
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024
    });
    const result = /<pre id="header-result">(.*?)<\/pre>/s.exec(run.stdout || "");
    if (!result) {
      findings.push(`${rel(file)}: the page did not run`);
      continue;
    }
    const { tops, found } = JSON.parse(decode(result[1]));
    covered += 1;
    if (tops === 0) continue;
    for (const line of found) findings.push(`${rel(file)}: ${line}`);
  }
  rmSync(work, { recursive: true, force: true });
}

console.log(`pages checked: ${files.length}, run in Chrome: ${covered}`);
report(findings);
