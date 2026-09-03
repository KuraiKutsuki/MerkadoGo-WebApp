import { ZONE_PALETTE, APP_COLORS, resolveCategoryColors } from './theme/colors.js';

/**
 * Exact calibrated translation from map_nodes.json coordinate space ("node space")
 * to the SVG canvas coordinate space. Mathematically derived and verified against
 * all 112 embedded vector node rectangles in LigaoCity_PublicMarket_Map.svg.
 * Centers all route polylines precisely within pedestrian aisles and corridors.
 * @type {{x: number, y: number}}
 */
export const NODE_TO_SVG_OFFSET = Object.freeze({ x: 7823.47, y: 3174.0 });

/**
 * Applies the default Unassigned style to a stall element (#E2E8F0 / #94A3B8)
 * @param {SVGElement} element 
 */
export function applyUnassignedStyle(element) {
  if (!element) return;
  element.setAttribute('fill', ZONE_PALETTE.unassigned.fill);
  element.setAttribute('stroke', ZONE_PALETTE.unassigned.outline);
  element.setAttribute('stroke-width', '2');
}

/**
 * Applies a custom fill and outline stroke to a stall element
 * @param {SVGElement} element 
 * @param {string} fill 
 * @param {string} stroke 
 */
export function setStallStyle(element, fill, stroke) {
  if (!element) return;
  if (fill) element.setAttribute('fill', fill);
  if (stroke) element.setAttribute('stroke', stroke);
  element.setAttribute('stroke-width', '2');
}

/**
 * Highlights or unhighlights a stall on the map
 * @param {string} stallId 
 * @param {Map<string, SVGElement>} stallElements 
 * @param {boolean} isHighlighted 
 */
export function highlightStall(stallId, stallElements, isHighlighted = true) {
  const element = stallElements.get(stallId);
  if (!element) return;
  if (isHighlighted) {
    element.classList.add('stall--highlighted');
  } else {
    element.classList.remove('stall--highlighted');
  }
}

/**
 * Selects a stall, applying the selected outline class and clearing previous selection
 * @param {string|null} stallId 
 * @param {Map<string, SVGElement>} stallElements 
 * @returns {SVGElement|null}
 */
export function selectStall(stallId, stallElements) {
  // Clear any existing selected class across all stalls
  stallElements.forEach((el) => {
    el.classList.remove('stall--selected');
  });

  if (!stallId) return null;

  const selectedEl = stallElements.get(stallId);
  if (selectedEl) {
    selectedEl.classList.add('stall--selected');
  }
  return selectedEl;
}

/**
 * Sets up delegated click hit-testing on the market SVG
 * @param {SVGSVGElement} svgElement 
 * @param {Map<string, SVGElement>} stallElements 
 * @param {function(string, SVGElement): void} [onStallClick] 
 */
export function setupStallHitTesting(svgElement, stallElements, onStallClick) {
  svgElement.addEventListener('click', (e) => {
    // Find the closest stall element in the SVG DOM
    const stallNode = e.target.closest('.market-stall, [id^="id_"], [id^="slot_"], [data-stall-id]');
    if (!stallNode) return;

    const stallId = stallNode.id || stallNode.getAttribute('data-stall-id');
    if (!stallId) return;

    console.log(`[MerkadoGo HitTest] Clicked stall: ${stallId}`, stallNode);

    selectStall(stallId, stallElements);

    if (typeof onStallClick === 'function') {
      onStallClick(stallId, stallNode);
    }
  });
}

/**
 * Applies a single vendor's zone colors to its SVG stall element.
 * Color is resolved ONLY from the vendor's primary category through the
 * canonical ZONE_PALETTE — never from a stored hex (Master Context §3.3/§6).
 * Defensive by design: an unknown stall ID warns and returns false instead
 * of throwing (Master Context §10).
 * @param {Object} vendor - Normalized vendor record (see normalizeStallRecord).
 * @param {Map<string, SVGElement>} stallElements
 * @returns {boolean} True if the element was found and colored.
 */
export function applyVendorToStall(vendor, stallElements) {
  const element = stallElements.get(vendor.stallId);
  if (!element) {
    console.warn(`[MerkadoGo Map] Stall "${vendor.stallId}" (${vendor.name}) has no matching SVG element — skipped`);
    return false;
  }
  const { fill, outline } = resolveCategoryColors(vendor.category);
  setStallStyle(element, fill, outline);
  return true;
}

/**
 * Colors all vendor polygons from their primary_category via ZONE_PALETTE.
 * Stalls without a vendor keep their Unassigned default (Task 2.1 styling).
 * @param {Array<Object>} vendors - Normalized vendor records.
 * @param {Map<string, SVGElement>} stallElements
 * @returns {{applied: number, unmatched: number}}
 */
export function applyVendorColors(vendors, stallElements) {
  let applied = 0;
  let unmatched = 0;
  (vendors || []).forEach((vendor) => {
    if (applyVendorToStall(vendor, stallElements)) {
      applied++;
    } else {
      unmatched++;
    }
  });

  console.log(`[MerkadoGo Map] Vendor coloring applied: ${applied} stalls colored by primary_category, ${unmatched} unmatched vendor records, ${stallElements.size - applied} stalls remain Unassigned.`);
  return { applied, unmatched };
}

/**
 * Draws the active route as a single flat <polyline> in the dedicated
 * #route-layer (Master Context §7.4). Node-space coordinates are translated
 * into SVG canvas space via NODE_TO_SVG_OFFSET (mobile-calibrated). The
 * layer sits above the stall layer inside #map-transform-layer, so the line
 * pans/zooms/rotates with the map and recalculating a route never touches
 * vendor polygons. Styling comes from the #route-layer polyline CSS rule
 * (primary green, 4px, round caps). Replaces any previously drawn route;
 * clearing on a broken path keeps the layer honest rather than showing a
 * stale line.
/**
 * Computes the center coordinates of an SVG stall element in SVG canvas space.
 * @param {SVGElement} element
 * @returns {{x: number, y: number}|null}
 */
export function getStallCenter(element) {
  if (!element || typeof element.getBBox !== 'function') return null;
  try {
    const bbox = element.getBBox();
    return {
      x: bbox.x + bbox.width / 2,
      y: bbox.y + bbox.height / 2
    };
  } catch (err) {
    console.warn('[MerkadoGo Map] Could not get stall center:', err);
    return null;
  }
}

/**
 * Draws the active route as a single flat <polyline> in the dedicated
 * #route-layer (Master Context §7.4). Node-space coordinates are translated
 * into SVG canvas space via NODE_TO_SVG_OFFSET (mobile-calibrated). If
 * a destinationPoint (e.g. stall center) is supplied, the polyline extends
 * directly from the final aisle snap node to the center of the stall element.
 *
 * @param {SVGGElement} routeLayer - The #route-layer container.
 * @param {string[]} nodeIds - Ordered path node IDs from findPath().
 * @param {Object.<string, {x: number, y: number}>} nodes - Graph node coordinates (node space).
 * @param {{x: number, y: number}|null} [destinationPoint=null] - Optional final point (stall center).
 * @returns {SVGPolylineElement|null} The drawn polyline, or null when nothing was drawn.
 */
export function drawRoute(routeLayer, nodeIds, nodes, destinationPoint = null) {
  routeLayer.replaceChildren();
  if (!Array.isArray(nodeIds) || nodeIds.length < 2 || !nodes) {
    return null;
  }

  const points = [];
  const coords = [];
  for (const nodeId of nodeIds) {
    const node = nodes[nodeId];
    if (!node) {
      console.warn(`[MerkadoGo Map] drawRoute: path references unknown node "${nodeId}" — route cleared`);
      routeLayer.replaceChildren();
      return null;
    }
    const sx = node.x + NODE_TO_SVG_OFFSET.x;
    const sy = node.y + NODE_TO_SVG_OFFSET.y;
    points.push(`${sx},${sy}`);
    coords.push({ x: sx, y: sy });
  }

  // Extend line from last corridor snap node straight into the destination stall center
  if (destinationPoint && typeof destinationPoint.x === 'number' && typeof destinationPoint.y === 'number') {
    const lastCoord = coords[coords.length - 1];
    const dist = Math.hypot(destinationPoint.x - lastCoord.x, destinationPoint.y - lastCoord.y);
    if (dist > 1) {
      points.push(`${destinationPoint.x},${destinationPoint.y}`);
      coords.push({ x: destinationPoint.x, y: destinationPoint.y });
    }
  }

  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('id', 'active-route');
  polyline.setAttribute('points', points.join(' '));
  routeLayer.appendChild(polyline);

  // Progressive stroke-draw animation tracing path from entrance to destination stall
  let totalLength = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    totalLength += Math.hypot(coords[i + 1].x - coords[i].x, coords[i + 1].y - coords[i].y);
  }

  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  if (!prefersReducedMotion && totalLength > 0) {
    polyline.style.strokeDasharray = `${totalLength} ${totalLength}`;
    polyline.style.strokeDashoffset = `${totalLength}`;
    // Force layout reflow before animating to 0
    void polyline.getBoundingClientRect();
    polyline.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.2, 0, 0.2, 1)';
    polyline.style.strokeDashoffset = '0';
  }

  return polyline;
}

/**
 * Removes the active route overlay from #route-layer.
 * @param {SVGGElement} routeLayer
 */
export function clearRoute(routeLayer) {
  routeLayer.replaceChildren();
}

/**
 * Loads LigaoCity_PublicMarket_Map.svg and injects it inline into the container
 * @param {HTMLElement} container - The #map-viewport DOM element
 * @returns {Promise<{
 *   svgElement: SVGSVGElement,
 *   transformLayer: SVGGElement,
 *   routeLayer: SVGGElement,
 *   markersLayer: SVGGElement,
 *   stallElements: Map<string, SVGElement>
 * }>}
 */
export async function loadAndInjectMap(container) {
  const loadingIndicator = document.getElementById('map-loading');
  
  try {
    const response = await fetch('/map/LigaoCity_PublicMarket_Map.svg');
    if (!response.ok) {
      throw new Error(`Failed to fetch SVG map: ${response.status} ${response.statusText}`);
    }
    
    const svgText = await response.text();
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;

    if (svgElement.nodeName.toLowerCase() !== 'svg') {
      throw new Error('Parsed document root is not an SVG element');
    }

    // Set SVG attributes for responsive scaling and hit-testing
    svgElement.setAttribute('id', 'market-svg');
    svgElement.setAttribute('width', '100%');
    svgElement.setAttribute('height', '100%');
    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // Create wrapper transform layer for CSS matrix pan/zoom
    const transformLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    transformLayer.setAttribute('id', 'map-transform-layer');

    // Ground plane: oversized canvas-colored rect beneath all artwork so any
    // exposed canvas margin (beyond drawn content) reads as uniform map ground
    // instead of a mismatched shade. Covers the 8004x8000 canvas plus
    // rotation margins. Color = APP_COLORS.canvas (user-preferred original).
    const groundRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    groundRect.setAttribute('id', 'map-ground');
    groundRect.setAttribute('x', '-4000');
    groundRect.setAttribute('y', '-4000');
    groundRect.setAttribute('width', '16004');
    groundRect.setAttribute('height', '16000');
    groundRect.setAttribute('fill', APP_COLORS.canvas);
    transformLayer.appendChild(groundRect);

    // Move existing SVG children inside transformLayer
    while (svgElement.firstChild) {
      const child = svgElement.firstChild;
      // Remove any dark background rectangle (fill="#1E1E1E") if present as first element
      if (child.nodeType === Node.ELEMENT_NODE && 
          child.tagName === 'rect' && 
          child.getAttribute('fill') === '#1E1E1E' && 
          child.getAttribute('width') === '8004') {
        svgElement.removeChild(child);
        continue;
      }
      transformLayer.appendChild(child);
    }

    // Create dedicated Route Overlay Layer (stacked above stalls)
    const routeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    routeLayer.setAttribute('id', 'route-layer');
    transformLayer.appendChild(routeLayer);

    // Create dedicated Markers Layer (pins, entrance gates)
    const markersLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    markersLayer.setAttribute('id', 'markers-layer');
    transformLayer.appendChild(markersLayer);

    svgElement.appendChild(transformLayer);

    // Index all stall shapes (id_* and slot_*) for O(1) attribute access and apply default styles
    const stallElements = new Map();
    const stallNodes = transformLayer.querySelectorAll('[id^="id_"], [id^="slot_"], [data-stall-id]');

    stallNodes.forEach((node) => {
      const stallId = node.id || node.getAttribute('data-stall-id');
      if (stallId) {
        stallElements.set(stallId, node);
        node.classList.add('market-stall');
        // Apply default Unassigned style: #E2E8F0 fill, #94A3B8 stroke, 2px stroke width
        applyUnassignedStyle(node);
      }
    });

    // Decorative Figma-export shapes ("Rectangle N" marks overlaying stalls)
    // must not swallow taps — pointer-events none lets hits pass through to
    // the stall beneath so delegated hit-testing stays reliable (Master Context §4)
    let decorativeCount = 0;
    transformLayer.querySelectorAll('rect[id^="Rectangle"]').forEach((rect) => {
      rect.setAttribute('pointer-events', 'none');
      decorativeCount++;
    });

    // Clear container and append the live SVG
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
    container.appendChild(svgElement);

    console.log(`[MerkadoGo Map] Injected SVG into DOM. Indexed & styled ${stallElements.size} stalls with default unassigned palette. ${decorativeCount} decorative overlay shapes set to pointer-events: none.`);

    return {
      svgElement,
      transformLayer,
      routeLayer,
      markersLayer,
      stallElements
    };
  } catch (error) {
    console.error('[MerkadoGo Map] Error loading SVG:', error);
    if (loadingIndicator) {
      loadingIndicator.innerHTML = `<span style="color: var(--color-error)">Failed to load market map. Please refresh.</span>`;
    }
    throw error;
  }
}

