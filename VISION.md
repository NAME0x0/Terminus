# Terminus — Vision (North-Star)

> The long-range destination. Not a v0.1 scope. We build toward this one brick
> at a time; v0.1 is only Epic E0. Last updated: 2026-06-22.

## One line

**Terminus is a terminal-native workspace** — a cross-platform terminal at the
center, with media, web, and AI as first-class panes, fully mouse-interactive
like a desktop app, and AI woven throughout via one provider-agnostic gateway.

Think: Warp × Wave × Arc browser × a media center, fused around a real terminal.
"Replace the desktop" is the spirit; a workspace you live in is the product.

## Design Pillars (cross-cutting — apply from E0 onward)

1. **Real terminal first.** PTY + a proven VT engine (xterm.js). It must run
   `vim`, `htop`, `ssh`, TUIs correctly on Windows, macOS, Linux. Everything
   else is worthless if the terminal isn't excellent.
2. **Editor-grade mouse + keyboard.** Fully interactive like Word/Notepad:
   drag panes, drag-and-drop, click-to-position, Word-style text selection,
   context menus — alongside keyboard-first / vim navigation. Not either/or.
3. **Panes are content.** A pane can be a terminal, an image, a video, a file
   preview, a browser, a widget, or an AI chat. One pane/layout system, many
   content types.
4. **AI everywhere, provider-agnostic.** One gateway interface. Behind it:
   local tiny model, any OpenAI-compatible endpoint, Gemini, NVIDIA NIM, and
   agents (Claude Code, Codex, custom). Cost-aware by default (free/local first).
5. **Cross-platform, lightweight.** Tauri (Rust core + web UI, native webview).
   ~10MB binary, low RAM. No Electron tax.
6. **Themeable & scriptable.** JSON/TOML theming now; Lua (`mlua`) + plugin API
   later. Import iTerm / Windows Terminal themes.

## Tech Stack

| Layer        | Choice                                          |
|--------------|-------------------------------------------------|
| Core         | Rust (Tauri backend)                            |
| UI           | Web (TS + Vite) in native webview               |
| Terminal eng | xterm.js (+ webgl, search, web-links, fit addons) |
| PTY          | `portable-pty` (ConPTY / forkpty)               |
| AI           | provider-agnostic gateway (local + cloud + agents) |
| Scripting    | Lua via `mlua` (later)                          |
| Build        | Cargo + Tauri CLI                               |
| Targets      | Windows · macOS · Linux                         |

## Epics (each = its own spec → plan → build cycle)

Order is a sketch, adjustable per epic.

### E0 — Terminal core  ← **v0.1, building now**
PTY + xterm.js, tabs + splits (split-tree), theming, TOML config, modern
rendering (true color, WebGL, OSC 8 hyperlinks, scrollback search), OSC 7 cwd
(splits inherit dir, tab titles show path). Cross-platform CI from day 1.
Full spec: `docs/superpowers/specs/2026-06-22-terminus-v0.1-terminal-core-design.md`.

### E1 — Interactive shell
OSC 133 shell integration → **command blocks** (each command+output a navigable,
copyable, rerunnable unit), prompt jump, per-command exit-status badges, sticky
command header. Plus the editor-grade mouse pillar: drag panes, drag-and-drop
into terminal, Word/Notepad-style selection, context menus.

### E2 — Multiplexer
Session persistence/restore (reopen tabs/splits/cwd after restart), tmux-like
**detach/attach** (terminal survives UI close via a background daemon),
broadcast/sync input across panes, saved layout presets per project.

### E3 — AI gateway
One provider abstraction. Adapters: **local tiny model** (Ollama / llama.cpp /
candle) for offline NL→command, **OpenAI-compatible** endpoints (LM Studio,
Ollama, vLLM, OpenRouter, Groq, …), **Gemini** (free tier), **NVIDIA NIM**, and
**agents** (Claude Code, Codex, custom) as first-class. Features: natural-language
→ command, explain-this-error, fix-the-command, agent panes. Cost-aware routing
(prefer local/free).

### E4 — Content panes
Pane content framework beyond terminals: **image viewer**, **video player**,
**file preview** (text/markdown/code/pdf). Inline image protocol (Sixel / kitty
graphics) in the terminal itself too.

### E5 — Embedded browser
Web pane via Tauri webview — browse arbitrary sites in-app, dock alongside
terminals. Arc-like split browsing inside the workspace.

### E6 — Integrations
**Spotify** (Web Playback SDK + Web API) as a media widget; framework for other
service widgets (calendar, weather, system monitor, clock).

### E7 — Power QoL
Command palette (fuzzy actions), shell **profiles** (pwsh / bash / wsl /
git-bash / ssh), **SSH connection manager** (saved hosts), **quake** dropdown
global-hotkey terminal, notify-on-command-complete.

### E8 — Extensibility
Lua (`mlua`) scripting for keybindings/behavior, plugin API, theme import
(iTerm / Windows Terminal), community theme ecosystem.

## Explicitly NOT doing (for now)

- Literal OS shell replacement (replacing `explorer.exe`). Tagline only.
- Mobile.
- Anything in an epic before its turn. Scope discipline is how this ships.

## Provenance

Supersedes the abandoned 2025 C++/wxWidgets scaffold (tmux + yazi + Rainmeter
idea). That design is considered stale; this north-star replaces it. Old C++
remains in-tree pending deletion; git history preserves it regardless.
