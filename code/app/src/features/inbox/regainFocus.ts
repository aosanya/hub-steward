export function onRegainFocus(callback: () => void) {
  const whenVisible = () => {
    if (document.visibilityState === "visible") callback();
  };
  window.addEventListener("focus", callback);
  document.addEventListener("visibilitychange", whenVisible);
  return () => {
    window.removeEventListener("focus", callback);
    document.removeEventListener("visibilitychange", whenVisible);
  };
}
