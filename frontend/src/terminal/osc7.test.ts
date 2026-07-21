import { describe, expect, it } from 'vitest';

import { parseOsc7Cwd } from './osc7';

describe('parseOsc7Cwd', () => {
  it('normalizes the Windows cmd prompt URI emitted by shell integration', () => {
    expect(parseOsc7Cwd(String.raw`file:///D:\Terminus\project\api`)).toBe(
      'D:/Terminus/project/api'
    );
  });

  it('decodes ordinary OSC 7 file URIs', () => {
    expect(parseOsc7Cwd('file://localhost/home/user/My%20Project')).toBe(
      '/home/user/My Project'
    );
  });

  it('rejects non-file and malformed metadata', () => {
    expect(parseOsc7Cwd('https://example.com/project')).toBeNull();
    expect(parseOsc7Cwd('file://%')).toBeNull();
  });
});
