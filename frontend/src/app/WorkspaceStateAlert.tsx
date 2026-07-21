import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';

export interface WorkspaceDestructiveAction {
  kind: 'remove' | 'clear';
  workspaceId?: string;
  workspaceName?: string;
}

interface WorkspaceStateAlertProps {
  action: WorkspaceDestructiveAction | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

export function WorkspaceStateAlert({
  action,
  onOpenChange,
  onConfirm
}: WorkspaceStateAlertProps): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clearing = action?.kind === 'clear';

  useEffect(() => setError(null), [action]);

  async function confirm(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : String(confirmError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={action !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>{clearing ? 'Clear all workspace state?' : `Remove ${action?.workspaceName ?? 'workspace'}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {clearing
              ? 'This removes every saved workspace, layout, project path, and working directory from Terminus. It does not delete project files.'
              : 'This removes the saved layout from Terminus. It does not delete the project directory or its files.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              void confirm();
            }}
          >
            {busy ? 'Removing…' : clearing ? 'Clear saved state' : 'Remove workspace'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
