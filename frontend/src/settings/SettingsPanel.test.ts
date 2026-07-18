import { afterEach, describe, expect, it, vi } from 'vitest';

import { ActionRegistry } from '../actions/actions';
import type { AppConfig } from '../config/types';
import { SettingsPanel } from './SettingsPanel';

describe('SettingsPanel', () => {
  afterEach(() => {
    document.body.replaceChildren();
    document.body.className = '';
  });

  it('shows configured shortcuts and persists normalized settings', async () => {
    const actions = new ActionRegistry();
    actions.register({ id: 'newTab', title: 'New tab', run: () => {} });
    actions.register({ id: 'splitVertical', title: 'Split pane right', run: () => {} });
    const save = vi.fn(async (config: AppConfig) => config);
    const panel = new SettingsPanel(config(), actions, save);
    panel.open();

    expect(document.body.textContent).toContain('Ctrl + Shift + T');
    expect(document.body.textContent).toContain('Alt + Shift + \\');

    field<HTMLInputElement>('fontFamily').value = '  JetBrains Mono  ';
    field<HTMLInputElement>('fontSize').value = '40';
    field<HTMLInputElement>('shellProgram').value = '  pwsh.exe  ';
    field<HTMLTextAreaElement>('shellArgs').value = '-NoLogo\n\n-NoProfile';
    document.querySelector<HTMLFormElement>('.settings-form')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    );

    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save).toHaveBeenCalledWith({
      appearance: { theme: 'default', fontFamily: 'JetBrains Mono', fontSize: 32 },
      shell: { program: 'pwsh.exe', cwd: null, args: ['-NoLogo', '-NoProfile'] },
      keybindings: config().keybindings
    });
    expect(document.querySelector('.settings-status')?.textContent).toContain('Saved');
  });

  it('closes on Escape and restores the previous focus', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    const panel = new SettingsPanel(config(), new ActionRegistry(), async (next) => next);
    panel.open();

    document.querySelector<HTMLElement>('.settings-overlay')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );

    expect(document.querySelector<HTMLElement>('.settings-overlay')?.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });
});

function field<T extends HTMLInputElement | HTMLTextAreaElement>(name: string): T {
  const element = document.querySelector<T>(`[name="${name}"]`);
  if (!element) {
    throw new Error(`missing ${name}`);
  }
  return element;
}

function config(): AppConfig {
  return {
    appearance: { theme: 'default', fontFamily: 'Cascadia Code', fontSize: 13 },
    shell: { program: null, args: [], cwd: null },
    keybindings: {
      'Ctrl+Shift+T': 'newTab',
      'Alt+Shift+\\': 'splitVertical'
    }
  };
}
