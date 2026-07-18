import type { AppConfig } from '../config/types';
import type { ActionRegistry } from '../actions/actions';

export interface KeybindingBinding {
  update(config: AppConfig): void;
  dispose(): void;
}

export function bindKeybindings(config: AppConfig, actions: ActionRegistry): KeybindingBinding {
  let keybindings = config.keybindings;
  const handleKeydown = (event: KeyboardEvent) => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.contentEditable === 'true' ||
          target.contentEditable === 'plaintext-only' ||
          target.closest('[contenteditable="true"], [contenteditable="plaintext-only"]') !== null))
    ) {
      return;
    }

    const combo = keyCombo(event);
    const action = keybindings[combo];
    if (!action) {
      return;
    }

    event.preventDefault();
    void actions.run(action);
  };
  window.addEventListener('keydown', handleKeydown);

  return {
    update(nextConfig) {
      keybindings = nextConfig.keybindings;
    },
    dispose() {
      window.removeEventListener('keydown', handleKeydown);
    }
  };
}

function keyCombo(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey) {
    parts.push('Ctrl');
  }
  if (event.altKey) {
    parts.push('Alt');
  }
  if (event.shiftKey) {
    parts.push('Shift');
  }
  parts.push(normalizeKey(event.key));
  return parts.join('+');
}

function normalizeKey(key: string): string {
  if (key === ' ') {
    return 'Space';
  }
  if (key.length === 1) {
    return key.toUpperCase();
  }
  return key;
}
