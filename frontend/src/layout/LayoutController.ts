import type { ITheme } from '@xterm/xterm';
import type { AppConfig } from '../config/types';
import type { PaneCommand, TerminalPane } from '../terminal/TerminalPane';
import type {
  SplitDirection,
  WorkspaceLayout,
  WorkspaceLayoutNode,
  WorkspaceTab
} from '../workspaces/types';

type FocusDirection = 'up' | 'down' | 'left' | 'right';

type LayoutNode =
  | {
      type: 'leaf';
      id: string;
      pane: TerminalPane;
    }
  | {
      type: 'split';
      direction: SplitDirection;
      ratio: number;
      first: LayoutNode;
      second: LayoutNode;
    };

type LeafNode = Extract<LayoutNode, { type: 'leaf' }>;

interface TabState {
  id: number;
  persistenceId: string;
  title: string;
  root: LayoutNode;
  focusedPane: TerminalPane;
}

export class LayoutController {
  private readonly tabs: TabState[] = [];
  private activeTabId = 0;
  private focusedPane: TerminalPane | null = null;
  private maximizedPane: TerminalPane | null = null;
  private nextTabId = 1;

  constructor(
    private readonly tabBar: HTMLElement,
    private readonly workspace: HTMLElement,
    private readonly statusText: HTMLElement,
    private readonly createPane: (cwd: string | null) => TerminalPane
  ) {}

  async initialize(): Promise<void> {
    await this.newTab();
  }

  async newTab(): Promise<void> {
    const pane = this.createPane(null);
    const tab: TabState = {
      id: this.nextTabId++,
      persistenceId: createPersistentId('tab'),
      title: 'Terminal',
      root: { type: 'leaf', id: createPersistentId('pane'), pane },
      focusedPane: pane
    };
    this.tabs.push(tab);
    this.activeTabId = tab.id;
    this.focusedPane = pane;
    this.render();

    await this.mountVisiblePanes();
    this.renderFocus();
    this.renderStatus();
  }

  async split(direction: SplitDirection): Promise<void> {
    const tab = this.activeTab();
    if (!tab || !this.focusedPane) {
      return;
    }

    const newPane = this.createPane(this.focusedPane.cwd());
    tab.root = replaceLeaf(tab.root, this.focusedPane, {
      type: 'split',
      direction,
      ratio: 0.5,
      first: leafForPane(tab.root, this.focusedPane),
      second: { type: 'leaf', id: createPersistentId('pane'), pane: newPane }
    });
    this.focusedPane = newPane;
    tab.focusedPane = newPane;
    this.render();

    await this.mountVisiblePanes();
    this.renderFocus();
    this.renderStatus();
  }

  applyConfig(config: AppConfig, theme: ITheme): void {
    for (const tab of this.tabs) {
      for (const pane of collectPanes(tab.root)) {
        pane.applyConfig(config, theme);
      }
    }
  }

  snapshot(): WorkspaceLayout {
    const activeTab = this.activeTab();
    return {
      activeTabId: activeTab?.persistenceId ?? '',
      tabs: this.tabs.map((tab) => ({
        id: tab.persistenceId,
        title: tab.title,
        root: snapshotNode(tab.root),
        focusedPaneId: persistenceIdForPane(tab.root, tab.focusedPane) ?? firstLeaf(tab.root).id
      }))
    };
  }

  async restore(snapshot: WorkspaceLayout): Promise<void> {
    assertValidSnapshot(snapshot);
    for (const tab of this.tabs) {
      for (const pane of collectPanes(tab.root)) {
        pane.dispose();
      }
    }

    this.tabs.splice(0);
    this.nextTabId = 1;
    this.maximizedPane = null;
    for (const savedTab of snapshot.tabs) {
      const root = this.restoreNode(savedTab.root);
      const focusedPane = paneForPersistenceId(root, savedTab.focusedPaneId) ?? firstPane(root);
      this.tabs.push({
        id: this.nextTabId++,
        persistenceId: savedTab.id,
        title: savedTab.title,
        root,
        focusedPane
      });
    }

    const activeTab =
      this.tabs.find((tab) => tab.persistenceId === snapshot.activeTabId) ?? this.tabs[0];
    this.activeTabId = activeTab.id;
    this.focusedPane = activeTab.focusedPane;
    this.render();
    await this.mountVisiblePanes();
    this.renderFocus();
    this.renderStatus();
  }

  closeActiveTab(): void {
    this.closeTab(this.activeTabId);
  }

  closeTab(id: number): void {
    const index = this.tabs.findIndex((tab) => tab.id === id);
    if (index === -1) {
      return;
    }

    const [closed] = this.tabs.splice(index, 1);
    for (const pane of collectPanes(closed.root)) {
      pane.dispose();
    }
    if (this.maximizedPane && containsPane(closed.root, this.maximizedPane)) {
      this.maximizedPane = null;
    }

    if (this.tabs.length === 0) {
      this.focusedPane = null;
      void this.newTab();
      return;
    }

    if (this.activeTabId === id) {
      const nextTab = this.tabs[Math.min(index, this.tabs.length - 1)];
      this.activeTabId = nextTab.id;
      this.focusedPane = nextTab.focusedPane;
    }
    this.render();
    void this.mountVisiblePanes();
    this.renderFocus();
    this.renderStatus();
  }

  nextTab(): Promise<void> {
    return this.focusTabByOffset(1);
  }

  previousTab(): Promise<void> {
    return this.focusTabByOffset(-1);
  }

  closeFocusedPane(): void {
    const tab = this.activeTab();
    if (!tab || !this.focusedPane) {
      return;
    }

    if (tab.root.type === 'leaf') {
      this.closeTab(tab.id);
      return;
    }

    const paneToClose = this.focusedPane;
    const collapsed = removeLeaf(tab.root, paneToClose);
    if (this.maximizedPane === paneToClose) {
      this.maximizedPane = null;
    }
    paneToClose.dispose();

    if (!collapsed) {
      return;
    }
    tab.root = collapsed;
    this.focusedPane = firstPane(tab.root);
    tab.focusedPane = this.focusedPane;
    tab.title = this.focusedPane.title();

    this.render();
    this.renderFocus();
    this.renderStatus();
  }

  async activateTab(id: number): Promise<void> {
    const tab = this.tabs.find((item) => item.id === id);
    if (!tab) {
      return;
    }
    this.activeTabId = id;
    this.focusedPane = tab.focusedPane;
    this.maximizedPane = null;
    this.render();
    await this.mountVisiblePanes();
    this.renderFocus();
    this.renderStatus();
  }

  setFocusedPane(pane: TerminalPane): void {
    this.focusedPane?.blur();
    this.focusedPane = pane;
    const tab = this.tabForPane(pane);
    if (tab) {
      tab.focusedPane = pane;
    }
    pane.focus();
    this.renderStatus();
  }

  focused(): TerminalPane | null {
    return this.focusedPane;
  }

  handlePaneCommand(command: PaneCommand, pane: TerminalPane): void {
    this.setFocusedPane(pane);
    switch (command) {
      case 'splitHorizontal':
        void this.split('horizontal');
        break;
      case 'splitVertical':
        void this.split('vertical');
        break;
      case 'toggleMaximizePane':
        this.toggleMaximizeFocusedPane();
        break;
      case 'closePane':
        this.closeFocusedPane();
        break;
    }
  }

  handlePaneMetadataChange(pane: TerminalPane): void {
    const tab = this.tabForPane(pane);
    if (tab && firstPane(tab.root) === pane) {
      tab.title = pane.title();
    }
    this.renderTabs();
    this.renderStatus();
  }

  toggleMaximizeFocusedPane(): void {
    if (!this.focusedPane) {
      return;
    }
    this.maximizedPane = this.maximizedPane === this.focusedPane ? null : this.focusedPane;
    this.render();
    this.renderFocus();
  }

  focusNextPane(): void {
    this.focusByOffset(1);
  }

  focusPreviousPane(): void {
    this.focusByOffset(-1);
  }

  focusPane(direction: FocusDirection): void {
    const tab = this.activeTab();
    if (!tab || !this.focusedPane || this.maximizedPane) {
      return;
    }

    const origin = this.focusedPane.element.getBoundingClientRect();
    const candidates = collectPanes(tab.root)
      .filter((pane) => pane !== this.focusedPane)
      .map((pane) => ({ pane, rank: directionalRank(origin, pane.element.getBoundingClientRect(), direction) }))
      .filter((candidate): candidate is { pane: TerminalPane; rank: number[] } => candidate.rank !== null)
      .sort((a, b) => compareRank(a.rank, b.rank));

    if (candidates[0]) {
      this.setFocusedPane(candidates[0].pane);
    }
  }

  private restoreNode(node: WorkspaceLayoutNode): LayoutNode {
    if (node.type === 'leaf') {
      return {
        type: 'leaf',
        id: node.pane.id,
        pane: this.createPane(node.pane.cwd)
      };
    }
    return {
      type: 'split',
      direction: node.direction,
      ratio: node.ratio,
      first: this.restoreNode(node.first),
      second: this.restoreNode(node.second)
    };
  }

  private async mountVisiblePanes(): Promise<void> {
    const tab = this.activeTab();
    if (!tab) {
      return;
    }
    const hosts = new Map(
      [...this.workspace.querySelectorAll<HTMLElement>('[data-pane-id]')].map((host) => [
        host.dataset.paneId,
        host
      ])
    );
    await Promise.all(
      collectLeaves(tab.root).map(async (leaf) => {
        const host = hosts.get(leaf.id);
        if (host && !leaf.pane.hasMounted()) {
          await leaf.pane.mount(host);
        }
      })
    );
  }

  private activeTab(): TabState | undefined {
    return this.tabs.find((tab) => tab.id === this.activeTabId);
  }

  private render(): void {
    this.renderTabs();

    const tab = this.activeTab();
    if (!tab) {
      this.workspace.replaceChildren();
      return;
    }

    const renderedRoot =
      this.maximizedPane && containsPane(tab.root, this.maximizedPane)
        ? leafForPane(tab.root, this.maximizedPane)
        : tab.root;
    const renderedWorkspace = renderNode(renderedRoot);
    this.workspace.replaceChildren(renderedWorkspace);
  }

  private renderTabs(): void {
    this.tabBar.replaceChildren();
    for (const tab of this.tabs) {
      const item = document.createElement('div');
      item.className = tab.id === this.activeTabId ? 'tab-item is-active' : 'tab-item';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = tab.id === this.activeTabId ? 'tab is-active' : 'tab';
      button.textContent = tab.title;
      button.addEventListener('click', () => void this.activateTab(tab.id));
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'tab-close';
      close.title = `Close ${tab.title}`;
      close.ariaLabel = close.title;
      close.textContent = 'x';
      close.addEventListener('click', () => this.closeTab(tab.id));
      item.append(button, close);
      this.tabBar.append(item);
    }
  }

  private renderFocus(): void {
    for (const tab of this.tabs) {
      for (const pane of collectPanes(tab.root)) {
        pane.blur();
      }
    }
    this.focusedPane?.focus();
  }

  private renderStatus(): void {
    const meta = this.focusedPane?.metadata();
    if (!meta) {
      this.statusText.textContent = 'No active pane';
      return;
    }

    const cwd = meta.cwd ?? 'unknown cwd';
    this.statusText.textContent = `${meta.status} | ${cwd}`;
  }

  private focusByOffset(offset: number): void {
    const tab = this.activeTab();
    if (!tab || !this.focusedPane) {
      return;
    }

    const panes = collectPanes(tab.root);
    const index = panes.indexOf(this.focusedPane);
    if (index === -1) {
      return;
    }

    const nextIndex = (index + offset + panes.length) % panes.length;
    this.setFocusedPane(panes[nextIndex]);
  }

  private async focusTabByOffset(offset: number): Promise<void> {
    const index = this.tabs.findIndex((tab) => tab.id === this.activeTabId);
    if (index === -1 || this.tabs.length < 2) {
      return;
    }
    const nextIndex = (index + offset + this.tabs.length) % this.tabs.length;
    await this.activateTab(this.tabs[nextIndex].id);
  }

  private tabForPane(pane: TerminalPane): TabState | undefined {
    return this.tabs.find((tab) => containsPane(tab.root, pane));
  }
}

function renderNode(node: LayoutNode): HTMLElement {
  if (node.type === 'leaf') {
    const host = document.createElement('section');
    host.className = 'pane-host';
    host.dataset.paneHost = 'true';
    host.dataset.paneId = node.id;
    if (node.pane.hasMounted()) {
      node.pane.remount(host);
    }
    return host;
  }

  const split = document.createElement('div');
  split.className = `split split-${node.direction}`;
  split.style.setProperty('--split-ratio', String(node.ratio));
  split.append(renderNode(node.first), renderNode(node.second));
  return split;
}

function replaceLeaf(node: LayoutNode, pane: TerminalPane, replacement: LayoutNode): LayoutNode {
  if (node.type === 'leaf') {
    return node.pane === pane ? replacement : node;
  }

  return {
    ...node,
    first: replaceLeaf(node.first, pane, replacement),
    second: replaceLeaf(node.second, pane, replacement)
  };
}

function removeLeaf(node: LayoutNode, pane: TerminalPane): LayoutNode | null {
  if (node.type === 'leaf') {
    return node.pane === pane ? null : node;
  }

  const first = removeLeaf(node.first, pane);
  const second = removeLeaf(node.second, pane);

  if (!first) {
    return second;
  }
  if (!second) {
    return first;
  }

  return {
    ...node,
    first,
    second
  };
}

function leafForPane(node: LayoutNode, pane: TerminalPane): LeafNode {
  if (node.type === 'leaf') {
    if (node.pane === pane) {
      return node;
    }
    throw new Error('focused pane is missing from the active layout');
  }
  if (containsPane(node.first, pane)) {
    return leafForPane(node.first, pane);
  }
  return leafForPane(node.second, pane);
}

function firstLeaf(node: LayoutNode): LeafNode {
  return node.type === 'leaf' ? node : firstLeaf(node.first);
}

function firstPane(node: LayoutNode): TerminalPane {
  return firstLeaf(node).pane;
}

function containsPane(node: LayoutNode, pane: TerminalPane): boolean {
  return node.type === 'leaf' ? node.pane === pane : containsPane(node.first, pane) || containsPane(node.second, pane);
}

function collectPanes(node: LayoutNode): TerminalPane[] {
  return node.type === 'leaf' ? [node.pane] : [...collectPanes(node.first), ...collectPanes(node.second)];
}

function collectLeaves(node: LayoutNode): LeafNode[] {
  return node.type === 'leaf' ? [node] : [...collectLeaves(node.first), ...collectLeaves(node.second)];
}

function snapshotNode(node: LayoutNode): WorkspaceLayoutNode {
  if (node.type === 'leaf') {
    return {
      type: 'leaf',
      pane: {
        id: node.id,
        cwd: node.pane.cwd(),
        shellProfile: null
      }
    };
  }
  return {
    type: 'split',
    direction: node.direction,
    ratio: node.ratio,
    first: snapshotNode(node.first),
    second: snapshotNode(node.second)
  };
}

function persistenceIdForPane(node: LayoutNode, pane: TerminalPane): string | null {
  const leaf = collectLeaves(node).find((candidate) => candidate.pane === pane);
  return leaf?.id ?? null;
}

function paneForPersistenceId(node: LayoutNode, id: string): TerminalPane | null {
  const leaf = collectLeaves(node).find((candidate) => candidate.id === id);
  return leaf?.pane ?? null;
}

function assertValidSnapshot(snapshot: WorkspaceLayout): void {
  if (snapshot.tabs.length === 0) {
    throw new Error('workspace layout must contain at least one tab');
  }
  const tabIds = new Set<string>();
  for (const tab of snapshot.tabs) {
    if (!tab.id || tabIds.has(tab.id)) {
      throw new Error(`workspace layout contains an invalid tab id: ${tab.id}`);
    }
    tabIds.add(tab.id);
    assertValidTab(tab);
  }
  if (!tabIds.has(snapshot.activeTabId)) {
    throw new Error(`active tab ${snapshot.activeTabId} does not exist`);
  }
}

function assertValidTab(tab: WorkspaceTab): void {
  const paneIds = new Set<string>();
  visitSnapshotNode(tab.root, (id) => {
    if (!id || paneIds.has(id)) {
      throw new Error(`tab ${tab.id} contains an invalid pane id: ${id}`);
    }
    paneIds.add(id);
  });
  if (!paneIds.has(tab.focusedPaneId)) {
    throw new Error(`focused pane ${tab.focusedPaneId} does not exist in tab ${tab.id}`);
  }
}

function visitSnapshotNode(node: WorkspaceLayoutNode, visitPane: (id: string) => void): void {
  if (node.type === 'leaf') {
    visitPane(node.pane.id);
    return;
  }
  if (!Number.isFinite(node.ratio) || node.ratio <= 0 || node.ratio >= 1) {
    throw new Error('split ratio must be between zero and one');
  }
  visitSnapshotNode(node.first, visitPane);
  visitSnapshotNode(node.second, visitPane);
}

let fallbackPersistentId = 0;

function createPersistentId(prefix: 'tab' | 'pane'): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) {
    return `${prefix}-${uuid}`;
  }
  fallbackPersistentId += 1;
  return `${prefix}-${Date.now().toString(36)}-${fallbackPersistentId}`;
}

function directionalRank(origin: DOMRect, candidate: DOMRect, direction: FocusDirection): number[] | null {
  const originCenter = center(origin);
  const candidateCenter = center(candidate);
  const deltaX = candidateCenter.x - originCenter.x;
  const deltaY = candidateCenter.y - originCenter.y;

  if (
    (direction === 'left' && deltaX >= 0) ||
    (direction === 'right' && deltaX <= 0) ||
    (direction === 'up' && deltaY >= 0) ||
    (direction === 'down' && deltaY <= 0)
  ) {
    return null;
  }

  const horizontal = direction === 'left' || direction === 'right';
  const perpendicularGap = horizontal
    ? intervalGap(origin.top, origin.bottom, candidate.top, candidate.bottom)
    : intervalGap(origin.left, origin.right, candidate.left, candidate.right);
  const primaryDistance = horizontal ? Math.abs(deltaX) : Math.abs(deltaY);
  const perpendicularDistance = horizontal ? Math.abs(deltaY) : Math.abs(deltaX);

  return [perpendicularGap === 0 ? 0 : 1, primaryDistance + perpendicularGap, perpendicularDistance];
}

function center(rect: DOMRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function intervalGap(firstStart: number, firstEnd: number, secondStart: number, secondEnd: number): number {
  return Math.max(0, firstStart - secondEnd, secondStart - firstEnd);
}

function compareRank(first: number[], second: number[]): number {
  for (let index = 0; index < Math.max(first.length, second.length); index += 1) {
    const difference = (first[index] ?? 0) - (second[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}
