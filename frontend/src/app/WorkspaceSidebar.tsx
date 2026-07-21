import {
  AlertCircle,
  Check,
  Command,
  FolderKanban,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings,
  Trash2
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import type { SavedWorkspace } from '@/workspaces/types';
import type { PersistenceStatus } from '@/workspaces/WorkspaceManager';

interface WorkspaceSidebarProps {
  workspaces: SavedWorkspace[];
  activeWorkspaceId: string | null;
  persistence: PersistenceStatus;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onEdit: (workspace: SavedWorkspace) => void;
  onRemove: (workspace: SavedWorkspace) => void;
  onOpenCommands: () => void;
  onOpenSettings: () => void;
}

export function WorkspaceSidebar({
  workspaces,
  activeWorkspaceId,
  persistence,
  onSelect,
  onCreate,
  onEdit,
  onRemove,
  onOpenCommands,
  onOpenSettings
}: WorkspaceSidebarProps): React.JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <header className="flex h-13 shrink-0 items-center justify-between border-b border-sidebar-border px-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary font-mono text-xs font-bold text-primary-foreground">
            &gt;_
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight">Terminus</div>
            <div className="truncate text-[11px] text-sidebar-foreground/55">Local workspaces</div>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Create workspace"
          aria-label="Create workspace"
          onClick={onCreate}
          className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Plus />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-2 py-3">
        <div className="flex items-center justify-between px-2 pb-2">
          <h2 className="text-[11px] font-semibold tracking-[0.12em] text-sidebar-foreground/45 uppercase">
            Workspaces
          </h2>
          <span className="text-[11px] tabular-nums text-sidebar-foreground/40">{workspaces.length}</span>
        </div>

        {workspaces.length === 0 ? (
          <div className="mx-1 mt-1 rounded-lg border border-dashed border-sidebar-border bg-sidebar-accent/25 p-3">
            <FolderKanban className="mb-3 size-5 text-primary" aria-hidden="true" />
            <p className="text-sm font-medium">Give this project a home</p>
            <p className="mt-1 text-xs leading-relaxed text-sidebar-foreground/55">
              Create a workspace to preserve its tabs, panes, and working directories.
            </p>
            <Button type="button" size="sm" className="mt-3 w-full" onClick={onCreate}>
              <Plus /> Create workspace
            </Button>
          </div>
        ) : (
          <nav aria-label="Project workspaces" className="min-h-0 space-y-1 overflow-y-auto">
            {workspaces.map((workspace) => {
              const active = workspace.id === activeWorkspaceId;
              return (
                <div
                  key={workspace.id}
                  className={
                    active
                      ? 'group flex items-center rounded-md bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'group flex items-center rounded-md text-sidebar-foreground/72 hover:bg-sidebar-accent/55 hover:text-sidebar-accent-foreground'
                  }
                >
                  <button
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                    onClick={() => onSelect(workspace.id)}
                  >
                    <span
                      className={
                        active
                          ? 'grid size-7 shrink-0 place-items-center rounded-md bg-primary/16 text-xs font-semibold text-primary'
                          : 'grid size-7 shrink-0 place-items-center rounded-md bg-sidebar-accent text-xs font-semibold text-sidebar-foreground/60'
                      }
                      aria-hidden="true"
                    >
                      {workspace.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{workspace.name}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-sidebar-foreground/42">
                        {workspace.projectPath ? projectLabel(workspace.projectPath) : 'No project directory'}
                      </span>
                    </span>
                    {active ? <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" /> : null}
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="mr-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                        aria-label={`Workspace actions for ${workspace.name}`}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="right" className="w-44">
                      <DropdownMenuItem onSelect={() => onEdit(workspace)}>
                        <Pencil /> Edit workspace
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => onRemove(workspace)}>
                        <Trash2 /> Remove workspace
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </nav>
        )}
      </div>

      <div className="shrink-0 px-2 pb-2">
        <div className="mb-2 flex items-center gap-2 px-2 text-[11px] text-sidebar-foreground/48" role="status">
          {persistence === 'saving' || persistence === 'loading' ? (
            <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
          ) : persistence === 'error' ? (
            <AlertCircle className="size-3 text-destructive" aria-hidden="true" />
          ) : (
            <Check className="size-3 text-emerald-400" aria-hidden="true" />
          )}
          <span>{persistenceLabel(persistence)}</span>
        </div>
        <Separator className="mb-2 bg-sidebar-border" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={onOpenCommands}
        >
          <Command /> Commands
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={onOpenSettings}
        >
          <Settings /> Settings
        </Button>
      </div>
    </div>
  );
}

function projectLabel(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

function persistenceLabel(status: PersistenceStatus): string {
  switch (status) {
    case 'loading':
      return 'Loading workspaces';
    case 'pending':
      return 'Changes pending';
    case 'saving':
      return 'Saving locally';
    case 'error':
      return 'Save needs attention';
    case 'saved':
      return 'Saved locally';
  }
}
