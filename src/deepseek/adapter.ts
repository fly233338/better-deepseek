import type { ConversationReference } from '../core/types';

const CHAT_PATH_PATTERN = /\/chat\/s\/([^/?#]+)/;
const SIDEBAR_SELECTORS = [
  'aside',
  'nav',
  '[class*="sidebar" i]',
  '[class*="sider" i]',
  '[class*="history" i]',
];

interface FolderInsertionTarget {
  sidebar: HTMLElement;
  before: ChildNode | null;
}

export function isDeepSeekChatUrl(url: string): boolean {
  return CHAT_PATH_PATTERN.test(url);
}

export function extractConversationId(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname.match(CHAT_PATH_PATTERN)?.[1] ?? null;
  } catch {
    return url.match(CHAT_PATH_PATTERN)?.[1] ?? null;
  }
}

export function conversationFromAnchor(anchor: HTMLAnchorElement): ConversationReference | null {
  const id = extractConversationId(anchor.href);
  if (!id) return null;

  const title = normalizeTitle(anchor.textContent) || `DeepSeek ${id.slice(0, 8)}`;
  const now = Date.now();

  return {
    conversationId: id,
    title,
    url: anchor.href,
    addedAt: now,
    updatedAt: now,
    sortIndex: 0,
  };
}

export function currentConversation(): ConversationReference | null {
  const id = extractConversationId(window.location.href);
  if (!id) return null;

  const title = normalizeTitle(document.title.replace(/\s*-\s*DeepSeek\s*$/i, '')) || '当前会话';
  const now = Date.now();

  return {
    conversationId: id,
    title,
    url: window.location.href,
    addedAt: now,
    updatedAt: now,
    sortIndex: 0,
  };
}

export function findSidebar(): HTMLElement | null {
  const anchorSidebar = findSidebarFromConversationAnchors();
  if (anchorSidebar) return anchorSidebar;

  for (const selector of SIDEBAR_SELECTORS) {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const match = candidates.find((element) => {
      const rect = element.getBoundingClientRect();
      const hasConversationLinks = element.querySelector('a[href*="/chat/s/"]');
      return hasConversationLinks || isLikelyLeftSidebar(element, rect);
    });
    if (match) return match;
  }

  return null;
}

export function findFolderInsertionTarget(): FolderInsertionTarget | null {
  const sidebar = findSidebar();
  if (!sidebar) return null;

  const historyAnchor = findConversationAnchors(sidebar)[0];
  if (!historyAnchor) return { sidebar, before: sidebar.firstChild };

  const historySection = findDirectChildContaining(sidebar, historyAnchor);
  return { sidebar, before: historySection };
}

export function findConversationAnchors(root: ParentNode = document): HTMLAnchorElement[] {
  const anchors = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href*="/chat/s/"]'));
  const byId = new Map<string, HTMLAnchorElement>();

  for (const anchor of anchors) {
    const id = extractConversationId(anchor.href);
    if (id && !byId.has(id)) byId.set(id, anchor);
  }

  return Array.from(byId.values());
}

export function navigateToConversation(url: string): void {
  const matchingAnchor = findConversationAnchors().find((anchor) => {
    return extractConversationId(anchor.href) === extractConversationId(url);
  });

  if (matchingAnchor) {
    matchingAnchor.click();
    return;
  }

  window.location.assign(url);
}

function normalizeTitle(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function findSidebarFromConversationAnchors(): HTMLElement | null {
  for (const anchor of findConversationAnchors()) {
    let current = anchor.parentElement;

    while (current && current !== document.body) {
      const rect = current.getBoundingClientRect();
      const directChild = findDirectChildContaining(current, anchor);
      const containsMultipleHistoryLinks = current.querySelectorAll('a[href*="/chat/s/"]').length > 1;

      if (
        directChild &&
        containsMultipleHistoryLinks &&
        (isLikelyLeftSidebar(current, rect) || current.matches(SIDEBAR_SELECTORS.join(',')))
      ) {
        return current;
      }

      current = current.parentElement;
    }
  }

  return null;
}

function findDirectChildContaining(parent: HTMLElement, child: Node): ChildNode | null {
  for (const directChild of Array.from(parent.childNodes)) {
    if (directChild.contains(child)) return directChild;
  }

  return null;
}

function isLikelyLeftSidebar(element: HTMLElement, rect: DOMRect): boolean {
  if (element === document.documentElement || element === document.body) return false;
  if (rect.width === 0 && rect.height === 0) return false;

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1280;
  return rect.left <= Math.min(80, viewportWidth * 0.08) && rect.width >= 180 && rect.width <= 460;
}
