/**
 * MerkadoGo Web — Stall Document Normalizer
 *
 * Canonical defensive field mapping for vendor records arriving from either
 * source: the static vendor_notes.json fallback (Task 3.2) or the live
 * Firestore /stalls stream (Task 3.4). Mirrors the mobile StallModel's
 * backward-compatible fallbacks (Database & Live Firestore Schema §4).
 *
 * All IDs stay strings — split stall records like "41.1" / "257.2" must never
 * be coerced to numbers (Guardrail 4). `map_color_hex` is deliberately dropped:
 * color is always resolved from the primary category against ZONE_PALETTE.
 */

const DEFAULT_DAYS_OPEN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Normalizes a raw Firestore document (or static JSON record) into the
 * canonical vendor shape shared by the map renderer, detail card, and
 * (future) search index.
 *
 * @param {string|null} docId - Firestore document ID (matches the SVG stall ID, e.g. "id_3").
 * @param {Object|null} data - Raw document/record payload.
 * @returns {Object|null} Canonical vendor record, or null if unusable.
 */
export function normalizeStallDoc(docId, data) {
  if (!data || typeof data !== 'object') return null;

  const stallId = String(docId || data.stall_id || (data.id != null ? `id_${data.id}` : '')).trim();
  const name = String(data.name ?? data.business_name ?? '').trim();
  if (!stallId || !name) return null;

  const primaryCategory = String(data.category ?? data.primary_category ?? '').trim();
  const rawCategories = Array.isArray(data.categories) ? data.categories : [];

  return {
    stallId,
    vendorId: String(data.id ?? ''),
    name,

    // Color driver — resolved against ZONE_PALETTE, never a stored hex
    category: primaryCategory,
    categories: rawCategories.length > 0 ? rawCategories.map((c) => String(c).trim()).filter(Boolean) : [primaryCategory].filter(Boolean),
    subcategories: Array.isArray(data.subcategories) ? data.subcategories.map((c) => String(c).trim()).filter(Boolean) : [],
    products: Array.isArray(data.products) ? data.products.map((p) => String(p).trim()).filter(Boolean) : [],

    // Location / display metadata
    address: String(data.address ?? '').trim(),
    section: String(data.section ?? data.building_or_section ?? 'Unassigned').trim(),
    stallNumber: String(data.stallNumber ?? data.stall_number ?? '').trim(), // display-only, never parsed
    photoUrls: Array.isArray(data.photoUrls) ? data.photoUrls.map(String).filter(Boolean) : [],

    // Operating hours (live-updatable from the admin app)
    openTime: String(data.openTime ?? '6:00 AM').trim(),
    closeTime: String(data.closeTime ?? '6:00 PM').trim(),
    daysOpen: Array.isArray(data.daysOpen) ? data.daysOpen.map(String).filter(Boolean) : DEFAULT_DAYS_OPEN,
    latitude: Number(data.latitude) || 0,
    longitude: Number(data.longitude) || 0,

    // Operational status — drives the Unassigned reset in the live sync
    status: String(data.status ?? '').trim() || ((data.isOpen ?? data.isActive) ? 'open' : 'closed'),
    isOpen: data.isOpen ?? data.isActive ?? (data.status === 'open'),

    // Search tags: prefer the combined tags array, fall back to search_categories
    tags: Array.isArray(data.tags) ? data.tags.map((t) => String(t).trim()).filter(Boolean)
      : Array.isArray(data.search_categories) ? data.search_categories.map((t) => String(t).trim()).filter(Boolean)
      : []
  };
}
