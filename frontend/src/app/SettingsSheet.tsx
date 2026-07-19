import { useEffect, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';

import type { ActionRegistry } from '@/actions/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import type { AppConfig } from '@/config/types';
import { formatShortcut, shortcutForAction } from '@/keys/shortcutHints';

interface SettingsSheetProps {
  open: boolean;
  config: AppConfig;
  actions: ActionRegistry | null;
  onOpenChange: (open: boolean) => void;
  onSave: (config: AppConfig) => Promise<void>;
  onClearWorkspaceState: () => void;
}

export function SettingsSheet({
  open,
  config,
  actions,
  onOpenChange,
  onSave,
  onClearWorkspaceState
}: SettingsSheetProps): React.JSX.Element {
  const [draft, setDraft] = useState<AppConfig>(() => cloneConfig(config));
  const [shellArgs, setShellArgs] = useState(config.shell.args.join('\n'));
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraft(cloneConfig(config));
    setShellArgs(config.shell.args.join('\n'));
    setStatus('');
  }, [config, open]);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setStatus('Saving settings…');
    const nextConfig: AppConfig = {
      ...draft,
      appearance: {
        ...draft.appearance,
        fontFamily: draft.appearance.fontFamily.trim() || 'Cascadia Code',
        fontSize: clamp(draft.appearance.fontSize, 8, 32)
      },
      shell: {
        program: nullable(draft.shell.program),
        cwd: nullable(draft.shell.cwd),
        args: shellArgs
          .split(/\r?\n/)
          .map((argument) => argument.trim())
          .filter(Boolean)
      }
    };
    try {
      await onSave(nextConfig);
      setStatus('Saved. Appearance updated; shell defaults apply to new panes.');
    } catch (error) {
      setStatus(`Could not save settings: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(92vw,620px)] gap-0 border-border/80 bg-popover sm:max-w-[620px]">
        <SheetHeader className="border-b border-border px-6 py-5">
          <div className="text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">Preferences</div>
          <SheetTitle className="text-xl">Settings</SheetTitle>
          <SheetDescription>Tune Terminus without leaving the active workspace.</SheetDescription>
        </SheetHeader>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void submit(event)}>
          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6">
            <section aria-labelledby="settings-appearance" className="space-y-4">
              <div>
                <h3 id="settings-appearance" className="text-sm font-semibold">Appearance</h3>
                <p className="mt-1 text-xs text-muted-foreground">Changes apply to every open terminal.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="settings-theme">Theme</Label>
                  <Select
                    value={draft.appearance.theme}
                    onValueChange={(theme) =>
                      setDraft((current) => ({
                        ...current,
                        appearance: { ...current.appearance, theme }
                      }))
                    }
                  >
                    <SelectTrigger id="settings-theme" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Terminus Dark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="settings-font-size">Font size</Label>
                  <Input
                    id="settings-font-size"
                    type="number"
                    min={8}
                    max={32}
                    value={draft.appearance.fontSize}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        appearance: { ...current.appearance, fontSize: Number(event.target.value) }
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="settings-font-family">Terminal font</Label>
                  <Input
                    id="settings-font-family"
                    value={draft.appearance.fontFamily}
                    spellCheck={false}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        appearance: { ...current.appearance, fontFamily: event.target.value }
                      }))
                    }
                  />
                </div>
              </div>
            </section>

            <Separator />

            <section aria-labelledby="settings-terminal" className="space-y-4">
              <div>
                <h3 id="settings-terminal" className="text-sm font-semibold">Terminal defaults</h3>
                <p className="mt-1 text-xs text-muted-foreground">Shell changes apply to new tabs and panes.</p>
              </div>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="settings-shell">Shell program</Label>
                  <Input
                    id="settings-shell"
                    value={draft.shell.program ?? ''}
                    spellCheck={false}
                    placeholder="Use the system default"
                    className="font-mono text-xs"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        shell: { ...current.shell, program: event.target.value }
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="settings-cwd">Starting directory</Label>
                  <Input
                    id="settings-cwd"
                    value={draft.shell.cwd ?? ''}
                    spellCheck={false}
                    placeholder="Use the workspace directory"
                    className="font-mono text-xs"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        shell: { ...current.shell, cwd: event.target.value }
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="settings-args">Shell arguments <span className="font-normal text-muted-foreground">one per line</span></Label>
                  <textarea
                    id="settings-args"
                    rows={3}
                    value={shellArgs}
                    spellCheck={false}
                    className="min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    onChange={(event) => setShellArgs(event.target.value)}
                  />
                </div>
              </div>
            </section>

            <Separator />

            <section aria-labelledby="settings-shortcuts" className="space-y-4">
              <div>
                <h3 id="settings-shortcuts" className="text-sm font-semibold">Keyboard shortcuts</h3>
                <p className="mt-1 text-xs text-muted-foreground">Available everywhere outside text fields.</p>
              </div>
              <div className="grid gap-1 rounded-md border border-border bg-card/45 p-2 sm:grid-cols-2">
                {(actions?.list() ?? []).map((action) => {
                  const shortcut = shortcutForAction(config.keybindings, action.id);
                  return (
                    <div key={action.id} className="flex min-w-0 items-center justify-between gap-3 rounded px-2 py-1.5 text-xs">
                      <span className="truncate text-muted-foreground">{action.title}</span>
                      <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                        {shortcut ? formatShortcut(shortcut) : 'Unassigned'}
                      </kbd>
                    </div>
                  );
                })}
              </div>
            </section>

            <Separator />

            <section aria-labelledby="settings-data" className="space-y-3">
              <div>
                <h3 id="settings-data" className="text-sm font-semibold">Local workspace data</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Workspace names, project paths, tabs, pane layouts, and working directories are stored locally.
                </p>
              </div>
              <Button type="button" variant="outline" className="text-destructive hover:text-destructive" onClick={onClearWorkspaceState}>
                <Trash2 /> Clear saved workspace state
              </Button>
            </section>
          </div>

          <SheetFooter className="border-t border-border bg-background/40 px-6 py-4">
            <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground" role="status">
              {status ? <><RotateCcw className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">{status}</span></> : null}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function cloneConfig(config: AppConfig): AppConfig {
  return {
    appearance: { ...config.appearance },
    shell: { ...config.shell, args: [...config.shell.args] },
    keybindings: { ...config.keybindings }
  };
}

function nullable(value: string | null): string | null {
  const normalized = value?.trim() ?? '';
  return normalized || null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(Math.round(value), minimum), maximum) : minimum;
}
