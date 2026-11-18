import os
import re
import sys

SHARED = os.path.dirname(os.path.abspath(__file__))
OWNED = {".bar", ".bar-action", ".bar-title", ".bar-agency", ".back", ".act", ".title", ".menu-btn", ".body", ".head", ".headline", ".sub", ".tabs", ".tab", ".rows", ".row", ".btn", ".chip", ".card", ".input", ".field", ".flabel", ".bottombar", ".icon", ".ic"}
TOKEN = re.compile(r"^--(r-sm|r-md|r-pill|bg|bg-alt|surface|ink|ink-soft|line|line-strong|accent|accent-strong|accent-wash|on-accent|danger|success|info|info-wash|sans|mono|content)$")


def top_level(css):
    items, depth, start = [], 0, 0
    for index, char in enumerate(css):
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                items.append(css[start:index + 1])
                start = index + 1
    tail = css[start:]
    return items, tail


def keep_declarations(body):
    kept = []
    for declaration in [part for part in body.split(";") if part.strip()]:
        name = declaration.split(":", 1)[0].strip()
        if name == "font-size" or TOKEN.match(name):
            continue
        kept.append(declaration.strip())
    return ";".join(kept)


def clean_item(item):
    head, _, rest = item.partition("{")
    selector = head.strip()
    if selector.startswith("@"):
        return item
    body = rest[:-1]
    if selector == ":root":
        body = keep_declarations(body)
        return f":root{{{body}}}" if body else ""
    if selector == "*":
        return ""
    if selector == "body":
        kept = [part.strip() for part in body.split(";") if part.strip().startswith("background")]
        return f"body{{{';'.join(kept)}}}" if kept else ""
    selectors = [part.strip() for part in selector.split(",")]
    remaining = [part for part in selectors if part not in OWNED]
    if not remaining:
        return ""
    return f"{','.join(remaining)}{{{body}}}"


def clean_style(css):
    items, tail = top_level(css)
    cleaned = [clean_item(item.strip()) for item in items]
    return "\n".join(item for item in cleaned if item) + tail


def text_of(fragment):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", fragment)).strip()


def attr(value):
    return value.replace("&amp;", "&").replace('"', "&quot;")


def convert_bar(match):
    inner = match.group(1)
    back = re.search(r'<(?:a|button)[^>]*class="back"[^>]*>(.*?)</(?:a|button)>', inner, re.S)
    title = re.search(r'<(?:span|h1)[^>]*class="(?:bar-title|ttl2|title)"[^>]*>(.*?)</(?:span|h1)>', inner, re.S)
    action = re.search(r'<(?:a|button)[^>]*class="act[^"]*"[^>]*>(.*?)</(?:a|button)>', inner, re.S)
    leftovers = re.sub(r'<(?:a|button)[^>]*class="back"[^>]*>.*?</(?:a|button)>|<(?:span|h1)[^>]*class="(?:bar-title|ttl2|title)"[^>]*>.*?</(?:span|h1)>|<(?:a|button)[^>]*class="act[^"]*"[^>]*>.*?</(?:a|button)>|<(?:span|div)[^>]*class="bar-action"[^>]*>|</span>|</div>|<button[^>]*menu-btn[^>]*>.*?</button>', "", inner, flags=re.S).strip()
    if leftovers or not (back or title):
        return match.group(0)
    parts = ['<header class="bar"']
    if back:
        parts.append(f' data-back="{attr(text_of(back.group(1)).lstrip(chr(8249)).strip())}"')
    if title:
        parts.append(f' data-title="{attr(text_of(title.group(1)))}"')
    if action:
        parts.append(f' data-action="{attr(text_of(action.group(1)))}"')
    if "menu-btn" not in inner:
        parts.append(" data-no-menu")
    parts.append("></header>")
    return "".join(parts)


def relative(path, target):
    return os.path.relpath(target, os.path.dirname(os.path.abspath(path))).replace(os.sep, "/")


def transform(path):
    html = open(path, encoding="utf-8").read()
    if not html.strip() or "shared/app-real.css" in html:
        return "skipped"
    shared = relative(path, SHARED)
    html = re.sub(r"<style>(.*?)</style>", lambda m: "<style>\n" + clean_style(m.group(1)) + "\n</style>", html, count=1, flags=re.S)
    link = f'<link rel="stylesheet" href="{shared}/app-real.css">\n'
    html = html.replace("<style>", link + "<style>", 1)
    html = re.sub(r'<header class="bar">(.*?)</header>', convert_bar, html, flags=re.S)
    html = re.sub(r'<svg class="ic( [^"]*)?"', lambda m: f'<svg class="icon{m.group(1) or ""}"', html)
    scripts = []
    if 'data-title=' in html or 'data-back=' in html:
        scripts.append(f'<script src="{shared}/app-top.js"></script>')
    if "data-tabs" in html and "app-bar.js" not in html:
        scripts.append(f'<script src="{shared}/app-bar.js"></script>')
    if scripts:
        html = html.replace("</body>", "\n".join(scripts) + "\n</body>", 1)
    open(path, "w", encoding="utf-8").write(html)
    return "converted"


for target in sys.argv[1:]:
    print(os.path.basename(target), transform(target))
