/**
 * MerkadoGo Web — Shared Category Vector SVG Icons
 * Exact SVG paths matching the search dropdown 2-column category grid.
 */

export const CATEGORY_SVG_PATHS = {
  all: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  produce: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.5 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  meat: '<circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/><path d="m15 9-6 6"/><path d="M9.5 5.5C13 4 19 7 19.5 11.5c.5 4-2 7-6 7.5-3.5.5-8-2.5-8.5-6.5C4.5 9 6.5 7 9.5 5.5Z"/>',
  mixed_meat: '<path d="M9.5 8C8.5 5.5 7.5 3.5 7.5 2M12.5 8C11.5 5.5 10.5 3.5 10.5 2"/><path d="M8 8h7c1.5 0 2.5 1 2.5 2.5v1.5"/><path d="M8 8C5 8 3 10.2 3 14c0 3.8 2 7 5.5 7 2.8 0 4-3 4-6 0-3.5-1.7-7-4.5-7Z"/><path d="M5.5 12.5c.5-1 2-1 2.5 0h-2.5ZM5.5 15.5h2.5c-.5 2-2 2-2.5 0v-2Z"/><path d="m16.5 11 2.5-4"/><path d="M18.2 6.5a1.2 1.2 0 1 1 1.7-1.7 1.2 1.2 0 1 1 1.7 1.7l-.8.8"/><path d="M12 17c0-2.8 1.8-5.5 4.5-5.5 2.2 0 4.5 2 4.5 5 0 3-2.2 5-4.5 5S12 19.5 12 17Z"/>',
  fish: '<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.46-3.44 6-7 6s-7.56-2.54-8.5-6Z"/><path d="M18 12h.01"/><path d="M2 8l4.5 4L2 16"/>',
  eateries: '<path d="M18 2v20M18 8a3 3 0 0 1-3-3V2h6v3a3 3 0 0 1-3 3ZM6 2v6a3 3 0 0 0 3 3v11M6 2v6a3 3 0 0 1-3-3V2h6Z"/>',
  rice_grains: '<path d="M2 12h20M4 12a8 8 0 0 0 16 0M8 12c0-4 4-8 4-8s4 4 4 8"/>',
  dry_goods: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23Z"/>',
  sari_sari: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  ingredients: '<path d="M9 3h6M10 3v3a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V10a4 4 0 0 1 4-4V3Z"/><path d="M10 14h4"/>',
  thrift_apparel: '<path d="M12 2a3 3 0 0 0-3 3c0 1.2.7 2.2 1.7 2.7L2.4 15.6A2 2 0 0 0 3.8 19h16.4a2 2 0 0 0 1.4-3.4L13.3 7.7A3 3 0 0 0 12 2Z"/>',
  tailoring: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>',
  wholesale_snacks: '<circle cx="12" cy="12" r="5"/><path d="m15.5 8.5 4-4a2.12 2.12 0 0 0-3-3l-4 4M8.5 15.5l-4 4a2.12 2.12 0 0 0 3 3l4-4"/>',
  coconut_gata: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7Z"/>',
  specialty_repair: '<circle cx="12" cy="12" r="7"/><polyline points="12 9 12 12 14 14"/><path d="M9 5V2h6v3M9 19v3h6v-3"/>',
  wellness_spa: '<path d="M12 3c-1.5 3-4 5-4 8a4 4 0 0 0 8 0c0-3-2.5-5-4-8Z"/><path d="M8 11C5 11 3 13 3 15a4 4 0 0 0 6 3.5M16 11c3 0 5 2 5 4a4 4 0 0 1-6 3.5"/>',
  salon_beauty: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  miscellaneous: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
  unassigned: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'
};

/**
 * Returns an inline SVG string for the specified category slug.
 * @param {string} categorySlug
 * @param {number} [size=16]
 * @param {string} [color='currentColor']
 * @returns {string} SVG HTML markup
 */
export function getCategorySvg(categorySlug, size = 16, color = 'currentColor') {
  const path = CATEGORY_SVG_PATHS[categorySlug] || CATEGORY_SVG_PATHS.unassigned;
  return `<svg class="category-vector-icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}
