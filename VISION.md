# Terminus — Product Vision

> Long-range product direction. Last updated: 2026-07-17.

## North star

**Terminus is a local-first, persistent workspace for developers who run
multiple shells, tools, and coding agents.** It keeps terminal work organized,
visible, and resumable without requiring a cloud account.

The terminal is the foundation, not the complete product. Terminus becomes
valuable when a developer can give project work a durable home, leave it, and
return without reconstructing terminals, directories, and layout by hand.

## Who it is for

The first user is a developer or technical power user who routinely coordinates
several terminal processes: shells, editors, dev servers, test watchers, SSH
sessions, infrastructure tools, and coding-agent CLIs.

They are not looking for a literal desktop replacement. They want a focused,
local workspace that makes complex terminal work easier to see, manage, and
resume.

## Core job

When work on a project spans multiple terminal tools, help the user preserve the
organization and context of that work so stopping and resuming is inexpensive.

## First switching reason

Open a named project workspace, arrange the terminals needed for that project,
close Terminus, and return later to the same tabs, pane layout, and working
directories.

Terminal correctness is mandatory, but it is not enough to make someone switch.
The durable workspace is the product wedge.

## Product principles

1. **Real terminal first.** PTY-backed sessions and a proven VT engine must run
   shells, SSH, editors, and TUIs correctly. Product features cannot compensate
   for an unreliable terminal.
2. **Workspaces are durable.** Project identity, tabs, panes, layout, focus, and
   cwd should survive restart. Process survival is a separate, later capability.
3. **Local-first and inspectable.** Core use requires no account or network.
   Saved state belongs to the user and can be inspected or cleared.
4. **Panes are the common model.** A pane begins as a terminal and can later
   host an agent, file, image, browser, or other content without inventing a
   second workspace system.
5. **Clear lifecycle over hidden magic.** Starting, running, failed, exited, and
   restored state must be visible. Errors should be actionable rather than
   silently swallowed.
6. **Keyboard and mouse are peers.** Fast actions and shortcuts coexist with
   predictable focus, selection, resizing, drag/drop, and context menus.
7. **Cross-platform by contract.** Windows, macOS, and Linux behavior is held by
   automated tests and CI, not only by portable dependencies.
8. **Agents extend the workspace.** External coding agents should work naturally
   as terminal processes before Terminus adds provider integrations or agent
   abstractions.

## Milestone model

Engineering milestones and product releases are deliberately separate.

### E0 — Terminal Foundation

An internal technical milestone: PTY lifecycle, xterm rendering, tabs, splits,
themes, config, keybindings, cwd tracking, tests, and cross-platform CI. E0
proves that the foundation is trustworthy; it is not itself a public release.

Technical design:
`docs/superpowers/specs/2026-06-22-terminus-e0-terminal-foundation-design.md`.

### v0.1 Public Preview — Persistent Project Workspaces

The first publicly valuable release combines accepted E0 behavior with named,
local workspaces that restore tabs, split-tree layout, focus, shell profiles,
and cwd. Restored panes start replacement shells in the saved directories; v0.1
does not promise that child processes survive application exit.

Product contract: `docs/product/terminus-v0.1-product-brief.md`.

## Roadmap after the foundation

The order reflects user value and dependency, not feature spectacle.

### E1 — Persistent Project Workspaces  ← **v0.1 product milestone**

Named workspaces, optional project roots, local layout/cwd persistence, restore,
workspace switching, explicit reset/clear behavior, and crash-safe state writes.

### E2 — Workspace Power UX

Excellent pane manipulation, drag/drop and resizing, shell profiles, saved
layouts, project actions, SSH entry points, and eventually background process
continuity through an explicit detach/attach service.

### E3 — Agent-Aware Workflows

Make external coding agents easy to launch, identify, supervise, and target from
the workspace. Add structured agent state and provider integrations only after
ordinary agent CLIs work well inside durable terminal workspaces.

### E4 — Command Intelligence

OSC 133 shell integration, command lifecycle metadata, searchable command
records, blocks, replay, exit status, and copy/share operations. Raw PTY bytes
remain the compatibility source of truth.

### E5 — Content and Browser Panes

Extend the shared pane model to files, Markdown, images, video, previews, and
web content where those formats directly support project work.

### E6 — Integrations and Extensibility

Local and cloud AI adapters, service integrations, Lua scripting, plugin APIs,
theme import, and community extensions. Each addition must strengthen the core
workspace rather than turn Terminus into an unrelated app collection.

## Explicit non-goals

- Replacing the operating-system shell or desktop environment.
- Shipping a generic media center, browser, or widget dashboard.
- Requiring an account, cloud sync, or hosted AI service for core operation.
- Adding built-in AI before terminal and workspace reliability are proven.
- Building every roadmap item before releasing useful software.

## Decision filter

A proposed feature belongs in Terminus when it makes terminal-based project
work easier to organize, understand, resume, or extend. If it does not reinforce
that job, it should not enter the roadmap merely because it can fit in a pane.
