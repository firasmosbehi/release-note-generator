import {describe, it, expect} from 'vitest';
import {buildCategoryMap, parseTitle} from '../src/parser';

describe('buildCategoryMap', () => {
  it('merges overrides with defaults', () => {
    const map = buildCategoryMap('{"perf":"Performance"}');
    expect(map.feat).toBe('Features');
    expect(map.perf).toBe('Performance');
  });

  it('throws on invalid JSON', () => {
    expect(() => buildCategoryMap('not json')).toThrow();
  });
});

describe('parseTitle', () => {
  const map = buildCategoryMap();

  it('parses conventional titles', () => {
    const parsed = parseTitle('feat: add thing', map);
    expect(parsed).not.toBeNull();
    expect(parsed?.category).toBe('Features');
    expect(parsed?.summary).toBe('add thing');
  });

  it('handles scoped types', () => {
    const parsed = parseTitle('fix(api): repair', map);
    expect(parsed?.category).toBe('Fixes');
    expect(parsed?.summary).toBe('repair');
  });

  it('returns null for non-conformant titles', () => {
    expect(parseTitle('bad title', map)).toBeNull();
  });
});
