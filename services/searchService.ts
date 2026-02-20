import Fuse from 'fuse.js';

export interface Searchable {
  id: string;
  topic?: string;
  tags?: string[];
  summary?: string;
  searchText?: string;
  name?: string;
  description?: string;
}

export class SearchService {
  private fuse: Fuse<Searchable> | null = null;

  constructor(items: Searchable[]) {
    this.initialize(items);
  }

  private initialize(items: Searchable[]) {
    this.fuse = new Fuse(items, {
      keys: ['topic', 'tags', 'summary', 'searchText', 'name', 'description'],
      threshold: 0.3,
      includeScore: true,
    });
  }

  search(query: string): Searchable[] {
    if (!this.fuse || !query.trim()) return [];
    return this.fuse.search(query).map((result) => result.item);
  }

  update(items: Searchable[]) {
    this.initialize(items);
  }
}

export function createSearchService(items: Searchable[]): SearchService {
  return new SearchService(items);
}
