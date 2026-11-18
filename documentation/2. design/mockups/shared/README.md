# Shared parts of the app mockups

The app mockups of this folder and of the municipality's design folder draw the phone app with the app's own stylesheet, so they cannot drift from it. This page says what each shared file does and what a page may and may not do.

## The rule

The app wins. A mockup never holds its own copy of the app's tokens, its root font size or any rule the app's stylesheets already draw. When the app changes, the mockups change with it because they link the same CSS; when a mockup shows something the built app does not do, the caption says it is drawn for a hub issue.

## The files

| File | What it does |
|---|---|
| `app-real.css` | Imports the app's real stylesheets from `code/app/src`: `app.css` (and through it `tokens.css`), `unread.css`, `menuWindow.css` and the shared ui stylesheets. A page links this one file |
| `app-top.js` | Draws the real top bar. Attributes on `<header class="bar">`: `data-back` (the back label; a bar with no back has a plain title), `data-title`, `data-action` (a text action beside the menu button), `data-agency` (the hub name line under the bar, shown on every screen inside a hub) and `data-no-menu` |
| `app-bar.js` | Draws the real bottom tab bar, Home, Chat and Notifications. Attributes on `<nav class="tabs" data-tabs>`: `data-chosen` (`home`, `chat` or `notifications`), `data-badge` (the number on Notifications) and `data-news` |
| `app-nav.js` | Draws the bar at the top of a mockup page from `window.mockupPages`. Attributes on `<nav class="jnav" data-pages>`: `data-current` (the current page, relative to the page list's root) and `data-base` (the prefix back to that root, `../` for a page one folder down) |
| `app-kit.css`, `app-wide.css` | The wide window of a figure (`.win`, `.split`, `.tree`, `.pane`, `.editor`) and a few parts the real stylesheets do not hold. Kept until the wide frames are drawn with the app's `paneWindow.css` alone |
| `check-sync.mjs` | The check. `node check-sync.mjs <file or folder>` fails a page that restates the app's tokens, sets a root font size, uses a pixel font size or a fixed border radius, redefines a rule the app draws, hand draws the top bar or the tab bar, or does not link `app-real.css` |
| `sync-mockup.py` | The one-off transform that moved the pages onto the contract: it drops the restated tokens and rules, links the shared files and turns a hand-drawn bar into a data-driven one. Kept for the next page that arrives drawn the old way |

## A page may

Keep its own `<style>` for what the app does not draw: the layout of the figures, the caption block, the phone and wide frames, and components that only the mockup has. It uses the app's class names (`bar`, `back`, `row`, `rows`, `btn`, `card`, `input`, `tabs`) and never redefines them.

## Checks

Run `node check-sync.mjs <folder>` for every folder of mockups after adding or changing a page. The municipality's folder also runs `node check-links.mjs` and `node build-index.mjs`; see its README.
