import type { ActionRegistry } from '../actions/actions';
import type { AppConfig } from '../config/types';
import type { ErrorReporter } from '../errors/ErrorCenter';
import { formatShortcut, shortcutForAction } from '../keys/shortcutHints';
import { createIcon } from '../ui/icons';

export type SaveConfig = (config: AppConfig) => Promise<AppConfig>;

export class SettingsPanel {
  private readonly overlay = document.createElement('div');
  private readonly dialog = document.createElement('aside');
  private readonly form = document.createElement('form');
  private readonly status = document.createElement('div');
  private readonly shortcutList = document.createElement('div');
  private lastFocused: HTMLElement | null = null;
  private config: AppConfig;

  constructor(
    initialConfig: AppConfig,
    private readonly actions: ActionRegistry,
    private readonly saveConfig: SaveConfig,
    private readonly reportError: ErrorReporter = () => {}
  ) {
    this.config = initialConfig;
    this.overlay.className = 'settings-overlay';
    this.overlay.hidden = true;

    this.dialog.className = 'settings-panel';
    this.dialog.role = 'dialog';
    this.dialog.ariaModal = 'true';
    this.dialog.setAttribute('aria-labelledby', 'settings-title');

    const header = document.createElement('header');
    header.className = 'settings-header';
    const heading = document.createElement('div');
    heading.innerHTML = `
      <div class="settings-eyebrow">Preferences</div>
      <h2 id="settings-title">Settings</h2>
      <p>Tune the terminal without leaving your workspace.</p>
    `;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'settings-close';
    close.ariaLabel = 'Close settings';
    close.title = 'Close settings';
    close.append(createIcon('close'));
    close.addEventListener('click', () => this.close());
    header.append(heading, close);

    this.form.className = 'settings-form';
    this.form.innerHTML = `
      <section class="settings-section" aria-labelledby="appearance-heading">
        <div class="settings-section-heading">
          <div>
            <h3 id="appearance-heading">Appearance</h3>
            <p>Changes apply to every open terminal.</p>
          </div>
        </div>
        <div class="settings-grid">
          <label class="settings-field">
            <span>Theme</span>
            <select name="theme" aria-label="Theme">
              <option value="default">Terminus Dark</option>
            </select>
          </label>
          <label class="settings-field settings-field-wide">
            <span>Terminal font</span>
            <input name="fontFamily" type="text" autocomplete="off" spellcheck="false" />
          </label>
          <label class="settings-field">
            <span>Font size</span>
            <input name="fontSize" type="number" min="8" max="32" step="1" inputmode="numeric" />
          </label>
        </div>
      </section>
      <section class="settings-section" aria-labelledby="terminal-heading">
        <div class="settings-section-heading">
          <div>
            <h3 id="terminal-heading">Terminal defaults</h3>
            <p>Shell changes apply when you open a new tab or pane.</p>
          </div>
        </div>
        <div class="settings-grid">
          <label class="settings-field settings-field-wide">
            <span>Shell program</span>
            <input name="shellProgram" type="text" autocomplete="off" spellcheck="false" placeholder="Use the system default" />
          </label>
          <label class="settings-field settings-field-wide">
            <span>Starting directory</span>
            <input name="shellCwd" type="text" autocomplete="off" spellcheck="false" placeholder="Use the current directory" />
          </label>
          <label class="settings-field settings-field-wide">
            <span>Shell arguments <small>one per line</small></span>
            <textarea name="shellArgs" rows="3" spellcheck="false"></textarea>
          </label>
        </div>
      </section>
      <section class="settings-section" aria-labelledby="shortcuts-heading">
        <div class="settings-section-heading">
          <div>
            <h3 id="shortcuts-heading">Keyboard shortcuts</h3>
            <p>These bindings come from <code>config.toml</code> and update live.</p>
          </div>
        </div>
      </section>
    `;
    this.shortcutList.className = 'settings-shortcuts';
    this.form.querySelector('[aria-labelledby="shortcuts-heading"]')?.append(this.shortcutList);

    const footer = document.createElement('footer');
    footer.className = 'settings-footer';
    this.status.className = 'settings-status';
    this.status.role = 'status';
    const footerActions = document.createElement('div');
    footerActions.className = 'settings-footer-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'button-secondary';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => this.close());
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'button-primary';
    save.textContent = 'Save changes';
    footerActions.append(cancel, save);
    footer.append(this.status, footerActions);
    this.form.append(footer);

    this.dialog.append(header, this.form);
    this.overlay.append(this.dialog);
    document.body.append(this.overlay);

    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.save();
    });
    this.overlay.addEventListener('pointerdown', (event) => {
      if (event.target === this.overlay) {
        this.close();
      }
    });
    this.overlay.addEventListener('keydown', (event) => this.handleKeydown(event));
    this.renderConfig();
  }

  open(): void {
    this.lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.renderConfig();
    this.status.textContent = '';
    this.overlay.hidden = false;
    document.body.classList.add('has-settings-open');
    requestAnimationFrame(() => this.field<HTMLInputElement>('fontFamily').focus());
  }

  close(): void {
    this.overlay.hidden = true;
    document.body.classList.remove('has-settings-open');
    this.lastFocused?.focus();
  }

  update(config: AppConfig): void {
    this.config = config;
    if (!this.overlay.hidden) {
      this.renderConfig();
    }
  }

  private renderConfig(): void {
    this.field<HTMLSelectElement>('theme').value = this.config.appearance.theme;
    this.field<HTMLInputElement>('fontFamily').value = this.config.appearance.fontFamily;
    this.field<HTMLInputElement>('fontSize').value = String(this.config.appearance.fontSize);
    this.field<HTMLInputElement>('shellProgram').value = this.config.shell.program ?? '';
    this.field<HTMLInputElement>('shellCwd').value = this.config.shell.cwd ?? '';
    this.field<HTMLTextAreaElement>('shellArgs').value = this.config.shell.args.join('\n');

    this.shortcutList.replaceChildren();
    for (const action of this.actions.list()) {
      const row = document.createElement('div');
      row.className = 'settings-shortcut-row';
      const label = document.createElement('span');
      label.textContent = action.title;
      const shortcut = shortcutForAction(this.config.keybindings, action.id);
      const hint = document.createElement('kbd');
      hint.className = 'shortcut-hint';
      hint.textContent = shortcut ? formatShortcut(shortcut) : 'Not assigned';
      if (!shortcut) {
        hint.classList.add('is-unassigned');
      }
      row.append(label, hint);
      this.shortcutList.append(row);
    }
  }

  private async save(): Promise<void> {
    const submit = this.form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Saving…';
    }
    this.status.textContent = 'Saving settings…';

    const nextConfig: AppConfig = {
      appearance: {
        theme: this.field<HTMLSelectElement>('theme').value,
        fontFamily: this.field<HTMLInputElement>('fontFamily').value.trim() || 'Cascadia Code',
        fontSize: clamp(Number(this.field<HTMLInputElement>('fontSize').value), 8, 32)
      },
      shell: {
        program: nullableValue(this.field<HTMLInputElement>('shellProgram').value),
        cwd: nullableValue(this.field<HTMLInputElement>('shellCwd').value),
        args: this.field<HTMLTextAreaElement>('shellArgs')
          .value.split(/\r?\n/)
          .map((argument) => argument.trim())
          .filter(Boolean)
      },
      keybindings: { ...this.config.keybindings }
    };

    try {
      this.config = await this.saveConfig(nextConfig);
      this.status.textContent = 'Saved. Appearance updated; shell defaults apply to new panes.';
      this.renderConfig();
    } catch (error) {
      this.status.textContent = 'Could not save settings.';
      this.reportError('Could not save settings', error);
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Save changes';
      }
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close();
      event.preventDefault();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const focusable = [
      ...this.dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)'
      )
    ];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) {
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && document.activeElement === last) {
      first.focus();
      event.preventDefault();
    }
  }

  private field<T extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(name: string): T {
    const field = this.form.elements.namedItem(name);
    if (!(field instanceof HTMLElement)) {
      throw new Error(`missing settings field ${name}`);
    }
    return field as T;
  }
}

function nullableValue(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  return Math.min(Math.max(Math.round(value), minimum), maximum);
}
