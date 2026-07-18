import { describe, expect, it } from 'vitest';

import { actionHint, formatShortcut, shortcutForAction } from './shortcutHints';

describe('shortcut hints', () => {
  const keybindings = {
    'Ctrl+Shift+T': 'newTab',
    'Alt+Shift+\\': 'splitVertical'
  };

  it('finds and formats the shortcut for an action', () => {
    expect(shortcutForAction(keybindings, 'splitVertical')).toBe('Alt+Shift+\\');
    expect(formatShortcut('Alt+Shift+\\')).toBe('Alt + Shift + \\');
  });

  it('builds a useful hint and tolerates unbound actions', () => {
    expect(actionHint('New tab', keybindings, 'newTab')).toBe('New tab · Ctrl + Shift + T');
    expect(actionHint('Settings', keybindings, 'settings')).toBe('Settings');
  });
});
