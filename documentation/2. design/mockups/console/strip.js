(() => {
  const { svg } = window.HubSteward;

  const HUBS = {
    farmers: { badge: "SF", name: "Siaya Farmers' Group", kind: "Farmers" },
    lab: { badge: "SL", name: "Siaya Community Computer Lab", kind: "Lab" },
    riders: { badge: "SB", name: "Siaya Boda Boda Riders", kind: "Riders" },
    swe: { badge: "HS", name: "Hub Steward SWE", kind: "SWE" }
  };

  const STATES = {
    "setting-up": { dot: "dot", words: "Setting up" },
    ready: { dot: "dot ok", words: "Ready" }
  };

  const LANGUAGES = ["English", "Deutsch", "Kiswahili", "Español", "Français", "中文", "Magyar"];

  const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const crumb = (spec, root) => {
    const parts = spec.split(" / ").map((part) => part.split("="));
    const last = parts.length - 1;
    return parts
      .map(([label, href], i) =>
        i === last
          ? '<span class="crumb-now">' + escape(label) + "</span>"
          : href
            ? '<a href="' + root + href + '">' + escape(label) + "</a>"
            : escape(label)
      )
      .join(" / ");
  };

  const group = (el) => {
    const name = el.dataset.group;
    if (!name) return "";
    const only = el.dataset.groupOnly === "true";
    const open = el.dataset.groupOpen === "true";
    const drop = el.querySelector(".group-drop");
    const label = '<span class="hub-name">' + escape(name) + '</span><span class="hub-meta"><span class="tag mute">Group</span></span>';
    if (only) return '<div class="switch"><span class="hub compact only"><span class="hub-text">' + label + "</span></span></div>";
    return '<div class="switch"><button type="button" class="hub compact" aria-haspopup="true" aria-expanded="' + open + '"><span class="hub-text">' + label + "</span>" + svg("chevrons", 16, 2, "chev") + "</button>" + (drop ? drop.outerHTML : "") + "</div>";
  };

  const render = (el, root) => {
    const hub = HUBS[el.dataset.hub];
    const state = STATES[el.dataset.state];
    const open = el.dataset.open === "true";
    el.innerHTML =
      '<div class="brand-row"><div class="logo">' + svg("logo", 18, 2.2) + '</div><div class="brand">Hub Steward</div><span class="demo">Demo</span></div>\n' +
      '<div class="switch">\n' +
      '<button type="button" class="hub compact" aria-haspopup="true" aria-expanded="' + open + '"><span class="badge">' + hub.badge +
      '</span><span class="hub-text"><span class="hub-name">' + hub.name + '</span><span class="hub-meta"><span class="' + state.dot +
      '" aria-hidden="true"></span>' + state.words + '<span class="tag mute">' + hub.kind + "</span></span></span>" + svg("chevrons", 16, 2, "chev") + "</button>\n" +
      (el.querySelector(".drop:not(.group-drop)") ? el.querySelector(".drop:not(.group-drop)").outerHTML + "\n" : "") +
      "</div>\n" +
      '<span class="strip-div"></span>\n' +
      '<div class="crumb">' + crumb(el.dataset.crumb, root) + "</div>\n" +
      '<div class="strip-end">' + group(el) + '<label class="lang">' + svg("globe", 16) + '<span class="sr">Language</span><select>' +
      LANGUAGES.map((l, i) => "<option" + (i === 0 ? " selected" : "") + ">" + l + "</option>").join("") +
      "</select></label></div>";
  };

  const script = document.currentScript;
  const root = script.getAttribute("src").replace(/strip\.js$/, "");
  document.querySelectorAll("header.strip[data-hub]").forEach((el) => render(el, root));
})();
