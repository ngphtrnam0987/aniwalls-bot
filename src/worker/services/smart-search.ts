import { OrientationFilter, ResolutionFilter, SearchFilters, Wallpaper } from '@/shared/types/wallpaper';
import { SmartSearchParsed, SmartSearchResult } from '@/shared/types/api';
import { SmartSearchOutputSchema } from '@/shared/schemas/search';
import { SearchEngine } from '../providers';

function hasPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'iu');
  return regex.test(text);
}

function hasAnyPhrase(text: string, phrases: string[]): boolean {
  return phrases.some((p) => hasPhrase(text, p));
}

export class SmartSearchService {
  constructor(private aiBinding?: { run(model: string, input: any): Promise<any> }) {}

  /**
   * Deterministic rule-based parser that interprets Vietnamese and English descriptions.
   */
  parseDeterministic(rawQuery: string): SmartSearchParsed {
    const q = rawQuery.toLowerCase().trim();

    // 1. Resolution detection
    let resolution: ResolutionFilter = 'all';
    if (hasAnyPhrase(q, ['8k', '4320p'])) {
      resolution = '8k';
    } else if (hasAnyPhrase(q, ['4k', 'uhd', '2160p', '3840x2160'])) {
      resolution = '4k';
    } else if (hasAnyPhrase(q, ['2k', 'qhd', '1440p', '2560x1440'])) {
      resolution = '2k';
    } else if (hasAnyPhrase(q, ['1080p', 'fhd', 'full hd', '1920x1080'])) {
      resolution = '1080p';
    }

    // 2. Orientation detection
    let orientation: OrientationFilter = 'all';
    if (hasAnyPhrase(q, ['ultrawide', '21:9', 'siêu rộng', 'màn hình dài'])) {
      orientation = 'ultrawide';
    } else if (hasAnyPhrase(q, ['desktop', 'pc', 'máy tính', 'landscape', 'ngang', '16:9'])) {
      orientation = 'landscape';
    } else if (hasAnyPhrase(q, ['mobile', 'phone', 'điện thoại', 'portrait', 'dọc', '9:16', 'tai thỏ'])) {
      orientation = 'portrait';
    } else if (hasAnyPhrase(q, ['square', 'vuông', '1:1'])) {
      orientation = 'square';
    }

    // 3. Colors detection
    const colors: string[] = [];
    const colorItems: Array<{ phrases: string[]; val: string }> = [
      { phrases: ['xanh dương', 'xanh biển', 'blue'], val: 'blue' },
      { phrases: ['xanh lá', 'green'], val: 'green' },
      { phrases: ['đỏ', 'red'], val: 'red' },
      { phrases: ['tím', 'purple', 'violet'], val: 'purple' },
      { phrases: ['hồng', 'pink'], val: 'pink' },
      { phrases: ['vàng', 'yellow'], val: 'yellow' },
      { phrases: ['cam', 'orange'], val: 'orange' },
      { phrases: ['đen', 'tối', 'black', 'dark'], val: 'dark' },
      { phrases: ['trắng', 'sáng', 'white', 'light'], val: 'light' },
      { phrases: ['neon'], val: 'neon' },
      { phrases: ['pastel'], val: 'pastel' }
    ];

    for (const item of colorItems) {
      if (hasAnyPhrase(q, item.phrases) && !colors.includes(item.val)) {
        colors.push(item.val);
      }
    }

    // 4. Themes & Scenery detection
    const themes: string[] = [];
    const themeItems: Array<{ phrases: string[]; val: string }> = [
      { phrases: ['cyberpunk', 'sci-fi', 'viễn tưởng'], val: 'cyberpunk' },
      { phrases: ['thành phố', 'city', 'đô thị', 'urban'], val: 'city' },
      { phrases: ['mưa', 'trời mưa', 'rain', 'rainy'], val: 'rain' },
      { phrases: ['tuyết', 'snow'], val: 'snow' },
      { phrases: ['đêm', 'buổi đêm', 'ban đêm', 'night'], val: 'night' },
      { phrases: ['hoàng hôn', 'sunset'], val: 'sunset' },
      { phrases: ['bình minh', 'sunrise'], val: 'sunrise' },
      { phrases: ['vũ trụ', 'ngân hà', 'sao', 'space', 'galaxy', 'stars', 'cosmos'], val: 'space' },
      { phrases: ['phong cảnh', 'thiên nhiên', 'scenery', 'nature', 'landscape'], val: 'scenery' },
      { phrases: ['hoa anh đào', 'sakura', 'cherry blossom'], val: 'sakura' },
      { phrases: ['biển', 'đại dương', 'sea', 'ocean', 'beach'], val: 'ocean' },
      { phrases: ['tối giản', 'minimal', 'minimalist'], val: 'minimal' },
      { phrases: ['mặt trăng', 'moon'], val: 'moon' }
    ];

    for (const item of themeItems) {
      if (hasAnyPhrase(q, item.phrases) && !themes.includes(item.val)) {
        themes.push(item.val);
      }
    }

    // 5. Negative filters
    const negativeKeywords: string[] = [];
    if (hasAnyPhrase(q, ['không có người', 'không người', 'không nhân vật', 'nobody', 'no people', 'scenery only'])) {
      negativeKeywords.push('people');
      if (!themes.includes('scenery')) themes.push('scenery');
    }
    if (hasAnyPhrase(q, ['không chữ', 'no text'])) {
      negativeKeywords.push('text');
    }

    // 6. Keywords normalization
    let clean = q;

    // First map common Vietnamese descriptive phrases to English tags
    const viToEnWords: Record<string, string> = {
      'ban đêm': 'night',
      'buổi đêm': 'night',
      'buổi sáng': 'morning',
      'buổi chiều': 'afternoon',
      'phong cảnh': 'scenery',
      'thiên nhiên': 'nature',
      'thành phố': 'city',
      'đêm': 'night',
      'mưa': 'rain',
      'tuyết': 'snow',
      'hoàng hôn': 'sunset',
      'bình minh': 'sunrise',
      'vũ trụ': 'space',
      'ngân hà': 'galaxy',
      'biển': 'ocean',
      'đại dương': 'ocean',
      'hoa anh đào': 'sakura',
      'mặt trăng': 'moon',
      'mây': 'clouds',
      'bầu trời': 'sky',
      'nắng': 'sunlight',
      'tối': 'dark',
      'sáng': 'light',
      'cô gái': 'anime girl',
      'chàng trai': 'anime boy',
      'mèo': 'cat',
      'hoa': 'flowers',
      'rừng': 'forest',
      'núi': 'mountain'
    };

    for (const [vi, en] of Object.entries(viToEnWords)) {
      const escaped = vi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'giu');
      clean = clean.replace(reg, `$1${en}$2`);
    }

    // Next strip non-keyword/filter tokens
    const stripPhrases = [
      'tìm kiếm', 'hình nền', 'wallpaper', 'ảnh nền', 'hãy tìm', 'cho tôi', 'bức ảnh', 'tấm ảnh',
      '8k', '4k', '2k', '1080p', 'uhd', 'fhd', 'qhd', 'full hd', '3840x2160', '1920x1080',
      'cho máy tính', 'cho pc', 'cho điện thoại', 'desktop', 'mobile', 'phone', 'ngang', 'dọc', 'ultrawide',
      'độ phân giải', 'tỷ lệ', 'chất lượng cao', 'sắc nét',
      'không có người', 'không người', 'không chữ', 'nobody', 'no people'
    ];

    for (const phrase of stripPhrases) {
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'giu');
      clean = clean.replace(reg, ' ');
    }
    clean = clean.replace(/\s+/g, ' ').trim();

    // Fallback keywords if clean string is empty
    let finalKeywords = clean;
    if (!finalKeywords) {
      const combined = [...themes, ...colors];
      finalKeywords = combined.length > 0 ? combined.join(' ') : 'anime scenery';
    }

    // 7. Human explanation
    const parts: string[] = [];
    if (resolution !== 'all') parts.push(`độ phân giải ${resolution.toUpperCase()}`);
    if (orientation === 'landscape') parts.push('dành cho máy tính (16:9)');
    else if (orientation === 'portrait') parts.push('dành cho điện thoại (9:16)');
    else if (orientation === 'ultrawide') parts.push('màn hình siêu rộng (21:9)');

    if (colors.length > 0) parts.push(`tông màu ${colors.join(', ')}`);
    if (themes.length > 0) parts.push(`chủ đề ${themes.join(', ')}`);
    if (negativeKeywords.length > 0) parts.push(`loại bỏ (${negativeKeywords.join(', ')})`);

    const explanation = parts.length > 0
      ? `Đã nhận diện: ${parts.join('; ')}`
      : `Tìm kiếm từ khóa: ${finalKeywords}`;

    return {
      keywords: finalKeywords,
      orientation,
      resolution,
      colors,
      themes,
      negativeKeywords,
      explanation,
      isAiGenerated: false
    };
  }

  /**
   * Interpret natural language query using Cloudflare Workers AI with fallback to deterministic parser.
   */
  async interpretQuery(rawQuery: string): Promise<SmartSearchParsed> {
    if (!this.aiBinding || typeof this.aiBinding.run !== 'function') {
      return this.parseDeterministic(rawQuery);
    }

    try {
      const systemPrompt = `You are an AI assistant for AniWalls, an anime wallpaper search engine.
Analyze the user's natural language request (in Vietnamese or English) and extract structured search parameters.
Respond ONLY with a valid JSON object matching this schema:
{
  "keywords": "string containing English search keywords for wallpaper engine (e.g. 'cyberpunk city rain')",
  "orientation": "all" | "landscape" | "portrait" | "ultrawide" | "square",
  "resolution": "all" | "1080p" | "2k" | "4k" | "8k",
  "colors": ["list", "of", "colors"],
  "themes": ["list", "of", "themes"],
  "negativeKeywords": ["list", "of", "negatives"],
  "explanation": "Brief explanation in Vietnamese of what was understood"
}
Do not include any surrounding markdown fences or extra text, just raw JSON.`;

      const userPrompt = `User request: "${rawQuery}"`;

      // 3000ms timeout for AI response
      const aiPromise = this.aiBinding.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 300,
        temperature: 0.1
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI inference timeout')), 3000)
      );

      const aiResponse = (await Promise.race([aiPromise, timeoutPromise])) as any;

      let textOutput = '';
      if (typeof aiResponse === 'string') {
        textOutput = aiResponse;
      } else if (aiResponse?.response) {
        textOutput = aiResponse.response;
      } else if (aiResponse?.choices?.[0]?.message?.content) {
        textOutput = aiResponse.choices[0].message.content;
      }

      // Clean markdown code blocks if model wrapped output in ```json ... ```
      textOutput = textOutput.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

      const parsedJson = JSON.parse(textOutput);
      const validated = SmartSearchOutputSchema.parse(parsedJson);

      return {
        ...validated,
        isAiGenerated: true
      };
    } catch (err) {
      console.warn('SmartSearch AI error or timeout, falling back to deterministic parser:', err);
      return this.parseDeterministic(rawQuery);
    }
  }

  /**
   * Complete smart search: interprets query and executes search via SearchEngine.
   */
  async search(
    rawQuery: string,
    searchEngine: SearchEngine,
    options?: { page?: number; limit?: number }
  ): Promise<SmartSearchResult> {
    const parsed = await this.interpretQuery(rawQuery);

    const searchFilters: SearchFilters = {
      query: parsed.keywords,
      orientation: parsed.orientation,
      resolution: parsed.resolution,
      page: options?.page || 1,
      limit: options?.limit || 20,
      sort: 'relevance',
      sfwOnly: true
    };

    try {
      const searchRes = await searchEngine.search(searchFilters);

      return {
        success: true,
        parsed,
        wallpapers: searchRes.wallpapers,
        totalEstimate: searchRes.totalEstimate
      };
    } catch (err: any) {
      console.error('SmartSearch search execution error:', err);
      return {
        success: false,
        parsed,
        wallpapers: [],
        message: err?.message || 'Lỗi khi tìm kiếm hình nền bằng Smart Search.'
      };
    }
  }
}
