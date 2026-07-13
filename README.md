# ⛏️ minecraft-statusline

[![npm version](https://img.shields.io/npm/v/minecraft-statusline.svg)](https://www.npmjs.com/package/minecraft-statusline)
[![npm downloads](https://img.shields.io/npm/dw/minecraft-statusline.svg)](https://www.npmjs.com/package/minecraft-statusline)
[![license](https://img.shields.io/npm/l/minecraft-statusline.svg)](./LICENSE)

A Minecraft-themed statusline for [Claude Code](https://claude.com/claude-code). Your rate limits
become hearts and food, your context window becomes an XP bar, and the model name is tinted like
crafting materials.

![demo](docs/demo.png)

## Legend

| Element | Meaning |
| --- | --- |
| `[Model]` tint | Netherite (Fable), diamond (Opus), gold (Sonnet), iron (Haiku) |
| 📁 `dir` | Current working directory |
| 🌿 `branch` | Git branch, with `*` (uncommitted changes) or `!` (untracked files) |
| `$cost` | Total session cost |
| ⏱️ | Elapsed session time |
| ↩ / ↪ | Cache read / cache write tokens |
| ❤️ / 🖤 | 5-hour rate limit — hearts deplete as usage climbs |
| 🍗 / 🦴 | 7-day rate limit — food depletes as usage climbs |
| 🟩 / ⬛ | Context window usage — XP bar fills as it climbs |

## Install

```
npx minecraft-statusline
```

This backs up any existing `~/.claude/settings.json` and statusline script, installs
`~/.claude/minecraft-statusline.js`, and points Claude Code's `statusLine` setting at it.

## Requirements

- [Claude Code](https://claude.com/claude-code)
- [Node.js](https://nodejs.org) — you already have it if you can run `npx`; the statusline itself
  runs on Node, so there's nothing else to install
- `git` (optional — only used to show the current branch)

Works on Windows, macOS, and Linux with no extra dependencies (no `jq` or `bash` needed).

## Troubleshooting

### Emoji show as boxes or monochrome (KDE Plasma 5 / Qt 5)

If the hearts, food, and other icons render as empty boxes or flat monochrome outlines
in **Konsole** or **Yakuake**, this is a known Qt 5 bug
([QTBUG-80434](https://bugreports.qt.io/browse/QTBUG-80434)), **not** a statusline bug:
Qt 5's text engine never consults fontconfig's generic `emoji` family, so it falls back
to a monochrome font or nothing. It affects every Qt 5 terminal on KDE Plasma 5,
regardless of distro. Plasma 6 / Qt 6 builds are unaffected.

**Workaround:** add a user fontconfig rule that puts Noto Color Emoji ahead of your
terminal font in the fallback chain. Since the emoji font has no Latin glyphs, regular
text is unaffected. Create `~/.config/fontconfig/conf.d/99-color-emoji.conf`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <match target="pattern">
    <test qual="any" name="family"><string>emoji</string></test>
    <edit name="family" mode="assign" binding="same"><string>Noto Color Emoji</string></edit>
  </match>
  <match>
    <test name="family"><string>Hack</string></test>
    <edit name="family" mode="prepend" binding="strong"><string>Noto Color Emoji</string></edit>
  </match>
  <match>
    <test name="family"><string>monospace</string></test>
    <edit name="family" mode="prepend" binding="strong"><string>Noto Color Emoji</string></edit>
  </match>
</fontconfig>
```

Swap `Hack` for whatever font your Konsole profile uses, then run `fc-cache -f` and
fully restart the terminal. Credit to [EHoop30](https://github.com/EHoop30) and
[this gist](https://gist.github.com/IgnoredAmbience/7c99b6cf9a8b73c9312a71d1209d9bbb)
for the approach.

## Uninstall

```
npx minecraft-statusline --uninstall
```

Restores your previous `settings.json` and removes the installed script.

## Customize

The installed script lives at `~/.claude/minecraft-statusline.js` — edit it directly to change
colors, icons, or segments.
