import { useState } from 'react';

import { cn } from '@/lib/utils';

export interface CodexPermissionOption {
  label: string;
  description: string;
  current?: boolean;
}

interface CodexPermissionsProps {
  title: string;
  options: CodexPermissionOption[];
  defaultSelected?: number;
  className?: string;
  onChoose?: (index: number) => void;
  onCancel?: () => void;
}

/** Adapted from Brainless's keyboard-operable Codex permission chooser. */
export function CodexPermissions({
  title,
  options,
  defaultSelected = 0,
  className,
  onChoose,
  onCancel
}: CodexPermissionsProps): React.JSX.Element {
  const [selected, setSelected] = useState(defaultSelected);

  function focusOption(current: HTMLElement, index: number): void {
    const option = current.parentElement?.children[index];
    if (option instanceof HTMLElement) {
      option.focus();
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number): void {
    let next = index;
    if (event.key === 'ArrowDown') {
      next = (index + 1) % options.length;
    } else if (event.key === 'ArrowUp') {
      next = (index - 1 + options.length) % options.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = options.length - 1;
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelected(index);
      onChoose?.(index);
      return;
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onCancel?.();
      return;
    } else {
      return;
    }
    event.preventDefault();
    setSelected(next);
    focusOption(event.currentTarget, next);
  }

  return (
    <div className={cn('font-mono text-[13px] leading-[1.55]', className)}>
      <div className="mb-2 font-semibold text-[#ededed]">{title}</div>
      <div role="radiogroup" aria-label={title} className="space-y-2">
        {options.map((option, index) => {
          const active = selected === index;
          return (
            <button
              type="button"
              key={option.label}
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onKeyDown={(event) => onKeyDown(event, index)}
              onClick={() => {
                setSelected(index);
                onChoose?.(index);
              }}
              className="flex w-full cursor-pointer gap-2 border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-1 focus-visible:ring-white/30"
            >
              <span aria-hidden="true" className={active ? 'w-[2ch] text-[#ededed]' : 'w-[2ch] text-transparent'}>›</span>
              <span className="min-w-0">
                <span className={active ? 'block text-[#f6e2b7]' : 'block text-[#ededed]'}>
                  {index + 1}. {option.label}{option.current ? <span className="text-[#7a7a7a]"> (current)</span> : null}
                </span>
                <span className="mt-0.5 block max-w-prose text-[12px] text-[#7a7a7a]">{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[12px] text-[#7a7a7a]">Press enter to confirm or esc to go back</p>
    </div>
  );
}
