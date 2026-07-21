import { useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Status = 'ok' | 'error' | 'run';

const DOT: Record<Status, string> = {
  ok: '#4ea96f',
  error: '#f7768e',
  run: '#e0af68'
};

interface CodexExecProps {
  command: string;
  result?: string;
  status?: Status;
  defaultOpen?: boolean;
  className?: string;
  children?: ReactNode;
}

/** Adapted from Brainless's Codex exec primitive. */
export function CodexExec({
  command,
  result,
  status = 'ok',
  defaultOpen = false,
  className,
  children
}: CodexExecProps): React.JSX.Element {
  const expandable = Boolean(children);
  const [open, setOpen] = useState(defaultOpen);
  const summary = (
    <span className="flex min-w-0 items-baseline gap-2">
      <span aria-hidden="true" className="shrink-0" style={{ color: DOT[status] }}>•</span>
      <span className="min-w-0 break-words text-[#5cc2e0]">{command}</span>
      {result ? <span className="shrink-0 text-[#7a7a7a]">{result}</span> : null}
      {expandable ? <span className="shrink-0 text-[#565656] group-open:hidden">▸</span> : null}
    </span>
  );

  if (!expandable) {
    return <div className={cn('font-mono text-[13px] leading-[1.55]', className)}>{summary}</div>;
  }

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className={cn('group font-mono text-[13px] leading-[1.55] [&_summary::-webkit-details-marker]:hidden', className)}
    >
      <summary className="min-w-0 list-none cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-[#5cc2e0]/60">
        {summary}
      </summary>
      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap pl-4 text-[#8a8a8a]">{children}</pre>
    </details>
  );
}
