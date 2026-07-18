export type IconName =
  | 'chevronDown'
  | 'close'
  | 'command'
  | 'maximize'
  | 'newTab'
  | 'settings'
  | 'splitDown'
  | 'splitRight';

const iconPaths: Record<IconName, string> = {
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="m7 7 10 10M17 7 7 17"/>',
  command: '<path d="M8 9h8M8 13h5"/><rect x="3.5" y="4.5" width="17" height="15" rx="3"/>',
  maximize: '<path d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4"/>',
  newTab: '<path d="M12 5v14M5 12h14"/>',
  settings:
    '<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="M19 13.5v-3l-2.1-.6a7 7 0 0 0-.7-1.6l1.1-1.9-2.1-2.1-1.9 1.1a7 7 0 0 0-1.6-.7L11 2.5H8l-.6 2.2a7 7 0 0 0-1.6.7L3.9 4.3 1.8 6.4l1.1 1.9a7 7 0 0 0-.7 1.6L0 10.5v3l2.2.6a7 7 0 0 0 .7 1.6l-1.1 1.9 2.1 2.1 1.9-1.1a7 7 0 0 0 1.6.7l.6 2.2h3l.6-2.2a7 7 0 0 0 1.6-.7l1.9 1.1 2.1-2.1-1.1-1.9a7 7 0 0 0 .7-1.6l2.2-.6Z" transform="translate(2.5 0) scale(.8)"/>',
  splitDown: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M4 12h16"/>',
  splitRight: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M12 4v16"/>'
};

export function createIcon(name: IconName): SVGSVGElement {
  const namespace = 'http://www.w3.org/2000/svg';
  const wrapper = document.createElement('template');
  wrapper.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${iconPaths[name]}</svg>`;
  const svg = wrapper.content.firstElementChild;
  if (!(svg instanceof SVGSVGElement)) {
    throw new Error(`failed to create ${name} icon`);
  }
  svg.classList.add('ui-icon');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  return svg;
}
