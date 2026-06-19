import { t, type AppLocale } from './i18n';
import { type ThemeMode } from './theme';
import { extractTables, findMarkdownTables, parseTable, serializeTable, type ParsedTable, type TableFormat } from './tableClip';

interface TableWidget {
  target: HTMLElement;
  parsedTable?: ParsedTable;
  host: HTMLElement;
  menu: HTMLElement;
  trigger: HTMLElement;
  hideTimer?: ReturnType<typeof setTimeout>;
  isActive: boolean;
  isMenuOpen: boolean;
}

const OUTSIDE_GAP = 6;
const HIDE_DELAY = 140;

function createWidgetShadow(root: Document, locale: AppLocale, theme: ThemeMode): { style: HTMLStyleElement; trigger: HTMLButtonElement; menu: HTMLDivElement } {
  const style = root.createElement('style');
  style.textContent = `
    :host { position: fixed; z-index: 2147483647; font: 13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color-scheme: ${theme}; }
    .trigger {
      width: 30px; height: 30px; display: grid; place-items: center;
      border: 1px solid rgba(15,23,42,0.15); border-radius: 8px;
      background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      color: #4b5563; cursor: pointer; padding: 0; transition: background 0.12s, border-color 0.12s;
    }
    .trigger:hover, .trigger[aria-expanded="true"] { background: #eef4ff; border-color: var(--bd-accent, #4f7cff); }
    .trigger svg { display: block; }
    .menu {
      position: absolute; top: 34px; left: 0; min-width: 150px;
      display: none; padding: 4px;
      border: 1px solid rgba(15,23,42,0.12); border-radius: 8px;
      background: #fff; box-shadow: 0 12px 28px rgba(0,0,0,0.15);
    }
    .menu[data-open="true"] { display: grid; gap: 2px; }
    .menu button {
      min-height: 30px; border: 0; border-radius: 6px;
      background: transparent; color: #1f2937;
      cursor: pointer; font: inherit; font-size: 12px; font-weight: 600;
      padding: 0 10px; text-align: left; white-space: nowrap;
    }
    .menu button:hover { background: #eef4ff; color: #4f7cff; }
    .menu button:active { background: #dce8ff; }
  `;

  const trigger = root.createElement('button');
  trigger.className = 'trigger';
  trigger.type = 'button';
  trigger.setAttribute('aria-label', t(locale, 'table.action'));
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M3 7h14M7 3v14"/></svg>';

  const menu = root.createElement('div');
  menu.className = 'menu';
  menu.setAttribute('role', 'menu');

  return { style, trigger, menu };
}

export function mountTableToolbar(locale: AppLocale, theme: ThemeMode, root: Document = document): () => void {
  const widgets = new WeakMap<HTMLElement, TableWidget>();
  const hosts = new Set<HTMLElement>();
  let scanPending: number | null = null;
  let posPending: number | null = null;

  const actions: Array<{ key: string; format?: TableFormat }> = [
    { key: 'table.copyMarkdown', format: 'markdown' },
    { key: 'table.copyCsv', format: 'csv' },
    { key: 'table.copyJson', format: 'json' },
  ];

  function scheduleScan(): void {
    if (scanPending) return;
    scanPending = window.requestAnimationFrame(() => {
      scanPending = null;
      scan();
    });
  }

  function schedulePos(): void {
    if (posPending) return;
    posPending = window.requestAnimationFrame(() => {
      posPending = null;
      updatePositions();
    });
  }

  function hasWidget(target: HTMLElement): boolean {
    return widgets.has(target);
  }

  function createWidget(target: HTMLElement, parsedTable?: ParsedTable): TableWidget {
    const host = root.createElement('div');
    host.className = 'bd-table-widget';
    host.hidden = true;
    const shadow = host.attachShadow({ mode: 'open' });

    const { style, trigger, menu } = createWidgetShadow(root, locale, theme);

    for (const act of actions) {
      const btn = root.createElement('button');
      btn.type = 'button';
      btn.textContent = t(locale, act.key as never);
      btn.setAttribute('role', 'menuitem');
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (act.format && parsedTable) {
          const content = serializeTable(parsedTable, act.format);
          navigator.clipboard.writeText(content).catch(() => {});
        }
        setMenuOpen(widget, false);
        hideLater(widget);
      });
      menu.append(btn);
    }

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = !widget.isMenuOpen;
      closeAll();
      setMenuOpen(widget, open);
    });

    shadow.append(style, trigger, menu);
    root.documentElement.append(host);

    const widget: TableWidget = { target, parsedTable, host, menu, trigger, isActive: false, isMenuOpen: false };
    host.dataset.bdTableWidget = '';

    target.addEventListener('mouseenter', () => show(widget));
    target.addEventListener('mouseleave', () => hideLater(widget));
    host.addEventListener('mouseenter', () => show(widget));
    host.addEventListener('mouseleave', () => hideLater(widget));

    return widget;
  }

  function show(w: TableWidget): void {
    if (w.hideTimer) { clearTimeout(w.hideTimer); w.hideTimer = undefined; }
    w.isActive = true;
    w.host.hidden = false;
  }

  function hideLater(w: TableWidget): void {
    if (w.hideTimer) clearTimeout(w.hideTimer);
    w.isActive = false;
    w.hideTimer = setTimeout(() => {
      if (!w.isActive && !w.isMenuOpen) w.host.hidden = true;
    }, HIDE_DELAY);
  }

  function setMenuOpen(w: TableWidget, open: boolean): void {
    w.isMenuOpen = open;
    w.trigger.setAttribute('aria-expanded', String(open));
    w.menu.dataset.open = String(open);
    w.host.hidden = false;
  }

  function closeAll(): void {
    hosts.forEach((h) => {
      const w = (h as HTMLElement & { tableclipWidget?: TableWidget }).tableclipWidget;
      if (w) setMenuOpen(w, false);
    });
  }

  function updatePositions(): void {
    hosts.forEach((host) => {
      const target = (host as HTMLElement & { tableclipTarget?: HTMLElement }).tableclipTarget;
      if (!target || !root.documentElement.contains(target)) {
        host.remove();
        hosts.delete(host);
        return;
      }
      const w = widgets.get(target);
      if (!w) return;
      const rect = target.getBoundingClientRect();
      const visible = rect.width >= 24 && rect.height >= 24 && rect.bottom >= 0 && rect.right >= 0 && rect.top <= window.innerHeight && rect.left <= window.innerWidth;
      w.host.hidden = !visible || !(w.isActive || w.isMenuOpen);
      if (w.host.hidden) return;
      w.host.style.left = `${Math.max(8, rect.right + OUTSIDE_GAP)}px`;
      w.host.style.top = `${Math.max(8, rect.top)}px`;
    });
  }

  function scan(): void {
    const chatRoot = root.getElementById('root') ?? root;
    for (const table of extractTables(chatRoot)) {
      if (hasWidget(table)) continue;
      const parsed = parseTable(table);
      const w = createWidget(table, parsed);
      widgets.set(table, w);
      hosts.add(w.host);
      (w.host as HTMLElement & { tableclipTarget?: HTMLElement }).tableclipTarget = table;
    }
    for (const { target, table } of findMarkdownTables(root)) {
      if (hasWidget(target)) continue;
      if (target.querySelector('table')) continue;
      const w = createWidget(target, table);
      widgets.set(target, w);
      hosts.add(w.host);
      (w.host as HTMLElement & { tableclipTarget?: HTMLElement }).tableclipTarget = target;
    }
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(root.documentElement, { childList: true, characterData: true, subtree: true });

  root.addEventListener('click', (event) => {
    const t = event.target instanceof Element ? event.target : undefined;
    if (t?.closest('.bd-table-widget')) return;
    closeAll();
  }, true);

  window.addEventListener('scroll', schedulePos, true);
  window.addEventListener('resize', schedulePos);

  scheduleScan();

  return () => {
    observer.disconnect();
    window.removeEventListener('scroll', schedulePos, true);
    window.removeEventListener('resize', schedulePos);
    if (scanPending) cancelAnimationFrame(scanPending);
    if (posPending) cancelAnimationFrame(posPending);
    hosts.forEach((h) => h.remove());
    hosts.clear();
  };
}
