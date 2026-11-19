import { describe, it, expect } from 'vitest';
import { SearchEngine } from '@/worker/providers';

describe('Search Engine Deduplication and Aggregation', () => {
  it('should initialize with registered providers', () => {
    const engine = new SearchEngine();
    expect(engine).toBeDefined();
  });

  it('should handle getById format routing', async () => {
    const engine = new SearchEngine();
    const res = await engine.getById('non_existent_provider_id');
    expect(res).toBeNull();
  });
});
