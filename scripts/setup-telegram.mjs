// scripts/setup-telegram.mjs
// Setup Telegram Webhook & Menu Button for AniWalls

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.argv[2];
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || process.argv[3] || 'aniwalls_super_secret_webhook_key_2026';
const WORKER_URL = process.env.WORKER_URL || 'https://aniwalls-bot.ngphtrnam0987.workers.dev';

if (!BOT_TOKEN) {
  console.error('❌ Vui lòng cung cấp TELEGRAM_BOT_TOKEN!');
  console.log('Cách dùng: node scripts/setup-telegram.mjs <TELEGRAM_BOT_TOKEN> [WEBHOOK_SECRET]');
  process.exit(1);
}

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function main() {
  console.log('🚀 Đang cấu hình AniWalls Bot trên Telegram API...');

  // 1. Set Webhook
  const webhookUrl = `${WORKER_URL}/telegram/webhook`;
  console.log(`📡 Thiết lập Webhook đến: ${webhookUrl}`);

  const setWebhookRes = await fetch(`${API_BASE}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: WEBHOOK_SECRET,
      allowed_updates: ['message', 'callback_query']
    })
  });
  const webhookData = await setWebhookRes.json();
  console.log('Kết quả setWebhook:', webhookData);

  // 2. Set Chat Menu Button (Open Mini App)
  console.log('📱 Thiết lập Menu Button (Mini App)...');
  const setMenuRes = await fetch(`${API_BASE}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      menu_button: {
        type: 'web_app',
        text: '✨ Mini App',
        web_app: { url: WORKER_URL }
      }
    })
  });
  const menuData = await setMenuRes.json();
  console.log('Kết quả setChatMenuButton:', menuData);

  // 3. Set Bot Commands
  console.log('⌨️ Thiết lập danh sách lệnh bot...');
  const setCommandsRes = await fetch(`${API_BASE}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'start', description: 'Khởi động bot và xem hướng dẫn' },
        { command: 'search', description: 'Tìm kiếm hình nền anime' },
        { command: 'favorites', description: 'Xem bộ sưu tập yêu thích' },
        { command: 'history', description: 'Lịch sử tìm kiếm gần đây' },
        { command: 'help', description: 'Hướng dẫn sử dụng và bộ lọc' }
      ]
    })
  });
  const commandsData = await setCommandsRes.json();
  console.log('Kết quả setMyCommands:', commandsData);

  // 4. Verify getWebhookInfo
  console.log('🔍 Kiểm tra getWebhookInfo...');
  const getInfoRes = await fetch(`${API_BASE}/getWebhookInfo`);
  const infoData = await getInfoRes.json();
  console.log('Thông tin Webhook hiện tại:', JSON.stringify(infoData, null, 2));

  if (webhookData.ok) {
    console.log('\n🎉 THÀNH CÔNG! Bot AniWalls đã được kết nối với Cloudflare Worker!');
  }
}

main().catch(console.error);
