import { TelegramInlineKeyboardMarkup, TelegramFile } from '@/shared/types/telegram';

export class TelegramService {
  private baseUrl: string;

  constructor(private botToken: string) {
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  async sendMessage(
    chatId: number | string,
    text: string,
    options?: {
      parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
      reply_markup?: TelegramInlineKeyboardMarkup;
      disable_web_page_preview?: boolean;
    }
  ): Promise<any> {
    const res = await fetch(`${this.baseUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options?.parse_mode || 'HTML',
        reply_markup: options?.reply_markup,
        disable_web_page_preview: options?.disable_web_page_preview ?? false
      })
    });
    return res.json();
  }

  async sendPhoto(
    chatId: number | string,
    photo: string, // URL or file_id
    options?: {
      caption?: string;
      parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
      reply_markup?: TelegramInlineKeyboardMarkup;
    }
  ): Promise<any> {
    const res = await fetch(`${this.baseUrl}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo,
        caption: options?.caption,
        parse_mode: options?.parse_mode || 'HTML',
        reply_markup: options?.reply_markup
      })
    });
    return res.json();
  }

  async sendDocumentWithFileId(
    chatId: number | string,
    fileId: string,
    options?: {
      caption?: string;
      parse_mode?: 'HTML' | 'Markdown';
      reply_markup?: TelegramInlineKeyboardMarkup;
    }
  ): Promise<any> {
    const res = await fetch(`${this.baseUrl}/sendDocument`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        document: fileId,
        caption: options?.caption,
        parse_mode: options?.parse_mode || 'HTML',
        reply_markup: options?.reply_markup
      })
    });
    return res.json();
  }

  async sendDocumentMultipart(
    chatId: number | string,
    fileBlob: Blob,
    filename: string,
    options?: {
      caption?: string;
      parse_mode?: 'HTML' | 'Markdown';
      reply_markup?: TelegramInlineKeyboardMarkup;
    }
  ): Promise<any> {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('document', fileBlob, filename);
    if (options?.caption) {
      formData.append('caption', options.caption);
    }
    if (options?.parse_mode) {
      formData.append('parse_mode', options.parse_mode);
    }
    if (options?.reply_markup) {
      formData.append('reply_markup', JSON.stringify(options.reply_markup));
    }

    const res = await fetch(`${this.baseUrl}/sendDocument`, {
      method: 'POST',
      body: formData
    });
    return res.json();
  }

  async editMessageCaption(
    chatId: number | string,
    messageId: number,
    caption: string,
    options?: {
      parse_mode?: 'HTML' | 'Markdown';
      reply_markup?: TelegramInlineKeyboardMarkup;
    }
  ): Promise<any> {
    const res = await fetch(`${this.baseUrl}/editMessageCaption`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        caption,
        parse_mode: options?.parse_mode || 'HTML',
        reply_markup: options?.reply_markup
      })
    });
    return res.json();
  }

  async editMessageReplyMarkup(
    chatId: number | string,
    messageId: number,
    replyMarkup?: TelegramInlineKeyboardMarkup
  ): Promise<any> {
    const res = await fetch(`${this.baseUrl}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: replyMarkup
      })
    });
    return res.json();
  }

  async editMessageMedia(
    chatId: number | string,
    messageId: number,
    media: {
      type: 'photo';
      media: string;
      caption?: string;
      parse_mode?: 'HTML' | 'Markdown';
    },
    replyMarkup?: TelegramInlineKeyboardMarkup
  ): Promise<any> {
    const res = await fetch(`${this.baseUrl}/editMessageMedia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        media,
        reply_markup: replyMarkup
      })
    });
    return res.json();
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    options?: {
      text?: string;
      show_alert?: boolean;
      url?: string;
    }
  ): Promise<any> {
    const res = await fetch(`${this.baseUrl}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: options?.text,
        show_alert: options?.show_alert ?? false,
        url: options?.url
      })
    });
    return res.json();
  }

  async getFile(fileId: string): Promise<TelegramFile | null> {
    const res = await fetch(`${this.baseUrl}/getFile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId })
    });
    const json = await res.json() as { ok: boolean; result?: TelegramFile };
    if (!json.ok || !json.result) return null;
    return json.result;
  }

  getFileDownloadUrl(filePath: string): string {
    return `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;
  }

  async setWebhook(url: string, secretToken: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        secret_token: secretToken,
        allowed_updates: ['message', 'callback_query']
      })
    });
    return res.json();
  }

  async getWebhookInfo(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/getWebhookInfo`);
    return res.json();
  }

  async setChatMenuButton(chatId?: number | string, menuButton?: { type: 'web_app'; text: string; web_app: { url: string } }): Promise<any> {
    const body: Record<string, unknown> = {};
    if (chatId) body.chat_id = chatId;
    if (menuButton) body.menu_button = menuButton;
    else body.menu_button = { type: 'default' };

    const res = await fetch(`${this.baseUrl}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  }
}
