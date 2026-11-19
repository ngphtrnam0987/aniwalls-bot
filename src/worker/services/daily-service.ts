import { DbClient } from '../db/client';
import { TelegramService } from './telegram-service';
import { SearchEngine } from '../providers';

export class DailyWallpaperService {
  constructor(
    private db: DbClient,
    private telegram: TelegramService,
    private searchEngine: SearchEngine,
    private miniAppUrl?: string
  ) {}

  async processDailyDeliveries(): Promise<{ sent: number; skipped: number; errors: number }> {
    return { sent: 0, skipped: 0, errors: 0 };
  }
}
