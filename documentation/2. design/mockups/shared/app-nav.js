(function () {
  var pages = [
  [
    "index.html",
    "Home"
  ],
  [
    "tabs.html",
    "Tabs"
  ],
  [
    "chat-list.html",
    "Chat list"
  ],
  [
    "chat-replies.html",
    "Chat replies"
  ],
  [
    "lists.html",
    "Lists"
  ],
  [
    "kanban.html",
    "Board"
  ],
  [
    "backlog.html",
    "Backlog"
  ],
  [
    "manage-backlogs.html",
    "Manage backlogs"
  ],
  [
    "smart-backlogs.html",
    "Smart backlogs"
  ],
  [
    "wide.html",
    "Wide window"
  ],
  [
    "issue-log.html",
    "Issue log"
  ],
  [
    "issue-references.html",
    "Issue references"
  ],
  [
    "issue-waits-on.html",
    "Issue waits on"
  ],
  [
    "assistant-limits.html",
    "Assistant limits"
  ],
  [
    "worker-caps.html",
    "Worker caps"
  ],
  [
    "form.html",
    "Form"
  ],
  [
    "workflow.html",
    "Workflow"
  ]
];
  var homeIcon = "<svg class=\"ic\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m3 10 9-7 9 7\"/><path d=\"M5 9v11h14V9\"/></svg>";

  function draw(nav) {
    var current = nav.getAttribute('data-current') || '';
    var links = pages.map(function (page, index) {
      var mark = page[0] === current ? ' aria-current="page"' : '';
      var label = index === 0 ? ' aria-label="Home"' : '';
      var inside = index === 0 ? homeIcon + page[1] : page[1];
      return '<a href="' + page[0] + '"' + label + mark + '>' + inside + '</a>';
    }).join('');
    nav.insertAdjacentHTML('afterbegin', links);
  }

  function start() {
    Array.prototype.forEach.call(document.querySelectorAll('nav[data-pages]'), draw);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
