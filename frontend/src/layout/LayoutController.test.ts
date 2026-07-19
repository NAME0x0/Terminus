import { beforeEach, describe, expect, it } from 'vitest';

import type { ITheme } from '@xterm/xterm';
import type { AppConfig } from '../config/types';
import type { PaneMetadata, TerminalPane } from '../terminal/TerminalPane';
import type { WorkspaceLayout } from '../workspaces/types';
import { LayoutController } from './LayoutController';

class FakeTerminalPane {
  readonly element = document.createElement('div');
  readonly mountHosts: HTMLElement[] = [];
  readonly remountHosts: HTMLElement[] = [];
  disposed = false;
  focused = false;
  appliedConfigs: AppConfig[] = [];

  constructor(
    readonly name: string,
    private readonly workingDirectory: string | null
  ) {
    this.element.dataset.testPane = name;
  }

  async mount(host: HTMLElement): Promise<void> {
    this.mountHosts.push(host);
    host.replaceChildren(this.element);
  }

  remount(host: HTMLElement): void {
    this.remountHosts.push(host);
    host.replaceChildren(this.element);
  }

  hasMounted(): boolean {
    return this.mountHosts.length > 0 && !this.disposed;
  }

  applyConfig(config: AppConfig, _theme: ITheme): void {
    this.appliedConfigs.push(config);
  }

  focus(): void {
    this.focused = true;
  }

  blur(): void {
    this.focused = false;
  }

  dispose(): void {
    this.disposed = true;
    this.element.remove();
  }

  cwd(): string | null {
    return this.workingDirectory;
  }

  title(): string {
    return this.name;
  }

  metadata(): PaneMetadata {
    return {
      id: null,
      cwd: this.workingDirectory,
      status: 'running',
      title: this.name
    };
  }

  copy(): void {}

  async paste(): Promise<void> {}

  find(): void {}
}

describe('LayoutController pane rendering', () => {
  let tabBar: HTMLElement;
  let workspace: HTMLElement;
  let statusText: HTMLElement;
  let controller: LayoutController;
  let panes: FakeTerminalPane[];

  beforeEach(() => {
    document.body.replaceChildren();
    tabBar = document.createElement('nav');
    workspace = document.createElement('main');
    statusText = document.createElement('div');
    document.body.append(tabBar, workspace, statusText);

    panes = [];
    controller = new LayoutController(tabBar, workspace, statusText, (cwd) => {
      const pane = new FakeTerminalPane(`pane-${panes.length + 1}`, cwd ?? 'C:\\project');
      panes.push(pane);
      return pane as unknown as TerminalPane;
    });
  });

  it('keeps the mounted pane visible when adding a split', async () => {
    await controller.initialize();
    await controller.split('vertical');

    expect(visiblePaneNames(workspace)).toEqual(['pane-1', 'pane-2']);
    expect(panes[0].remountHosts).toHaveLength(1);
    expect(panes[1].mountHosts).toHaveLength(1);
    expect(panes[1].cwd()).toBe('C:\\project');
  });

  it('reattaches mounted panes when switching tabs', async () => {
    await controller.initialize();
    await controller.newTab();

    expect(visiblePaneNames(workspace)).toEqual(['pane-2']);

    controller.activateTab(1);

    expect(visiblePaneNames(workspace)).toEqual(['pane-1']);
    expect(panes[0].remountHosts).toHaveLength(1);
  });

  it('restores every pane after maximizing and restoring the focused pane', async () => {
    await controller.initialize();
    await controller.split('horizontal');

    controller.toggleMaximizeFocusedPane();
    expect(visiblePaneNames(workspace)).toEqual(['pane-2']);

    controller.toggleMaximizeFocusedPane();
    expect(visiblePaneNames(workspace)).toEqual(['pane-1', 'pane-2']);
  });

  it('collapses a split after closing its focused pane', async () => {
    await controller.initialize();
    await controller.split('vertical');

    controller.closeFocusedPane();

    expect(panes[1].disposed).toBe(true);
    expect(visiblePaneNames(workspace)).toEqual(['pane-1']);
    expect(panes[0].focused).toBe(true);
  });

  it('cycles focus without replacing pane sessions', async () => {
    await controller.initialize();
    await controller.split('vertical');

    controller.focusPreviousPane();
    expect(panes[0].focused).toBe(true);
    expect(panes[1].focused).toBe(false);

    controller.focusNextPane();
    expect(panes[0].focused).toBe(false);
    expect(panes[1].focused).toBe(true);
  });

  it('closes the active tab and activates its nearest neighbor', async () => {
    await controller.initialize();
    await controller.newTab();
    controller.activateTab(1);

    controller.closeActiveTab();

    expect(panes[0].disposed).toBe(true);
    expect(panes[1].disposed).toBe(false);
    expect(visiblePaneNames(workspace)).toEqual(['pane-2']);
    expect(tabBar.querySelectorAll('.tab-item')).toHaveLength(1);
  });

  it('replaces the final closed tab with a fresh terminal', async () => {
    await controller.initialize();

    controller.closeActiveTab();
    await Promise.resolve();

    expect(panes[0].disposed).toBe(true);
    expect(panes).toHaveLength(2);
    expect(visiblePaneNames(workspace)).toEqual(['pane-2']);
    expect(tabBar.querySelectorAll('.tab-item')).toHaveLength(1);
  });

  it('cycles tabs in both directions', async () => {
    await controller.initialize();
    await controller.newTab();

    controller.previousTab();
    expect(visiblePaneNames(workspace)).toEqual(['pane-1']);

    controller.nextTab();
    expect(visiblePaneNames(workspace)).toEqual(['pane-2']);
  });

  it('reapplies config to panes in active and inactive tabs', async () => {
    await controller.initialize();
    await controller.newTab();
    const config = testConfig();

    controller.applyConfig(config, {});

    expect(panes[0].appliedConfigs).toEqual([config]);
    expect(panes[1].appliedConfigs).toEqual([config]);
  });

  it('focuses the geometrically adjacent pane in every direction', async () => {
    await controller.initialize();
    await controller.split('vertical');
    controller.setFocusedPane(panes[0] as unknown as TerminalPane);
    await controller.split('horizontal');
    controller.setFocusedPane(panes[1] as unknown as TerminalPane);
    await controller.split('horizontal');
    setRect(panes[0], 0, 0);
    setRect(panes[1], 100, 0);
    setRect(panes[2], 0, 100);
    setRect(panes[3], 100, 100);

    controller.setFocusedPane(panes[0] as unknown as TerminalPane);
    controller.focusPane('right');
    expect(panes[1].focused).toBe(true);

    controller.focusPane('down');
    expect(panes[3].focused).toBe(true);

    controller.focusPane('left');
    expect(panes[2].focused).toBe(true);

    controller.focusPane('up');
    expect(panes[0].focused).toBe(true);
  });

  it('keeps focus when no pane exists in the requested direction', async () => {
    await controller.initialize();
    await controller.split('vertical');
    setRect(panes[0], 0, 0);
    setRect(panes[1], 100, 0);

    controller.setFocusedPane(panes[0] as unknown as TerminalPane);
    controller.focusPane('left');

    expect(panes[0].focused).toBe(true);
    expect(panes[1].focused).toBe(false);
  });

  it('snapshots tabs, split structure, cwd, and focused pane identity', async () => {
    await controller.initialize();
    await controller.split('vertical');
    controller.focusPreviousPane();
    await controller.newTab();
    await controller.activateTab(1);

    const snapshot = controller.snapshot();
    const firstTab = snapshot.tabs[0];

    expect(snapshot.tabs).toHaveLength(2);
    expect(snapshot.activeTabId).toBe(firstTab.id);
    expect(firstTab.root.type).toBe('split');
    if (firstTab.root.type !== 'split') {
      throw new Error('expected a split layout');
    }
    expect(firstTab.root.direction).toBe('vertical');
    expect(firstTab.root.first.type).toBe('leaf');
    expect(firstTab.root.second.type).toBe('leaf');
    if (firstTab.root.first.type === 'leaf' && firstTab.root.second.type === 'leaf') {
      expect(firstTab.root.first.pane.cwd).toBe('C:\\project');
      expect(firstTab.root.second.pane.cwd).toBe('C:\\project');
      expect(firstTab.focusedPaneId).toBe(firstTab.root.first.pane.id);
    }
  });

  it('restores saved tabs lazily with fresh panes and per-tab focus', async () => {
    await controller.initialize();
    const originalPane = panes[0];
    const snapshot = savedLayout();

    await controller.restore(snapshot);

    expect(originalPane.disposed).toBe(true);
    expect(controller.snapshot()).toEqual(snapshot);
    expect(visiblePaneNames(workspace)).toEqual(['pane-4']);

    await controller.activateTab(1);
    expect(visiblePaneNames(workspace)).toEqual(['pane-2', 'pane-3']);
    expect(panes[2].focused).toBe(true);
  });

  it('rejects an invalid snapshot before disposing the current session', async () => {
    await controller.initialize();
    const invalid = savedLayout();
    invalid.activeTabId = 'missing-tab';

    await expect(controller.restore(invalid)).rejects.toThrow('active tab missing-tab does not exist');

    expect(panes[0].disposed).toBe(false);
    expect(visiblePaneNames(workspace)).toEqual(['pane-1']);
  });
});

function visiblePaneNames(workspace: HTMLElement): string[] {
  return [...workspace.querySelectorAll<HTMLElement>('[data-test-pane]')].map(
    (element) => element.dataset.testPane ?? ''
  );
}

function setRect(pane: FakeTerminalPane, left: number, top: number): void {
  pane.element.getBoundingClientRect = () =>
    ({
      x: left,
      y: top,
      left,
      top,
      right: left + 100,
      bottom: top + 100,
      width: 100,
      height: 100,
      toJSON: () => ({})
    }) as DOMRect;
}

function testConfig(): AppConfig {
  return {
    appearance: {
      theme: 'default',
      fontFamily: 'Cascadia Code',
      fontSize: 16
    },
    shell: {
      program: null,
      args: [],
      cwd: null
    },
    keybindings: {}
  };
}

function savedLayout(): WorkspaceLayout {
  return {
    activeTabId: 'tab-b',
    tabs: [
      {
        id: 'tab-a',
        title: 'Project',
        focusedPaneId: 'pane-b',
        root: {
          type: 'split',
          direction: 'vertical',
          ratio: 0.5,
          first: {
            type: 'leaf',
            pane: { id: 'pane-a', cwd: 'C:\\project', shellProfile: null }
          },
          second: {
            type: 'leaf',
            pane: { id: 'pane-b', cwd: 'C:\\project\\frontend', shellProfile: null }
          }
        }
      },
      {
        id: 'tab-b',
        title: 'Server',
        focusedPaneId: 'pane-c',
        root: {
          type: 'leaf',
          pane: { id: 'pane-c', cwd: 'C:\\project', shellProfile: null }
        }
      }
    ]
  };
}
