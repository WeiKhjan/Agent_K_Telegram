---
name: send-email
description: Send emails via Gmail API with proper display name, attachments, and CC support. Use when asked to send, email, forward, follow up, remind, or reply to someone via email. For follow-ups, automatically searches sent emails and replies in the same thread.
---

# Send Email

Send emails via Gmail API using the custom Python script (NOT Gmail MCP — MCP strips the From display name).

## Usage — New Email

```bash
~/.local/bin/uv run --with google-api-python-client --with google-auth \
  python3 ~/Agent_K_Telegram/skills/send-email/scripts/send_email.py \
  --to recipient@example.com \
  --subject "Subject line" \
  --html '<h1>Hello</h1><p>Body here</p>' \
  --cc cc1@example.com cc2@example.com \
  --attach /path/to/file.pdf
```

## Usage — Follow-Up / Reply in Thread

**ALWAYS use this flow** when the task involves following up, reminding, replying, or continuing a previous email conversation. This ensures the recipient sees the full email history.

### Step 1: Search for the last sent email
Use Gmail MCP `search_emails` to find the original sent email:
```
search_emails → query: "in:sent to:recipient@example.com subject:keyword"
```
- Use `in:sent` to find emails YOU sent
- Add subject keywords or recipient to narrow results
- If unsure of subject, just search by recipient: `"in:sent to:recipient@example.com"`

### Step 2: Read the email to get thread info + content
```
read_email → messageId: "<message_id from search>"
```
From the result, extract:
- **threadId** — the Gmail thread ID (for threading)
- **Message-ID** header — the RFC 2822 Message-ID, looks like `<CAxxxxxx@mail.gmail.com>` (for In-Reply-To)
- **Subject** — the original subject line (prepend `Re: ` if not already there)
- **To / CC recipients** — for reply-all, include all original recipients

### Step 3: Send reply in same thread
```bash
~/.local/bin/uv run --with google-api-python-client --with google-auth \
  python3 ~/Agent_K_Telegram/skills/send-email/scripts/send_email.py \
  --to recipient@example.com \
  --subject "Re: Original Subject" \
  --html '<p>Follow-up body here</p>' \
  --thread-id "18dxxxxxx" \
  --in-reply-to "<CAxxxxxx@mail.gmail.com>" \
  --cc cc1@example.com
```

### Threading Rules
- Subject **MUST** start with `Re: ` followed by the original subject
- Both `--thread-id` and `--in-reply-to` are **required** for proper threading
- **Reply-all by default** — include all original To/CC recipients so everyone stays in the loop
- The reply will appear in the same Gmail thread, so the recipient sees the full conversation history

## Usage — Calendar Invitation

Send a proper Google Calendar invite that shows up as an event in the recipient's calendar.

### Step 1: Generate the .ics file

Write a valid iCalendar (.ics) file with all required fields. Example:

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//AiTraining2U//Atlas//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VTIMEZONE
TZID:Asia/Kuala_Lumpur
BEGIN:STANDARD
DTSTART:19700101T000000
TZOFFSETFROM:+0800
TZOFFSETTO:+0800
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:unique-id-here@aitraining2u.com
DTSTAMP:20260301T120000Z
DTSTART;TZID=Asia/Kuala_Lumpur:20260315T140000
DTEND;TZID=Asia/Kuala_Lumpur:20260315T160000
SUMMARY:Meeting Title
DESCRIPTION:Meeting description here
LOCATION:Meeting Room / Zoom link
ORGANIZER;CN=Atlas (AiTraining2U):mailto:atlas.aitraining2u@gmail.com
ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:person@example.com
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR
```

**Required fields**: UID (unique per event), DTSTAMP, DTSTART, DTEND, SUMMARY, METHOD:REQUEST, ORGANIZER, ATTENDEE(s), VTIMEZONE.

### Step 2: Send with --ics flag

```bash
~/.local/bin/uv run --with google-api-python-client --with google-auth \
  python3 ~/Agent_K_Telegram/skills/send-email/scripts/send_email.py \
  --to person@example.com \
  --subject "Meeting: Title — Date & Time" \
  --html '<h2>You are invited!</h2><p>Details here...</p>' \
  --ics @/tmp/invitation.ics
```

The `--ics` flag accepts either:
- `@/path/to/file.ics` — reads .ics content from a file
- Raw iCalendar string (inline)

The script will:
1. Embed the calendar as a `text/calendar; method=REQUEST` MIME part (triggers Gmail's calendar UI)
2. Attach the .ics file for manual import in other clients

## Arguments

| Arg | Required | Description |
|-----|----------|-------------|
| `--to` | Yes | Recipient email(s), space-separated |
| `--subject` | Yes | Email subject line |
| `--html` | Yes | HTML body string, or `@file.html` to read from file |
| `--cc` | No | CC recipients, space-separated. Default: use `$CC_EMAILS` from env |
| `--attach` | No | File path(s) to attach, space-separated |
| `--reply-to` | No | Reply-To address if different from sender |
| `--thread-id` | No | Gmail thread ID — reply lands in same thread |
| `--in-reply-to` | No | Message-ID header of the email being replied to |
| `--ics` | No | iCalendar content string or `@file.ics` — sends as calendar invitation |

## From Header

Emails are sent as: **Atlas (AiTraining2U) <atlas.aitraining2u@gmail.com>**

Configured via `$FROM_NAME` and `$FROM_EMAIL` env vars.

## Why Not Gmail MCP?

The Gmail MCP server (`@gongrzhe/server-gmail-autoauth-mcp`) strips the display name from the From header, sending as bare `atlas.aitraining2u@gmail.com`. The custom script preserves `Atlas (AiTraining2U)` as the sender name.

## OAuth Credentials

- Token: `~/.gmail-mcp/credentials.json`
- Keys: `~/.gmail-mcp/gcp-oauth.keys.json`
- Auto-refreshes expired tokens
