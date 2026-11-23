(() => {
  const { svg } = window.HubSteward;
  const OPEN = "data-open";
  const live = new Set();

  const escape = (text) =>
    String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const listOf = (el, key) => (el.dataset[key] ? JSON.parse(el.dataset[key]) : []);

  const ICONS = [
    [/^enhance/i, "wand"],
    [/again$/i, "refresh"],
    [/^running/i, "clock"],
    [/^run/i, "play"],
    [/^stop/i, "stop"],
    [/^print/i, "printer"],
    [/^download/i, "download"],
    [/^upload/i, "upload"],
    [/^publish/i, "send"],
    [/^save/i, "check"],
    [/^(edit|rename)/i, "edit"],
    [/^(remove|delete)/i, "trash"],
    [/^(cancel|close)/i, "cross"],
    [/^invite/i, "user-plus"],
    [/^(add|create|new|allocate)/i, "plus"]
  ];

  const iconFor = (label) => (ICONS.find(([pattern]) => pattern.test(label)) || [null, "arrow"])[1];

  const linkAttrs = (item) =>
    (item.href ? ' href="' + escape(item.href) + '"' : "") +
    (item.opens ? ' title="Opens: ' + escape(item.opens) + '" aria-label="' + escape(item.label + ", opens: " + item.opens) + '"' : "");

  const rankOf = (item) => (item.kind === "danger" ? 2 : item.kind === "primary" ? 0 : 1);

  const menuItem = (item) =>
    "<" + (item.href ? "a" : "button type=\"button\"") + ' class="actions-item' + (item.kind ? " " + item.kind : "") + '" role="menuitem"' +
    linkAttrs(item) + (item.disabled || item.busy ? " disabled" : "") + (item.busy ? ' aria-busy="true"' : "") + ">" +
    (item.busy ? '<span class="tool-spin" aria-hidden="true"></span>' : svg(item.icon || iconFor(item.label), 16, 2.2)) +
    escape(item.label) + "</" + (item.href ? "a" : "button") + ">";

  const menu = (items) => {
    const sorted = items.map((item, i) => ({ item, i })).sort((a, b) => rankOf(a.item) - rankOf(b.item) || a.i - b.i).map(({ item }) => item);
    return sorted
      .map((item, i) => {
        const rule = rankOf(item) === 2 && (i === 0 || rankOf(sorted[i - 1]) !== 2) ? '<div class="actions-rule" role="separator"></div>' : "";
        return rule + menuItem(item);
      })
      .join("");
  };

  const toggle = (item) =>
    '<label class="toggle"><input class="sr" type="checkbox" role="switch"' + (item.on ? " checked" : "") + '><span class="track"></span>' +
    escape(item.label) + "</label>";

  const metaItem = (item) =>
    item.tone ? '<span class="tag ' + item.tone + '">' + escape(item.text) + "</span>" : '<span class="muted">' + escape(item.text) + "</span>";

  const actionsMenu = (items, open) =>
    '<div class="actions"><button type="button" class="btn quiet" aria-haspopup="menu" aria-expanded="' + open + '">Actions' +
    svg("chevron-down", 14, 2) + '</button><div class="actions-menu" role="menu" aria-label="Actions">' + menu(items) + "</div></div>";

  const renderTop = (el) => {
    const meta = listOf(el, "meta");
    const switches = listOf(el, "switches");
    const actions = listOf(el, "actions");
    const end = switches.map(toggle).join("") + (actions.length ? actionsMenu(actions, el.getAttribute(OPEN) === "true") : "");
    el.innerHTML =
      "<h1>" + escape(el.dataset.title) + "</h1>" +
      (meta.length ? '<div class="top-meta">' + meta.map(metaItem).join("") + "</div>" : "") +
      (end ? '<div class="top-end">' + end + "</div>" : "");
  };

  const endOf = (item) => {
    if (!item) return "";
    if (item.kind === "tag") return '<span class="tag ' + item.tone + '">' + escape(item.text) + "</span>";
    if (item.kind === "text") return '<span class="muted">' + escape(item.text) + "</span>";
    if (item.kind === "link") return '<a class="link sm"' + linkAttrs(item) + ">" + escape(item.label) + svg("arrow", 12, 2.6) + "</a>";
    return '<button type="button" class="btn quiet xs"' + (item.disabled ? " disabled" : "") + ">" + escape(item.label) + "</button>";
  };

  const renderSection = (el) => {
    const end = el.dataset.end ? JSON.parse(el.dataset.end) : null;
    el.innerHTML =
      "<h2>" + escape(el.dataset.title) + "</h2>" +
      (el.dataset.count ? '<span class="count">' + escape(el.dataset.count) + "</span>" : "") +
      endOf(end) +
      (el.dataset.note ? '<p class="section-note">' + escape(el.dataset.note) + "</p>" : "");
  };

  const renderNotice = (el) => {
    const tone = el.dataset.tone;
    el.className = "notice " + tone;
    el.setAttribute("role", tone === "bad" ? "alert" : "status");
    el.innerHTML =
      svg(tone === "bad" ? "alert" : "check", 18, 2.4) + '<span class="notice-text">' + escape(el.dataset.text) + "</span>" +
      '<button type="button" class="notice-close" aria-label="Dismiss">' + svg("cross", 16, 2.4) + "</button>";
  };

  const renderDraft = (el) => {
    const link = el.dataset.href
      ? '<a class="link sm"' + linkAttrs({ href: el.dataset.href, opens: el.dataset.opens, label: el.dataset.link }) + ">" + escape(el.dataset.link) + svg("arrow", 12, 2.6) + "</a>"
      : "";
    const note = el.dataset.note ? '<span class="soft">' + escape(el.dataset.note) + "</span>" : "";
    const busy = el.dataset.busy === "true";
    el.innerHTML =
      '<div class="draft-text"><span class="dot" aria-hidden="true"></span><strong>' + escape(el.dataset.text) + "</strong>" + link + note + "</div>" +
      '<button type="button" class="btn primary sm publish"' + (busy ? ' aria-busy="true"' : "") + (el.dataset.disabled === "true" ? ' aria-disabled="true"' : "") + ">" +
      (busy ? '<span class="tool-spin" aria-hidden="true"></span>' : "") + escape(el.dataset.button) + "</button>";
  };

  document.querySelectorAll(".top[data-title]").forEach(renderTop);
  document.querySelectorAll(".section-head[data-title]").forEach(renderSection);
  document.querySelectorAll(".notice[data-tone]").forEach(renderNotice);
  document.querySelectorAll(".draft[data-text]").forEach(renderDraft);

  const setOpen = (top, open) => {
    if (open) top.setAttribute(OPEN, "true");
    else top.removeAttribute(OPEN);
    top.querySelector(".actions > .btn").setAttribute("aria-expanded", String(open));
  };

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".top .actions > .btn");
    live.forEach((top) => {
      if (!button || button.closest(".top") !== top) {
        setOpen(top, false);
        live.delete(top);
      }
    });
    if (!button) return;
    const top = button.closest(".top");
    const open = top.getAttribute(OPEN) !== "true";
    setOpen(top, open);
    if (open) live.add(top);
    else live.delete(top);
  });

  document.addEventListener("keydown", (event) => {
    const wrap = event.target.closest && event.target.closest(".top .actions");
    if (!wrap) return;
    const top = wrap.closest(".top");
    const button = wrap.querySelector(".btn");
    const items = [...wrap.querySelectorAll(".actions-item:not(:disabled)")];
    if (!items.length) return;
    const open = top.getAttribute(OPEN) === "true";
    const at = items.indexOf(document.activeElement);

    if (event.key === "Escape" && open) {
      setOpen(top, false);
      live.delete(top);
      button.focus();
      return;
    }
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (step === undefined && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    if (!open) {
      setOpen(top, true);
      live.add(top);
    }
    const target =
      event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : at === -1 ? (step === 1 ? 0 : items.length - 1) : (at + step + items.length) % items.length;
    items[target].focus();
  });
})();
