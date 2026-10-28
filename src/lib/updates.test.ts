import { describe, expect, it } from 'vitest';
import { isNewerVersion } from './updates';

describe('versão nova', () => {
  it('compara número a número, com ou sem o "v" da tag', () => {
    expect(isNewerVersion('v1.2.0', '1.1.0')).toBe(true);
    expect(isNewerVersion('1.10.0', '1.9.3')).toBe(true);
    expect(isNewerVersion('2.0.0', '1.12.4')).toBe(true);
    expect(isNewerVersion('1.1.1', '1.1.0')).toBe(true);
  });

  it('a mesma versão ou uma mais antiga não avisa', () => {
    expect(isNewerVersion('v1.1.0', '1.1.0')).toBe(false);
    expect(isNewerVersion('1.0.9', '1.1.0')).toBe(false);
    expect(isNewerVersion('', '1.1.0')).toBe(false);
  });
});
