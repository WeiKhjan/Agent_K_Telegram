const { Telegraf } = require('telegraf');
const fs = require('fs');
require('dotenv').config({ path: '/Users/aitraining2u/Agent_K_Telegram/.env' });

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const chatId = process.env.TELEGRAM_GROUP_CHAT_ID;

const files = [
  "/tmp/carousel_v3/slide1.jpg",
  "/tmp/carousel_v3/slide2.jpg",
  "/tmp/carousel_v3/slide3.jpg",
  "/tmp/carousel_v3/slide4.jpg",
  "/tmp/carousel_v3/slide5.jpg",
  "/tmp/carousel_v3/slide6.jpg",
];

(async () => {
  const media = files.map((f, i) => ({
    type: 'photo',
    media: { source: fs.readFileSync(f) },
    ...(i === 0 ? { caption: 'aitraining2u.com — AI Agents carousel' } : {}),
  }));

  await bot.telegram.sendMediaGroup(chatId, media);
  console.log('Sent album to group.');
  process.exit(0);
})();
