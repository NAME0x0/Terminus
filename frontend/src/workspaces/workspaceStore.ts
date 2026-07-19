import { invoke } from '@tauri-apps/api/core';

import type { WorkspaceStore } from './types';

export function loadWorkspaceStore(): Promise<WorkspaceStore> {
  return invoke<WorkspaceStore>('get_workspace_store');
}

export function saveWorkspaceStore(store: WorkspaceStore): Promise<WorkspaceStore> {
  return invoke<WorkspaceStore>('save_workspace_store', { store });
}
