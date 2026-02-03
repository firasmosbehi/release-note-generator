import type {ParsedTitle} from './parser';

export interface CategorizedEntry extends ParsedTitle {
  pr: number;
}

export type Categorized = Record<string, CategorizedEntry[]>;

export interface RenderOptions {
  headingLevel: number;
  emptyMessage: string;
  template: string;
  tag: string;
  previousTag?: string | null;
}

function buildSections(categorized: Categorized, headingLevel: number): string {
  const heading = '#'.repeat(Math.max(1, headingLevel));
  return Object.entries(categorized)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => {
      const bullets = items
        .sort((x, y) => x.pr - y.pr)
        .map(item => `- ${item.summary} (#${item.pr})`)
        .join('\n');
      return `${heading} ${category}\n${bullets}`;
    })
    .join('\n\n');
}

function replaceTemplate(template: string, sections: string, tag: string, previousTag?: string | null): string {
  return template
    .replace(/{{\s*sections\s*}}/gi, sections)
    .replace(/{{\s*tag\s*}}/gi, tag)
    .replace(/{{\s*previousTag\s*}}/gi, previousTag ?? '');
}

export function renderBody(categorized: Categorized, options: RenderOptions): string {
  const sections = Object.keys(categorized).length === 0
    ? ''
    : buildSections(categorized, options.headingLevel);

  const content = sections || options.emptyMessage;
  return replaceTemplate(options.template, content, options.tag, options.previousTag);
}
