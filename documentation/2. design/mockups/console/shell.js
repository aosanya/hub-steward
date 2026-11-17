(() => {
  const root = document.currentScript.getAttribute("src").replace(/shell\.js$/, "");
  ["icons", "strip", "chat", "menu"].forEach((name) => {
    document.write('<script src="' + root + name + '.js"><\/script>');
  });
})();
