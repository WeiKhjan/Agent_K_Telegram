const isUserAllowed = (userId) => {
  const ids = (process.env.ALLOWED_TELEGRAM_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
  // If no IDs configured, allow everyone
  if (ids.length === 0) return true;
  return ids.includes(userId);
};

const splitMessage = (msg, max = 4000) => {
  if (!msg || msg.length <= max) return [msg || 'No response'];
  const chunks = [];
  let rest = msg;
  while (rest.length > 0) {
    if (rest.length <= max) { chunks.push(rest); break; }
    let i = rest.lastIndexOf('\n', max);
    if (i < max / 2) i = rest.lastIndexOf(' ', max);
    if (i < max / 2) i = max;
    chunks.push(rest.slice(0, i));
    rest = rest.slice(i).trimStart();
  }
  return chunks;
};

const markdownToHtml = (text) => {
  if (!text) return text;

  // First, convert markdown tables to readable format (before HTML escaping)
  text = convertTablesToReadable(text);

  // Clean any remaining table artifacts
  text = cleanTableRemnants(text);

  // Clean up excessive whitespace and blank lines
  text = text.replace(/\n{3,}/g, '\n\n');

  // Escape HTML entities but preserve our formatting tags
  text = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Restore our formatting tags that were added by convertTablesToReadable
  text = text
    .replace(/&lt;b&gt;/g, '<b>')
    .replace(/&lt;\/b&gt;/g, '</b>')
    .replace(/&lt;i&gt;/g, '<i>')
    .replace(/&lt;\/i&gt;/g, '</i>')
    .replace(/&lt;u&gt;/g, '<u>')
    .replace(/&lt;\/u&gt;/g, '</u>')
    .replace(/&lt;pre&gt;/g, '<pre>')
    .replace(/&lt;\/pre&gt;/g, '</pre>');

  // Apply markdown formatting — but skip inside <pre> blocks
  const applyMarkdown = (t) => t
    // Code blocks (markdown ```)
    .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre>$2</pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/__(.+?)__/g, '<b>$1</b>')
    // Italic
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<i>$1</i>')
    .replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<i>$1</i>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Headers - convert to bold with newline
    .replace(/^#{1,6}\s+(.+)$/gm, '\n<b>$1</b>')
    // Bullet points - cleaner bullets
    .replace(/^(\s*)[-*]\s+/gm, '$1• ')
    // Numbered lists - keep numbers for clarity
    .replace(/^(\s*)(\d+)\.\s+/gm, '$1$2. ')
    // Horizontal rules
    .replace(/^[-*_]{3,}$/gm, '───────────')
    // Clean up any remaining excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Split by <pre> blocks, only apply markdown to non-pre parts
  const preParts = text.split(/(<pre>[\s\S]*?<\/pre>)/g);
  text = preParts.map(part =>
    part.startsWith('<pre>') ? part : applyMarkdown(part)
  ).join('');

  // Final cleanup: remove any leftover raw pipe-only lines or table separators (outside <pre>)
  const finalParts = text.split(/(<pre>[\s\S]*?<\/pre>)/g);
  text = finalParts.map(part => {
    if (part.startsWith('<pre>')) return part;
    return part
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        if (/^[\|\-\s:]+$/.test(trimmed) && trimmed.includes('|')) return false;
        if (/^[-─]+$/.test(trimmed)) return false;
        return true;
      })
      .join('\n');
  }).join('');

  // Clean up spacing around formatted entries
  text = text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');

  return text;
};

// Format calendar/event entries more nicely
const formatCalendarEntry = (title, date, status) => {
  const statusEmoji = status?.toLowerCase().includes('accept') ? '✅' :
                      status?.toLowerCase().includes('decline') ? '❌' :
                      status?.toLowerCase().includes('tentative') ? '❓' : '📅';
  return `${statusEmoji} <b>${title}</b>\n   📆 ${date}\n   ${status}`;
};

// Check if a line is a table separator (|---|---|)
const isTableSeparator = (line) => {
  const trimmed = line.trim();
  if (!trimmed.includes('-')) return false;
  // Remove pipes, dashes, colons, and spaces - if nothing left, it's a separator
  const remaining = trimmed.replace(/[\|\-:\s]/g, '');
  return remaining.length === 0;
};

// Check if a line looks like a table row
const isTableRow = (line) => {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return false;
  if (isTableSeparator(line)) return false;
  const pipeCount = (trimmed.match(/\|/g) || []).length;
  // Need at least 1 pipe for a valid table row
  return pipeCount >= 1;
};

// Parse a table row into cells
const parseTableRow = (row) => {
  let cleaned = row.trim();
  if (cleaned.startsWith('|')) cleaned = cleaned.slice(1);
  if (cleaned.endsWith('|')) cleaned = cleaned.slice(0, -1);
  return cleaned.split('|').map(cell => cell.trim());
};

// Convert markdown tables to monospace <pre> blocks with aligned columns
const convertTablesToReadable = (text) => {
  const lines = text.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check if this looks like a table row or separator
    if (isTableRow(line) || isTableSeparator(line)) {
      let headerLine = null;
      const dataRows = [];

      // Collect all consecutive table-related lines
      while (i < lines.length) {
        const currentLine = lines[i];
        if (isTableSeparator(currentLine)) {
          // Line before separator is the header
          if (dataRows.length === 1 && !headerLine) {
            headerLine = dataRows.shift();
          }
          i++;
          continue;
        }
        if (isTableRow(currentLine)) {
          dataRows.push(currentLine.trim());
          i++;
        } else {
          break;
        }
      }

      // Parse all rows
      const headerCells = headerLine ? parseTableRow(headerLine) : null;
      const parsedRows = dataRows.map(r => parseTableRow(r));

      // If no separator found, check if first row looks like headers
      if (!headerCells && parsedRows.length > 1) {
        const firstRow = parsedRows[0];
        const looksLikeHeader = firstRow.some(h =>
          /^(event|date|status|name|title|id|type|time|description|value|action|result|count|total|item|category|no|invoice|client|amount|qty|price|rate)$/i.test(h.replace(/[.#]/g, ''))
        );
        if (looksLikeHeader) {
          // Treat first row as header
          const hdr = parsedRows.shift();
          return convertTablesToReadable(
            [...result, buildMonoTable(hdr, parsedRows), ...lines.slice(i)].join('\n')
          );
        }
      }

      if (headerCells && parsedRows.length > 0) {
        result.push(buildMonoTable(headerCells, parsedRows));
      } else if (parsedRows.length > 0) {
        // No header — just format as aligned pre block
        result.push(buildMonoTable(null, parsedRows));
      }
      continue;
    }

    result.push(line);
    i++;
  }

  return result.join('\n');
};

// Build a monospace table wrapped in <pre> tags
const buildMonoTable = (headers, rows) => {
  const allRows = headers ? [headers, ...rows] : rows;
  const colCount = Math.max(...allRows.map(r => r.length));

  // Calculate max width for each column
  const colWidths = [];
  for (let c = 0; c < colCount; c++) {
    colWidths[c] = Math.max(...allRows.map(r => (r[c] || '').length));
  }

  // Cap individual column widths to keep tables readable
  for (let c = 0; c < colCount; c++) {
    colWidths[c] = Math.min(colWidths[c], 30);
  }

  // Truncate cell to fit width
  const fitCell = (text, width) => {
    if (text.length <= width) return text.padEnd(width);
    return text.slice(0, width - 1) + '…';
  };

  const formatRow = (cells) =>
    cells.map((cell, c) => fitCell(cell || '', colWidths[c] || 0)).join(' │ ');

  const separator = colWidths.map(w => '─'.repeat(w)).join('─┼─');

  const outputLines = [];
  if (headers) {
    outputLines.push(formatRow(headers));
    outputLines.push(separator);
  }
  for (const row of rows) {
    outputLines.push(formatRow(row));
  }

  return `\n<pre>\n${outputLines.join('\n')}\n</pre>\n`;
};

// Remove any raw markdown table remnants that slipped through
const cleanTableRemnants = (text) => {
  // Don't touch content inside <pre> blocks
  const parts = text.split(/(<pre>[\s\S]*?<\/pre>)/g);
  return parts.map(part => {
    if (part.startsWith('<pre>')) return part;
    return part
      .split('\n')
      .map(line => {
        if (line.includes('|') && !line.includes('<')) {
          const cells = parseTableRow(line).filter(c => c.trim());
          if (cells.length > 0) return cells.join(' · ');
          return '';
        }
        return line;
      })
      .filter(line => {
        const trimmed = line.trim();
        if (/^[\|\-\s:─]+$/.test(trimmed) && trimmed.length > 2) return false;
        return true;
      })
      .join('\n');
  }).join('');
};

module.exports = { isUserAllowed, splitMessage, markdownToHtml, formatCalendarEntry };
