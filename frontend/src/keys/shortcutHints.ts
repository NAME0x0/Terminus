export function shortcutForAction(
  keybindings: Record<string, string>,
  actionId: string
): string | null {
  return Object.entries(keybindings).find(([, boundAction]) => boundAction === actionId)?.[0] ?? null;
}

export function formatShortcut(shortcut: string): string {
  return shortcut.replaceAll('+', ' + ');
}

export function actionHint(
  title: string,
  keybindings: Record<string, string>,
  actionId: string
): string {
  const shortcut = shortcutForAction(keybindings, actionId);
  return shortcut ? `${title} · ${formatShortcut(shortcut)}` : title;
}
