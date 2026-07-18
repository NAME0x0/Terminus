# Warp Terminal Notes for Terminus

> Research note for shaping Terminus E0 and the first public workspace release.
> Last updated: 2026-07-17.

## Purpose

Warp is a strong reference product for Terminus because it has already tested
many of the hard terminal UX ideas we want: real shell compatibility, structured
command output, modern text editing, panes, settings, and agent-aware workflows.

This note is not a plan to clone Warp. It is a filter: what to learn from Warp,
what to avoid copying, and what should change in Terminus next.

## Licensing Boundary

Warp's public repository is useful for research, but direct code reuse needs a
license decision first. Warp's README says the `warpui_core` and `warpui` crates
are MIT licensed, while the rest of the repository is AGPL v3.

Terminus should treat Warp as product and architecture inspiration only unless
we explicitly decide AGPL compatibility is acceptable. No Warp code should be
copied into Terminus during E0 or the v0.1 workspace milestone.

## Sources Reviewed

- Warp GitHub repository: <https://github.com/warpdotdev/warp>
- Warp open-source announcement: <https://www.warp.dev/blog/warp-is-now-open-source>
- Warp engineering write-up: <https://www.warp.dev/blog/how-warp-works>
- Warp Blocks docs: <https://docs.warp.dev/terminal/blocks/>
- Warp split panes docs: <https://docs.warp.dev/terminal/windows/split-panes/>
- Warp working directory docs: <https://docs.warp.dev/terminal/more-features/working-directory/>
- Warp text selection docs: <https://docs.warp.dev/terminal/more-features/text-selection/>
- Warp session restoration docs: <https://docs.warp.dev/terminal/sessions/session-restoration/>
- Warp command palette docs: <https://docs.warp.dev/terminal/command-palette/>
- Warp settings reference: <https://docs.warp.dev/terminal/settings/all-settings/>

## Current Terminus Baseline

Terminus now has a Tauri/Rust + Vite/TypeScript scaffold with `portable-pty`,
xterm.js, tabs, split panes, theme mapping, config defaults, and Tauri event
capabilities. It is still early and feels janky because it lacks the product
model around the terminal: no command model, no cwd tracking, no robust shell
integration, no pane drag/drop, no command palette, and minimal error states.

The next work should not expand into built-in AI, media, or browser panes yet.
It should make the E0 terminal core trustworthy, then make project context
durable for the v0.1 Public Preview.

## Takeaways

### 1. Performance Is A Feature

Warp's engineering notes frame speed as core product quality, especially for
PTY reads, ANSI parsing, rendering, and scrolling. Terminus uses xterm.js rather
than a custom GPU terminal grid, so our performance work should focus on:

- Batch PTY output before writing to xterm instead of emitting tiny chunks.
- Debounce resize events so pane resizing does not flood Rust IPC.
- Add smoke tests for large output, color output, long scrollback, and TUIs.
- Track startup time, first prompt time, and resize latency as real metrics.

E0 should be considered unfinished until `vim`, `ssh`, `git log --color`,
long-running output, and resize behavior are boring.

### 2. Blocks Are A Data Model, Not A Skin

Warp's Blocks work because the app knows command boundaries. The important
lesson is not the visual card treatment; it is the command lifecycle model:
prompt shown, command entered, command running, output captured, exit code
known, block searchable/copyable/rerunnable.

Terminus should defer full Blocks to E4, but E0 should avoid decisions that make
Blocks hard later. Concretely:

- Keep raw PTY bytes flowing to xterm for compatibility.
- Add a parallel metadata channel for shell integration events.
- Start with OSC 7 cwd tracking in E0.
- Add OSC 133/preexec/precmd-style command boundary tracking in E4.
- Represent command history as structured records, not only terminal scrollback.

### 3. Panes Need Predictable Interaction Rules

Warp's pane behavior includes right/down splits, previous/next pane focus,
arrow-key pane navigation, maximize pane, close pane, and drag/drop pane
movement. Terminus currently has a recursive split tree, but the interaction
surface is incomplete.

For E0 polish:

- Add visible pane headers or a subtle focus affordance that is always clear.
- Implement previous/next pane and directional focus.
- Add maximize/restore focused pane.
- Preserve each pane as a unique terminal session.
- Make new splits inherit the focused pane's cwd once OSC 7 exists.
- Defer drag/drop until keyboard and click behavior are solid.

### 4. Text Selection Deserves First-Class Treatment

Warp documents smart selection for URLs, paths, emails, IPs, and numbers, plus
rectangular selection for columnar output. Terminus should not try to rebuild a
full selection engine in E0, because xterm.js already handles baseline terminal
selection. The right near-term path is:

- Ensure standard selection, copy, paste, and web links work reliably.
- Add smart double-click selection later for file paths and URLs.
- Add rectangular selection only after basic selection is stable.
- Avoid custom mouse behavior that fights xterm.js.

### 5. Working Directory Is Part Of Session Identity

Warp offers home, previous session, custom, and per-window/tab/pane working
directory policies. Terminus already plans OSC 7 cwd tracking; this should move
up in priority because it affects splits, tab titles, session restore, and
future agents.

Suggested Terminus config shape:

```toml
[session.cwd]
new_window = "home"      # home | previous | custom
new_tab = "previous"
new_pane = "previous"
custom = ""
```

### 6. Session Restore Should Be Explicit And Local

Warp stores windows, tabs, panes, and recent blocks locally in SQLite and exposes
ways to clear that data. Terminus now makes local workspace persistence the E1
product milestone and the core of its v0.1 Public Preview; the Warp lesson is to
design it with privacy controls from the start.

For Terminus:

- Store session layout and cwd before storing output history.
- Keep restore local by default.
- Add a visible "clear session history" command before saving command output.
- Treat sensitive command output as a product concern, not only a storage detail.

### 7. Command Palette Should Become The Main Action Dispatcher

Warp's command palette is a global search surface for actions, settings,
shortcuts, files, workflows, and sessions. Terminus should use the same idea as
the UI gateway for advanced features instead of adding many menu surfaces.

Near-term implementation path:

- Build a registry of actions behind keybindings.
- Add a small command palette over that action registry.
- Include pane actions first: split, close, maximize, focus next, new tab.
- Later add settings, theme switching, profiles, SSH hosts, and agents.

### 8. Agent Support Should Ride On The Terminal Model

Warp now frames itself as an agentic development environment and supports both
built-in and external CLI agents. Terminus's E3 agent-aware milestone is aligned
with this, but it should not precede terminal and workspace correctness.

The right sequence is:

1. E0: reliable terminal sessions, panes, cwd, config, tests, and CI.
2. E1 / v0.1: named local workspaces with layout and cwd restore.
3. E2: power workspace interaction and, later, explicit background lifecycle.
4. E3: agent-aware launch and supervision, followed by provider integrations.
5. E4: command metadata, blocks, command replay, and exit-state surfaces.

Agents become much more useful once they can target a known pane, know cwd, read
structured command outcomes, and show their work in the same terminal model.

## Recommended Next Work For Terminus

### E0 Stabilization

- Fix app startup and permission issues before adding features.
- Add pane lifecycle states: starting, running, exited, failed.
- Add inline spawn errors when shell creation fails.
- Debounce resize IPC.
- Add visible close/split/maximize controls using icons.
- Implement directional pane focus and next/previous pane focus.
- Add OSC 7 cwd parsing and per-pane cwd state.
- Add tab titles from cwd or shell profile.
- Add tests for config defaults, session create/close, resize, and shell spawn.

### v0.1 Workspace Preparation

- Define a local, versioned workspace-state schema.
- Persist workspace identity, project root, tabs, split tree, focus, shell
  profile, and cwd without persisting terminal output by default.
- Use crash-safe writes and provide explicit clear/reset behavior.
- Restore replacement PTYs in saved directories; do not imply that processes
  survive application exit until a background service exists.
- Test the complete create, arrange, close, reopen, and restore loop.

### E4 Command-Intelligence Preparation

- Research shell integration options for PowerShell, bash, zsh, fish, and WSL.
- Decide whether to use OSC 133, custom OSC/DCS messages, or both.
- Define a `CommandBlock` model before building the UI.
- Track command text, start time, end time, exit code, cwd, and output ranges.
- Make copy/rerun/search behavior operate on command records.

### Product Guardrails

- Do not copy Warp code unless licensing is explicitly resolved.
- Do not add built-in AI panes before the terminal and persistence loop feels
  stable.
- Do not let the web UI own terminal truth; Rust owns sessions, xterm owns VT
  rendering, and app-level models own metadata.
- Do not hide terminal errors. Shell spawn, PTY read, IPC, and ACL failures need
  visible states.

## Open Questions

- Should Terminus keep xterm.js long-term or eventually move to a Rust-native
  terminal grid?
- Should command metadata be captured through standard OSC 133 first, then add
  custom extensions only where needed?
- Should workspace persistence use SQLite from the start of E1, or begin with a
  simple TOML/JSON layout file and graduate later?
- How much of Warp-style command editing belongs in Terminus versus leaving
  editing to the user's shell in the initial public releases?
