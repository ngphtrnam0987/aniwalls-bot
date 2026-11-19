import { describe, it, expect } from 'vitest';
import { SmartSearchService } from '../src/worker/services/smart-search';

describe('Smart Search & Natural Language Query Interpreter', () => {
  const service = new SmartSearchService(); // without AI binding -> deterministic parser

  it('1. should extract 4K resolution, landscape orientation and cyberpunk theme from Vietnamese query', () => {
    const query = 'hình nền thành phố cyberpunk ban đêm 4k cho máy tính';
    const parsed = service.parseDeterministic(query);

    expect(parsed.resolution).toBe('4k');
    expect(parsed.orientation).toBe('landscape');
    expect(parsed.themes).toContain('cyberpunk');
    expect(parsed.themes).toContain('city');
    expect(parsed.themes).toContain('night');
    expect(parsed.keywords).toContain('cyberpunk');
    expect(parsed.explanation).toContain('4K');
    expect(parsed.explanation).toContain('máy tính');
  });

  it('2. should extract mobile orientation and sakura / rain theme from Vietnamese query', () => {
    const query = 'cô gái anime dưới trời mưa hoa anh đào điện thoại';
    const parsed = service.parseDeterministic(query);

    expect(parsed.orientation).toBe('portrait');
    expect(parsed.themes).toContain('rain');
    expect(parsed.themes).toContain('sakura');
    expect(parsed.keywords).toContain('rain');
  });

  it('3. should extract ultrawide and colors correctly', () => {
    const query = 'vũ trụ ngân hà tông màu tím xanh dương 21:9';
    const parsed = service.parseDeterministic(query);

    expect(parsed.orientation).toBe('ultrawide');
    expect(parsed.themes).toContain('space');
    expect(parsed.colors).toContain('purple');
    expect(parsed.colors).toContain('blue');
  });

  it('4. should handle negative keywords (không có người / nobody)', () => {
    const query = 'phong cảnh núi tuyết không có người 2k';
    const parsed = service.parseDeterministic(query);

    expect(parsed.resolution).toBe('2k');
    expect(parsed.negativeKeywords).toContain('people');
    expect(parsed.themes).toContain('scenery');
  });

  it('5. should parse English natural language queries cleanly', () => {
    const query = 'neon rain city street 4k desktop wallpaper';
    const parsed = service.parseDeterministic(query);

    expect(parsed.resolution).toBe('4k');
    expect(parsed.orientation).toBe('landscape');
    expect(parsed.colors).toContain('neon');
    expect(parsed.themes).toContain('rain');
    expect(parsed.themes).toContain('city');
  });

  it('6. should fall back safely to deterministic parser when AI is unavailable or fails', async () => {
    const faultyAi = {
      run: async () => {
        throw new Error('AI service unavailable');
      }
    };
    const aiService = new SmartSearchService(faultyAi);
    const parsed = await aiService.interpretQuery('hoàng hôn biển 4k pc');

    expect(parsed.resolution).toBe('4k');
    expect(parsed.orientation).toBe('landscape');
    expect(parsed.themes).toContain('sunset');
    expect(parsed.themes).toContain('ocean');
    expect(parsed.isAiGenerated).toBe(false);
  });
});
