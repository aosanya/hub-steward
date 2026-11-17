import { englishLabel, menuJs, menuTs, report } from "./check-lib.mjs";

const jsEntries = menuJs().ENTRIES;
const tsEntries = menuTs().entries;
const jsById = new Map(jsEntries.map((e) => [e.id, e]));
const tsById = new Map(tsEntries.map((e) => [e.id, e]));
const findings = [];

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const shared = (entries, other) => entries.map((e) => e.id).filter((id) => other.has(id));

tsEntries.filter((e) => !jsById.has(e.id)).forEach((e) => findings.push(`id ${e.id}: in menu.ts, missing from menu.js`));
jsEntries.filter((e) => !tsById.has(e.id)).forEach((e) => findings.push(`id ${e.id}: in menu.js, missing from menu.ts`));

const jsOrder = shared(jsEntries, tsById);
const tsOrder = shared(tsEntries, jsById);
jsOrder.forEach((id, i) => {
  if (tsOrder.indexOf(id) !== i) {
    findings.push(`order ${id}: follows ${jsOrder[i - 1] ?? "(start)"} in menu.js but ${tsOrder[tsOrder.indexOf(id) - 1] ?? "(start)"} in menu.ts`);
  }
});

const fields = {
  section: (e) => e.section ?? null,
  kinds: (e) => [...e.kinds].sort(),
  children: (e) => e.children ?? [],
  dividedBefore: (e) => Boolean(e.dividedBefore),
  hidden: (e) => Boolean(e.hidden),
};

for (const id of jsOrder) {
  for (const [name, pick] of Object.entries(fields)) {
    const js = pick(jsById.get(id));
    const ts = pick(tsById.get(id));
    if (!same(js, ts)) findings.push(`${name} ${id}: menu.js ${JSON.stringify(js)} but menu.ts ${JSON.stringify(ts)}`);
  }
}

for (const id of new Set([...jsById.keys(), ...tsById.keys()])) {
  const english = englishLabel(id);
  const label = jsById.get(id)?.label;
  if (english === undefined) findings.push(`label ${id}: menu.${id} missing from i18n.json en`);
  else if (label !== undefined && label !== english) findings.push(`label ${id}: menu.js "${label}" but i18n.json "${english}"`);
}

report(findings);
