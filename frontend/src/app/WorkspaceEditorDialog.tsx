import { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SavedWorkspace } from '@/workspaces/types';
import type { WorkspaceInput } from '@/workspaces/WorkspaceManager';

interface WorkspaceEditorDialogProps {
  open: boolean;
  workspace: SavedWorkspace | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: WorkspaceInput) => Promise<void>;
}

export function WorkspaceEditorDialog({
  open: dialogOpen,
  workspace,
  onOpenChange,
  onSubmit
}: WorkspaceEditorDialogProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!dialogOpen) {
      return;
    }
    setName(workspace?.name ?? '');
    setProjectPath(workspace?.projectPath ?? '');
    setError(null);
  }, [dialogOpen, workspace]);

  async function chooseProjectDirectory(): Promise<void> {
    setError(null);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: projectPath || undefined,
        title: 'Choose a project directory'
      });
      if (typeof selected === 'string') {
        setProjectPath(selected);
      }
    } catch (dialogError) {
      setError(`Could not open the folder picker: ${dialogError instanceof Error ? dialogError.message : String(dialogError)}`);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ name, projectPath: projectPath || null });
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setBusy(false);
    }
  }

  const editing = workspace !== null;
  return (
    <Dialog open={dialogOpen} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/80 bg-popover sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit workspace' : 'Create a workspace'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Update the project identity shown in the workspace sidebar.'
              : 'Start with a project home. Terminus will preserve the tabs and panes you build here.'}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-5" onSubmit={(event) => void submit(event)}>
          <div className="grid gap-2">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              value={name}
              maxLength={80}
              autoComplete="off"
              placeholder="Terminus"
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Use the project or responsibility users will switch back to.</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="workspace-path">Project directory</Label>
            <div className="flex min-w-0 gap-2">
              <Input
                id="workspace-path"
                value={projectPath}
                autoComplete="off"
                spellCheck={false}
                placeholder="Optional"
                className="min-w-0 font-mono text-xs"
                onChange={(event) => setProjectPath(event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void chooseProjectDirectory()}
                aria-label="Choose project directory"
              >
                <FolderOpen /> Browse
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              New panes begin here. Existing panes retain their individually saved directories.
            </p>
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || name.trim().length === 0}>
              {busy ? 'Saving…' : editing ? 'Save workspace' : 'Create workspace'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
