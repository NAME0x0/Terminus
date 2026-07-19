import type { ActionDefinition, ActionRegistry } from '@/actions/actions';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut
} from '@/components/ui/command';
import { formatShortcut } from '@/keys/shortcutHints';

interface CommandPaletteDialogProps {
  open: boolean;
  actions: ActionRegistry | null;
  shortcutFor: (actionId: string) => string | null;
  onOpenChange: (open: boolean) => void;
}

export function CommandPaletteDialog({
  open,
  actions,
  shortcutFor,
  onOpenChange
}: CommandPaletteDialogProps): React.JSX.Element {
  const availableActions = actions?.list() ?? [];

  function run(action: ActionDefinition): void {
    if (action.isEnabled && !action.isEnabled()) {
      return;
    }
    onOpenChange(false);
    void actions?.run(action.id);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Terminus commands">
      <CommandInput placeholder="Search commands…" />
      <CommandList>
        <CommandEmpty>No matching commands.</CommandEmpty>
        <CommandGroup heading="Actions">
          {availableActions.map((action) => {
            const shortcut = shortcutFor(action.id);
            const disabled = action.isEnabled ? !action.isEnabled() : false;
            return (
              <CommandItem
                key={action.id}
                value={`${action.title} ${action.id}`}
                disabled={disabled}
                onSelect={() => run(action)}
              >
                <span>{action.title}</span>
                {shortcut ? <CommandShortcut>{formatShortcut(shortcut)}</CommandShortcut> : null}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
