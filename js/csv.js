// Minimal RFC 4180 CSV parser: quoted fields, escaped quotes ("") and
// newlines inside quotes. Auto-detects comma vs semicolon delimiters.

export function detectDelimiter(text) {
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const count = (ch) => firstLine.split(ch).length - 1;
  return count(';') > count(',') ? ';' : ',';
}

export function parseCsv(text, delimiter) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
  const delim = delimiter ?? detectDelimiter(text);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}
