(() => {
  const root = document.currentScript.getAttribute("src").replace(/shell\.js$/, "");
  ["icons", "strip", "chat", "menu", "parts"].forEach((name) => {
    document.write('<script src="' + root + name + '.js"><\/script>');
  });
})();
