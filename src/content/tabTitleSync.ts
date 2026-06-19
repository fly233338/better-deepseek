function normalizeTitle(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function extractConversationId(href: string): string | null {
  const match = href.match(/\/chat\/s\/([^/?#]+)/);
  return match ? match[1] : null;
}

function syncTabTitle(): void {
  const id = extractConversationId(window.location.href);
  if (!id) return;

  const anchor = document.querySelector<HTMLAnchorElement>(`a[href*="/chat/s/${id}"]`);
  if (!anchor) return;

  const title = normalizeTitle(anchor.textContent);
  if (!title) return;

  const suffix = document.title.includes('DeepSeek') ? ' - DeepSeek' : '';
  document.title = `${title}${suffix}`;
}

let stopObserver: (() => void) | null = null;

function startObserver(): void {
  stopObserver?.();

  const anchors = document.querySelectorAll<HTMLAnchorElement>('a[href*="/chat/s/"]');
  let lastTitles = new Map<string, string>();
  for (const a of anchors) {
    lastTitles.set(a.href, normalizeTitle(a.textContent));
  }

  const container = anchors[0]?.closest('aside, nav, [class*="sidebar" i], [class*="history" i]') ?? document.body;
  const observer = new MutationObserver(() => {
    const id = extractConversationId(window.location.href);
    if (!id) return;
    const anchor = document.querySelector<HTMLAnchorElement>(`a[href*="/chat/s/${id}"]`);
    if (!anchor) return;
    const title = normalizeTitle(anchor.textContent);
    if (title && title !== normalizeTitle(lastTitles.get(anchor.href))) {
      const suffix = document.title.includes('DeepSeek') ? ' - DeepSeek' : '';
      document.title = `${title}${suffix}`;
      lastTitles.set(anchor.href, title);
    }
  });

  observer.observe(container, { childList: true, subtree: true, characterData: true });

  stopObserver = () => observer.disconnect();
}

export function mountTabTitleSync(): void {
  syncTabTitle();
  startObserver();

  window.addEventListener('popstate', syncTabTitle);
  window.addEventListener('hashchange', syncTabTitle);
}

export function unmountTabTitleSync(): void {
  stopObserver?.();
  window.removeEventListener('popstate', syncTabTitle);
  window.removeEventListener('hashchange', syncTabTitle);
}
