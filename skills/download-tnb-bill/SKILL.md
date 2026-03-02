---
name: download-tnb-bill
description: Download TNB (Tenaga Nasional) electricity bills from myTNB portal using Playwright browser automation. Use when user asks to download TNB bill, check electricity bill, get TNB statement, or download utility bill.
---

## When to Use
When user asks to download TNB bill, check electricity bill, get TNB statement, download utility bill, or anything related to myTNB / Tenaga Nasional billing.

## Required Info
Collect these before starting (ask user if missing):
1. **Account number** (optional) — specific TNB account number. If not provided, download for ALL accounts in `TNB_ACCOUNT_NUMBERS` env var.
2. **Bill month** (optional) — defaults to latest bill.

## Credentials
All credentials are stored in environment variables (`.env`). **NEVER hardcode credentials in Playwright scripts.**

| Env Var | Purpose |
|---------|---------|
| `TNB_EMAIL` | myTNB login email/phone |
| `TNB_PASSWORD` | myTNB login password |
| `TNB_ACCOUNT_NUMBERS` | Comma-separated TNB account numbers (e.g. `220734510004,220734510005`) |

Read credentials at runtime:
```bash
cd ~/Agent_K_Telegram && node -e "require('dotenv').config(); console.log(process.env.TNB_EMAIL);"
```

## Approach: Playwright Browser Automation

Use the Playwright MCP tools to automate the myTNB portal. Do NOT use any API.

### Login Flow

1. **Navigate** to `https://myaccount.mytnb.com.my/`
2. **Wait** for the login form to load (look for email/phone input field)
3. **Read credentials** from env vars — use `browser_evaluate` to check or use `browser_fill_form`:
   - Email/Phone field: fill with `TNB_EMAIL` env var value
   - Password field: fill with `TNB_PASSWORD` env var value
4. **Click Login** button
5. **Handle announcement modal** — myTNB often shows a Bootstrap modal popup (`modal-announcement`). Dismiss it by clicking the close button (X) or "Close" button before proceeding.
6. **Verify login success** — use `browser_snapshot` to confirm you're on the dashboard

### Download Bill Flow

1. **Navigate to billing** — after login, look for "View Bill" or "Billing" section on the dashboard
2. **Account selection** — if multiple accounts exist:
   - Use the account dropdown/selector to switch between accounts
   - Account numbers are in `TNB_ACCOUNT_NUMBERS` env var (comma-separated)
   - If user specified a specific account, select only that one
   - If no specific account requested, iterate through all accounts
3. **Find the bill** — look for "View Bill", "Download Bill", or PDF icon for the latest bill
4. **Download the PDF** — use `browser_run_code` to intercept the PDF download:
   ```javascript
   async (page) => {
     const fs = require('fs');
     const path = require('path');

     // Click the download/view bill button and wait for download
     const [download] = await Promise.all([
       page.waitForEvent('download', { timeout: 30000 }),
       page.click('SELECTOR_FOR_DOWNLOAD_BUTTON')
     ]);

     const suggestedName = download.suggestedFilename();
     const savePath = path.join(process.env.HOME, 'Downloads', `TNB_Bill_${accountNumber}_${billMonth}.pdf`);
     await download.saveAs(savePath);
     return savePath;
   }
   ```

   **Alternative approach** — if no download event (PDF opens in new tab):
   ```javascript
   async (page) => {
     const fs = require('fs');
     // If PDF opens in a new tab, get the PDF URL and fetch it
     const pages = page.context().pages();
     const pdfPage = pages[pages.length - 1];
     const pdfUrl = pdfPage.url();

     const response = await pdfPage.goto(pdfUrl);
     const buffer = await response.body();
     const savePath = `${process.env.HOME}/Downloads/TNB_Bill_ACCOUNT_DATE.pdf`;
     fs.writeFileSync(savePath, buffer);
     return savePath;
   }
   ```

5. **Save file** with naming convention: `~/Downloads/TNB_Bill_{AccountNumber}_{MonthYear}.pdf`

### Post-Download

1. **Close browser** after all bills are downloaded
2. **Deliver files** to user via Telegram using the send-file skill pattern:
   ```bash
   cd ~/Agent_K_Telegram && node -e "
   const { Telegraf } = require('telegraf');
   require('dotenv').config();
   const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
   const chatId = process.env.TELEGRAM_DM_CHAT_ID;
   bot.telegram.sendDocument(chatId, { source: 'PDF_FILE_PATH' }, { caption: 'TNB Bill - Account XXXXX - Month Year' })
     .then(() => { console.log('Sent'); process.exit(0); })
     .catch(e => { console.error(e); process.exit(1); });
   "
   ```

### Critical Rules

1. **NEVER hardcode credentials** — always read `TNB_EMAIL` and `TNB_PASSWORD` from environment variables via dotenv
2. **Handle the announcement modal** — myTNB portal frequently shows a modal popup on login. Always check for and dismiss it before proceeding.
3. **Be patient with slow pages** — myTNB site can be slow. Use `browser_wait_for` with generous timeouts (up to 30 seconds per page).
4. **Use browser_snapshot after every action** — verify page state before clicking to avoid wrong elements.
5. **Handle maintenance windows** — myTNB goes offline for maintenance (typically midnight-1AM). If you encounter a maintenance page, inform the user and suggest retrying later.
6. **Multiple accounts** — iterate through all accounts in `TNB_ACCOUNT_NUMBERS` unless user specifies one.
7. **File naming** — use `TNB_Bill_{AccountNumber}_{MonthYear}.pdf` format for easy identification.

## Troubleshooting

- **Login fails**: Check if credentials in `.env` are correct. myTNB may require phone number format (e.g. `+60123456789`).
- **Modal blocks interaction**: Look for close button with class `close` or `btn-close` in the modal. Try clicking it. If that fails, use `browser_evaluate` to remove the modal: `document.querySelector('.modal-announcement').remove()`
- **PDF won't download**: Try `browser_run_code` approach to intercept download event. If that fails, take a screenshot of the bill page as fallback.
- **Account not found in dropdown**: Verify account number matches exactly what's in myTNB. Check for leading zeros.
- **Site under maintenance**: myTNB maintenance is usually midnight-1:30AM MYT. Inform user and retry after maintenance window.
- **Session timeout**: myTNB sessions expire quickly. If actions fail after login, re-navigate to the login page and log in again.
