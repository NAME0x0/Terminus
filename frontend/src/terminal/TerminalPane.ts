import { invoke } from '@tauri-apps/api/core';
import { Terminal } from '@xterm/xterm';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import type { ITheme } from '@xterm/xterm';
import type { AppConfig } from '../config/types';
import type { ErrorReporter } from '../errors/ErrorCenter';
import { actionHint } from '../keys/shortcutHints';
import { createIcon, type IconName } from '../ui/icons';
import { parseOsc7Cwd } from './osc7';
import { startTerminalEventStream } from './TerminalEvents';

interface CreateTerminalResponse {
  id: number;
  cwd: string | null;
}

const panesByBackendId = new Map<number, TerminalPane>();

export type PaneCommand = 'splitHorizontal' | 'splitVertical' | 'toggleMaximizePane' | 'closePane';

export interface PaneMetadata {
  id: number | null;
  cwd: string | null;
  status: PaneStatus;
  title: string;
}

type PaneStatus = 'starting' | 'running' | 'exited' | 'failed';

export async function startTerminalEventListeners(): Promise<void> {
  await startTerminalEventStream(
    (output) => panesByBackendId.get(output.id)?.writeBase64(output.data),
    (exit) => panesByBackendId.get(exit.id)?.markExited(exit.code)
  );
}

export class TerminalPane {
  readonly element: HTMLDivElement;

  private readonly header = document.createElement('div');
  private readonly titleElement = document.createElement('div');
  private readonly statusElement = document.createElement('div');
  private readonly paneActionButtons = new Map<PaneCommand, HTMLButtonElement>();
  private readonly terminalHost: HTMLDivElement;
  private readonly term: Terminal;
  private readonly fitAddon = new FitAddon();
  private readonly searchAddon = new SearchAddon();
  private readonly resizeObserver: ResizeObserver;
  private resizeTimer: number | null = null;
  private pendingOutput: Uint8Array[] = [];
  private outputFrame: number | null = null;
  private lastSize = { cols: 0, rows: 0 };
  private backendId: number | null = null;
  private mounted = false;
  private currentCwd: string | null;
  private status: PaneStatus = 'starting';

  constructor(
    private config: AppConfig,
    theme: ITheme,
    private readonly onFocus: (pane: TerminalPane) => void,
    private readonly onCommand: (command: PaneCommand, pane: TerminalPane) => void,
    private readonly onMetadataChange: (pane: TerminalPane) => void,
    private readonly reportError: ErrorReporter,
    private readonly spawnCwd: string | null = null
  ) {
    this.currentCwd = spawnCwd ?? config.shell.cwd;
    this.element = document.createElement('div');
    this.element.className = 'terminal-pane';
    this.element.tabIndex = 0;

    this.header.className = 'pane-header';
    this.titleElement.className = 'pane-title';
    this.statusElement.className = 'pane-status';
    const meta = document.createElement('div');
    meta.className = 'pane-meta';
    meta.append(this.titleElement, this.statusElement);
    this.header.append(meta, this.createPaneActions());

    this.terminalHost = document.createElement('div');
    this.terminalHost.className = 'terminal-host';
    this.element.append(this.header, this.terminalHost);
    this.updateChrome();

    this.term = new Terminal({
      allowProposedApi: true,
      convertEol: true,
      cursorBlink: true,
      fontFamily: config.appearance.fontFamily,
      fontSize: config.appearance.fontSize,
      theme
    });

    this.term.loadAddon(this.fitAddon);
    this.term.loadAddon(this.searchAddon);
    this.term.loadAddon(new ClipboardAddon());
    this.term.loadAddon(new Unicode11Addon());
    this.term.loadAddon(new WebLinksAddon());
    this.term.unicode.activeVersion = '11';
    this.term.parser.registerOscHandler(7, (data) => {
      const cwd = parseOsc7Cwd(data);
      if (cwd) {
        this.currentCwd = cwd;
        this.updateChrome();
        this.onMetadataChange(this);
      }
      return true;
    });

    try {
      this.term.loadAddon(new WebglAddon());
    } catch {
      // WebGL is an optimization; canvas rendering is a valid fallback.
    }

    this.term.onData((data) => {
      if (this.backendId === null || this.status !== 'running') {
        return;
      }
      void invoke('write_stdin', {
        request: {
          id: this.backendId,
          data
        }
      }).catch((error: unknown) => this.reportError('Could not write to terminal', error));
    });

    this.element.addEventListener('pointerdown', () => this.onFocus(this));
    this.resizeObserver = new ResizeObserver(() => this.fitAndResizeBackend());
  }

  async mount(host: HTMLElement): Promise<void> {
    host.replaceChildren(this.element);
    this.term.open(this.terminalHost);
    this.mounted = true;
    try {
      this.fitAddon.fit();
    } catch (error) {
      this.reportError('Could not size terminal pane', error);
    }
    this.resizeObserver.observe(this.element);

    try {
      const response = await invoke<CreateTerminalResponse>('create_terminal', {
        request: {
          shell: this.config.shell.program,
          args: this.config.shell.args,
          cwd: this.spawnCwd ?? this.config.shell.cwd,
          cols: this.term.cols,
          rows: this.term.rows
        }
      });

      this.backendId = response.id;
      this.currentCwd = response.cwd ?? this.currentCwd;
      this.status = 'running';
      panesByBackendId.set(response.id, this);
      this.updateChrome();
      this.onMetadataChange(this);
      this.term.focus();
    } catch (error) {
      this.status = 'failed';
      this.term.options.disableStdin = true;
      this.updateChrome();
      this.onMetadataChange(this);
      this.reportError('Could not start shell', error);
      this.term.writeln(`Failed to start shell: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  remount(host: HTMLElement): void {
    host.replaceChildren(this.element);
    requestAnimationFrame(() => this.fitAndResizeBackend());
  }

  hasMounted(): boolean {
    return this.mounted;
  }

  applyConfig(config: AppConfig, theme: ITheme): void {
    this.config = config;
    this.term.options.fontFamily = config.appearance.fontFamily;
    this.term.options.fontSize = config.appearance.fontSize;
    this.term.options.theme = theme;
    this.updateActionHints();
    requestAnimationFrame(() => this.fitAndResizeBackend());
  }

  focus(): void {
    this.element.classList.add('is-focused');
    this.term.focus();
  }

  blur(): void {
    this.element.classList.remove('is-focused');
  }

  dispose(): void {
    this.mounted = false;
    this.resizeObserver.disconnect();
    if (this.resizeTimer !== null) {
      window.clearTimeout(this.resizeTimer);
    }
    if (this.outputFrame !== null) {
      window.cancelAnimationFrame(this.outputFrame);
    }
    if (this.backendId !== null) {
      panesByBackendId.delete(this.backendId);
      void invoke('close_terminal', { request: { id: this.backendId } }).catch((error: unknown) =>
        this.reportError('Could not close terminal session', error)
      );
    }
    this.term.dispose();
  }

  copy(): void {
    const selection = this.term.getSelection();
    if (selection.length > 0) {
      try {
        void navigator.clipboard
          .writeText(selection)
          .catch((error: unknown) => this.reportError('Could not copy terminal selection', error));
      } catch (error) {
        this.reportError('Could not copy terminal selection', error);
      }
    }
  }

  async paste(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      if (this.backendId !== null && this.status === 'running' && text.length > 0) {
        await invoke('write_stdin', {
          request: {
            id: this.backendId,
            data: text
          }
        });
      }
    } catch (error) {
      this.reportError('Could not paste into terminal', error);
    }
  }

  find(): void {
    const query = window.prompt('Find');
    if (query) {
      this.searchAddon.findNext(query);
    }
  }

  writeBase64(data: string): void {
    let bytes: Uint8Array;
    try {
      const binary = atob(data);
      bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    } catch (error) {
      this.reportError('Could not decode terminal output', error);
      return;
    }
    this.pendingOutput.push(bytes);
    if (this.outputFrame !== null) {
      return;
    }

    this.outputFrame = window.requestAnimationFrame(() => {
      this.outputFrame = null;
      if (this.pendingOutput.length === 0) {
        return;
      }

      const output = concatBytes(this.pendingOutput);
      this.pendingOutput = [];
      this.term.write(output);
    });
  }

  markExited(code: number | null): void {
    if (this.status === 'exited') {
      return;
    }
    this.status = 'exited';
    this.term.options.disableStdin = true;
    if (this.backendId !== null) {
      panesByBackendId.delete(this.backendId);
    }
    this.updateChrome();
    this.onMetadataChange(this);
    this.term.writeln('');
    this.term.writeln(`[process exited${code === null ? '' : ` ${code}`}]`);
  }

  metadata(): PaneMetadata {
    return {
      id: this.backendId,
      cwd: this.currentCwd,
      status: this.status,
      title: this.title()
    };
  }

  cwd(): string | null {
    return this.currentCwd;
  }

  title(): string {
    if (!this.currentCwd) {
      return 'Terminal';
    }
    const normalized = this.currentCwd.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    return parts.at(-1) ?? this.currentCwd;
  }

  private fitAndResizeBackend(): void {
    if (!this.element.isConnected || this.status !== 'running') {
      return;
    }

    if (this.resizeTimer !== null) {
      window.clearTimeout(this.resizeTimer);
    }
    this.resizeTimer = window.setTimeout(() => {
      this.resizeTimer = null;
      if (this.status !== 'running') {
        return;
      }
      try {
        this.fitAddon.fit();
      } catch {
        return;
      }

      if (
        this.backendId === null ||
        (this.lastSize.cols === this.term.cols && this.lastSize.rows === this.term.rows)
      ) {
        return;
      }

      this.lastSize = { cols: this.term.cols, rows: this.term.rows };
      void invoke('resize', {
        request: {
          id: this.backendId,
          cols: this.term.cols,
          rows: this.term.rows
        }
      }).catch((error: unknown) => this.reportError('Could not resize terminal session', error));
    }, 40);
  }

  private createPaneActions(): HTMLElement {
    const actions = document.createElement('div');
    actions.className = 'pane-actions';
    actions.ariaLabel = 'Focused pane actions';
    actions.append(
      this.actionButton('splitRight', 'Split right', 'splitVertical'),
      this.actionButton('splitDown', 'Split down', 'splitHorizontal'),
      this.actionButton('maximize', 'Maximize or restore pane', 'toggleMaximizePane'),
      this.actionButton('close', 'Close pane', 'closePane')
    );
    return actions;
  }

  private actionButton(icon: IconName, title: string, command: PaneCommand): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pane-action';
    button.dataset.actionId = command;
    button.dataset.title = title;
    button.append(createIcon(icon));
    this.paneActionButtons.set(command, button);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      this.onFocus(this);
      this.onCommand(command, this);
    });
    this.updateActionHint(button, command);
    return button;
  }

  private updateActionHints(): void {
    for (const [command, button] of this.paneActionButtons) {
      this.updateActionHint(button, command);
    }
  }

  private updateActionHint(button: HTMLButtonElement, command: PaneCommand): void {
    const title = button.dataset.title ?? command;
    const hint = actionHint(title, this.config.keybindings, command);
    button.title = hint;
    button.ariaLabel = hint;
    button.dataset.tooltip = hint;
  }

  private updateChrome(): void {
    this.titleElement.textContent = this.title();
    this.titleElement.title = this.currentCwd ?? 'Terminal';
    this.statusElement.textContent = this.status;
    this.statusElement.dataset.status = this.status;
    this.element.dataset.status = this.status;
  }
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) {
    return chunks[0];
  }

  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}
