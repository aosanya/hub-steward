(function () {
  var menu = [
    { page: 'tabs.html', label: 'Tabs' },
    { label: 'Chat', items: [
      ['chat-list.html', 'Chat list'],
      ['chat-replies.html', 'Chat replies'],
      ['assistant-limits.html', 'Assistant limits']
    ] },
    { label: 'Backlogs', items: [
      ['lists.html', 'Lists'],
      ['kanban.html', 'Boards'],
      ['backlog.html', 'Backlog'],
      ['manage-backlogs.html', 'Manage backlogs'],
      ['smart-backlogs.html', 'Smart backlogs']
    ] },
    { label: 'Issues', items: [
      ['card.html', 'Card and issue page'],
      ['issue-priority.html', 'Priority'],
      ['issue-todos.html', 'Todos'],
      ['issue-log.html', 'Log'],
      ['issue-references.html', 'References'],
      ['issue-waits-on.html', 'Waits on'],
      ['worker-caps.html', 'Worker caps']
    ] },
    { page: 'files.html', label: 'Folders' },
    { label: 'Menu', items: [
      ['menu.html', 'Menu'],
      ['menu-assets.html', 'Assets & Works'],
      ['menu-properties.html', 'Properties & Addresses'],
      ['menu-issues.html', 'Issues & Requests'],
      ['menu-residents.html', 'Residents'],
      ['menu-staff.html', 'Staff & Departments']
    ] },
    { label: 'Forms', items: [
      ['form.html', 'Forms'],
      ['workflow.html', 'Workflow'],
      ['step-questions.html', 'Step questions']
    ] }
  ];
  var homeIcon = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/></svg>';
  var css = ".jnav{position:sticky;top:0;z-index:20;display:flex;align-items:stretch;gap:.125rem;min-height:3.25rem;padding:0 .5rem;background:var(--surface);border-bottom:1px solid var(--line);font-size:.8125rem}\n.jnav .nb-item,.jnav .nb-link{position:relative;display:flex;align-items:center;gap:.375rem;padding:0 .875rem;border:0;background:transparent;color:var(--ink-soft);font-weight:500;white-space:nowrap}\n.jnav .nb-link:hover,.jnav .nb-drop.is-active>.nb-link,.jnav .nb-drop:focus-within>.nb-link{background:var(--accent-wash);color:var(--accent-strong)}\n.jnav .nb-link[aria-current]{color:var(--accent-strong);font-weight:600;box-shadow:inset 0 -.1875rem 0 var(--accent)}\n.jnav .nb-drop{position:relative;display:flex}\n.jnav .nb-drop>.nb-link::after{content:\"\";width:.4375rem;height:.4375rem;margin:-.25rem 0 0 .125rem;border:solid currentColor;border-width:0 .125rem .125rem 0;transform:rotate(45deg)}\n.jnav .nb-menu{position:absolute;top:100%;left:0;z-index:21;display:none;flex-direction:column;min-width:13rem;padding:.375rem 0;background:var(--surface);border:1px solid var(--line);border-top:.125rem solid var(--accent);border-radius:0 0 var(--r-md) var(--r-md);box-shadow:0 .5rem 1.5rem var(--line)}\n.jnav .nb-end{margin-left:auto}\n.jnav .nb-end .nb-menu{left:auto;right:0}\n.jnav .nb-drop.is-active>.nb-menu{display:flex}\n.jnav .nb-menu a{display:block;padding:.5rem 1rem;color:var(--ink-soft)}\n.jnav .nb-menu a:hover{background:var(--accent-wash);color:var(--accent-strong)}\n.jnav .nb-menu a[aria-current]{color:var(--accent-strong);font-weight:600;background:var(--accent-wash)}\n@media(hover:hover){.jnav .nb-drop:hover>.nb-menu{display:flex}}\n@media(max-width:48rem){.jnav{overflow-x:auto}.jnav .nb-menu{position:fixed;top:3.25rem;left:.5rem;right:.5rem}.jnav .nb-end .nb-menu{left:.5rem;right:.5rem}}";

  function link(page, label, current, inner) {
    var mark = page === current ? ' aria-current="page"' : '';
    return '<a href="' + page + '"' + mark + '>' + (inner || label) + '</a>';
  }

  function drop(label, links, end, holds) {
    var mark = holds ? ' aria-current="true"' : '';
    return '<div class="nb-drop' + (end ? ' nb-end' : '') + '"><button type="button" class="nb-link" aria-haspopup="true" aria-expanded="false"' + mark + '>' + label + '</button><div class="nb-menu">' + links + '</div></div>';
  }

  function draw(nav) {
    var current = nav.getAttribute('data-current') || '';
    var local = Array.prototype.map.call(nav.querySelectorAll('a[href^="#"]'), function (a) {
      return '<a href="' + a.getAttribute('href') + '">' + a.innerHTML + '</a>';
    }).join('');
    var html = '<a class="nb-item" href="index.html" aria-label="Home"' + (current === 'index.html' ? ' aria-current="page"' : '') + '>' + homeIcon + '</a>';
    menu.forEach(function (entry) {
      if (entry.page) {
        html += '<a class="nb-link" href="' + entry.page + '"' + (entry.page === current ? ' aria-current="page"' : '') + '>' + entry.label + '</a>';
        return;
      }
      var holds = entry.items.some(function (item) { return item[0] === current; });
      html += drop(entry.label, entry.items.map(function (item) { return link(item[0], item[1], current); }).join(''), false, holds);
    });
    if (local) html += drop('On this page', local, true, false);
    nav.innerHTML = html;
  }

  function closeAll(except) {
    Array.prototype.forEach.call(document.querySelectorAll('.jnav .nb-drop.is-active'), function (d) {
      if (d !== except) {
        d.classList.remove('is-active');
        d.firstChild.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function start() {
    var style = document.createElement('style');
    style.id = 'app-nav-style';
    style.textContent = css;
    document.head.appendChild(style);
    Array.prototype.forEach.call(document.querySelectorAll('nav[data-pages]'), draw);
    document.addEventListener('click', function (event) {
      var button = event.target.closest('.nb-drop > .nb-link');
      var drop = button ? button.parentNode : null;
      closeAll(drop);
      if (drop) {
        var open = drop.classList.toggle('is-active');
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeAll(null);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
