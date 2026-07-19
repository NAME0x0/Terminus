import type { WorkspaceLayout } from './types';
import { emptyWorkspaceStore, type SavedWorkspace, type WorkspaceStore } from './types';

export type PersistenceStatus = 'loading' | 'saved' | 'pending' | 'saving' | 'error';

export interface WorkspaceManagerSnapshot {
  store: WorkspaceStore;
  persistence: PersistenceStatus;
  error: string | null;
}

export interface WorkspaceLayoutHost {
  snapshot(): WorkspaceLayout;
  restore(snapshot: WorkspaceLayout): Promise<void>;
  reset(cwd?: string | null): Promise<void>;
  clear(): void;
}

export interface WorkspacePersistence {
  load(): Promise<WorkspaceStore>;
  save(store: WorkspaceStore): Promise<WorkspaceStore>;
}

export interface WorkspaceInput {
  name: string;
  projectPath: string | null;
}

const SAVE_DELAY_MS = 350;

export class WorkspaceManager {
  private current: WorkspaceManagerSnapshot = {
    store: emptyWorkspaceStore(),
    persistence: 'loading',
    error: null
  };
  private readonly listeners = new Set<() => void>();
  private saveTimer: number | null = null;
  private saveQueue: Promise<void> = Promise.resolve();
  private dirty = false;
  private suppressLayoutChanges = false;
  private revision = 0;

  constructor(
    private readonly layout: WorkspaceLayoutHost,
    private readonly persistence: WorkspacePersistence,
    private readonly reportError: (context: string, error: unknown) => void = () => {},
    private readonly now: () => number = () => Date.now(),
    private readonly createId: () => string = createWorkspaceId
  ) {}

  getSnapshot = (): WorkspaceManagerSnapshot => this.current;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  activeWorkspace(): SavedWorkspace | null {
    const activeId = this.current.store.activeWorkspaceId;
    return this.current.store.workspaces.find((workspace) => workspace.id === activeId) ?? null;
  }

  async initialize(): Promise<void> {
    const loaded = await this.persistence.load();
    const activeWorkspace =
      loaded.workspaces.find((workspace) => workspace.id === loaded.activeWorkspaceId) ??
      loaded.workspaces[0] ??
      null;
    const store = {
      ...loaded,
      activeWorkspaceId: activeWorkspace?.id ?? null
    };

    this.suppressLayoutChanges = true;
    try {
      if (activeWorkspace) {
        await this.layout.restore(activeWorkspace.layout);
      } else {
        this.layout.clear();
      }
    } finally {
      this.suppressLayoutChanges = false;
    }

    this.setCurrent(store, 'saved', null);
    if (store.activeWorkspaceId !== loaded.activeWorkspaceId) {
      await this.persistStore(store);
    }
  }

  handleLayoutChanged = (): void => {
    if (this.suppressLayoutChanges || !this.activeWorkspace()) {
      return;
    }
    this.dirty = true;
    this.setCurrent(this.current.store, 'pending', null);
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
    }
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.flush().catch((error: unknown) => {
        this.reportError('Could not save workspace changes', error);
      });
    }, SAVE_DELAY_MS);
  };

  async create(input: WorkspaceInput): Promise<SavedWorkspace> {
    const normalized = validateInput(input, this.current.store.workspaces);
    await this.flush();

    this.suppressLayoutChanges = true;
    try {
      await this.layout.reset(normalized.projectPath);
    } finally {
      this.suppressLayoutChanges = false;
    }

    const workspace: SavedWorkspace = {
      id: this.createId(),
      name: normalized.name,
      projectPath: normalized.projectPath,
      layout: this.layout.snapshot(),
      updatedAt: this.now()
    };
    const store = {
      ...this.current.store,
      activeWorkspaceId: workspace.id,
      workspaces: [...this.current.store.workspaces, workspace]
    };
    await this.persistStore(store);
    return workspace;
  }

  async open(id: string): Promise<void> {
    if (id === this.current.store.activeWorkspaceId) {
      return;
    }
    const target = this.current.store.workspaces.find((workspace) => workspace.id === id);
    if (!target) {
      throw new Error(`workspace ${id} does not exist`);
    }

    await this.flush();
    this.suppressLayoutChanges = true;
    try {
      await this.layout.restore(target.layout);
    } finally {
      this.suppressLayoutChanges = false;
    }
    await this.persistStore({ ...this.current.store, activeWorkspaceId: id });
  }

  async update(id: string, input: WorkspaceInput): Promise<void> {
    const currentWorkspace = this.current.store.workspaces.find((workspace) => workspace.id === id);
    if (!currentWorkspace) {
      throw new Error(`workspace ${id} does not exist`);
    }
    const others = this.current.store.workspaces.filter((workspace) => workspace.id !== id);
    const normalized = validateInput(input, others);
    await this.flush();
    const workspaces = this.current.store.workspaces.map((workspace) =>
      workspace.id === id
        ? {
            ...workspace,
            name: normalized.name,
            projectPath: normalized.projectPath,
            updatedAt: this.now()
          }
        : workspace
    );
    await this.persistStore({ ...this.current.store, workspaces });
  }

  async remove(id: string): Promise<void> {
    const removed = this.current.store.workspaces.find((workspace) => workspace.id === id);
    if (!removed) {
      return;
    }
    await this.flush();

    const workspaces = this.current.store.workspaces.filter((workspace) => workspace.id !== id);
    let activeWorkspaceId = this.current.store.activeWorkspaceId;
    if (activeWorkspaceId === id) {
      const nextWorkspace = workspaces[0] ?? null;
      activeWorkspaceId = nextWorkspace?.id ?? null;
      this.suppressLayoutChanges = true;
      try {
        if (nextWorkspace) {
          await this.layout.restore(nextWorkspace.layout);
        } else {
          this.layout.clear();
        }
      } finally {
        this.suppressLayoutChanges = false;
      }
    }
    await this.persistStore({ ...this.current.store, activeWorkspaceId, workspaces });
  }

  async clearAll(): Promise<void> {
    await this.flush();
    this.suppressLayoutChanges = true;
    try {
      this.layout.clear();
    } finally {
      this.suppressLayoutChanges = false;
    }
    await this.persistStore(emptyWorkspaceStore());
  }

  async retrySave(): Promise<void> {
    await this.persistStore(this.current.store);
  }

  async flush(): Promise<void> {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.dirty) {
      this.dirty = false;
      const activeId = this.current.store.activeWorkspaceId;
      const workspaces = this.current.store.workspaces.map((workspace) =>
        workspace.id === activeId
          ? { ...workspace, layout: this.layout.snapshot(), updatedAt: this.now() }
          : workspace
      );
      await this.persistStore({ ...this.current.store, workspaces });
    }
    await this.saveQueue;
  }

  dispose(): void {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.listeners.clear();
  }

  private async persistStore(store: WorkspaceStore): Promise<void> {
    const revision = ++this.revision;
    this.setCurrent(store, 'saving', null, false);
    const task = this.saveQueue.then(async () => {
      const saved = await this.persistence.save(store);
      if (revision === this.revision) {
        this.setCurrent(saved, 'saved', null);
      }
    });
    this.saveQueue = task.catch(() => {});
    try {
      await task;
    } catch (error) {
      if (revision === this.revision) {
        this.setCurrent(store, 'error', errorMessage(error));
      }
      throw error;
    }
  }

  private setCurrent(
    store: WorkspaceStore,
    persistence: PersistenceStatus,
    error: string | null,
    incrementRevision = true
  ): void {
    if (incrementRevision) {
      this.revision += 1;
    }
    this.current = { store, persistence, error };
    for (const listener of this.listeners) {
      listener();
    }
  }
}

function validateInput(input: WorkspaceInput, existing: SavedWorkspace[]): WorkspaceInput {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Workspace name is required');
  }
  if (name.length > 80) {
    throw new Error('Workspace name must be 80 characters or fewer');
  }
  if (existing.some((workspace) => workspace.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0)) {
    throw new Error(`A workspace named ${name} already exists`);
  }
  const projectPath = input.projectPath?.trim() || null;
  return { name, projectPath };
}

function createWorkspaceId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `workspace-${uuid ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
