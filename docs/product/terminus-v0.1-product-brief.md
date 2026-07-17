# Terminus v0.1 Public Preview — Product Brief

> Product contract for the first publicly valuable Terminus release.
> Approved: 2026-07-17.

## Product promise

Terminus is a local-first, persistent workspace for developers who run multiple
shells, tools, and coding agents. It keeps terminal work organized, visible,
and resumable without requiring a cloud account.

The first switching reason is simple:

> Open a named project workspace, arrange the terminals needed for that work,
> close Terminus, and return later to the same layout and working directories.

## Primary user

The first user is a developer or technical power user whose normal work spans
several concurrent terminal processes, such as:

- a project shell and editor;
- a development server and test watcher;
- an SSH or infrastructure session;
- one or more terminal-based coding agents.

They value local control, keyboard efficiency, visible process state, and the
ability to resume context without rebuilding a workspace by hand.

## Core job

When working on a project across multiple terminal tools, help the user keep
those tools arranged, understandable, and recoverable so they can stop and
resume work without reconstructing context.

## Why switch

Terminus v0.1 is not trying to win by being another terminal emulator. Its
terminal foundation must be excellent, but the product value is the durable
workspace built around it:

- project work has a name and a stable home;
- tabs, panes, layout, focus, and working directories survive an app restart;
- each pane has clear lifecycle and error state;
- external CLI tools and coding agents fit naturally without special hosting;
- workspace state remains local and can be inspected or cleared by the user.

## Relationship to E0

**E0 — Terminal Foundation** is an internal technical milestone. It proves that
PTY sessions, xterm.js rendering, tabs, splits, configuration, theming, and the
cross-platform build/test contract are reliable.

**v0.1 Public Preview** is the first product release. It includes the accepted
E0 foundation plus the minimum persistent-workspace experience below. E0 being
complete does not by itself make the product ready to publish.

## In scope for v0.1

### Reliable terminal foundation

- PTY-backed terminals that handle common shells, TUIs, SSH, color, Unicode,
  links, selection, clipboard, search, resize, and large output.
- Tabs and horizontal/vertical split panes with predictable focus, close,
  maximize, and resize behavior.
- Visible starting, running, exited, and failed states.
- Configurable shell, appearance, theme, and keybindings.

### Named project workspaces

- Create, open, rename, and remove a named workspace.
- Associate an optional local project directory with a workspace.
- Persist tabs, split-tree layout, active tab, focused pane, pane cwd, and shell
  profile locally.
- Restore that structure on the next launch and start replacement PTY sessions
  in their saved working directories.
- Make the active workspace and persistence state visible in the UI.
- Provide an explicit way to clear saved workspace state.

### Release foundation

- Automated Windows, macOS, and Linux checks for build, unit, and integration
  behavior.
- A documented manual smoke suite for terminal compatibility and restore flows.
- No account, network connection, or hosted service required for core use.

## Explicitly out of scope

- Keeping child processes alive after the application exits. True detach and
  reattach requires a background service and comes later.
- Built-in AI providers or a hosted AI gateway. External coding-agent CLIs work
  as ordinary terminal processes in v0.1.
- Structured command blocks, command replay, and OSC 133 history models.
- Image, video, file-preview, or browser panes.
- Cloud sync, collaboration, telemetry required for operation, or user accounts.
- Lua scripting, a plugin API, and service integrations.

## Release acceptance

v0.1 is ready for a public preview when all of the following are demonstrated:

1. A new user can create a workspace and reach a working shell without an
   account or network dependency.
2. The user can build a three-pane project layout, assign distinct working
   directories, close Terminus, reopen it, and recover the same organization.
3. Restored panes start in the correct directories and failures are visible and
   recoverable.
4. `vim` or another full-screen TUI, SSH, colored Git output, long output,
   resize, selection, copy/paste, and search pass the smoke suite.
5. Unit and integration tests cover layout persistence, config fallback, PTY
   lifecycle, session lifecycle, and restore behavior.
6. Required Windows, macOS, and Linux CI checks pass on the release commit.
7. Saved state is local, documented, and removable by the user.

## Product signals

During the public preview, evaluate:

- **Activation:** can a developer create and restore a useful workspace in one
  session without guidance?
- **Reliability:** do layout, cwd, and pane identity restore without data loss or
  surprising duplication?
- **Habit value:** do users return to named workspaces instead of rebuilding
  terminal layouts manually?
- **Trust:** are process state, errors, and local persistence understandable?
- **Performance:** track startup, first-prompt, output, and resize latency from a
  measured baseline before setting hard targets.

Feedback collection must remain optional and must not weaken the local-first,
no-account product promise.
