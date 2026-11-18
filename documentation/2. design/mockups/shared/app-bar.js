(function () {
  var icons = {
    home: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    chat: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    notifications: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg>'
  };
  var tabs = [
    { key: 'home', label: 'Home' },
    { key: 'chat', label: 'Chat' },
    { key: 'notifications', label: 'Notifications' }
  ];

  function badge(count) {
    return count ? '<span class="unread-num" aria-label="' + count + ' things to do">' + count + '</span>' : '';
  }

  function news(flag) {
    return flag ? '<span class="unread-dot" role="img" aria-label="New updates"></span>' : '';
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
    Array.prototype.forEach.call(document.querySelectorAll('nav[data-tabs]'), draw);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
