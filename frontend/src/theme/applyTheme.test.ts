import { beforeEach, describe, expect, it } from 'vitest';

import { applyTheme, resolveTheme } from './applyTheme';
import { defaultTheme } from './defaultTheme';

describe('theme application', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('maps the JSON theme into UI variables and xterm colors', () => {
    const xtermTheme = applyTheme(resolveTheme('default'));

    expect(document.documentElement.style.getPropertyValue('--color-bg')).toBe('#1E1E1E');
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#007ACC');
    expect(document.documentElement.style.getPropertyValue('--color-terminal-bg')).toBe('#0C0C0C');
    expect(document.documentElement.style.getPropertyValue('--color-statusbar')).toBe('#007ACC');
    expect(document.documentElement.style.getPropertyValue('--font-ui')).toBe('Segoe UI');
    expect(xtermTheme.background).toBe('#0C0C0C');
    expect(xtermTheme.brightBlue).toBe('#3B78FF');
  });

  it('falls back to the built-in theme for an unknown name', () => {
    expect(resolveTheme('missing-theme')).toBe(defaultTheme);
  });
});
