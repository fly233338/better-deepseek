import type { MessageKey } from './i18n';

export const ROOT_ID = 'better-deepseek-folders';
export const DRAG_MIME = 'application/x-better-deepseek';
export const DEFAULT_FOLDER_COLOR = 'var(--bd-folder-accent-default)';
export const FOLDER_COLORS: Array<{ labelKey: MessageKey; value: string }> = [
  { labelKey: 'color.default', value: DEFAULT_FOLDER_COLOR },
  { labelKey: 'color.lightBlue', value: 'var(--bd-folder-color-light-blue)' },
  { labelKey: 'color.mint', value: 'var(--bd-folder-color-mint)' },
  { labelKey: 'color.purple', value: 'var(--bd-folder-color-purple)' },
  { labelKey: 'color.pink', value: 'var(--bd-folder-color-pink)' },
  { labelKey: 'color.amber', value: 'var(--bd-folder-color-amber)' },
] as const;

export type IconName =
  | 'chat'
  | 'chevronDown'
  | 'chevronRight'
  | 'folder'
  | 'library'
  | 'palette'
  | 'pin'
  | 'pinOff'
  | 'plus'
  | 'search'
  | 'settings'
  | 'x';

export function iconButton(
  icon: IconName,
  title: string,
  onClick: (event: MouseEvent) => void | Promise<void>,
  active = false,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'bd-icon-button';
  button.classList.toggle('bd-icon-button-active', active);
  button.type = 'button';
  button.title = title;
  button.append(iconElement(icon));
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    void onClick(event);
  });
  return button;
}

export function iconElement(icon: IconName): SVGSVGElement {
  const wrapper = document.createElement('span');
  wrapper.innerHTML = ICONS[icon];
  return wrapper.firstElementChild as SVGSVGElement;
}

const baseIconAttrs =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

const ICONS: Record<IconName, string> = {
  chat: `<svg ${baseIconAttrs}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>`,
  chevronDown: `<svg ${baseIconAttrs}><path d="m6 9 6 6 6-6"/></svg>`,
  chevronRight: `<svg ${baseIconAttrs}><path d="m9 6 6 6-6 6"/></svg>`,
  folder: `<svg ${baseIconAttrs}><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`,
  library: `<svg ${baseIconAttrs}><path d="M4 19.5V5a2 2 0 0 1 2-2h11"/><path d="M8 7h11v14H8a4 4 0 0 1 0-8h11"/><path d="M8 7v6"/></svg>`,
  palette: `<svg ${baseIconAttrs}><path d="M12 22a10 10 0 1 1 10-10 3 3 0 0 1-3 3h-1.5a2 2 0 0 0-1.7 3l.2.3a2.5 2.5 0 0 1-2.1 3.7z"/><circle cx="7.5" cy="10.5" r=".5"/><circle cx="10.5" cy="7.5" r=".5"/><circle cx="14.5" cy="7.5" r=".5"/><circle cx="16.5" cy="11.5" r=".5"/></svg>`,
  pin: `<svg ${baseIconAttrs}><path d="M12 17v5"/><path d="M5 17h14"/><path d="M15 3.6 14 10l3 3v4H7v-4l3-3-.9-6.4A1 1 0 0 1 10.1 2h3.8a1 1 0 0 1 1.1 1.6z"/></svg>`,
  pinOff: `<svg ${baseIconAttrs}><path d="m3 3 18 18"/><path d="M12 17v5"/><path d="M5 17h12"/><path d="M10 4 9.5 7.5"/><path d="M14.5 10.5 17 13v4H7v-4l2-2"/><path d="M14 2a1 1 0 0 1 1 1.2L14 10"/></svg>`,
  plus: `<svg ${baseIconAttrs}><path d="M12 5v14"/><path d="M5 12h14"/></svg>`,
  search: `<svg ${baseIconAttrs}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  settings: `<svg ${baseIconAttrs}><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 0 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 0 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 0 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  x: `<svg ${baseIconAttrs}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
};
