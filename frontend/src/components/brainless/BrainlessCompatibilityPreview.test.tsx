import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CodexExec } from './codex/codex-exec';
import { CodexPermissions } from './codex/codex-permissions';

describe('Brainless compatibility components', () => {
  it('uses a native disclosure for expandable execution output', async () => {
    const user = userEvent.setup();
    render(<CodexExec command="Ran npm test">passed</CodexExec>);

    const disclosure = screen.getByText('Ran npm test').closest('details');
    expect(disclosure?.open).toBe(false);
    await user.click(screen.getByText('Ran npm test'));
    expect(disclosure?.open).toBe(true);
  });

  it('supports radiogroup navigation and escape cancellation', async () => {
    const user = userEvent.setup();
    const choose = vi.fn();
    const cancel = vi.fn();
    render(
      <CodexPermissions
        title="Permissions"
        options={[
          { label: 'Workspace', description: 'Workspace access' },
          { label: 'Read only', description: 'Read-only access' }
        ]}
        onChoose={choose}
        onCancel={cancel}
      />
    );

    const options = screen.getAllByRole('radio');
    options[0].focus();
    await user.keyboard('{ArrowDown}{Enter}{Escape}');

    expect(options[1].getAttribute('aria-checked')).toBe('true');
    expect(choose).toHaveBeenCalledWith(1);
    expect(cancel).toHaveBeenCalledOnce();
  });
});
