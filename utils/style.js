/**
 * VIRALBOT MINI — Boxed Format UI v2
 *
 *   ┏▣ /////◈ *TITLE* ◈
 *   ┃
 *   ┃  👋 *User:* drey
 *   ┃  ⚡ *Prefix:* [ . ]
 *   ┃
 *   ┗━━━━━━━━━━━━━━━━━━━━━━━▣
 */

const HEADER = (title) =>
  `┏▣ /////◈ *${String(title || 'VIRALBOT MINI').toUpperCase()}* ◈`;
const PREFIX = '┃';
const EMPTY  = `${PREFIX}`;
const FOOTER = `┗━━━━━━━━━━━━━━━━━━━━━━━▣`;

/**
 * Build a single boxed block.
 *   formatViralUI('TITLE', ['line one', 'line two'])
 *   → multiline string in the new style.
 */
function formatViralUI(title, lines) {
  const safe = Array.isArray(lines)
    ? lines
    : (lines == null ? [] : [String(lines)]);

  const body = [];
  for (const raw of safe) {
    const text = String(raw == null ? '' : raw);
    if (!text.trim()) { body.push(EMPTY); continue; }
    body.push(`${PREFIX}  ${text}`);
  }

  return [
    HEADER(title),
    EMPTY,
    ...(body.length ? body : [`${PREFIX}  —`]),
    EMPTY,
    FOOTER,
  ].join('\n');
}

/** Join multiple boxed sections with one blank line between them. */
function multiBox(sections = []) {
  return sections
    .filter(Boolean)
    .map(s => formatViralUI(s.title, s.lines || []))
    .join('\n\n');
}

// ---------- Legacy shims so older callers keep working ----------
function header(opts = {}) {
  const { pushName, totalCommands, title } = opts;
  const lines = [];
  if (pushName) lines.push(`👋 *User:* ${String(pushName).split('@')[0]}`);
  if (typeof totalCommands === 'number') lines.push(`📦 *Commands:* ${totalCommands}`);
  return formatViralUI(title || 'VIRALBOT MINI', lines);
}
function section(title, rows = []) {
  return formatViralUI(title, Array.isArray(rows) ? rows : [String(rows)]);
}
function footer(label = 'VIRALBOT MINI') {
  return formatViralUI(label, []);
}
function styled({ pushName, title, sections = [] } = {}) {
  const merged = [];
  if (pushName) merged.push(`👋 *User:* ${String(pushName).split('@')[0]}`);
  for (const s of sections) {
    if (s && Array.isArray(s.rows)) merged.push(...s.rows);
  }
  return formatViralUI(title || 'VIRALBOT MINI', merged);
}

module.exports = { formatViralUI, multiBox, header, section, footer, styled };
