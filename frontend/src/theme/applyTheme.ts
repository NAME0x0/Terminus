import type { ITheme } from '@xterm/xterm';
import { defaultTheme, type TerminusTheme } from './defaultTheme';

export function resolveTheme(name: string): TerminusTheme {
  const normalized = name.trim().toLowerCase();
  if (normalized === 'default' || normalized === defaultTheme.name.toLowerCase()) {
    return defaultTheme;
  }
  return defaultTheme;
}

export function applyTheme(theme: TerminusTheme = defaultTheme): ITheme {
  const root = document.documentElement;
  root.style.setProperty('--color-bg', theme.colors.background);
  root.style.setProperty('--color-fg', theme.colors.foreground);
  root.style.setProperty('--terminus-accent', theme.colors.accent);
  root.style.setProperty('--color-selection', theme.colors.selection);
  root.style.setProperty('--color-terminal-bg', theme.colors.terminal.background);
  root.style.setProperty('--color-panel', theme.colors.ui.toolbar);
  root.style.setProperty('--color-panel-text', theme.colors.ui.toolbarText);
  root.style.setProperty('--color-statusbar', theme.colors.ui.statusbar);
  root.style.setProperty('--color-statusbar-text', theme.colors.ui.statusbarText);
  root.style.setProperty('--font-ui', theme.fonts.ui.family);

  return {
    background: theme.colors.terminal.background,
    foreground: theme.colors.terminal.foreground,
    cursor: theme.colors.terminal.cursor,
    selectionBackground: theme.colors.terminal.selection,
    black: theme.colors.terminal.black,
    red: theme.colors.terminal.red,
    green: theme.colors.terminal.green,
    yellow: theme.colors.terminal.yellow,
    blue: theme.colors.terminal.blue,
    magenta: theme.colors.terminal.magenta,
    cyan: theme.colors.terminal.cyan,
    white: theme.colors.terminal.white,
    brightBlack: theme.colors.terminal.brightBlack,
    brightRed: theme.colors.terminal.brightRed,
    brightGreen: theme.colors.terminal.brightGreen,
    brightYellow: theme.colors.terminal.brightYellow,
    brightBlue: theme.colors.terminal.brightBlue,
    brightMagenta: theme.colors.terminal.brightMagenta,
    brightCyan: theme.colors.terminal.brightCyan,
    brightWhite: theme.colors.terminal.brightWhite
  };
}
