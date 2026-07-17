import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorCenter, errorMessage, renderFatalError } from './ErrorCenter';

describe('ErrorCenter', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('keeps the newest notices bounded and lets the user dismiss one', () => {
    const errors = new ErrorCenter();
    errors.report('First', new Error('one'));
    errors.report('Second', 'two');
    errors.report('Third', 'three');
    errors.report('Fourth', 'four');

    const notices = document.querySelectorAll<HTMLElement>('.error-notice');
    expect(notices).toHaveLength(3);
    expect(document.body.textContent).not.toContain('First: one');
    expect(document.body.textContent).toContain('Fourth: four');

    notices[0].querySelector<HTMLButtonElement>('.error-notice-dismiss')?.click();
    expect(document.querySelectorAll('.error-notice')).toHaveLength(2);
  });

  it('renders a recoverable fatal state', () => {
    const root = document.createElement('div');
    const retry = vi.fn();
    document.body.append(root);

    renderFatalError(root, new Error('config unavailable'), retry);
    root.querySelector<HTMLButtonElement>('.fatal-error-retry')?.click();

    expect(root.getAttribute('role')).toBeNull();
    expect(root.querySelector('.fatal-error')?.getAttribute('role')).toBe('alert');
    expect(root.textContent).toContain('config unavailable');
    expect(retry).toHaveBeenCalledOnce();
  });

  it('formats non-Error failures without throwing', () => {
    expect(errorMessage(null)).toBe('null');
    expect(errorMessage({ reason: 'denied' })).toBe('[object Object]');
  });
});
