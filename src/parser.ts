export interface ParsedTitle {
  category: string;
  summary: string;
}

export type CategoryMap = Record<string, string>;

const DEFAULT_CATEGORY_MAP: CategoryMap = {
  feat: 'Features',
  fix: 'Fixes',
  chore: 'Chores',
  docs: 'Docs',
  refactor: 'Refactors',
  perf: 'Performance',
  build: 'Build',
  ci: 'CI',
  test: 'Tests',
  style: 'Style',
  deps: 'Dependencies'
};

export function buildCategoryMap(override?: string): CategoryMap {
  if (!override) return DEFAULT_CATEGORY_MAP;
  try {
    const parsed = JSON.parse(override) as CategoryMap;
    return {...DEFAULT_CATEGORY_MAP, ...parsed};
  } catch {
    throw new Error('Invalid JSON in category-map input.');
  }
}

export function parseTitle(title: string, categoryMap: CategoryMap): ParsedTitle | null {
  const match = title.match(/^([a-z][a-z-]*)(?:\([^)]*\))?(!)?:\s+(.+)/i);
  if (!match) return null;
  const [, rawType,, summary] = match;
  const normalizedType = rawType.toLowerCase();
  const fallbackType = normalizedType.split('-')[0];
  const category = categoryMap[normalizedType] ?? categoryMap[fallbackType] ?? 'Other';
  return {category, summary};
}
