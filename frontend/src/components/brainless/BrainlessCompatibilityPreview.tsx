import { CodexDiff } from './codex/codex-diff';
import { CodexExec } from './codex/codex-exec';
import { CodexPermissions } from './codex/codex-permissions';
import { CodexWorking } from './codex/codex-working';

/**
 * Development-only composition proving that the Brainless atoms work inside
 * Terminus. Production agent panes will supply provider-neutral event data.
 */
export function BrainlessCompatibilityPreview(): React.JSX.Element {
  return (
    <section aria-label="Structured agent UI compatibility preview" className="space-y-4 bg-[#1a1a1a] p-4 text-[#ededed]">
      <CodexExec command="Read frontend/src/main.tsx" result="completed" />
      <CodexExec command="Ran npm test" result="passed" defaultOpen>
        35 tests passed
      </CodexExec>
      <CodexWorking running={false} />
      <CodexDiff
        lines={[
          { type: 'meta', text: 'diff --git a/frontend/src/main.tsx b/frontend/src/main.tsx' },
          { type: 'del', text: '-imperative shell' },
          { type: 'add', text: '+react workspace shell' }
        ]}
      />
      <CodexPermissions
        title="Agent permissions"
        options={[
          { label: 'Workspace', description: 'Read and edit files in this workspace.', current: true },
          { label: 'Read only', description: 'Inspect files without modifying them.' }
        ]}
      />
    </section>
  );
}
