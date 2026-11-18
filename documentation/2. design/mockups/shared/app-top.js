(function () {
  var back = '‹ ';
  var menu = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>';

  function escape(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function draw(bar) {
    var backLabel = bar.getAttribute('data-back');
    var title = bar.getAttribute('data-title');
    var action = bar.getAttribute('data-action');
    var agency = bar.getAttribute('data-agency');
    var withMenu = !bar.hasAttribute('data-no-menu');
    var html = '';
    if (backLabel !== null) {
      html += '<a class="back">' + back + escape(backLabel) + '</a>';
      if (title) html += '<h1 class="bar-title">' + escape(title) + '</h1>';
    } else {
      html += '<h1 class="title">' + escape(title || '') + '</h1>';
    }
    if (action || withMenu) {
      html += '<div class="bar-action">' + (action ? '<a class="act">' + escape(action) + '</a>' : '') + (withMenu ? '<button type="button" class="menu-btn" aria-label="Menu">' + menu + '</button>' : '') + '</div>';
    }
    if (agency) html += '<p class="bar-agency">' + escape(agency) + '</p>';
    bar.innerHTML = html;
  }

  function start() {
    Array.prototype.forEach.call(document.querySelectorAll('header.bar[data-title], header.bar[data-back]'), draw);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
