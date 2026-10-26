'use strict';
/* Minimal inline SVG icon set (24x24, stroke = currentColor). */
const ICONS = {
  all: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  powder: '<path d="M3 20h18L14 9c-1-1.5-3-1.5-4 0z"/><circle cx="12" cy="4" r="1" fill="currentColor"/><circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="15" cy="6" r="1" fill="currentColor"/>',
  liquid: '<path d="M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
  gas: '<path d="M7 18h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.5-1A4.5 4.5 0 0 0 7 18z"/>',
  solid: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 12h18M9 5v7M15 12v7"/>',
  life: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19l8-8"/>',
  energy: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  explosive: '<circle cx="11" cy="14" r="7"/><path d="M15 9l3-3M18 6l2-1M18 6l1-2"/>',
  special: '<path d="M12 2l2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5z"/>',
  circle: '<circle cx="12" cy="12" r="7"/>',
  square: '<rect x="5" y="5" width="14" height="14" rx="1"/>',
  line: '<path d="M5 19L19 5"/><circle cx="5" cy="19" r="1.6" fill="currentColor"/><circle cx="19" cy="5" r="1.6" fill="currentColor"/>',
  spray: '<circle cx="6" cy="7" r="1" fill="currentColor"/><circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="17" cy="9" r="1" fill="currentColor"/><circle cx="8" cy="13" r="1" fill="currentColor"/><circle cx="14" cy="14" r="1" fill="currentColor"/><circle cx="18" cy="17" r="1" fill="currentColor"/><circle cx="6" cy="19" r="1" fill="currentColor"/><circle cx="11" cy="19" r="1" fill="currentColor"/>',
  mix: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
  heat: '<path d="M12 3c2 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 3 5 1-2 1-6 1-9z"/>',
  cool: '<path d="M12 2v20M4 6l16 12M20 6L4 18"/><path d="M9 4l3 3 3-3M9 20l3-3 3 3"/>',
  select: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" /><path d="M11 4h2M11 20h2M4 11v2M20 11v2"/>',
  zoom: '<circle cx="10" cy="10" r="6"/><path d="M15 15l5 5M10 7v6M7 10h6"/>',
  pick: '<path d="M14 4l6 6-2 2-6-6zM12 6L4 14v6h6l8-8"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  fit: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>',
  play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8a5 5 0 0 1 0 8M18.5 5.5a8.5 8.5 0 0 1 0 13"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  book: '<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  reroll: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  load: '<path d="M4 14v6h16v-6"/><path d="M12 4v11M7 10l5 5 5-5"/>',
  ad: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>',
  atom: '<circle cx="12" cy="12" r="1.8" fill="currentColor"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M3 9h18M12 9v11M12 9c-2-4-6-4-6-1s6 1 6 1zM12 9c2-4 6-4 6-1s-6 1-6 1z"/>',
  brush: '<path d="M18 3l3 3-9 9-3-3zM9 12l-4 4c-1 1-1 3-2 5 2-1 4-1 5-2l4-4"/>',
};

function hydrateIcons(root) {
  (root || document).querySelectorAll('svg[data-icon]').forEach(svg => {
    const name = svg.getAttribute('data-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = ICONS[name] || '';
  });
}
const icon = name => `<svg data-icon="${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
