import { cn } from '@/lib/utils';

export interface CodexDiffLine {
  type: 'meta' | 'hunk' | 'add' | 'del' | 'ctx' | 'fill';
  text: string;
}

interface CodexDiffProps {
  lines: CodexDiffLine[];
  percent?: number;
  className?: string;
}

const COLORS: Record<CodexDiffLine['type'], string> = {
  meta: '#ededed',
  hunk: '#f6e2b7',
  add: '#abdfa7',
  del: '#f2a0a0',
  ctx: '#ededed',
  fill: '#7a7a7a'
};

/** Adapted from Brainless's Codex diff primitive with data supplied by Terminus. */
export function CodexDiff({ lines, percent = 100, className }: CodexDiffProps): React.JSX.Element {
  return (
    <section className={cn('overflow-hidden border border-[#2a2a2a] bg-[#1a1a1a] font-mono text-[13px] leading-[1.45]', className)} aria-label="Code changes">
      <div className="bg-[#121212] px-2 py-1 text-[12px] tracking-[0.28em] text-[#7a7a7a]">D I F F</div>
      <pre className="overflow-x-auto px-2 py-1.5"><code>
        {lines.map((line, index) => (
          <span key={`${line.type}-${line.text}-${index}`} className="block" style={{ color: COLORS[line.type] }}>
            {line.type === 'add' ? <span className="sr-only">added: </span> : null}
            {line.type === 'del' ? <span className="sr-only">removed: </span> : null}
            {line.text}
          </span>
        ))}
      </code></pre>
      <footer className="border-t border-[#2a2a2a] px-2 py-1 text-right text-[12px] text-[#7a7a7a]">{percent}%</footer>
    </section>
  );
}
