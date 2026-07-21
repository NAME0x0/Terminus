import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { SavedWorkspace } from '@/workspaces/types';
import { WorkspaceSidebar } from './WorkspaceSidebar';

describe('WorkspaceSidebar', () => {
  it('makes first-workspace creation the primary empty-state action', async () => {
    const user = userEvent.setup();
    const create = vi.fn();
    renderSidebar({ workspaces: [], onCreate: create });

    expect(screen.getByText('Give this project a home')).toBeTruthy();
    const primaryCreate = screen
      .getAllByRole('button', { name: 'Create workspace' })
      .find((button) => button.textContent?.includes('Create workspace'));
    if (!primaryCreate) {
      throw new Error('missing primary create workspace action');
    }
    await user.click(primaryCreate);
    expect(create).toHaveBeenCalledOnce();
  });

  it('shows project context and switches with one click', async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    renderSidebar({ workspaces: [workspace()], activeWorkspaceId: 'workspace-1', onSelect: select });

    const item = screen
      .getAllByRole('button')
      .find((button) => button.getAttribute('aria-current') === 'page');
    if (!item) {
      throw new Error('missing active workspace action');
    }
    expect(item.getAttribute('aria-current')).toBe('page');
    expect(item.textContent).toContain('Terminus');
    await user.click(item);
    expect(select).toHaveBeenCalledWith('workspace-1');
  });
});

function renderSidebar(overrides: Partial<React.ComponentProps<typeof WorkspaceSidebar>> = {}): void {
  render(
    <WorkspaceSidebar
      workspaces={[]}
      activeWorkspaceId={null}
      persistence="saved"
      onSelect={() => {}}
      onCreate={() => {}}
      onEdit={() => {}}
      onRemove={() => {}}
      onOpenCommands={() => {}}
      onOpenSettings={() => {}}
      {...overrides}
    />
  );
}

function workspace(): SavedWorkspace {
  return {
    id: 'workspace-1',
    name: 'Terminus',
    projectPath: 'D:/Terminus',
    updatedAt: 1,
    layout: {
      activeTabId: 'tab-1',
      tabs: [
        {
          id: 'tab-1',
          title: 'Terminal',
          focusedPaneId: 'pane-1',
          root: { type: 'leaf', pane: { id: 'pane-1', cwd: 'D:/Terminus', shellProfile: null } }
        }
      ]
    }
  };
}
