# Terminal Compatibility Smoke Suite

This suite is the E0 compatibility gate for the terminal foundation. Automated
checks prove raw PTY behavior on every CI operating system; the manual pass
proves native webview, xterm, clipboard, keyboard, and full-screen interaction.
Both parts are required before E0 is accepted.

## Automated baseline

Run:

```bash
npm run test:terminal-smoke
```

The Rust smoke tests open a real platform PTY and verify:

- interactive input reaches the default shell and output returns;
- a live PTY accepts a resize before more input;
- process output and the real exit code arrive in order;
- ANSI color control sequences remain in the VT stream;
- at least 512 lines and the final marker survive sustained output.

The GitHub Actions matrix runs this command on Windows, macOS, and Ubuntu. A
local result proves only the current operating system.

## Manual native-app pass

Start a development build with `npm run dev`, then record each row as pass or
fail for the release commit. Use a real SSH test host where noted; an SSH
version check is not an adequate substitute.

| Scenario | Procedure | Expected result |
|---|---|---|
| First prompt | Open Terminus with the default config. | A usable prompt appears without an account or network connection. |
| True color | Print ANSI foreground/background gradients or run a known true-color script. | Colors render without raw escape text or corrupted lines. |
| Sustained output | Produce at least 10,000 numbered lines. | Output completes, scrollback remains responsive, and the final line is present. |
| Full-screen TUI | Open `vim` or another alternate-screen TUI; edit, resize, and exit. | Redraw, cursor, keyboard input, and alternate-screen restoration are correct. |
| Colored Git | Run `git -c color.ui=always log --oneline --decorate -n 50`. | Decorations and colors render correctly and remain searchable/selectable. |
| SSH | Connect to a disposable real host, run output, resize, and disconnect. | The remote prompt, input, resize, and exit remain stable. |
| Pane layout | Create three mixed-direction panes and move focus with every arrow action. | Focus moves geometrically and no terminal session remounts or disappears. |
| Working directory | Change each pane directory via a shell that emits OSC 7, then split. | Pane/tab titles update and the new split inherits the focused cwd. |
| Selection/copy/paste | Select multiline output, copy it, and paste into a safe prompt. | Text and line breaks round-trip; denied clipboard access shows a notice. |
| Search | Search forward through known output. | The expected occurrence is selected without disrupting input. |
| Config reload | Change font size and a keybinding in `config.toml`, then save malformed TOML once. | Valid changes apply live; malformed input does not crash or block the app. |
| Failure recovery | Configure a nonexistent shell, open a tab, then restore the shell config. | The failed pane stays closable, explains the failure, and a new tab can recover. |

## Current evidence — 2026-07-18

| Environment | Automated PTY smoke | Manual native-app pass |
|---|---:|---:|
| Windows local | Pass — 2/2 on 2026-07-17 | Not yet run |
| Windows GitHub runner | Pass — 2/2 in [run 29634928793](https://github.com/NAME0x0/Terminus/actions/runs/29634928793) | Not applicable |
| macOS GitHub runner | Pass — 2/2 in [run 29634928793](https://github.com/NAME0x0/Terminus/actions/runs/29634928793) | Not applicable |
| Ubuntu GitHub runner | Pass — 2/2 in [run 29634928793](https://github.com/NAME0x0/Terminus/actions/runs/29634928793) | Not applicable |
| macOS native hardware | Covered by GitHub runner | Not yet run |
| Ubuntu native hardware | Covered by GitHub runner | Not yet run |

Do not mark E0 accepted while any required manual row or remote CI job remains
unverified. The v0.1 persistence/restore smoke pass is a separate release gate.
