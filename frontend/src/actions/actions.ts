import type { LayoutController } from '../layout/LayoutController';
import type { ErrorReporter } from '../errors/ErrorCenter';

export interface ActionDefinition {
  id: string;
  title: string;
  run: () => void | Promise<void>;
  isEnabled?: () => boolean;
}

export class ActionRegistry {
  private readonly actions = new Map<string, ActionDefinition>();

  constructor(private readonly reportError: ErrorReporter = () => {}) {}

  register(action: ActionDefinition): void {
    this.actions.set(action.id, action);
  }

  get(id: string): ActionDefinition | undefined {
    return this.actions.get(id);
  }

  list(): ActionDefinition[] {
    return [...this.actions.values()].sort((a, b) => a.title.localeCompare(b.title));
  }

  async run(id: string): Promise<void> {
    const action = this.actions.get(id);
    if (!action) {
      return;
    }
    if (action.isEnabled && !action.isEnabled()) {
      return;
    }
    try {
      await action.run();
    } catch (error) {
      this.reportError(`Failed to run ${action.title}`, error);
    }
  }
}

export function createActionRegistry(
  layout: LayoutController,
  openPalette: () => void,
  openSettings: () => void,
  reportError: ErrorReporter = () => {},
  hasActiveWorkspace: () => boolean = () => true
): ActionRegistry {
  const registry = new ActionRegistry(reportError);
  const register = (id: string, title: string, run: () => void | Promise<void>) =>
    registry.register({ id, title, run });

  register('newTab', 'New tab', () => layout.newTab());
  register('closeTab', 'Close active tab', () => layout.closeActiveTab());
  register('nextTab', 'Activate next tab', () => layout.nextTab());
  register('previousTab', 'Activate previous tab', () => layout.previousTab());
  register('closePane', 'Close focused pane', () => layout.closeFocusedPane());
  register('splitHorizontal', 'Split pane down', () => layout.split('horizontal'));
  register('splitVertical', 'Split pane right', () => layout.split('vertical'));
  register('toggleMaximizePane', 'Maximize or restore pane', () => layout.toggleMaximizeFocusedPane());
  register('focusNextPane', 'Focus next pane', () => layout.focusNextPane());
  register('focusPreviousPane', 'Focus previous pane', () => layout.focusPreviousPane());
  register('focusPaneUp', 'Focus pane up', () => layout.focusPane('up'));
  register('focusPaneDown', 'Focus pane down', () => layout.focusPane('down'));
  register('focusPaneLeft', 'Focus pane left', () => layout.focusPane('left'));
  register('focusPaneRight', 'Focus pane right', () => layout.focusPane('right'));
  register('copy', 'Copy selection', () => layout.focused()?.copy());
  register('paste', 'Paste', () => layout.focused()?.paste());
  register('find', 'Find in pane', () => layout.focused()?.find());
  register('commandPalette', 'Open command palette', openPalette);
  register('settings', 'Open settings', openSettings);

  for (const id of [
    'newTab',
    'closeTab',
    'nextTab',
    'previousTab',
    'closePane',
    'splitHorizontal',
    'splitVertical',
    'toggleMaximizePane',
    'focusNextPane',
    'focusPreviousPane',
    'focusPaneUp',
    'focusPaneDown',
    'focusPaneLeft',
    'focusPaneRight',
    'copy',
    'paste',
    'find'
  ]) {
    const action = registry.get(id);
    if (action) {
      action.isEnabled = hasActiveWorkspace;
    }
  }

  return registry;
}
