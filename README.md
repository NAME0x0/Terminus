# Terminus

Terminus is a local-first, persistent workspace for developers who run multiple
shells, tools, and coding agents. It keeps terminal work organized, visible,
and resumable without requiring a cloud account.

The project is currently building **E0 — Terminal Foundation**, an internal
technical milestone based on Tauri, Rust, TypeScript, xterm.js, and
`portable-pty`. E0 is not the public product release.

The first public target is **v0.1 — Persistent Project Workspaces**: create a
named project workspace, arrange its terminal tabs and panes, close Terminus,
and return later to the same layout and working directories.

Read the [product vision](VISION.md), [v0.1 product brief](docs/product/terminus-v0.1-product-brief.md),
and [current project status](STATUS.md) for the product contract and progress.

## Current Stage: E0 Terminal Foundation

The local E0 implementation and the first E1 product slice currently include:

- PTY-backed shell sessions through `portable-pty`.
- xterm.js rendering with fit, search, web-links, Unicode, clipboard, and WebGL
  fallback support.
- Closable, keyboard-cyclable tabs and binary split-tree infrastructure.
- Pane lifecycle states, spatial focus, maximize, and cwd inheritance through
  OSC 7.
- TOML config defaults and filesystem hot reload for appearance, shell, cwd,
  and keybindings.
- JSON theme loading and live theme/font mapping into xterm and CSS.
- A shortcut-aware action registry and command palette, plus in-app Settings
  for appearance and terminal defaults.
- A React, Tailwind, and shadcn/ui application shell with an adaptive workspace
  sidebar: persistent on wider windows, user-collapsible, and a drawer on
  constrained windows.
- Named local workspaces with create, open, rename, remove, reset, save-state
  feedback, and layout/cwd restoration.
- A development-only Brainless compatibility preview for future agent event
  rendering; ordinary terminal streams remain in xterm.js.
- Recoverable frontend error notices, inline shell failures, and a retryable
  fatal-startup state.
- A Windows/macOS/Ubuntu GitHub Actions verification contract plus executable
  PTY compatibility smoke tests.

E0 remains incomplete until the remote Windows/macOS/Linux matrix passes and
the documented native-app terminal compatibility suite meets the
[technical design](docs/superpowers/specs/2026-06-22-terminus-e0-terminal-foundation-design.md).

## First Public Release: v0.1

The v0.1 Public Preview adds the product value that E0 alone does not provide:

- named workspaces with optional project roots;
- local persistence of tabs, split layout, focus, shell profile, and cwd;
- restore on launch using replacement PTY sessions in saved directories;
- clear workspace lifecycle, persistence state, and reset controls;
- no required account, network connection, or hosted service.

True detach/attach, built-in AI providers, command blocks, browser/content
panes, cloud sync, Lua, and plugins are later work.

## Project Layout

- `src-tauri/` — Tauri/Rust backend, IPC commands, PTY sessions, config loading.
- `frontend/` — React/Vite/TypeScript frontend, xterm panes, layout, workspaces,
  and keybindings.
- `res/themes/default.json` — Terminus theme source format.
- `VISION.md` — product positioning, principles, milestones, and roadmap.
- `STATUS.md` — living implementation status and decision log.
- `docs/product/` — product release contracts.
- `docs/superpowers/specs/` — approved technical designs.
- `docs/research/` — source and product research notes.
- `docs/testing/` — executable and manual compatibility gates.
- `.github/workflows/` — cross-platform verification contracts.

## Development

Prerequisites:

- Rust toolchain with Cargo.
- Node.js and npm.
- Platform requirements for Tauri v2.

Install JavaScript dependencies:

```bash
npm install
```

Run the app in development:

```bash
npm run dev
```

Build the release executable without installer packaging:

```bash
npm run build
```

Build platform bundles/installers:

```bash
npm run bundle
```

Run the checks currently available:

```bash
npm run typecheck
npm test
npm run test:terminal-smoke
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

The 39-test frontend suite covers pane attachment, layout lifecycle, tab
actions, spatial focus, live config application, theme mapping, keybinding
replacement, recoverable failures, workspace persistence, adaptive sidebar
behavior, and the Brainless compatibility boundary. The 15-test Rust suite
covers config and workspace-store contracts, filesystem reload and fallback,
real PTY output and exit codes, dead-session guards, manager create/close
behavior, interactive input/resize, ANSI VT data, and sustained output. The
cross-platform workflow is present, but the native-app compatibility suite is
still a separate manual gate; see the
[terminal smoke suite](docs/testing/terminal-compatibility-smoke.md).

## Config

On first launch, the backend creates `config.toml` in a `Terminus` folder under
the platform config directory. Open Settings from the titlebar or with
`Ctrl+,` to change appearance and terminal defaults without leaving the
workspace; the same area also shows every active shortcut. The config covers
appearance, shell command, shell args, cwd, and keybindings. Changes are watched
at runtime: appearance and keybindings update existing panes immediately, while
shell changes apply to terminals created afterward. Malformed TOML falls back
to built-in defaults without blocking startup.

## Old Scaffold

The C++/wxWidgets files under `src/`, `include/`, `tests/`, `CMakeLists.txt`,
and `build.bat` are retained temporarily for transition context. They must not
receive new product work and will be removed after the E0 implementation is
protected and its replacement boundary is clear in history.
