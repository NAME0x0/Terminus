# Terminus — Project Status

> Living document. Tracks vision vs. reality, build state, and decisions.
> Last updated: 2026-06-22
>
> See also: **`VISION.md`** (north-star) ·
> **`docs/superpowers/specs/2026-06-22-terminus-v0.1-terminal-core-design.md`** (v0.1 spec)

## 1. What Terminus Is (Vision)

**A terminal-native workspace** — a cross-platform terminal at the center, with
media, web, and AI as first-class panes, fully mouse-interactive like a desktop
app, and AI woven throughout via one provider-agnostic gateway. Warp × Wave ×
Arc browser × a media center, fused around a real terminal. Formerly named
**ITD (Integrated Terminal Desktop)**; the literal "replace the desktop" framing
is now tagline only.

Full north-star + epics E0–E8: **`VISION.md`**. Build order: terminal core (E0 /
v0.1) first, everything else phased.

## 2. Current Reality (one line)

A one-sitting architecture scaffold: rich interface headers, ~85% empty
implementation stubs, and **it does not compile**. Abandoned right after scaffolding.

## 3. Tech Stack

### 3a. Old (as scaffolded — being replaced)

| Layer       | Choice                                  |
|-------------|-----------------------------------------|
| Language    | C++17                                    |
| GUI         | wxWidgets 3.2 (`core base stc aui adv`)  |
| Terminal UI | `wxStyledTextCtrl` (not a real terminal) |
| Scripting   | Lua 5.4 (embedded)                       |
| Build       | CMake 3.15 + MSVC / `build.bat`          |
| Target      | Windows 10/11 x64 only                   |

### 3b. New (decided 2026-06-22 — **Tauri / Rust + web**)

| Layer        | Choice                                          |
|--------------|-------------------------------------------------|
| Core         | Rust (Tauri backend)                            |
| UI           | Web (HTML/CSS/TS) in native webview             |
| Terminal eng | **xterm.js** (proven VT/ANSI engine)            |
| PTY          | `portable-pty` (ConPTY on Win, forkpty on unix) |
| Scripting    | Lua via `mlua` crate                            |
| Build        | Cargo + Tauri CLI                               |
| Target       | **Cross-platform** Win / macOS / Linux          |
| Binary       | ~10MB, low RAM (vs Electron ~150MB)             |

## 4. Feature Matrix — Promised vs. Actual

| Feature (README)        | Header API | Implementation | State        |
|-------------------------|:----------:|:--------------:|--------------|
| Terminal emulator       | yes        | partial        | 🟡 buggy, runs `cmd /c` |
| Vim-like navigation     | yes        | `// TODO` stub | 🔴 none      |
| File explorer (Yazi)    | yes        | placeholder    | 🔴 none      |
| Widgets (clock/sysmon)  | yes        | placeholder    | 🔴 none      |
| Tiling + transparency   | yes        | placeholder¹   | 🔴 none      |
| Custom taskbar          | yes        | placeholder    | 🔴 none      |
| Lua scripting           | yes        | placeholder    | 🔴 none      |
| Fast search / indexer   | yes        | placeholder    | 🔴 none      |
| Config manager          | yes        | placeholder    | 🔴 none      |
| Theming (JSON)          | n/a        | asset only²    | 🔴 unused    |

¹ Transparency partially wired in `terminalwx.cpp` via `SetTransparent`.
² `res/themes/default.json` is a complete theme with no loader reading it.

## 5. Code Inventory

**Real implementation (4 files):**
- `src/terminal/terminalwx.cpp` (331) — only substantive code. See bugs §6.
- `src/mainframe.cpp` (204) — menus, status bar, AUI layout, wires components.
- `src/app.cpp` (44), `src/main.cpp` (4) — wxApp boilerplate.

**Placeholder `.cpp` (1 line `// Placeholder`, 10 files):**
`config/configmanager`, `explorer/yaziexplorer`, `lua/luascript`,
`search/indexer`, `search/searchbar`, `ui/taskbar`, `ui/tilingmanager`,
`widgets/clockwidget`, `widgets/sysmonwidget`, `widgets/widgetmanager`.

**Headers (designed, no impl behind them):**
`configmanager.h` (187), `indexer.h` (179), `widgetmanager.h` (169),
`taskbar.h` (145), `luascript.h` (131), `tilingmanager.h` (129),
`terminalwx.h` (115), `searchbar.h` (99), `yaziexplorer.h` (83), `mainframe.h` (67).

**Tests:** `tests/unit/config_test.cpp` (gtest, ConfigManager) — cannot link (impl missing).

## 6. Build Blockers (does NOT compile)

1. **CMake ordering bug** — root `CMakeLists.txt` calls `add_subdirectory(src)`
   (line 29) → `src/CMakeLists.txt` runs `target_sources(ITD ...)` before the
   `ITD` target is created (`add_executable`, line 41). Configure fails.
2. **Undefined symbols** — `mainframe.cpp` constructs `WidgetManager`,
   `YaziExplorer`, `Taskbar`, `TilingManager`, `SearchBar`; `app.cpp` calls
   `ConfigManager::Load/Save`. All bodies are placeholders → link errors.
3. **Missing resource** — `mainframe.cpp:33` `wxICON(MAINICON)`; no icon exists
   (`res/icons/` holds only `README.txt`).

## 7. Decisions Log

- [x] **Vision** — _Power terminal + panes_ (NOT literal desktop replacement).
      Integrated terminal: multiplexer + explorer + widgets in panes, vim nav,
      Lua config, fast search, theming. "Replace the desktop" = tagline only.
      _(2026-06-22)_
- [x] **Platform** — _Cross-platform from day 1_ (Win / macOS / Linux).
      _(2026-06-22)_
- [x] **Tech stack** — _Tauri (Rust + web)_, xterm.js terminal, `portable-pty`,
      `mlua`. See §3b. _(2026-06-22)_
- [x] **Scope for v0.1** — _Terminal core only_: real cross-platform terminal
      (PTY + xterm.js), tabs + splits, theming, config file. No explorer/widgets
      yet — they layer on as easy web UI once the terminal engine is proven on
      all 3 OSes. _(2026-06-22)_

- [x] **C++ handling** — _delete later_ (not now). Old C++ stays in-tree during
      the Tauri transition; removed in a later step (git history preserves it).
      Old design judged stale → NOT harvested verbatim; instead **rethought**
      into the modern north-star (`VISION.md`). _(2026-06-22)_
- [x] **Vision scope** — expanded from "power terminal + panes" to
      _terminal-native workspace_ (media + browser + AI panes, editor-grade
      mouse, AI gateway). Captured as north-star; v0.1 unchanged. _(2026-06-22)_

### Roadmap — Epics (see `VISION.md` for detail)

- **E0 / v0.1** — terminal core (PTY + xterm.js, tabs+splits, theming, TOML,
  modern render, OSC 7 cwd) ← **building now**
- E1 — interactive shell: command blocks (OSC 133) + editor-grade mouse/drag
- E2 — multiplexer: persist/restore, detach/attach, broadcast, layouts
- E3 — AI gateway: local + OpenAI-compatible + Gemini + NIM + agents
- E4 — content panes: image / video / file preview
- E5 — embedded browser pane
- E6 — integrations: Spotify + service widgets
- E7 — power QoL: command palette, profiles, SSH manager, quake, notifications
- E8 — extensibility: Lua scripting, plugin API, theme import

## 8. Known Bugs (in existing real code)

- `terminalwx.cpp`: `m_isBusy` never reset to `false` on success → terminal
  stuck busy after first command (no `wxEVT_END_PROCESS` handler).
- `terminalwx.cpp`: `ReadProcessOutput()` recurses with `wxMilliSleep`+`Yield`
  → UI freeze / stack-overflow risk. Needs event-driven I/O.
- `terminalwx.cpp`: Vim mode is a no-op TODO.

## 9. Next Steps

1. ✅ Vision + stack + scope decided (§7).
2. ✅ `VISION.md` (north-star) + v0.1 spec written.
3. ⏳ User reviews v0.1 spec.
4. ⏳ Implementation plan (writing-plans skill) for E0.
5. ⏳ Scaffold Tauri project (`src-tauri/` + `src/`), build E0.
6. ⏳ Delete old C++ tree once Tauri scaffold is in place.
7. ⏳ Rewrite `README.md` for the new direction.
