// Turns a technical message (a database error, a code error, a network error) into a plain sentence a person can act on.
// Shared by the server (every API answer goes through it, see api-log.ts) and the browser (popups and alerts), so such a message
// is not shown anywhere. The real message is kept only in the API Logs.

const DUPLICATE = /Duplicate entry|ER_DUP_ENTRY/i;
const LINKED = /foreign key constraint|ER_ROW_IS_REFERENCED|ER_NO_REFERENCED_ROW|\b(1451|1452)\b/i;
const TOO_LONG = /Data too long|ER_DATA_TOO_LONG/i;
const BAD_VALUE = /Incorrect (string|integer|datetime|date|decimal|double) value|Data truncated|ER_TRUNCATED_WRONG_VALUE|ER_WRONG_VALUE/i;
const NETWORK = /Failed to fetch|NetworkError|Load failed|Network request failed|The network connection was lost|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION/i;
const TECHNICAL = /\bER_[A-Z_]+\b|SQLSTATE|sqlMessage|constraint fails|Unknown column|Table '[^']*' doesn't exist|You have an error in your SQL|syntax error|Lock wait timeout|Deadlock|Too many connections|\bE(CONN\w+|TIMEDOUT|NOTFOUND|PIPE|ACCES)\b|socket hang up|getaddrinfo|Cannot read propert|is not a function|is not defined|is not iterable|\bundefined\b|\[object Object\]|ReferenceError|TypeError|SyntaxError|Unexpected (token|end of JSON)|JSON at position|is not valid JSON|\bat [^\s]+ \([^)]*:\d+:\d+\)|node_modules|\bmysql2?\b|Pool is closed|connection pool/i;

export function friendlyError(message, ref) {
  const m = String(message == null ? '' : message);
  if (DUPLICATE.test(m)) return { text: 'This value already exists. Please use a different one.', technical: true };
  if (LINKED.test(m)) return { text: 'This record is linked to other records, so this change cannot be made.', technical: true };
  if (TOO_LONG.test(m)) return { text: 'One of the values is too long.', technical: true };
  if (BAD_VALUE.test(m)) return { text: 'One of the values is not in the right format.', technical: true };
  if (NETWORK.test(m)) return { text: 'Could not reach the server. Please check the connection and try again.', technical: true };
  if (TECHNICAL.test(m)) return { text: `Something went wrong. Please try again. If it keeps happening, tell the administrator${ref ? ` and quote reference ${ref}` : ''}.`, technical: true };
  return { text: m, technical: false };
}

// Text that may carry a whole answer of the server inside it, e.g. 'Update failed: {"detail":"..."}': the readable part is kept.
export function friendlyText(text, ref) {
  let m = String(text == null ? '' : text);
  const j = m.match(/\{[\s\S]*"(detail|error|message)"[\s\S]*\}/);
  if (j) {
    try {
      const o = JSON.parse(j[0]);
      const inner = o.detail !== undefined ? o.detail : o.error !== undefined ? o.error : o.message;
      if (typeof inner === 'string') m = m.replace(j[0], inner);
    } catch { /* not JSON after all */ }
  }
  return friendlyError(m, ref).text;
}

// Goes through a whole answer (object, list, text) and replaces every technical message in it. Returns what it found.
const MESSAGE_KEY = /error|detail|message|reason|failure|fail/i;
export function cleanAnswer(value, ref, key = '', found = { raw: '' }) {
  if (typeof value === 'string') {
    if (!MESSAGE_KEY.test(key)) return value;
    const f = friendlyError(value, ref);
    if (f.technical) { if (!found.raw) found.raw = value; return f.text; }
    return value;
  }
  if (Array.isArray(value)) return value.map(v => cleanAnswer(v, ref, key, found));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = cleanAnswer(v, ref, k, found);
    return out;
  }
  return value;
}
