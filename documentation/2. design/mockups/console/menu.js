const ICONS = (typeof window !== "undefined" && window.HubSteward && window.HubSteward.icons) || {};

const SECTIONS = {
  agency: "Agency",
  usersAgents: "Users &amp; Agents",
  generated: "Generated",
  knowledge: "Knowledge",
  settings: "Settings"
};

const EVERY = ["lab", "farmers", "riders"];
const LAB_AND_RIDERS = ["lab", "riders"];
const FARMERS = ["farmers"];
const REVIEW = ["review-profile", "review-goals", "review-objectives", "review-roles", "review-workflows", "review-risks", "review-tests"];

const ENTRIES = [
  { id: "status", label: "Status", icon: "pulse", section: null, kinds: EVERY, href: "status/status.html" },
  { id: "profile", label: "Profile", icon: "doc", section: "agency", kinds: EVERY, href: "agency/profile/profile.html" },
  { id: "goals", label: "Goals", icon: "target", section: "agency", kinds: EVERY, href: "agency/goals/goals.html" },
  { id: "objectives", label: "Objectives", icon: "flag", section: "agency", kinds: FARMERS, href: "agency/goals/objectives.html" },
  { id: "roles", label: "Roles", icon: "people", section: "agency", kinds: EVERY, href: "agency/roles/roles.html" },
  {
    id: "workflows", label: "Workflows", icon: "sliders", section: "agency", kinds: EVERY, href: "agency/workflows/workflows.html",
    children: ["workflows-designed", "workflows-generated"]
  },
  { id: "workflows-designed", label: "Designed", icon: "edit", section: "agency", kinds: EVERY, href: "agency/workflows/workflows.html" },
  { id: "workflows-generated", label: "Generated", icon: "sparkle", section: "agency", kinds: EVERY, href: "agency/workflows/workflows-generated.html" },
  { id: "test", label: "Test", icon: "clipboard", section: "agency", kinds: FARMERS, href: "agency/test/test.html" },
  {
    id: "risks", label: "Risks", icon: "shield", section: "agency", kinds: EVERY, href: "agency/risks/risks.html",
    children: ["bowties", "hazards", "threats", "consequences", "controls"]
  },
  { id: "bowties", label: "Bowties", icon: "grid", section: "agency", kinds: EVERY, href: "agency/risks/bowties.html" },
  { id: "hazards", label: "Hazards", icon: "grid", section: "agency", kinds: EVERY, href: "agency/risks/hazards.html" },
  { id: "threats", label: "Threats", icon: "grid", section: "agency", kinds: EVERY, href: "agency/risks/threats.html" },
  { id: "consequences", label: "Consequences", icon: "grid", section: "agency", kinds: EVERY, href: "agency/risks/consequences.html" },
  { id: "controls", label: "Controls", icon: "shield", section: "agency", kinds: EVERY, href: "agency/risks/controls.html" },
  { id: "modules", label: "Modules", icon: "package", section: "agency", kinds: EVERY, href: "agency/modules/modules.html" },
  { id: "publish-review", label: "Review", icon: "eye", section: "agency", kinds: EVERY, href: "agency/publish/review.html", dividedBefore: true, children: REVIEW },
  { id: "review-profile", label: "Profile", icon: "doc", section: "agency", kinds: EVERY, href: "agency/publish/review-profile.html" },
  { id: "review-goals", label: "Goals", icon: "target", section: "agency", kinds: EVERY, href: "agency/publish/review-goals.html" },
  { id: "review-objectives", label: "Objectives", icon: "flag", section: "agency", kinds: FARMERS, href: "agency/publish/review-objectives.html" },
  { id: "review-roles", label: "Roles", icon: "people", section: "agency", kinds: EVERY, href: "agency/publish/review-roles.html" },
  { id: "review-workflows", label: "Workflows", icon: "sliders", section: "agency", kinds: EVERY, href: "agency/publish/review-workflows.html" },
  { id: "review-risks", label: "Risks", icon: "shield", section: "agency", kinds: EVERY, href: "agency/publish/review-risks.html" },
  { id: "review-tests", label: "Tests", icon: "clipboard", section: "agency", kinds: EVERY, href: "agency/publish/review-tests.html" },
  { id: "publish", label: "Publish", icon: "send", section: "agency", kinds: EVERY, href: "agency/publish/publish.html" },
  { id: "users", label: "Users", icon: "people", section: "usersAgents", kinds: EVERY, href: "people/members.html" },
  { id: "groups", label: "Groups", icon: "chat", section: "usersAgents", kinds: EVERY, href: "people/groups.html" },
  { id: "agents", label: "Agents", icon: "robot", section: "usersAgents", kinds: EVERY, href: "people/agents.html" },
  { id: "approvals", label: "Approvals", icon: "check", section: "generated", kinds: LAB_AND_RIDERS, href: "work/approvals.html" },
  {
    id: "operations", label: "Operations", icon: "activity", section: "generated", kinds: LAB_AND_RIDERS, href: "work/operations.html",
    children: ["network", "activity", "alerts"]
  },
  { id: "network", label: "Network", icon: "wifi", section: "generated", kinds: LAB_AND_RIDERS, href: "work/operations-network.html", hidden: true },
  { id: "activity", label: "Activity", icon: "pulse", section: "generated", kinds: LAB_AND_RIDERS, href: "work/operations-activity.html" },
  { id: "alerts", label: "Alerts", icon: "alert", section: "generated", kinds: LAB_AND_RIDERS, href: "work/operations-alerts.html" },
  { id: "records", label: "Records", icon: "grid", section: "generated", kinds: LAB_AND_RIDERS, href: "work/records.html" },
  { id: "equipment", label: "Equipment", icon: "laptop", section: "generated", kinds: ["riders"], href: "work/equipment.html" },
  { id: "documents", label: "Documents", icon: "file", section: "knowledge", kinds: LAB_AND_RIDERS, href: "knowledge/documents.html" },
  { id: "general", label: "General", icon: "gear", section: "settings", kinds: EVERY, href: "settings/general.html" },
  { id: "consent", label: "Consent text", icon: "doc", section: "settings", kinds: EVERY, href: "settings/consent.html" },
  {
    id: "models", label: "Models", icon: "grid", section: "settings", kinds: EVERY, href: "settings/models.html",
    children: ["models-configure", "assistant", "usage"]
  },
  { id: "models-configure", label: "Configure", icon: "gear", section: "settings", kinds: EVERY, href: "settings/models.html" },
  { id: "assistant", label: "Assistant", icon: "robot", section: "settings", kinds: EVERY, href: "settings/assistant.html" },
  { id: "usage", label: "Usage", icon: "chart", section: "settings", kinds: EVERY, href: "settings/usage-overview.html", children: ["usage-overview", "usage-work", "usage-agents"] },
  { id: "usage-overview", label: "Overview", icon: "chart", section: "settings", kinds: EVERY, href: "settings/usage-overview.html" },
  { id: "usage-work", label: "Kind of work", icon: "grid", section: "settings", kinds: EVERY, href: "settings/usage-work.html" },
  { id: "usage-agents", label: "Agents and people", icon: "people", section: "settings", kinds: EVERY, href: "settings/usage-agents.html" },
  { id: "access-keys", label: "Access keys", icon: "key", section: "settings", kinds: EVERY, href: "settings/access-keys.html" }
];

const DETAILS = {
  functions: "workflows-designed",
  "workflow-edit": "workflows-designed",
  "workflow-generated": "workflows-generated",
  "agent-edit": "agents",
  "calc-step": "workflows-designed"
};
const LANDING = { models: "models-configure", workflows: "workflows-designed" };
const SIGN_OUT = { label: "Sign out", href: "entry/sign-in.html" };

const entryOf = (id) => ENTRIES.find((e) => e.id === id);
const isChild = (id) => ENTRIES.some((e) => (e.children || []).includes(id));
const shown = (kind) => (e) => e && e.kinds.includes(kind) && !e.hidden;
const hasDescendant = (e, id) => (e.children || []).some((k) => k === id || hasDescendant(entryOf(k), id));

const svg = (size, inner, width) =>
  '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' +
  (width || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + "</svg>";

const rowOf = (e, kind, page, badges) => {
  const kids = (e.children || []).map(entryOf).filter(shown(kind));
  const row = { entry: e, current: e.id === page, kids: [] };
  let count = Number(badges[e.id] || 0);
  if (kids.length) {
    row.expanded = e.id === page || hasDescendant(e, page);
    if (row.expanded) row.kids = kids.map((k) => rowOf(k, kind, page, badges));
    else count += kids.reduce((sum, k) => sum + Number(badges[k.id] || 0), 0);
  }
  row.badge = count;
  return row;
};

const link = (row, root, depth) => {
  const e = row.entry;
  const classes = "nav-link" + (depth > 1 ? " sub deep" : depth ? " sub" : "");
  const current = row.current ? ' aria-current="page"' : "";
  const expanded = row.expanded === undefined ? "" : ' aria-expanded="' + row.expanded + '"';
  const badge = row.badge ? '<span class="nav-badge">' + row.badge + "</span>" : "";
  const chev = row.expanded === undefined ? "" : '<span class="nav-chev">' + svg(14, ICONS[row.expanded ? "chevron-down" : "chevron-right"], 2.2) + "</span>";
  const end = badge || chev ? '<span class="nav-end">' + badge + chev + "</span>" : "";
  const target = e.href ? ' href="' + root + e.href + '"' : ' href="#" title="Opens: ' + e.label + ' (not drawn yet)"';
  const rule = e.dividedBefore ? '<div class="menu-rule" role="separator"></div>\n' : "";
  return rule + '<a class="' + classes + '"' + target + current + expanded + '><span class="nav-icon page">' +
    svg(depth ? 14 : 16, ICONS[e.icon]) + "</span>" + e.label + end + "</a>";
};

const flatten = (row, root, depth) =>
  [link(row, root, depth)].concat(row.kids.flatMap((k) => flatten(k, root, depth + 1)));

const sections = (kind) => {
  const groups = [];
  ENTRIES.filter((e) => shown(kind)(e) && !isChild(e.id)).forEach((e) => {
    const last = groups[groups.length - 1];
    if (last && last.section === e.section) last.entries.push(e);
    else groups.push({ section: e.section, entries: [e] });
  });
  return groups;
};

const renderMenu = (o) => {
  const page = LANDING[DETAILS[o.current] || o.current] || DETAILS[o.current] || o.current;
  const groups = sections(o.agency).map((g) => {
    const cls = g.section === "settings" ? "menu-group divided" : "menu-group";
    const head = g.section ? '<div class="eyebrow">' + SECTIONS[g.section] + "</div>\n" : "";
    const rows = g.entries.flatMap((e) => flatten(rowOf(e, o.agency, page, o.badges), o.root, 0));
    return '<div class="' + cls + '">\n' + head + rows.join("\n") + "\n</div>";
  });
  return '<div class="menu">\n' + groups.join("\n") + "\n</div>\n\n" +
    '<div class="side-foot"><a class="nav-link" href="' + o.root + SIGN_OUT.href + '"><span class="nav-icon">' +
    svg(16, ICONS.logout) + "</span>" + SIGN_OUT.label + "</a></div>";
};

const list = (value) => (value ? value.split(",").map((v) => v.trim()).filter(Boolean) : []);

const optionsOf = (nav, root) => ({
  root,
  agency: nav.dataset.agency,
  current: nav.dataset.current,
  badges: Object.fromEntries(list(nav.dataset.badges).map((b) => b.split(":")))
});

if (typeof document !== "undefined") {
  const script = document.currentScript;
  const root = script.getAttribute("src").replace(/menu\.js$/, "");
  document.querySelectorAll("nav.side[data-agency]").forEach((nav) => {
    nav.innerHTML = renderMenu(optionsOf(nav, root));
  });
}

if (typeof module !== "undefined") module.exports = { renderMenu };
