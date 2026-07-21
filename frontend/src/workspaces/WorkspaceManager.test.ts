import { describe, expect, it, vi } from 'vitest';

import type { WorkspaceLayout, WorkspaceStore } from './types';
import {
  WorkspaceManager,
  type WorkspaceLayoutHost,
  type WorkspacePersistence
} from './WorkspaceManager';

class FakeLayout implements WorkspaceLayoutHost {
  current = layout('current');
  restored: WorkspaceLayout[] = [];
  resetCwds: Array<string | null> = [];
  clearCount = 0;

  snapshot(): WorkspaceLayout {
    return structuredClone(this.current);
  }

  async restore(snapshot: WorkspaceLayout): Promise<void> {
    this.current = structuredClone(snapshot);
    this.restored.push(structuredClone(snapshot));
  }

  async reset(cwd: string | null = null): Promise<void> {
    this.resetCwds.push(cwd);
    this.current = layout('fresh', cwd);
  }

  clear(): void {
    this.clearCount += 1;
  }
}

function harness(initial: WorkspaceStore = store()): {
  manager: WorkspaceManager;
  layoutHost: FakeLayout;
  saves: WorkspaceStore[];
  persistence: WorkspacePersistence;
} {
  const layoutHost = new FakeLayout();
  const saves: WorkspaceStore[] = [];
  const persistence: WorkspacePersistence = {
    load: vi.fn(async () => structuredClone(initial)),
    save: vi.fn(async (next) => {
      saves.push(structuredClone(next));
      return structuredClone(next);
    })
  };
  const manager = new WorkspaceManager(layoutHost, persistence, undefined, () => 42, () => 'workspace-new');
  return { manager, layoutHost, saves, persistence };
}

describe('WorkspaceManager', () => {
  it('restores the active workspace on startup', async () => {
    const { manager, layoutHost } = harness();

    await manager.initialize();

    expect(layoutHost.restored).toEqual([layout('alpha')]);
    expect(manager.activeWorkspace()?.name).toBe('Alpha');
    expect(manager.getSnapshot().persistence).toBe('saved');
  });

  it('keeps an empty store terminal-free until the user creates a workspace', async () => {
    const { manager, layoutHost, saves } = harness({
      schemaVersion: 1,
      activeWorkspaceId: null,
      workspaces: []
    });

    await manager.initialize();
    const created = await manager.create({ name: '  Terminus  ', projectPath: ' D:/Terminus ' });

    expect(layoutHost.clearCount).toBe(1);
    expect(layoutHost.resetCwds).toEqual(['D:/Terminus']);
    expect(created.name).toBe('Terminus');
    expect(created.projectPath).toBe('D:/Terminus');
    expect(saves.at(-1)?.activeWorkspaceId).toBe('workspace-new');
  });

  it('flushes a changed layout before switching workspaces', async () => {
    const initial = store(true);
    const { manager, layoutHost, saves } = harness(initial);
    await manager.initialize();
    layoutHost.current = layout('changed');

    manager.handleLayoutChanged();
    await manager.open('workspace-beta');

    expect(saves[0].workspaces[0].layout).toEqual(layout('changed'));
    expect(saves.at(-1)?.activeWorkspaceId).toBe('workspace-beta');
    expect(layoutHost.restored.at(-1)).toEqual(layout('beta'));
  });

  it('updates workspace metadata and rejects duplicate names', async () => {
    const { manager } = harness(store(true));
    await manager.initialize();

    await manager.update('workspace-alpha', { name: 'Project Alpha', projectPath: null });

    expect(manager.activeWorkspace()).toMatchObject({ name: 'Project Alpha', projectPath: null });
    await expect(
      manager.update('workspace-alpha', { name: 'beta', projectPath: null })
    ).rejects.toThrow('already exists');
  });

  it('restores the next workspace when the active workspace is removed', async () => {
    const { manager, layoutHost } = harness(store(true));
    await manager.initialize();

    await manager.remove('workspace-alpha');

    expect(manager.getSnapshot().store.activeWorkspaceId).toBe('workspace-beta');
    expect(layoutHost.restored.at(-1)).toEqual(layout('beta'));
  });

  it('exposes persistence failures and can retry the optimistic state', async () => {
    const { manager, persistence } = harness();
    await manager.initialize();
    vi.mocked(persistence.save).mockRejectedValueOnce(new Error('disk full'));

    await expect(manager.update('workspace-alpha', { name: 'Renamed', projectPath: null })).rejects.toThrow(
      'disk full'
    );

    expect(manager.getSnapshot()).toMatchObject({ persistence: 'error', error: 'disk full' });
    await manager.retrySave();
    expect(manager.getSnapshot().persistence).toBe('saved');
    expect(manager.activeWorkspace()?.name).toBe('Renamed');
  });
});

function store(withSecond = false): WorkspaceStore {
  const workspaces = [workspace('workspace-alpha', 'Alpha', 'alpha')];
  if (withSecond) {
    workspaces.push(workspace('workspace-beta', 'Beta', 'beta'));
  }
  return {
    schemaVersion: 1,
    activeWorkspaceId: 'workspace-alpha',
    workspaces
  };
}

function workspace(id: string, name: string, seed: string) {
  return {
    id,
    name,
    projectPath: null,
    layout: layout(seed),
    updatedAt: 1
  };
}

function layout(seed: string, cwd: string | null = null): WorkspaceLayout {
  return {
    activeTabId: `tab-${seed}`,
    tabs: [
      {
        id: `tab-${seed}`,
        title: seed,
        focusedPaneId: `pane-${seed}`,
        root: {
          type: 'leaf',
          pane: { id: `pane-${seed}`, cwd, shellProfile: null }
        }
      }
    ]
  };
}
