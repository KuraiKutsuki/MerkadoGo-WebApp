/**
 * MerkadoGo Web — Static Data Store
 *
 * Fetches, validates, and holds all datasets in memory (Master Context §2.2):
 * - The four fixed physical-structure JSON assets under /data/ (Task 3.1)
 * - The static `vendor_notes.json` vendor directory (Task 3.2) — the offline
 *   instant-paint fallback for the live Firestore `/stalls` stream (Task 3.4)
 *
 * Pure data layer: no DOM access, so every export is unit-testable in isolation.
 */

import { normalizeStallDoc } from './services/stallNormalizer.js';

const DATA_PATHS = Object.freeze({
  mapNodes: '/data/map_nodes.json',
  stallNodes: '/data/stall_nodes.json',
  entryPoints: '/data/market_entry_points.json',
  searchDirectory: '/data/subcategory_search_directory.json',
  vendors: '/data/vendor_notes.json'
});

/**
 * In-memory cache of the loaded static datasets.
 * @type {{ mapNodes: Object|null, stallNodes: Object|null, entryPoints: Array|null, searchDirectory: Object|null }}
 */
let staticData = {
  mapNodes: null,
  stallNodes: null,
  entryPoints: null,
  searchDirectory: null
};

/**
 * In-memory cache of the normalized vendor directory (static fallback).
 * @type {{ records: Array|null, byStallId: Map|null }}
 */
let vendorData = { records: null, byStallId: null };

/**
 * Fetches a JSON asset and fails loudly on HTTP errors or malformed JSON.
 * @param {string} url
 * @returns {Promise<any>}
 */
async function fetchJson(url) {
  const response = await fetch(`${url}?t=${Date.now()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Validates map_nodes.json (Master Context §3.1): every node needs numeric x/y
 * and a neighbors array. Logs asymmetric or dangling adjacency edges as warnings
 * instead of failing — a graph data hiccup must not crash the kiosk.
 * @param {Object} mapNodes
 * @returns {Object}
 */
function validateMapNodes(mapNodes) {
  if (!mapNodes || typeof mapNodes !== 'object' || Array.isArray(mapNodes)) {
    throw new Error('map_nodes.json: expected a non-empty object of graph nodes');
  }

  let asymmetricEdges = 0;
  for (const [nodeId, node] of Object.entries(mapNodes)) {
    if (typeof node.x !== 'number' || typeof node.y !== 'number') {
      console.warn(`[MerkadoGo Data] map_nodes: node "${nodeId}" is missing numeric x/y coordinates`);
    }
    if (!Array.isArray(node.neighbors)) {
      console.warn(`[MerkadoGo Data] map_nodes: node "${nodeId}" has no neighbors[] array`);
      continue;
    }
    for (const neighborId of node.neighbors) {
      const neighbor = mapNodes[neighborId];
      if (!neighbor) {
        console.warn(`[MerkadoGo Data] map_nodes: dangling edge "${nodeId}" -> "${neighborId}" (neighbor not defined)`);
        asymmetricEdges++;
      } else if (!neighbor.neighbors.includes(nodeId)) {
        console.warn(`[MerkadoGo Data] map_nodes: asymmetric edge "${nodeId}" -> "${neighborId}" (missing reverse entry)`);
        asymmetricEdges++;
      }
    }
  }

  console.log(`[MerkadoGo Data] map_nodes.json loaded: ${Object.keys(mapNodes).length} pathway nodes, ${asymmetricEdges} graph warnings.`);
  return mapNodes;
}

/**
 * Validates stall_nodes.json (Master Context §3.2): values may be a single
 * node ID string or an array of candidates — both shapes are legal and kept
 * as-is; routing resolves index 0 as the primary snap node (Phase 4).
 * @param {Object} stallNodes
 * @returns {Object}
 */
function validateStallNodes(stallNodes) {
  if (!stallNodes || typeof stallNodes !== 'object' || Array.isArray(stallNodes)) {
    throw new Error('stall_nodes.json: expected a non-empty object mapping stall IDs to pathway nodes');
  }

  let singleNode = 0;
  let multiNode = 0;
  for (const [stallId, value] of Object.entries(stallNodes)) {
    if (typeof value === 'string') {
      singleNode++;
    } else if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
      multiNode++;
    } else {
      console.warn(`[MerkadoGo Data] stall_nodes: "${stallId}" has an invalid value (expected string or string[])`, value);
    }
  }

  console.log(`[MerkadoGo Data] stall_nodes.json loaded: ${singleNode + multiNode} stall mappings (${singleNode} single-node, ${multiNode} multi-node arrays).`);
  return stallNodes;
}

/**
 * Validates market_entry_points.json (Master Context §3.5): 14 entrances, each
 * with entrance_id, node_id, and description. Warns on node IDs that do not
 * resolve in the loaded graph (would break Phase 4 route starts).
 * @param {Array} entryPoints
 * @param {Object} mapNodes
 * @returns {Array}
 */
function validateEntryPoints(entryPoints, mapNodes) {
  if (!Array.isArray(entryPoints) || entryPoints.length === 0) {
    throw new Error('market_entry_points.json: expected a non-empty array of entrances');
  }

  let unresolved = 0;
  for (const entry of entryPoints) {
    if (typeof entry.node_id !== 'string' || typeof entry.description !== 'string') {
      console.warn('[MerkadoGo Data] market_entry_points: entry missing node_id/description', entry);
      unresolved++;
    } else if (mapNodes && !mapNodes[entry.node_id]) {
      console.warn(`[MerkadoGo Data] market_entry_points: entrance ${entry.entrance_id} references unknown node "${entry.node_id}"`);
      unresolved++;
    }
  }

  console.log(`[MerkadoGo Data] market_entry_points.json loaded: ${entryPoints.length} entrance gates, ${unresolved} warnings.`);
  return entryPoints;
}

/**
 * Validates subcategory_search_directory.json: 17 category slugs nested under
 * a top-level "categories" object, each with display_name and multilingual
 * keywords[] (English / Tagalog / Central Bicolano interleaved).
 * @param {Object} searchDirectory
 * @returns {Object}
 */
function validateSearchDirectory(searchDirectory) {
  const categories = searchDirectory && searchDirectory.categories;
  if (!categories || typeof categories !== 'object' || Array.isArray(categories)) {
    throw new Error('subcategory_search_directory.json: expected a top-level "categories" object');
  }

  let missingKeywords = 0;
  for (const [slug, category] of Object.entries(categories)) {
    if (!Array.isArray(category.keywords) || category.keywords.length === 0) {
      console.warn(`[MerkadoGo Data] search_directory: category "${slug}" has no keywords[]`);
      missingKeywords++;
    }
  }

  console.log(`[MerkadoGo Data] subcategory_search_directory.json loaded: ${Object.keys(categories).length} category slugs, ${missingKeywords} warnings.`);
  return searchDirectory;
}

/**
 * Loads and validates all four static datasets in parallel, then caches them.
 * Safe to call repeatedly — subsequent calls return the cached snapshot.
 * @returns {Promise<{mapNodes: Object, stallNodes: Object, entryPoints: Array, searchDirectory: Object}>}
 */
export async function loadStaticData() {
  if (isStaticDataLoaded()) {
    return getStaticData();
  }

  const [mapNodes, stallNodes, entryPoints, searchDirectory] = await Promise.all([
    fetchJson(DATA_PATHS.mapNodes).then(validateMapNodes),
    fetchJson(DATA_PATHS.stallNodes).then(validateStallNodes),
    fetchJson(DATA_PATHS.entryPoints),
    fetchJson(DATA_PATHS.searchDirectory)
  ]);

  // Entry point validation needs the graph to check node references
  validateEntryPoints(entryPoints, mapNodes);
  validateSearchDirectory(searchDirectory);

  staticData = { mapNodes, stallNodes, entryPoints, searchDirectory };
  return getStaticData();
}

/**
 * @returns {boolean} True once loadStaticData() has resolved successfully.
 */
export function isStaticDataLoaded() {
  return staticData.mapNodes !== null;
}

/**
 * Returns the cached static data snapshot.
 * @returns {{mapNodes: Object, stallNodes: Object, entryPoints: Array, searchDirectory: Object}}
 * @throws {Error} If loadStaticData() has not resolved yet.
 */
export function getStaticData() {
  if (staticData.mapNodes === null) {
    throw new Error('Static data not loaded yet — call loadStaticData() first');
  }
  return staticData;
}

/**
 * Convenience getters for individual datasets.
 */
export function getMapNodes() {
  return getStaticData().mapNodes;
}

export function getStallNodes() {
  return getStaticData().stallNodes;
}

export function getEntryPoints() {
  return getStaticData().entryPoints;
}

export function getSearchDirectory() {
  return getStaticData().searchDirectory;
}

/**
 * Resolves a stall/slot ID to its pathway node candidates, normalizing the
 * two legal shapes of stall_nodes.json values (string or string[]) into a
 * string array. Index 0 is the primary snap node per Master Context §3.2.
 * @param {string} stallId
 * @returns {string[]} Empty array if the stall ID is unknown.
 */
export function getStallNodeIds(stallId) {
  const value = getStaticData().stallNodes[stallId];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value;
  return [];
}

/**
 * Normalizes a raw vendor record by delegating to the canonical service
 * normalizer (services/stallNormalizer.js), which handles both static JSON
 * field names and Firestore field names with identical defensive fallbacks.
 * @param {Object} record - Raw vendor record.
 * @returns {Object|null} Canonical vendor record, or null if unusable.
 */
export function normalizeStallRecord(record) {
  // Static records carry their SVG join key in stall_id; passing a null docId
  // makes the normalizer fall through to stall_id, then id_${data.id}.
  return normalizeStallDoc(null, record);
}

/**
 * Validates and normalizes the raw vendor_notes.json array.
 * @param {Array} rawVendors
 * @returns {{records: Array, byStallId: Map}}
 */
function validateAndCacheVendors(rawVendors) {
  if (!Array.isArray(rawVendors) || rawVendors.length === 0) {
    throw new Error('vendor_notes.json: expected a non-empty array of vendor records');
  }

  const records = [];
  const byStallId = new Map();
  let skipped = 0;
  let duplicateStallIds = 0;

  rawVendors.forEach((raw) => {
    const vendor = normalizeStallRecord(raw);
    if (!vendor) {
      console.warn('[MerkadoGo Data] vendor_notes: skipping unusable record', raw);
      skipped++;
      return;
    }
    if (byStallId.has(vendor.stallId)) {
      console.warn(`[MerkadoGo Data] vendor_notes: duplicate stall_id "${vendor.stallId}" (${vendor.name} overrides ${byStallId.get(vendor.stallId).name})`);
      duplicateStallIds++;
    }
    byStallId.set(vendor.stallId, vendor);
    records.push(vendor);
  });

  console.log(`[MerkadoGo Data] vendor_notes.json loaded: ${records.length} vendors normalized (${skipped} skipped, ${duplicateStallIds} duplicate stall IDs).`);
  vendorData = { records, byStallId };
  return vendorData;
}

/**
 * Fetches the static vendor directory fallback and caches it normalized.
 * Safe to call repeatedly — subsequent calls return the cached snapshot
 * until the live Firestore sync (Task 3.4) supersedes it.
 * @returns {Promise<{records: Array, byStallId: Map}>}
 */
export async function loadVendorData() {
  if (isVendorDataLoaded()) {
    return getVendorData();
  }
  const rawVendors = await fetchJson(DATA_PATHS.vendors);
  return validateAndCacheVendors(rawVendors);
}

/**
 * @returns {boolean} True once loadVendorData() has resolved successfully.
 */
export function isVendorDataLoaded() {
  return vendorData.records !== null;
}

/**
 * Returns the cached normalized vendor directory.
 * @returns {{records: Array, byStallId: Map}}
 * @throws {Error} If loadVendorData() has not resolved yet.
 */
export function getVendorData() {
  if (vendorData.records === null) {
    throw new Error('Vendor data not loaded yet — call loadVendorData() first');
  }
  return vendorData;
}

/**
 * Looks up the vendor occupying a given stall/slot ID.
 * @param {string} stallId - SVG shape ID, e.g. "id_154" or "slot_dm_001".
 * @returns {Object|null} Canonical vendor record, or null for vacant slots.
 */
export function getVendorByStallId(stallId) {
  return vendorData.byStallId?.get(stallId) ?? null;
}

/**
 * Inserts or replaces a vendor record in the in-memory store (live Firestore
 * sync path). The detail card and future search index read through
 * getVendorByStallId, so they always reflect live truth.
 * @param {Object} vendor - Normalized vendor record with a stallId.
 */
export function upsertVendorRecord(vendor) {
  if (!vendor?.stallId || !vendorData.byStallId) return;
  vendorData.byStallId.set(vendor.stallId, vendor);
  const index = vendorData.records.findIndex((r) => r.stallId === vendor.stallId);
  if (index >= 0) {
    vendorData.records[index] = vendor;
  } else {
    vendorData.records.push(vendor);
  }
}

/**
 * Removes a vendor record from the in-memory store (live sync `removed`
 * events / closed stalls).
 * @param {string} stallId
 */
export function removeVendorRecord(stallId) {
  if (!vendorData.byStallId) return;
  vendorData.byStallId.delete(stallId);
  vendorData.records = vendorData.records.filter((r) => r.stallId !== stallId);
}
