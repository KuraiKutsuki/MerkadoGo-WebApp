/**
 * MerkadoGo Web — Canonical Theme Colors & 18-Zone SVG Palette
 * Source: UI-UX Design System.md (Ported from Flutter AppColors)
 */

export const APP_COLORS = {
  primary: '#1B5E20',         // Forest Green
  primaryLight: '#E8F5E9',    // Soft Mint
  error: '#E53935',           // Crimson Red
  canvas: '#F7F7F5',          // Warm Off-White
  surface: '#FFFFFF',         // Pure White
  surfaceDim: '#F1F8E9',      // Soft Sage
  ink: '#1A241A',             // Deep Charcoal
  inkMuted: '#667066',        // Slate Gray
  inkSubtle: '#9E9E9E',       // Light Gray
  border: '#E2E8E2'           // Hairline Gray
};

export const ZONE_PALETTE = {
  produce:          { fill: '#4CAF50', outline: '#2E7D32', label: 'Produce (Fruits & Vegetables)' },
  meat:             { fill: '#E57373', outline: '#C62828', label: 'Meat (Pork & Beef)' },
  mixed_meat:       { fill: '#C2185B', outline: '#880E4F', label: 'Mixed Meat' },
  fish:             { fill: '#64B5F6', outline: '#1565C0', label: 'Fish & Seafood' },
  dry_goods:        { fill: '#FFD54F', outline: '#FF8F00', label: 'Dry Goods (Grains & Clothing)' },
  rice_grains:      { fill: '#E5A93C', outline: '#B27300', label: 'Rice & Grains' },
  thrift_apparel:   { fill: '#3949AB', outline: '#1A237E', label: 'Thrift Apparel (Ukay Ukay)' },
  tailoring:        { fill: '#26C6DA', outline: '#00838F', label: 'Tailoring & Dress Shop' },
  eateries:         { fill: '#FF8A65', outline: '#D84315', label: 'Eateries (Carinderia)' },
  sari_sari:        { fill: '#8BC34A', outline: '#33691E', label: 'Sari Sari / Retail' },
  wholesale_snacks: { fill: '#8E24AA', outline: '#4A148C', label: 'Wholesale Snacks' },
  ingredients:      { fill: '#9575CD', outline: '#4527A0', label: 'Ingredients & Spices' },
  coconut_gata:     { fill: '#A1887F', outline: '#4E342E', label: 'Coconut & Gata' },
  specialty_repair: { fill: '#5C6BC0', outline: '#283593', label: 'Specialty Repair' },
  wellness_spa:     { fill: '#F06292', outline: '#AD1457', label: 'Wellness & Spa' },
  salon_beauty:     { fill: '#BA68C8', outline: '#7B1FA2', label: 'Salon & Beauty' },
  miscellaneous:    { fill: '#4DB6AC', outline: '#00695C', label: 'Services & Utilities' },
  unassigned:       { fill: '#E2E8F0', outline: '#94A3B8', label: 'Unassigned Stall' }
};

export const INFRA_PALETTE = {
  pathway:  { fill: '#E0E0E0', outline: '#9E9E9E' },
  building: { fill: '#B0BEC5', outline: '#546E7A' },
  bridge:   { fill: '#78909C', outline: '#455A64' },
  river:    { fill: '#4DD0E1', outline: '#00838F' }
};

/**
 * Normalizes any category string into a key matching ZONE_PALETTE
 * @param {string} category 
 * @returns {string} canonical palette slug
 */
export function normalizeCategorySlug(category) {
  if (!category) return 'unassigned';
  const clean = category.toLowerCase().trim();
  
  if (clean.includes('produce') || clean.includes('fruit') || clean.includes('vegetable')) return 'produce';
  if (clean.includes('mixed meat') || clean.includes('poultry')) return 'mixed_meat';
  if (clean.includes('meat') || clean.includes('pork') || clean.includes('beef')) return 'meat';
  if (clean.includes('fish') || clean.includes('seafood')) return 'fish';
  if (clean.includes('dry goods')) return 'dry_goods';
  if (clean.includes('rice') || clean.includes('grain')) return 'rice_grains';
  if (clean.includes('thrift') || clean.includes('ukay')) return 'thrift_apparel';
  if (clean.includes('tailor') || clean.includes('dress')) return 'tailoring';
  if (clean.includes('eater') || clean.includes('food') || clean.includes('carinderia')) return 'eateries';
  if (clean.includes('sari') || clean.includes('retail') || clean.includes('convenience')) return 'sari_sari';
  if (clean.includes('snack') || clean.includes('wholesale')) return 'wholesale_snacks';
  if (clean.includes('ingredient') || clean.includes('spice')) return 'ingredients';
  if (clean.includes('coconut') || clean.includes('gata')) return 'coconut_gata';
  if (clean.includes('repair') || clean.includes('watch') || clean.includes('jewelry')) return 'specialty_repair';
  if (clean.includes('wellness') || clean.includes('spa')) return 'wellness_spa';
  if (clean.includes('salon') || clean.includes('beauty')) return 'salon_beauty';
  if (clean.includes('misc') || clean.includes('service') || clean.includes('utility')) return 'miscellaneous';

  return 'unassigned';
}

/**
 * Resolves the fill and outline colors for a given primary category
 * @param {string} primaryCategory 
 * @returns {{ fill: string, outline: string, label: string }}
 */
export function resolveCategoryColors(primaryCategory) {
  const slug = normalizeCategorySlug(primaryCategory);
  return ZONE_PALETTE[slug] || ZONE_PALETTE.unassigned;
}
