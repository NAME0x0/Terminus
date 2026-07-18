# Terminus — Project Status

> Living document. Tracks vision vs. reality, build state, and decisions.
> Last updated: 2026-07-18
>
> See also: **`VISION.md`** (north-star) ·
> **`docs/product/terminus-v0.1-product-brief.md`** (first public release) ·
> **`docs/superpowers/specs/2026-06-22-terminus-e0-terminal-foundation-design.md`** (E0 technical design) ·
> **`docs/research/warp-terminal-notes.md`** (Warp reference notes)

## 1. What Terminus Is (Vision)

**A local-first, persistent workspace for developers who run multiple shells,
tools, and coding agents.** Terminus keeps terminal work organized, visible,
and resumable without requiring a cloud account.

The first switching reason is a named project workspace that restores its tabs,
split layout, focus, shell profiles, and working directories after restart.
The terminal is the foundation; durable project context is the product wedge.

E0 is now explicitly an internal terminal-foundation milestone. It is not the
v0.1 release. The first public v0.1 combines accepted E0 behavior with the
persistent-workspace contract in `docs/product/terminus-v0.1-product-brief.md`.

## 2. Current Reality (one line)

A published Tauri/Rust + Vite/TypeScript E0 implementation now exists beside
the stale C++/wxWidgets scaffold on draft PR
[#1](https://github.com/NAME0x0/Terminus/pull/1). It typechecks, passes eight
Rust tests and 21 frontend tests, and builds on Windows, macOS, and Ubuntu in
GitHub Actions. The native-app manual smoke matrix remains unverified, so E0
acceptance is incomplete and the PR remains a draft.

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

## 4. Legacy Scaffold Matrix — Promised vs. Actual

This table describes the abandoned C++ direction. It is retained as transition
evidence and is not the active product roadmap.

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
² The old scaffold never loaded `res/themes/default.json`; the new E0 frontend does.

## 5. Code Inventory

### 5a. New implementation

- `src-tauri/` — Rust backend scaffold with Tauri commands, config loading,
  PTY sessions via `portable-pty`, and session management.
- `frontend/` — plain TypeScript/Vite frontend with xterm panes, tabs, splits,
  keybinding dispatch, and theme-to-CSS/xterm mapping.
- E0 polish now includes focused pane-only actions, lifecycle states, shortcut
  discovery, split cwd inheritance, resize debounce, pane maximize, focus
  cycling, a command palette, and in-app Settings backed by the TOML config.
- Pane rendering now tracks whether a terminal has mounted independently from
  current DOM attachment, preserving pane sessions through split, tab,
  maximize/restore, and close re-renders. Eleven jsdom/Vitest regressions cover
  the layout lifecycle and its final-tab/directional edge cases.
- PTY lifecycle now waits on the real child independently from output reads,
  drains output before publishing the exit event, preserves the process exit
  code, rejects writes/resizes after exit, and uses an independent killer for
  explicit close. Rust integration tests cover nonzero exit, failed-spawn ID
  preservation, and manager close/removal behavior.
- Config now watches the platform TOML file with `notify`, falls back safely on
  malformed input, and emits live updates. The frontend loads the canonical
  JSON theme and reapplies UI/xterm colors, fonts, and keybindings in place.
- Tabs now expose close controls plus previous/next actions, and pane arrow
  actions choose a geometrically adjacent pane instead of aliasing sequential
  focus.
- Frontend failures now surface through bounded, dismissible notices; shell
  spawn failures remain inline and fatal startup failures offer retry. Listener
  registration cleans up partial success before retrying.
- Twenty-six Vitest cases cover layout, tabs, spatial focus, config/theme/
  keybinding application, Settings, action failures, notices, and event
  registration. Nine Rust tests cover config, PTY/session lifecycle, interactive shell
  input/resize, ANSI VT preservation, and sustained output.
- `.github/workflows/ci.yml` defines the Windows/macOS/Ubuntu typecheck, test,
  format, Clippy, PTY smoke, and optimized-build matrix. The contract parses
  locally but is not considered passing until GitHub executes all three jobs.
- `package.json`, `vite.config.ts`, `tsconfig.json` — new JS/Tauri entrypoints.

`frontend/` is used during the transition to avoid colliding with the old C++
`src/` directory. It can be renamed to `src/` after the C++ tree is deleted.

### 5b. Old implementation

**Real old implementation (4 files):**
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
- [x] **E0 scope** — _Terminal foundation_: real cross-platform terminal
      (PTY + xterm.js), tabs + splits, theming, config, tests, and CI.
      E0 is an internal technical milestone. _(Reclassified 2026-07-17)_
- [x] **First public release** — _v0.1 Persistent Project Workspaces_: accepted
      E0 plus named, local workspace persistence and restore. Layout and cwd
      restore in v0.1; process detach/reattach comes later. _(2026-07-17)_
- [x] **Primary user** — developers and technical power users coordinating
      several shells, dev tools, SSH sessions, and coding-agent CLIs.
      _(2026-07-17)_
- [x] **Switching reason** — stop and resume a named project workspace without
      rebuilding terminal layout and cwd context. _(2026-07-17)_

- [x] **C++ handling** — _delete later_ (not now). Old C++ stays in-tree during
      the Tauri transition; removed in a later step (git history preserves it).
      Old design judged stale → NOT harvested verbatim; instead **rethought**
      into the modern north-star (`VISION.md`). _(2026-06-22)_
- [x] **Vision scope** — narrowed from a broad terminal/media/browser/AI
      collection to a local-first persistent developer workspace. Later pane
      types remain possible only when they strengthen the core job.
      _(2026-07-17)_

### Roadmap — Milestones (see `VISION.md` for detail)

- **E0 — Terminal Foundation**: internal technical milestone; PTY + xterm.js,
  tabs/splits, themes, TOML, lifecycle, tests, and cross-platform CI.
- **E1 / v0.1 — Persistent Project Workspaces**: named workspaces, local
  layout/cwd persistence, restore, switching, and clear/reset behavior.
- **E2 — Workspace Power UX**: excellent pane manipulation, profiles, project
  actions, SSH entry points, saved layouts, then explicit detach/attach.
- **E3 — Agent-Aware Workflows**: launch and supervise external agent CLIs;
  provider integrations only after the terminal workflow is trustworthy.
- **E4 — Command Intelligence**: OSC 133 metadata, blocks, search, replay, and
  exit status.
- **E5 — Content and Browser Panes**: files, previews, media, and web content
  that directly support project work.
- **E6 — Integrations and Extensibility**: AI adapters, service integrations,
  Lua, plugins, and theme import.

## 8. Known Bugs (in existing real code)

- `terminalwx.cpp`: `m_isBusy` never reset to `false` on success → terminal
  stuck busy after first command (no `wxEVT_END_PROCESS` handler).
- `terminalwx.cpp`: `ReadProcessOutput()` recurses with `wxMilliSleep`+`Yield`
  → UI freeze / stack-overflow risk. Needs event-driven I/O.
- `terminalwx.cpp`: Vim mode is a no-op TODO.

## 9. Next Steps

1. ✅ Define the primary user, core job, switching reason, and local-first
   product promise.
2. ✅ Separate E0 Terminal Foundation from the v0.1 public product release.
3. ✅ Write the v0.1 Persistent Project Workspaces product brief.
4. ✅ Move the uncommitted E0 implementation onto
   `feat/e0-terminal-foundation` before further product code changes.
5. ✅ Fix the pane remount/render lifecycle and add focused frontend tests for
   split, tab switch, maximize/restore, close collapse, focus, and cwd inherit.
6. ✅ Preserve real PTY exit codes, drain final output, guard dead sessions, and
   cover failed spawn plus explicit close behavior in Rust tests.
7. ✅ Load the JSON theme, hot-reload config, add tab close/cycling actions,
   and implement geometry-based directional focus.
8. ✅ Add recoverable frontend error handling, broader E0 edge/integration
   coverage, and the Windows/macOS/Linux CI contract.
9. ⏳ The Windows/macOS/Ubuntu CI matrix passes; run and record the documented
   native-app compatibility suite on all three platforms before accepting E0.
10. ⏳ Remove the stale C++ tree in a separate cleanup change after the
   replacement is protected and reviewable.
11. ⏳ Design and implement E1 persistence against the v0.1 product brief.
12. ⏳ Revisit installer packaging after the v0.1 product loop is reliable;
    current WiX ICE validation remains environment-blocked.
