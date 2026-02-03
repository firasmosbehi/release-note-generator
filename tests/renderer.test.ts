import {describe, it, expect} from 'vitest';
import {renderBody, Categorized} from '../src/renderer';

describe('renderBody', () => {
  const categorized: Categorized = {
    Features: [
      {category: 'Features', summary: 'add foo', pr: 1},
      {category: 'Features', summary: 'add bar', pr: 2}
    ],
    Fixes: [
      {category: 'Fixes', summary: 'bug fix', pr: 3}
    ]
  };

  it('renders sections with heading level', () => {
    const body = renderBody(categorized, {
      headingLevel: 3,
      emptyMessage: 'none',
      template: '{{sections}}',
      tag: 'v1.0.0'
    });
    expect(body).toContain('### Features');
    expect(body).toContain('### Fixes');
    expect(body).toContain('- add foo (#1)');
  });

  it('renders empty message when no sections', () => {
    const body = renderBody({}, {
      headingLevel: 2,
      emptyMessage: 'No changes',
      template: 'Changes:\n{{sections}}',
      tag: 'v1.0.0'
    });
    expect(body).toContain('No changes');
  });

  it('replaces template variables', () => {
    const body = renderBody(categorized, {
      headingLevel: 2,
      emptyMessage: 'none',
      template: 'Tag {{tag}} since {{previousTag}}\n{{sections}}',
      tag: 'v1.2.3',
      previousTag: 'v1.2.2'
    });
    expect(body).toContain('v1.2.3');
    expect(body).toContain('v1.2.2');
  });
});
