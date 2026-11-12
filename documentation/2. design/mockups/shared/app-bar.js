(function () {
  var icons = {
    home: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    chat: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    notifications: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg>'
  };
  var tabs = [
    { key: 'home', label: 'Home' },
    { key: 'chat', label: 'Chat' },
    { key: 'notifications', label: 'Notifications' }
  ];
  var css = ".ic{flex:none;width:1.25rem;height:1.25rem;stroke-width:1.75}\n.tabs{display:flex;gap:0;padding:.5rem .25rem 1rem;background:var(--surface);border-top:1px solid var(--line)}\n.tab{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:.125rem;min-height:3rem;color:var(--ink-soft);font-size:.8125rem;font-weight:500}\n.tab .pill{position:relative;display:grid;place-items:center;width:2.75rem;height:2rem;border-radius:var(--r-pill)}\n.tab .pill .ic{width:1.5rem;height:1.5rem;stroke-width:1.5}\n.badge{position:absolute;top:-.125rem;right:.125rem;min-width:1.125rem;height:1.125rem;padding:0 .25rem;border-radius:var(--r-pill);background:var(--danger);color:var(--on-accent);font-size:.6875rem;font-weight:600;line-height:1.125rem;text-align:center}\n.news{position:absolute;top:.125rem;right:.625rem;width:.625rem;height:.625rem;border-radius:var(--r-pill);background:var(--accent);border:2px solid var(--surface);box-sizing:content-box}\n.badge+.news{left:.5rem;right:auto}\n.tab[aria-current=\"page\"]{color:var(--accent);font-weight:600}\n.tab[aria-current=\"page\"] .pill{background:var(--accent-wash)}";

  function badge(count) {
    return count ? '<span class="badge" role="img" aria-label="' + count + ' things to do">' + count + '</span>' : '';
  }

  function news(flag) {
    return flag ? '<span class="news" role="img" aria-label="Unread updates"></span>' : '';
  }

  function draw(nav) {
    var chosen = nav.getAttribute('data-chosen') || '';
    var count = nav.getAttribute('data-badge') || '';
    var unreadNews = nav.hasAttribute('data-news');
    nav.innerHTML = tabs.map(function (tab) {
      var current = tab.key === chosen ? ' aria-current="page"' : '';
      var extra = tab.key === 'notifications' ? badge(count) + news(unreadNews) : '';
      return '<a class="tab"' + current + '><span class="pill">' + icons[tab.key] + extra + '</span>' + tab.label + '</a>';
    }).join('');
  }

  function start() {
    if (!document.getElementById('app-bar-style')) {
      var style = document.createElement('style');
      style.id = 'app-bar-style';
      style.textContent = css;
      document.head.appendChild(style);
    }
    Array.prototype.forEach.call(document.querySelectorAll('nav[data-tabs]'), draw);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
