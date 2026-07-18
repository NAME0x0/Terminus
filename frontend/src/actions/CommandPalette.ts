import type { ActionRegistry } from './actions';
import { formatShortcut } from '../keys/shortcutHints';

export class CommandPalette {
  private readonly overlay = document.createElement('div');
  private readonly input = document.createElement('input');
  private readonly list = document.createElement('div');
  private visibleActionIds: string[] = [];
  private selectedIndex = 0;

  constructor(
    private readonly registry: ActionRegistry,
    private readonly getShortcut: (actionId: string) => string | null = () => null
  ) {
    this.overlay.className = 'command-palette';
    this.overlay.hidden = true;
    this.overlay.innerHTML = '<div class="command-palette-panel"></div>';

    const panel = this.overlay.querySelector<HTMLElement>('.command-palette-panel');
    if (!panel) {
      throw new Error('failed to create command palette panel');
    }

    this.input.className = 'command-palette-input';
    this.input.type = 'search';
    this.input.placeholder = 'Search commands';
    this.input.autocomplete = 'off';
    this.input.ariaLabel = 'Search commands';

    this.list.className = 'command-palette-list';
    this.list.role = 'listbox';
    panel.append(this.input, this.list);
    document.body.append(this.overlay);

    this.input.addEventListener('input', () => this.renderList());
    this.input.addEventListener('keydown', (event) => this.onInputKeyDown(event));
    this.overlay.addEventListener('pointerdown', (event) => {
      if (event.target === this.overlay) {
        this.close();
      }
    });
  }

  open(): void {
    this.overlay.hidden = false;
    this.input.value = '';
    this.selectedIndex = 0;
    this.renderList();
    requestAnimationFrame(() => this.input.focus());
  }

  close(): void {
    this.overlay.hidden = true;
  }

  private renderList(): void {
    const query = this.input.value.trim().toLowerCase();
    const actions = this.registry
      .list()
      .filter((action) => action.title.toLowerCase().includes(query) || action.id.toLowerCase().includes(query))
      .slice(0, 10);

    this.visibleActionIds = actions.map((action) => action.id);
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(actions.length - 1, 0));
    this.list.replaceChildren();
    for (const [index, action] of actions.entries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = index === this.selectedIndex ? 'command-palette-item is-selected' : 'command-palette-item';
      button.dataset.actionId = action.id;
      button.role = 'option';
      button.ariaSelected = String(index === this.selectedIndex);
      const title = document.createElement('span');
      title.className = 'command-palette-title';
      title.textContent = action.title;
      button.append(title);
      const shortcut = this.getShortcut(action.id);
      if (shortcut) {
        const hint = document.createElement('kbd');
        hint.className = 'shortcut-hint';
        hint.textContent = formatShortcut(shortcut);
        button.append(hint);
      }
      button.addEventListener('click', () => {
        void this.runAction(action.id);
      });
      button.addEventListener('pointermove', () => {
        this.selectedIndex = index;
        this.renderSelection();
      });
      this.list.append(button);
    }
  }

  private onInputKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close();
      event.preventDefault();
      return;
    }

    if (event.key === 'ArrowDown') {
      this.moveSelection(1);
      event.preventDefault();
      return;
    }

    if (event.key === 'ArrowUp') {
      this.moveSelection(-1);
      event.preventDefault();
      return;
    }

    if (event.key === 'Enter') {
      const actionId = this.visibleActionIds[this.selectedIndex];
      if (actionId) {
        void this.runAction(actionId);
      }
      event.preventDefault();
    }
  }

  private moveSelection(offset: number): void {
    if (this.visibleActionIds.length === 0) {
      return;
    }

    this.selectedIndex = (this.selectedIndex + offset + this.visibleActionIds.length) % this.visibleActionIds.length;
    this.renderSelection();
  }

  private renderSelection(): void {
    const items = [...this.list.querySelectorAll<HTMLButtonElement>('.command-palette-item')];
    for (const [index, item] of items.entries()) {
      item.classList.toggle('is-selected', index === this.selectedIndex);
      item.ariaSelected = String(index === this.selectedIndex);
      if (index === this.selectedIndex) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  private async runAction(actionId: string): Promise<void> {
    this.close();
    await this.registry.run(actionId);
  }
}
