export type TableFormat = 'markdown' | 'csv' | 'json';

export interface TableCellModel {
  text: string;
  rowIndex: number;
  columnIndex: number;
  rowSpan: number;
  colSpan: number;
  isHeader: boolean;
  sourceTag: 'td' | 'th';
}

export interface TableRowModel {
  cells: TableCellModel[];
}

export interface ParsedTable {
  caption?: string;
  headerRowIndex?: number;
  rows: TableRowModel[];
  sourceType?: 'html' | 'markdown';
}

/* ======== detection ======== */

const MIN_CELLS = 2;

function getOwnRows(table: HTMLTableElement): HTMLTableRowElement[] {
  return Array.from(table.querySelectorAll('tr')).filter((row) => row.closest('table') === table);
}

export function extractTables(root: ParentNode = document): HTMLTableElement[] {
  return Array.from(root.querySelectorAll('table')).filter((table) => {
    const ownRows = getOwnRows(table);
    const cellCount = ownRows.reduce((count, row) => count + row.cells.length, 0);
    return ownRows.length > 0 && cellCount >= MIN_CELLS;
  });
}

export function findMarkdownTables(root: ParentNode = document): Array<{ target: HTMLElement; table: ParsedTable }> {
  const selectors = [
    '[data-message-author-role="assistant"]',
    '[data-testid="conversation-turn"]',
    'message-content',
    '.markdown',
    '[data-response-index]',
  ];
  const candidates = new Set<HTMLElement>();
  for (const sel of selectors) {
    for (const el of root.querySelectorAll<HTMLElement>(sel)) {
      candidates.add(el);
    }
  }
  return Array.from(candidates)
    .filter((el) => {
      if (el.querySelector('table')) return false;
      const text = el.innerText || el.textContent || '';
      if (text.length < 16 || text.length > 30000) return false;
      return text.includes('|') && /\|[^\n]+\|\s*\n\s*\|?\s*:?-{3,}:?\s*\|/.test(text);
    })
    .map((target) => {
      const tables = parseMarkdownTables(target.innerText || target.textContent || '');
      return tables.length > 0 ? { target, table: tables[0] } : undefined;
    })
    .filter((v): v is { target: HTMLElement; table: ParsedTable } => Boolean(v));
}

/* ======== HTML parsing ======== */

function extractCellText(cell: HTMLTableCellElement): string {
  const clone = cell.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('script, style, noscript').forEach((n) => n.remove());
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  return normalize(clone.textContent ?? '');
}

function normalize(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/[ \t\f\v]+/g, ' ').replace(/ *\n+ */g, '\n').trim();
}

function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

function coveredCell(row: number, col: number): TableCellModel {
  return { text: '', rowIndex: row, columnIndex: col, rowSpan: 1, colSpan: 1, isHeader: false, sourceTag: 'td' };
}

function detectHeaderRow(table: HTMLTableElement, sourceRows: HTMLTableRowElement[]): number | undefined {
  const theadRows = Array.from(table.tHead?.rows ?? []);
  const firstThead = theadRows.find((r) => r.closest('table') === table);
  if (firstThead) return sourceRows.indexOf(firstThead);
  const firstRow = sourceRows[0];
  if (firstRow && Array.from(firstRow.cells).every((cell) => cell.tagName.toLowerCase() === 'th')) {
    return 0;
  }
  return undefined;
}

export function parseTable(table: HTMLTableElement): ParsedTable {
  const ownRows = getOwnRows(table);
  const grid: Array<Array<TableCellModel | undefined>> = [];
  const occupied = new Map<string, true>();

  ownRows.forEach((row, ri) => {
    grid[ri] ??= [];
    let ci = 0;
    for (const cell of Array.from(row.cells)) {
      while (occupied.has(cellKey(ri, ci))) {
        grid[ri][ci] = coveredCell(ri, ci);
        ci += 1;
      }
      const rowSpan = Math.max(1, cell.rowSpan || 1);
      const colSpan = Math.max(1, cell.colSpan || 1);
      const tag = cell.tagName.toLowerCase() === 'th' ? 'th' : 'td';
      grid[ri][ci] = { text: extractCellText(cell), rowIndex: ri, columnIndex: ci, rowSpan, colSpan, isHeader: tag === 'th', sourceTag: tag };
      for (let ro = 0; ro < rowSpan; ro += 1) {
        for (let co = 0; co < colSpan; co += 1) {
          if (ro === 0 && co === 0) continue;
          occupied.set(cellKey(ri + ro, ci + co), true);
          grid[ri + ro] ??= [];
          grid[ri + ro][ci + co] = coveredCell(ri + ro, ci + co);
        }
      }
      ci += colSpan;
    }
  });

  const width = Math.max(0, ...grid.map((r) => r.length));
  const rows: TableRowModel[] = grid.map((r, ri) => ({
    cells: Array.from({ length: width }, (_, ci) => r[ci] ?? coveredCell(ri, ci)),
  }));

  return {
    caption: normalize(table.caption?.textContent ?? '') || undefined,
    headerRowIndex: detectHeaderRow(table, ownRows),
    rows,
    sourceType: 'html',
  };
}

/* ======== Markdown parsing ======== */

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = '';
  let esc = false;
  for (const ch of s) {
    if (esc) { cur += ch; esc = false; continue; }
    if (ch === '\\') { esc = true; cur += ch; continue; }
    if (ch === '|') { cells.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function unescapeMd(v: string): string {
  return v.replace(/<br\s*\/?>/gi, '\n').replace(/\\\|/g, '|').replace(/\\\\/g, '\\').trim();
}

function isPipeRow(line: string | undefined): line is string {
  if (!line) return false;
  const cells = splitRow(line.trim());
  return cells.length >= 2;
}

function isSepRow(line: string | undefined): boolean {
  if (!line) return false;
  return splitRow(line).every((c) => /^:?-{3,}:?$/.test(c.trim()));
}

function mdCell(text: string, ri: number, ci: number, header: boolean): TableCellModel {
  return { text, rowIndex: ri, columnIndex: ci, rowSpan: 1, colSpan: 1, isHeader: header, sourceTag: header ? 'th' : 'td' };
}

export function parseMarkdownTables(text: string): ParsedTable[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const result: ParsedTable[] = [];
  let i = 0;
  while (i < lines.length) {
    const hdr = lines[i];
    const sep = lines[i + 1];
    if (!isPipeRow(hdr) || !isSepRow(sep)) { i += 1; continue; }
    const rows = [splitRow(hdr)];
    i += 2;
    while (i < lines.length && isPipeRow(lines[i])) { rows.push(splitRow(lines[i])); i += 1; }
    const w = Math.max(...rows.map((r) => r.length));
    if (w < 2 || rows.length < 2) continue;
    result.push({
      headerRowIndex: 0,
      rows: rows.map((r, ri) => ({ cells: Array.from({ length: w }, (_, ci) => mdCell(unescapeMd(r[ci] ?? ''), ri, ci, ri === 0)) })),
      sourceType: 'markdown',
    });
  }
  return result;
}

/* ======== serialization ======== */

function escMd(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function mdRow(cells: string[]): string {
  return `| ${cells.join(' | ')} |`;
}

function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function serializeMarkdown(t: ParsedTable): string {
  const rows = t.rows.map((r) => r.cells.map((c) => escMd(c.text)));
  if (!rows.length) return '';
  const hi = t.headerRowIndex;
  const header = hi === undefined ? rows[0].map((_, i) => `Column ${i + 1}`) : rows[hi];
  const body = hi === undefined ? rows : rows.filter((_, i) => i !== hi);
  return [mdRow(header), mdRow(header.map(() => '---')), ...body.map(mdRow)].join('\n');
}

function serializeCsv(t: ParsedTable): string {
  return t.rows.map((r) => r.cells.map((c) => csvCell(c.text)).join(',')).join('\n');
}

function toJsonObj(t: ParsedTable): object {
  return { caption: t.caption, headerRowIndex: t.headerRowIndex, rows: t.rows.map((r) => r.cells.map((c) => c.text)) };
}

export function serializeTable(t: ParsedTable, format: TableFormat): string {
  if (format === 'markdown') return serializeMarkdown(t);
  if (format === 'csv') return serializeCsv(t);
  return JSON.stringify(toJsonObj(t), null, 2);
}
