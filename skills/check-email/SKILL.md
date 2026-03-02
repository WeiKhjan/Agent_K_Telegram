---
name: check-email
description: Check Gmail inbox for new or important emails. Use when user asks to check email or for daily email summaries.
---

Check the Atlas Gmail inbox (atlas.AiTraining2U@gmail.com) for emails.

## Steps

1. Use the `gmail` MCP server tools to search/read emails
2. Search for unread emails: `search_emails` with query `is:unread`
3. For each important email, use `read_email` to get full content
4. Summarize findings to user
5. **ALWAYS mark all fetched unread emails as read** using `batch_modify_emails` with `removeLabelIds: ["UNREAD"]` after presenting the summary

## Summary Format

Present emails as:
```
## Email Summary (DATE)

### Unread (COUNT)
1. **From:** sender | **Subject:** subject | **Time:** time
   **Summary:** 2-3 sentence concise summary of the email content — what was said, what was asked, any key details (amounts, dates, names).

### Action Required
- [email subject] — what needs to be done

### FYI Only
- [email subject] — brief note
```

> Always write a proper content summary, not just a subject repeat or vague preview.

## Arguments
- No args = check unread emails
- `$ARGUMENTS` = specific search query (e.g., "from:someone@example.com", "subject:invoice")

## Delivery
- Display summary in chat
- If user wants forwarding, use send-telegram skill to deliver to group chat
