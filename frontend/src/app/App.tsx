import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Command, PanelLeftClose, PanelLeftOpen, Plus, Settings } from 'lucide-react';

import { createActionRegistry, type ActionRegistry } from '@/actions/actions';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { AppConfig } from '@/config/types';
import type { ErrorReporter } from '@/errors/ErrorCenter';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { bindKeybindings, type KeybindingBinding } from '@/keys/keybindings';
import { actionHint, shortcutForAction } from '@/keys/shortcutHints';
import { LayoutController } from '@/layout/LayoutController';
import { TerminalPane } from '@/terminal/TerminalPane';
import { applyTheme, resolveTheme } from '@/theme/applyTheme';
import { loadWorkspaceStore, saveWorkspaceStore } from '@/workspaces/workspaceStore';
import type { SavedWorkspace } from '@/workspaces/types';
import {
  WorkspaceManager,
  type WorkspaceManagerSnapshot
} from '@/workspaces/WorkspaceManager';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import type { WorkspaceDestructiveAction } from './WorkspaceStateAlert';

const CommandPaletteDialog = lazy(async () => {
  const module = await import('./CommandPaletteDialog');
  return { default: module.CommandPaletteDialog };
});
const SettingsSheet = lazy(async () => {
  const module = await import('./SettingsSheet');
  return { default: module.SettingsSheet };
});
const WorkspaceEditorDialog = lazy(async () => {
  const module = await import('./WorkspaceEditorDialog');
  return { default: module.WorkspaceEditorDialog };
});
const WorkspaceStateAlert = lazy(async () => {
  const module = await import('./WorkspaceStateAlert');
  return { default: module.WorkspaceStateAlert };
});

interface AppProps {
  initialConfig: AppConfig;
  reportError: ErrorReporter;
}

interface AppRuntime {
  actions: ActionRegistry;
  manager: WorkspaceManager;
  saveConfig: (config: AppConfig) => Promise<void>;
}

const EMPTY_WORKSPACE_SNAPSHOT: WorkspaceManagerSnapshot = {
  store: { schemaVersion: 1, activeWorkspaceId: null, workspaces: [] },
  persistence: 'loading',
  error: null
};

export function App({ initialConfig, reportError }: AppProps): React.JSX.Element {
  const tabBarRef = useRef<HTMLElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const paneStatusRef = useRef<HTMLSpanElement>(null);
  const [config, setConfig] = useState(initialConfig);
  const [runtime, setRuntime] = useState<AppRuntime | null>(null);
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState(EMPTY_WORKSPACE_SNAPSHOT);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<SavedWorkspace | null>(null);
  const [destructiveAction, setDestructiveAction] = useState<WorkspaceDestructiveAction | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(() => localStorage.getItem('terminus.sidebar.expanded') !== 'false');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isWide = useMediaQuery('(min-width: 1050px)');
  const isWideRef = useRef(isWide);
  isWideRef.current = isWide;

  const activeWorkspace =
    workspaceSnapshot.store.workspaces.find(
      (workspace) => workspace.id === workspaceSnapshot.store.activeWorkspaceId
    ) ?? null;

  useEffect(() => {
    localStorage.setItem('terminus.sidebar.expanded', String(sidebarExpanded));
  }, [sidebarExpanded]);

  useEffect(() => {
    if (isWide) {
      setMobileSidebarOpen(false);
    }
  }, [isWide]);

  useEffect(() => {
    const tabBar = tabBarRef.current;
    const workspace = workspaceRef.current;
    const paneStatus = paneStatusRef.current;
    if (!tabBar || !workspace || !paneStatus) {
      throw new Error('failed to attach the Terminus workspace shell');
    }

    let cancelled = false;
    let keybindings: KeybindingBinding | null = null;
    let workspaceManager: WorkspaceManager | null = null;
    const disposers: Array<() => void> = [];
    let currentConfig = initialConfig;
    let currentTheme = applyTheme(resolveTheme(currentConfig.appearance.theme));
    let closing = false;

    const layout = new LayoutController(
      tabBar,
      workspace,
      paneStatus,
      (cwd) =>
        new TerminalPane(
          currentConfig,
          currentTheme,
          (pane) => layout.setFocusedPane(pane),
          (command, pane) => layout.handlePaneCommand(command, pane),
          (pane) => layout.handlePaneMetadataChange(pane),
          reportError,
          cwd
        ),
      () => workspaceManager?.handleLayoutChanged()
    );

    workspaceManager = new WorkspaceManager(
      layout,
      { load: loadWorkspaceStore, save: saveWorkspaceStore },
      reportError
    );
    const manager = workspaceManager;
    const toggleSidebar = () => {
      if (isWideRef.current) {
        setSidebarExpanded((expanded) => !expanded);
      } else {
        setMobileSidebarOpen((open) => !open);
      }
    };
    const openWorkspaceEditor = () => {
      setEditingWorkspace(null);
      setEditorOpen(true);
    };
    const actions = createActionRegistry(
      layout,
      () => setPaletteOpen(true),
      () => setSettingsOpen(true),
      reportError,
      () => manager.activeWorkspace() !== null
    );
    actions.register({ id: 'toggleWorkspaceSidebar', title: 'Toggle workspace sidebar', run: toggleSidebar });
    actions.register({ id: 'createWorkspace', title: 'Create workspace', run: openWorkspaceEditor });
    keybindings = bindKeybindings(currentConfig, actions);

    const applyConfig = (nextConfig: AppConfig): void => {
      currentTheme = applyTheme(resolveTheme(nextConfig.appearance.theme));
      layout.applyConfig(nextConfig, currentTheme);
      keybindings?.update(nextConfig);
      currentConfig = nextConfig;
      setConfig(nextConfig);
    };
    const saveConfig = async (nextConfig: AppConfig): Promise<void> => {
      const saved = await invoke<AppConfig>('save_config', { config: nextConfig });
      applyConfig(saved);
    };

    const unsubscribe = manager.subscribe(() => setWorkspaceSnapshot(manager.getSnapshot()));
    disposers.push(unsubscribe);

    async function initialize(): Promise<void> {
      await manager.initialize();
      if (cancelled) {
        return;
      }
      setWorkspaceSnapshot(manager.getSnapshot());
      setRuntime({ actions, manager, saveConfig });

      const unlistenConfig = await listen<AppConfig>('config://reloaded', (event) => {
        try {
          applyConfig(event.payload);
        } catch (error) {
          reportError('Could not apply reloaded configuration', error);
        }
      });
      if (cancelled) {
        unlistenConfig();
        return;
      }
      disposers.push(unlistenConfig);

      const appWindow = getCurrentWindow();
      const unlistenClose = await appWindow.onCloseRequested(async (event) => {
        if (closing) {
          return;
        }
        event.preventDefault();
        try {
          await manager.flush();
          closing = true;
          await invoke('exit_application');
        } catch (error) {
          reportError('Could not save the workspace before closing', error);
        }
      });
      if (cancelled) {
        unlistenClose();
        return;
      }
      disposers.push(unlistenClose);
    }

    void initialize().catch((error: unknown) => reportError('Could not load workspaces', error));

    return () => {
      cancelled = true;
      for (const dispose of disposers) {
        dispose();
      }
      keybindings?.dispose();
      manager.dispose();
      layout.dispose();
    };
  }, [initialConfig, reportError]);

  function toggleSidebar(): void {
    if (isWide) {
      setSidebarExpanded((expanded) => !expanded);
    } else {
      setMobileSidebarOpen((open) => !open);
    }
  }

  function beginCreateWorkspace(): void {
    setEditingWorkspace(null);
    setEditorOpen(true);
  }

  function beginEditWorkspace(workspace: SavedWorkspace): void {
    setEditingWorkspace(workspace);
    setEditorOpen(true);
  }

  async function submitWorkspace(input: { name: string; projectPath: string | null }): Promise<void> {
    if (!runtime) {
      return;
    }
    try {
      if (editingWorkspace) {
        await runtime.manager.update(editingWorkspace.id, input);
      } else {
        await runtime.manager.create(input);
      }
    } catch (error) {
      if (runtime.manager.getSnapshot().persistence !== 'error') {
        throw error;
      }
      reportError('Workspace changed but could not be saved yet', error);
    }
    setMobileSidebarOpen(false);
  }

  function selectWorkspace(id: string): void {
    if (!runtime) {
      return;
    }
    setMobileSidebarOpen(false);
    void runtime.manager.open(id).catch((error: unknown) => reportError('Could not open workspace', error));
  }

  async function confirmDestructiveAction(): Promise<void> {
    if (!runtime || !destructiveAction) {
      return;
    }
    if (destructiveAction.kind === 'clear') {
      try {
        await runtime.manager.clearAll();
      } catch (error) {
        if (runtime.manager.getSnapshot().persistence !== 'error') {
          throw error;
        }
        reportError('Workspace state was cleared but could not be saved yet', error);
      }
      setSettingsOpen(false);
      return;
    }
    if (destructiveAction.workspaceId) {
      try {
        await runtime.manager.remove(destructiveAction.workspaceId);
      } catch (error) {
        if (runtime.manager.getSnapshot().persistence !== 'error') {
          throw error;
        }
        reportError('Workspace was removed but could not be saved yet', error);
      }
    }
  }

  const sidebar = (
    <WorkspaceSidebar
      workspaces={workspaceSnapshot.store.workspaces}
      activeWorkspaceId={workspaceSnapshot.store.activeWorkspaceId}
      persistence={workspaceSnapshot.persistence}
      onSelect={selectWorkspace}
      onCreate={beginCreateWorkspace}
      onEdit={beginEditWorkspace}
      onRemove={(workspace) =>
        setDestructiveAction({ kind: 'remove', workspaceId: workspace.id, workspaceName: workspace.name })
      }
      onOpenCommands={() => setPaletteOpen(true)}
      onOpenSettings={() => setSettingsOpen(true)}
    />
  );

  return (
    <TooltipProvider delayDuration={450}>
      <div className="terminus-app">
        {isWide && sidebarExpanded ? <aside className="workspace-sidebar">{sidebar}</aside> : null}

        {!isWide ? (
          <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
            <SheetContent side="left" showCloseButton={false} className="w-[min(88vw,280px)] gap-0 border-sidebar-border bg-sidebar p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Workspaces</SheetTitle>
                <SheetDescription>Switch and manage Terminus project workspaces.</SheetDescription>
              </SheetHeader>
              {sidebar}
            </SheetContent>
          </Sheet>
        ) : null}

        <main className="workspace-shell">
          <header className="topbar">
            <div className="flex min-w-0 items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={toggleSidebar} aria-label={sidebarExpanded && isWide ? 'Hide workspace sidebar' : 'Show workspace sidebar'}>
                    {sidebarExpanded && isWide ? <PanelLeftClose /> : <PanelLeftOpen />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{sidebarExpanded && isWide ? 'Hide workspace sidebar' : 'Show workspace sidebar'}</TooltipContent>
              </Tooltip>
              <div className="min-w-0 border-l border-border pl-2.5">
                <div className="truncate text-[11px] text-muted-foreground">Workspace</div>
                <div className="truncate text-[13px] font-medium">{activeWorkspace?.name ?? 'No workspace'}</div>
              </div>
            </div>

            <nav ref={tabBarRef} className="tabs" aria-label="Terminal tabs" />

            <div className="topbar-actions" aria-label="Workspace actions">
              <Button
                type="button"
                size="sm"
                disabled={!activeWorkspace}
                title={actionHint('New tab', config.keybindings, 'newTab')}
                onClick={() => void runtime?.actions.run('newTab')}
              >
                <Plus /> <span className="hidden xl:inline">New tab</span>
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={actionHint('Commands', config.keybindings, 'commandPalette')} onClick={() => setPaletteOpen(true)}>
                    <Command />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{actionHint('Commands', config.keybindings, 'commandPalette')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={actionHint('Settings', config.keybindings, 'settings')} onClick={() => setSettingsOpen(true)}>
                    <Settings />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{actionHint('Settings', config.keybindings, 'settings')}</TooltipContent>
              </Tooltip>
            </div>
          </header>

          <div className="workspace-stage">
            <section ref={workspaceRef} className="workspace" aria-label="Terminal workspace" />
            {!activeWorkspace && workspaceSnapshot.persistence !== 'loading' ? (
              <section className="workspace-empty" aria-labelledby="empty-workspace-title">
                <span className="workspace-empty-mark" aria-hidden="true">&gt;_</span>
                <h1 id="empty-workspace-title">Start with a durable workspace</h1>
                <p>Name the project once, arrange its terminals, and Terminus will restore that organization when you return.</p>
                <Button type="button" onClick={beginCreateWorkspace}><Plus /> Create workspace</Button>
              </section>
            ) : null}
          </div>

          <footer className="statusbar">
            <span ref={paneStatusRef} className="status-text">{activeWorkspace ? 'Preparing terminal…' : 'No active pane'}</span>
            <span className="status-mode" role="status" aria-live="polite">
              {workspaceSnapshot.persistence === 'error' ? (
                <button type="button" className="status-retry" onClick={() => void runtime?.manager.retrySave().catch((error: unknown) => reportError('Could not retry workspace save', error))}>
                  Save failed — retry
                </button>
              ) : (
                persistenceLabel(workspaceSnapshot.persistence)
              )}
            </span>
          </footer>
        </main>
      </div>

      <Suspense fallback={null}>
        {editorOpen ? (
          <WorkspaceEditorDialog
            open
            workspace={editingWorkspace}
            onOpenChange={setEditorOpen}
            onSubmit={submitWorkspace}
          />
        ) : null}
        {paletteOpen ? (
          <CommandPaletteDialog
            open
            actions={runtime?.actions ?? null}
            shortcutFor={(actionId) => shortcutForAction(config.keybindings, actionId)}
            onOpenChange={setPaletteOpen}
          />
        ) : null}
        {settingsOpen ? (
          <SettingsSheet
            open
            config={config}
            actions={runtime?.actions ?? null}
            onOpenChange={setSettingsOpen}
            onSave={async (nextConfig) => runtime?.saveConfig(nextConfig)}
            onClearWorkspaceState={() => setDestructiveAction({ kind: 'clear' })}
          />
        ) : null}
        {destructiveAction ? (
          <WorkspaceStateAlert
            action={destructiveAction}
            onOpenChange={(open) => {
              if (!open) {
                setDestructiveAction(null);
              }
            }}
            onConfirm={confirmDestructiveAction}
          />
        ) : null}
      </Suspense>
    </TooltipProvider>
  );
}

function persistenceLabel(status: WorkspaceManagerSnapshot['persistence']): string {
  switch (status) {
    case 'loading':
      return 'Loading workspace';
    case 'pending':
      return 'Changes pending';
    case 'saving':
      return 'Saving locally';
    case 'saved':
      return 'Saved locally';
    case 'error':
      return 'Save failed';
  }
}
