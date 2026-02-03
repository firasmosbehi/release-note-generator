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
  refactor: 'Refactors'
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
  const match = title.match(/^(\w+)(?:\([^)]*\))?:\s+(.+)/);
  if (!match) return null;
  const [, type, summary] = match;
  const category = categoryMap[type.toLowerCase()] ?? 'Other';
  return {category, summary};
}
