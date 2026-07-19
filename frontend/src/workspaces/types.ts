export const WORKSPACE_SCHEMA_VERSION = 1;

export interface WorkspaceStore {
  schemaVersion: number;
  activeWorkspaceId: string | null;
  workspaces: SavedWorkspace[];
}

export interface SavedWorkspace {
  id: string;
  name: string;
  projectPath: string | null;
  layout: WorkspaceLayout;
  updatedAt: number;
}

export interface WorkspaceLayout {
  tabs: WorkspaceTab[];
  activeTabId: string;
}

export interface WorkspaceTab {
  id: string;
  title: string;
  root: WorkspaceLayoutNode;
  focusedPaneId: string;
}

export type WorkspaceLayoutNode =
  | {
      type: 'leaf';
      pane: WorkspacePane;
    }
  | {
      type: 'split';
      direction: SplitDirection;
      ratio: number;
      first: WorkspaceLayoutNode;
      second: WorkspaceLayoutNode;
    };

export interface WorkspacePane {
  id: string;
  cwd: string | null;
  shellProfile: string | null;
}

export type SplitDirection = 'horizontal' | 'vertical';

export function emptyWorkspaceStore(): WorkspaceStore {
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    activeWorkspaceId: null,
    workspaces: []
  };
}
