import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

interface CodexWorkingProps {
  running?: boolean;
  label?: string;
  className?: string;
}

/** Adapted from Brainless's polite-live-region Codex working primitive. */
export function CodexWorking({ running = true, label = 'Working', className }: CodexWorkingProps): React.JSX.Element | null {
  const prefersReduced = usePrefersReducedMotion();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) {
      return undefined;
    }
    const id = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  if (!running) {
    return null;
  }

  return (
    <div role="status" aria-live="polite" className={cn('flex items-baseline gap-2 font-mono text-[13px] font-bold', className)}>
      <span aria-hidden="true" className="text-[#a7a7a7]">•</span>
      <span className={prefersReduced ? 'text-[#e7e7e7]' : 'codex-working-shimmer'}>{label}</span>
      <span className="font-normal text-[#7a7a7a]">({seconds}s • esc to interrupt)</span>
    </div>
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}
