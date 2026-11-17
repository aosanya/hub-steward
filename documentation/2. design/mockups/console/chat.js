(() => {
  const { svg } = window.HubSteward;

  const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const head = (el) =>
    '<div class="chat-head"><h2 class="chat-label">Chat</h2><span class="chat-ctx">' + svg(el.dataset.ctxIcon, 14) + escape(el.dataset.ctx) +
    '</span><button type="button" class="chat-collapse" aria-label="Collapse chat">' + svg("panel-right", 18) + "</button></div>";

  const picker = (model) =>
    model
      ? '<button type="button" aria-haspopup="listbox" aria-expanded="false">' + escape(model) + svg("chevron-down", 14, 2.2) + "</button>"
      : "";

  const input = (el) =>
    '<div class="chat-input"><div class="composer"><label><span class="sr">Write a message</span><textarea rows="3" placeholder="' +
    escape(el.dataset.placeholder || "Ask about " + el.dataset.ctx + "…") + '"></textarea></label><div class="composer-bar"><span class="chat-tools">' +
    '<button type="button" class="chat-attach" aria-label="Attach a file">' + svg("paperclip", 18) + "</button>" +
    '<span class="chat-model">' + picker(el.dataset.model) + "</span></span>" +
    '<button type="submit" class="chat-send" aria-label="Send">' + svg("arrow-up", 18, 2.4) + "</button></div></div></div>";

  document.querySelectorAll("aside.chat[data-ctx]").forEach((el) => {
    const thread = el.querySelector(".thread");
    const chips = el.querySelector(".chat-chips");
    el.innerHTML = head(el) + "\n" + (thread ? thread.outerHTML : "") + "\n" + (chips ? chips.outerHTML + "\n" : "") + input(el);
  });
})();
