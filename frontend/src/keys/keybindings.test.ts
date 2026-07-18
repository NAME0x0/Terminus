import { afterEach, describe, expect, it } from 'vitest';

import { ActionRegistry } from '../actions/actions';
import type { AppConfig } from '../config/types';
import { bindKeybindings, type KeybindingBinding } from './keybindings';

describe('keybindings', () => {
  let binding: KeybindingBinding | null = null;

  afterEach(() => {
    binding?.dispose();
    binding = null;
    document.body.replaceChildren();
  });

  it('uses a replacement keymap after config reload', () => {
    const actions = new ActionRegistry();
    let runs = 0;
    actions.register({
      id: 'newTab',
      title: 'New tab',
      run: () => {
        runs += 1;
      }
    });
    binding = bindKeybindings(configWith({ 'Ctrl+Shift+T': 'newTab' }), actions);

    pressWindowKey('t', { ctrlKey: true, shiftKey: true });
    expect(runs).toBe(1);

    binding.update(configWith({ 'Ctrl+N': 'newTab' }));
    pressWindowKey('t', { ctrlKey: true, shiftKey: true });
    pressWindowKey('n', { ctrlKey: true });
    expect(runs).toBe(2);
  });

  it('does not intercept typing in an input', () => {
    const actions = new ActionRegistry();
    let runs = 0;
    actions.register({
      id: 'newTab',
      title: 'New tab',
      run: () => {
        runs += 1;
      }
    });
    binding = bindKeybindings(configWith({ 'Ctrl+N': 'newTab' }), actions);
    const input = document.createElement('input');
    document.body.append(input);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, bubbles: true }));

    expect(runs).toBe(0);
  });

  it('does not intercept shortcuts while editing a select or contenteditable field', () => {
    const actions = new ActionRegistry();
    let runs = 0;
    actions.register({
      id: 'newTab',
      title: 'New tab',
      run: () => {
        runs += 1;
      }
    });
    binding = bindKeybindings(configWith({ 'Ctrl+N': 'newTab' }), actions);
    const select = document.createElement('select');
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    document.body.append(select, editable);

    select.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, bubbles: true }));
    editable.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, bubbles: true }));

    expect(runs).toBe(0);
  });
});

function configWith(keybindings: Record<string, string>): AppConfig {
  return {
    appearance: { theme: 'default', fontFamily: 'Cascadia Code', fontSize: 13 },
    shell: { program: null, args: [], cwd: null },
    keybindings
  };
}

function pressWindowKey(
  key: string,
  modifiers: Pick<KeyboardEventInit, 'ctrlKey' | 'altKey' | 'shiftKey'>
): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true, ...modifiers }));
}
