/**
 * MerkadoGo Web — UI Controller
 *
 * Owns the floating Stall Details card: population, show/hide, and dismissal.
 * Vendor data comes from the dataStore via an injected getter, keeping this
 * module decoupled from data loading and trivially testable.
 */

import { selectStall, drawRoute, clearRoute as clearRouteLayer, NODE_TO_SVG_OFFSET, getStallCenter, highlightEntranceMarker, setEntranceMarkersVisibility, cancelActiveWalkingAnimation } from './mapRenderer.js';
import { resolveCategoryColors, normalizeCategorySlug } from './theme/colors.js';
import { getCategorySvg } from './theme/categoryIcons.js';
import { findPath, getPrimarySnapNode, getCandidateSnapNodes, findOptimalPath, getPathCost } from './pathfinder.js';
import { generateDirections } from './turnGenerator.js';

/** Selector mirroring mapRenderer's stall hit-test targets */
const STALL_SELECTOR = '.market-stall, [id^="id_"], [id^="slot_"], [data-stall-id]';

/**
 * Builds the "STALL #15 • BUILDING II" display tag. `stall_number` is
 * display-only with inconsistent source formatting ("STALL #15", "#5", "11")
 * — shown verbatim, never parsed (Master Context §10).
 * @param {Object} vendor - Normalized vendor record.
 * @returns {string} Joined tag, or empty string when nothing to show.
 */
function buildStallTag(vendor) {
  return [vendor.stallNumber, vendor.section]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' • ');
}

/**
 * Parses time string like "6:00 AM" or "06:00" into minutes from midnight.
 * @param {string} timeStr
 * @returns {number|null} Minutes from midnight (0-1439), or null if invalid.
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const cleaned = timeStr.trim().toUpperCase();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3];

  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

/**
 * Checks if a vendor is currently open based on operating hours and days open.
 * @param {Object} vendor
 * @returns {{ isOpen: boolean, hoursText: string, statusText: string }}
 */
function getOperatingStatus(vendor) {
  const openTime = vendor.openTime || '6:00 AM';
  const closeTime = vendor.closeTime || '6:00 PM';
  const hoursText = `${openTime} – ${closeTime}`;

  if (vendor.status === 'closed' || vendor.isOpen === false) {
    return { isOpen: false, hoursText, statusText: 'Closed' };
  }

  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
  const daysOpen = Array.isArray(vendor.daysOpen) && vendor.daysOpen.length > 0
    ? vendor.daysOpen
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const isDayOpen = daysOpen.includes(currentDay) || daysOpen.includes('Daily') || daysOpen.length === 7;
  if (!isDayOpen) {
    return { isOpen: false, hoursText, statusText: 'Closed Today' };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = parseTimeToMinutes(openTime);
  const closeMinutes = parseTimeToMinutes(closeTime);

  if (openMinutes !== null && closeMinutes !== null) {
    if (closeMinutes > openMinutes) {
      const isOpen = currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
      return { isOpen, hoursText, statusText: isOpen ? 'Open Now' : 'Closed' };
    } else {
      const isOpen = currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
      return { isOpen, hoursText, statusText: isOpen ? 'Open Now' : 'Closed' };
    }
  }

  return { isOpen: true, hoursText, statusText: 'Open Now' };
}

/**
 * Initializes the Stall Details card and its interaction wiring.
 * @param {Object} options
 * @param {Map<string, SVGElement>} options.stallElements - Indexed stall SVG elements.
 * @param {function(string): Object|null} options.getVendor - Resolves a stall ID to a vendor (or null for vacant slots).
 * @param {Object} options.stallNodes - Mapping of stall IDs to corridor snap nodes.
 * @returns {{ showStall: function(string): void, hide: function(): void, currentStallId: string|null }}
 */
export function initStallDetailCard({ stallElements, getVendor, stallNodes }) {
  const card = document.getElementById('stall-detail-card');
  const photoImg = document.getElementById('detail-photo-img');
  const photoFallback = document.getElementById('detail-photo-fallback');
  const fallbackLabel = document.getElementById('detail-fallback-label');
  const categoryBadge = document.getElementById('detail-category-badge');
  const hoursStatus = document.getElementById('detail-hours-status');
  const vendorName = document.getElementById('detail-vendor-name');
  const stallTag = document.getElementById('detail-stall-tag');
  const stallTagRow = stallTag?.parentElement;
  const hoursRow = document.getElementById('detail-hours-row');
  const hoursText = document.getElementById('detail-hours-text');
  const address = document.getElementById('detail-address');
  const btnClose = document.getElementById('btn-close-detail');
  const btnRoute = document.getElementById('btn-route-here');

  if (!card || !categoryBadge || !vendorName || !stallTag || !address) {
    throw new Error('Stall detail card elements missing from index.html');
  }

  let currentStallId = null;

  const appRoot = document.getElementById('app');

  function hide() {
    card.hidden = true;
    currentStallId = null;
    appRoot?.classList.remove('detail-open');
    selectStall(null, stallElements);
  }

  function showStall(stallId) {
    const vendor = getVendor(stallId);

    // Vacant slots and unassigned stalls are clickable-but-unlabeled
    // (Master Context §3.2): no vendor, no card.
    if (!vendor) {
      hide();
      return;
    }

    currentStallId = stallId;

    // Photo Header (Cloudinary CDN or graceful category banner fallback)
    const slug = normalizeCategorySlug(vendor.category);
    const { fill } = resolveCategoryColors(vendor.category);
    const photoUrl = Array.isArray(vendor.photoUrls) && vendor.photoUrls.length > 0 ? vendor.photoUrls[0] : null;

    if (photoImg && photoFallback) {
      if (photoUrl) {
        photoImg.src = photoUrl;
        photoImg.alt = `${vendor.name} Photo`;
        photoImg.hidden = false;
        photoFallback.hidden = true;
        photoImg.onerror = () => {
          photoImg.hidden = true;
          photoImg.removeAttribute('src');
          photoFallback.hidden = false;
        };
      } else {
        photoImg.hidden = true;
        photoImg.removeAttribute('src');
        photoFallback.hidden = false;
      }
      if (fallbackLabel) {
        fallbackLabel.textContent = vendor.category ? `${vendor.category} Section` : 'Ligao Public Market';
      }
    }

    vendorName.textContent = vendor.name;

    // Category badge: exact vector SVG icon tinted with canonical category color (replaces dot)
    categoryBadge.replaceChildren();
    const iconSpan = document.createElement('span');
    iconSpan.className = 'badge-category-vector';
    iconSpan.innerHTML = getCategorySvg(slug, 15, fill);
    categoryBadge.appendChild(iconSpan);
    categoryBadge.appendChild(document.createTextNode(vendor.category || 'Unassigned'));

    // Operating Hours & Open/Closed Status
    const { isOpen, hoursText: displayHours, statusText } = getOperatingStatus(vendor);
    if (hoursText) {
      const days = Array.isArray(vendor.daysOpen) && vendor.daysOpen.length === 7 ? 'Daily' : (vendor.daysOpen?.join(', ') || 'Daily');
      hoursText.textContent = `${displayHours} • ${days}`;
    }
    if (hoursStatus) {
      hoursStatus.textContent = statusText;
      hoursStatus.classList.toggle('badge-hours-status--open', isOpen);
      hoursStatus.classList.toggle('badge-hours-status--closed', !isOpen);
    }

    const tag = buildStallTag(vendor);
    stallTag.textContent = tag;
    if (stallTagRow) {
      stallTagRow.style.display = tag ? '' : 'none';
    }

    address.textContent = vendor.address || 'Ligao City Public Market, Bagumbayan, Ligao City';

    // Verify routing availability (does the stall have a snap node?)
    if (btnRoute) {
      const hasRoute = Boolean(stallNodes && stallNodes[stallId]);
      if (hasRoute) {
        btnRoute.disabled = false;
        btnRoute.innerHTML = `
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
          How Do I Get Here?
        `;
        btnRoute.classList.remove('btn--disabled');
      } else {
        btnRoute.disabled = true;
        btnRoute.innerHTML = `
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          No Route Available
        `;
        btnRoute.classList.add('btn--disabled');
      }
    }

    card.hidden = false;
    appRoot?.classList.add('detail-open');
  }

  btnClose?.addEventListener('click', hide);

  // Escape dismisses (desktop debugging convenience; kiosk is touch-driven)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !card.hidden) {
      hide();
    }
  });

  // Tap-away dismissal: a click that lands on neither the card, a stall, map controls, nor header
  document.addEventListener('click', (e) => {
    if (card.hidden || currentStallId === null) return;
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    if (target.closest('#stall-detail-card')) return;
    if (target.closest(STALL_SELECTOR)) return;
    if (target.closest('.map-controls-group')) return;
    if (target.closest('.top-overlay')) return;
    hide();
  });

  return {
    showStall,
    hide,
    get currentStallId() {
      return currentStallId;
    }
  };
}

/**
 * Initializes the turn-by-turn Navigation Panel (Task 4.3).
 *
 * Owns the route interaction flow: entrance gate selection (populated from
 * market_entry_points.json), A* routing to the selected stall's primary snap
 * node, the flat <polyline> overlay in #route-layer, and the static
 * instruction list. Per the product decision, NO distances are displayed
 * anywhere — directions are angle-based only; the summary badge shows the
 * step count. The route is recomputed on every entrance change.
 *
 * On open, the entrance nearest to the destination BY WALKING DISTANCE
 * (shortest A* route, not straight line) is preselected so the shopper
 * immediately sees a usable route and can switch gates freely.
 *
 * @param {Object} options
 * @param {SVGGElement} options.routeLayer - #route-layer for the polyline overlay.
 * @param {{nodes: Object, adjacency: Object}} options.graph - Built A* graph (pathfinder.js).
 * @param {Object} options.stallNodes - Raw stall_nodes.json (string | string[] values).
 * @param {Array<{entrance_id: number, node_id: string, description: string}>} options.entryPoints - 14 gates.
 * @param {function(string): Object|null} options.getVendor - Resolves stall ID to vendor (destination name).
 * @param {function({cx: number, cy: number, width: number, height: number}): void} [options.onFocusBounds]
 *        Called with the route's bounding box so main.js can frame the route in the viewport.
 * @returns {{ openForStall: function(string): boolean, clearRoute: function(): void, close: function(): void, isOpen: function(): boolean }}
 */
export function initNavigationPanel({ routeLayer, markersLayer, graph, stallNodes, entryPoints, getVendor, stallElements, onFocusBounds, onEntranceSelectionChange, onSelectEntranceFromDropdown, onAvatarMove }) {
  const panel = document.getElementById('navigation-panel');
  const destinationLabel = document.getElementById('nav-destination-name');
  const entranceSelect = document.getElementById('entrance-select');
  const summary = document.getElementById('route-summary');
  const stepsCount = document.getElementById('route-steps-count');
  const instructionsList = document.getElementById('instructions-list');
  const btnClear = document.getElementById('btn-clear-route');
  const btnClose = document.getElementById('btn-close-navigation');
  const btnMinimize = document.getElementById('btn-minimize-navigation');
  const btnExpand = document.getElementById('btn-expand-navigation');
  const btnExitMinimized = document.getElementById('btn-exit-minimized');
  const minimizedBar = document.getElementById('nav-minimized-bar');
  const minimizedTitle = document.getElementById('nav-minimized-title');
  const minimizedSubtext = document.getElementById('nav-minimized-subtext');
  const entranceSelectionBanner = document.getElementById('entrance-selection-banner');
  const selectionBannerTarget = document.getElementById('selection-banner-target');
  const btnCancelSelection = document.getElementById('btn-cancel-entrance-selection');
  const bannerEntranceSelect = document.getElementById('banner-entrance-select');
  const btnSkipWalking = document.getElementById('btn-skip-walking');
  const btnChangeEntrance = document.getElementById('btn-change-entrance');
  const btnMinimizedChangeEntrance = document.getElementById('btn-minimized-change-entrance');
  const navPhotoImg = document.getElementById('nav-stall-photo-img');
  const navPhotoFallback = document.getElementById('nav-stall-photo-fallback');
  const navFallbackLabel = document.getElementById('nav-fallback-label');
  const appRoot = document.getElementById('app');

  if (!panel || !destinationLabel || !entranceSelect || !summary || !stepsCount || !instructionsList) {
    throw new Error('Navigation panel elements missing from index.html');
  }

  let currentStallId = null;
  let currentDestinationName = '';
  let isMinimized = false;
  let currentRouteController = null;

  function setMinimized(minimized) {
    isMinimized = Boolean(minimized);
    if (isMinimized) {
      panel.classList.add('navigation-panel--minimized');
      appRoot?.classList.add('nav-minimized');
    } else {
      panel.classList.remove('navigation-panel--minimized');
      appRoot?.classList.remove('nav-minimized');
    }
  }

  // Populate the entrance selector from market_entry_points.json (Master Context §3.5)
  for (const entry of entryPoints) {
    const option = document.createElement('option');
    option.value = String(entry.entrance_id);
    option.textContent = entry.description;
    entranceSelect.appendChild(option);
  }

  // Populate the quick entrance dropdown inside the selection guide banner
  if (bannerEntranceSelect) {
    bannerEntranceSelect.replaceChildren();
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.disabled = true;
    defaultOpt.selected = true;
    defaultOpt.textContent = 'Choose entrance from list (1 to 14)...';
    bannerEntranceSelect.appendChild(defaultOpt);

    for (const entry of entryPoints) {
      const option = document.createElement('option');
      option.value = String(entry.entrance_id);
      option.textContent = `Entrance ${entry.entrance_id} — ${entry.description}`;
      bannerEntranceSelect.appendChild(option);
    }

    bannerEntranceSelect.addEventListener('change', () => {
      const entrance = findEntranceById(bannerEntranceSelect.value);
      if (entrance) {
        highlightEntranceMarker(markersLayer, entrance.entrance_id);
        if (typeof onSelectEntranceFromDropdown === 'function') {
          onSelectEntranceFromDropdown(entrance);
        }
      }
    });
  }

  const findEntranceById = (id) => entryPoints.find((e) => String(e.entrance_id) === String(id));

  function updateNavVendorPhoto(stallId) {
    const vendor = getVendor(stallId);
    if (!vendor || !navPhotoImg || !navPhotoFallback) return;
    const photoUrl = Array.isArray(vendor.photoUrls) && vendor.photoUrls.length > 0 ? vendor.photoUrls[0] : null;
    if (photoUrl) {
      navPhotoImg.src = photoUrl;
      navPhotoImg.alt = `${vendor.name} Photo`;
      navPhotoImg.hidden = false;
      navPhotoFallback.hidden = true;
      navPhotoImg.onerror = () => {
        navPhotoImg.hidden = true;
        navPhotoImg.removeAttribute('src');
        navPhotoFallback.hidden = false;
      };
    } else {
      navPhotoImg.hidden = true;
      navPhotoImg.removeAttribute('src');
      navPhotoFallback.hidden = false;
    }
    if (navFallbackLabel) {
      navFallbackLabel.textContent = vendor.category ? `${vendor.category} Section` : (vendor.name || 'Ligao Public Market');
    }
  }

  function hide() {
    panel.hidden = true;
    currentStallId = null;
    setMinimized(false);
    appRoot?.classList.remove('nav-open');
    appRoot?.classList.remove('nav-minimized');
    appRoot?.classList.remove('walking-active');
    setEntranceMarkersVisibility(markersLayer, false);
    highlightEntranceMarker(markersLayer, null);
  }

  /** Clears the drawn route and instruction list; the panel stays usable. */
  function clearRoute() {
    clearRouteLayer(routeLayer);
    instructionsList.replaceChildren();
    summary.hidden = true;
    entranceSelect.value = '';
    highlightEntranceMarker(markersLayer, null);
    setEntranceMarkersVisibility(markersLayer, false);
    if (bannerEntranceSelect) bannerEntranceSelect.value = '';
    if (minimizedSubtext) minimizedSubtext.textContent = '';
  }

  function cancelEntranceSelection() {
    if (entranceSelectionBanner) entranceSelectionBanner.hidden = true;
    if (bannerEntranceSelect) bannerEntranceSelect.value = '';
    appRoot?.classList.remove('selecting-entrance');
    setEntranceMarkersVisibility(markersLayer, false);
    highlightEntranceMarker(markersLayer, null);
    if (typeof onEntranceSelectionChange === 'function') {
      onEntranceSelectionChange(false);
    }
  }

  function startEntranceSelection(stallId = null) {
    if (stallId) currentStallId = stallId;
    if (!currentStallId) return;
    const vendor = getVendor(currentStallId);
    currentDestinationName = vendor?.name || currentStallId;
    destinationLabel.textContent = `To: ${currentDestinationName}`;
    if (minimizedTitle) minimizedTitle.textContent = currentDestinationName;
    if (selectionBannerTarget) {
      selectionBannerTarget.textContent = `Tap a pin on the map or choose below`;
    }
    if (bannerEntranceSelect) bannerEntranceSelect.value = '';
    if (entranceSelectionBanner) entranceSelectionBanner.hidden = false;
    setEntranceMarkersVisibility(markersLayer, true, null);
    appRoot?.classList.add('selecting-entrance');
    if (typeof onEntranceSelectionChange === 'function') {
      onEntranceSelectionChange(true);
    }
  }

  function close() {
    cancelActiveWalkingAnimation();
    if (btnSkipWalking) btnSkipWalking.hidden = true;
    cancelEntranceSelection();
    setEntranceMarkersVisibility(markersLayer, false);
    highlightEntranceMarker(markersLayer, null);
    clearRoute();
    hide();
    if (stallElements) {
      selectStall(null, stallElements);
    }
  }

  /** Renders instruction text only — step numbers + copy, no distances. */
  function renderSteps(steps) {
    instructionsList.replaceChildren();
    steps.forEach((step, index) => {
      const li = document.createElement('li');
      li.className = 'instruction-step';

      const number = document.createElement('span');
      number.className = 'step-number';
      number.textContent = String(index + 1);

      const textGroup = document.createElement('span');
      textGroup.className = 'step-text-group';
      const text = document.createElement('span');
      text.className = 'step-text';
      text.textContent = step.instruction;
      textGroup.appendChild(text);

      li.appendChild(number);
      li.appendChild(textGroup);
      instructionsList.appendChild(li);
    });
  }

  /** Route bounding box in SVG canvas space (node space + calibrated offset)
   *  so the viewport frames the drawn polyline, not the raw node frame. */
  function computeRouteBounds(path, destCenter) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const nodeId of path) {
      const { x, y } = graph.nodes[nodeId];
      const sx = x + NODE_TO_SVG_OFFSET.x;
      const sy = y + NODE_TO_SVG_OFFSET.y;
      if (sx < minX) minX = sx;
      if (sy < minY) minY = sy;
      if (sx > maxX) maxX = sx;
      if (sy > maxY) maxY = sy;
    }
    if (destCenter && typeof destCenter.x === 'number' && typeof destCenter.y === 'number') {
      if (destCenter.x < minX) minX = destCenter.x;
      if (destCenter.y < minY) minY = destCenter.y;
      if (destCenter.x > maxX) maxX = destCenter.x;
      if (destCenter.y > maxY) maxY = destCenter.y;
    }
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, width: maxX - minX, height: maxY - minY };
  }

  function routeTo(entrance, destinationName, options = {}) {
    const candidates = getCandidateSnapNodes(stallNodes[currentStallId]);
    if (candidates.length === 0) {
      console.warn(`[MerkadoGo Nav] Stall "${currentStallId}" has no snap nodes — no route drawn`);
      return null;
    }

    const optimal = findOptimalPath(graph, entrance.node_id, candidates);
    if (!optimal || optimal.path.length === 0) {
      console.warn(`[MerkadoGo Nav] No route from entrance ${entrance.entrance_id} to "${currentStallId}"`);
      clearRouteLayer(routeLayer);
      instructionsList.replaceChildren();
      summary.hidden = true;
      return null;
    }

    const path = optimal.path;

    // Resolve the destination stall center so the polyline extends from the
    // nearest corridor snap node directly into the center of the stall rectangle
    const stallElement = stallElements?.get(currentStallId);
    const destCenter = getStallCenter(stallElement);

    const steps = generateDirections(path, graph.nodes, {
      entranceDescription: entrance.description,
      destinationName
    });
    const controller = drawRoute(routeLayer, path, graph.nodes, destCenter, {
      ...options,
      steps,
      entrance
    });
    renderSteps(steps);
    const countText = `${steps.length} ${steps.length === 1 ? 'Step' : 'Steps'}`;
    stepsCount.textContent = countText;
    summary.hidden = false;
    updateNavVendorPhoto(currentStallId);

    // Update minimized bar text
    if (minimizedTitle) minimizedTitle.textContent = destinationName;
    if (minimizedSubtext) minimizedSubtext.textContent = `${countText} • via ${entrance.description}`;

    if (!options.animateAvatar) {
      onFocusBounds?.(computeRouteBounds(path, destCenter));
    }
    return controller;
  }

  /**
   * Routes from an explicitly chosen entrance point.
   * Runs the camera-tracking walking animation, shows the Skip button,
   * hides all other 13 entrance markers, and defers the navigation panel until arrival.
   */
  function routeFromEntrance(entrance) {
    if (!currentStallId || !entrance) return false;
    cancelEntranceSelection();
    entranceSelect.value = String(entrance.entrance_id);
    highlightEntranceMarker(markersLayer, entrance.entrance_id);

    // Keep only the chosen entrance marker visible
    setEntranceMarkersVisibility(markersLayer, true, entrance.entrance_id);

    // Defer opening navigation panel until walking animation is complete
    panel.hidden = true;
    setMinimized(false);

    // Show floating Skip button and activate walking mode (yields map controls)
    if (btnSkipWalking) btnSkipWalking.hidden = false;
    appRoot?.classList.add('walking-active');

    currentRouteController = routeTo(entrance, currentDestinationName, {
      animateAvatar: true,
      onProgress: (pt) => {
        onAvatarMove?.(pt);
      },
      onComplete: () => {
        if (btnSkipWalking) btnSkipWalking.hidden = true;
        appRoot?.classList.remove('walking-active');
        // Frame full route bounds using optimal path
        const candidates = getCandidateSnapNodes(stallNodes[currentStallId]);
        const optimal = findOptimalPath(graph, entrance.node_id, candidates);
        const stallElement = stallElements?.get(currentStallId);
        const destCenter = getStallCenter(stallElement);
        if (optimal && optimal.path.length > 0) {
          onFocusBounds?.(computeRouteBounds(optimal.path, destCenter));
        }
        // Open navigation panel in clean minimized bar mode so map & destination arrival are showcased
        setMinimized(true);
        panel.hidden = false;
        appRoot?.classList.add('nav-open');
      }
    });

    return true;
  }

  /**
   * Opens the panel for a destination stall and routes from the entrance
   * with the shortest A* walking distance to it across all candidate access nodes.
   * Returns false when the stall cannot be snapped to the graph (warn, never crash).
   */
  function openForStall(stallId) {
    const candidates = getCandidateSnapNodes(stallNodes[stallId]);
    if (candidates.length === 0) {
      console.warn(`[MerkadoGo Nav] Cannot route to "${stallId}" — no snap node in stall_nodes.json`);
      return false;
    }

    const vendor = getVendor(stallId);
    currentStallId = stallId;
    currentDestinationName = vendor?.name || stallId;
    destinationLabel.textContent = `To: ${currentDestinationName}`;
    if (minimizedTitle) minimizedTitle.textContent = currentDestinationName;

    // Nearest entrance by true walking distance over the corridor graph across all candidate access nodes
    let nearest = entryPoints[0];
    let nearestCost = Infinity;
    for (const entry of entryPoints) {
      const optimal = findOptimalPath(graph, entry.node_id, candidates);
      if (optimal && optimal.cost < nearestCost) {
        nearestCost = optimal.cost;
        nearest = entry;
      }
    }
    entranceSelect.value = String(nearest.entrance_id);
    highlightEntranceMarker(markersLayer, nearest.entrance_id);
    setEntranceMarkersVisibility(markersLayer, true, nearest.entrance_id);

    currentRouteController = routeTo(nearest, currentDestinationName, { animateAvatar: false });
    updateNavVendorPhoto(currentStallId);
    setMinimized(false);
    panel.hidden = false;
    appRoot?.classList.add('nav-open');
    return true;
  }

  entranceSelect.addEventListener('change', () => {
    const entrance = findEntranceById(entranceSelect.value);
    if (currentStallId && entrance) {
      highlightEntranceMarker(markersLayer, entrance.entrance_id);
      setEntranceMarkersVisibility(markersLayer, true, entrance.entrance_id);
      currentRouteController = routeTo(entrance, currentDestinationName, { animateAvatar: false });
    }
  });

  btnCancelSelection?.addEventListener('click', (e) => {
    e.stopPropagation();
    const stallId = currentStallId;
    cancelEntranceSelection();
    highlightEntranceMarker(markersLayer, null);
    if (typeof onEntranceSelectionChange === 'function') {
      onEntranceSelectionChange(false, stallId);
    }
  });

  function handleChangeEntrance() {
    cancelActiveWalkingAnimation();
    if (btnSkipWalking) btnSkipWalking.hidden = true;
    clearRoute();
    panel.hidden = true;
    appRoot?.classList.remove('nav-open');
    appRoot?.classList.remove('nav-minimized');
    appRoot?.classList.remove('walking-active');
    setEntranceMarkersVisibility(markersLayer, true, null);
    startEntranceSelection(currentStallId);
  }

  btnChangeEntrance?.addEventListener('click', (e) => {
    e.stopPropagation();
    handleChangeEntrance();
  });

  btnMinimizedChangeEntrance?.addEventListener('click', (e) => {
    e.stopPropagation();
    handleChangeEntrance();
  });

  btnSkipWalking?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (btnSkipWalking) btnSkipWalking.hidden = true;
    appRoot?.classList.remove('walking-active');
    if (currentRouteController && typeof currentRouteController.cancel === 'function') {
      currentRouteController.cancel();
    } else {
      panel.hidden = false;
      setMinimized(true);
      appRoot?.classList.add('nav-open');
    }
  });

  // Minimize / Expand buttons
  btnMinimize?.addEventListener('click', (e) => {
    e.stopPropagation();
    setMinimized(true);
  });

  btnExpand?.addEventListener('click', (e) => {
    e.stopPropagation();
    setMinimized(false);
  });

  // Tapping the minimized bar expands it (unless clicking exit)
  minimizedBar?.addEventListener('click', (e) => {
    if (e.target.closest('#btn-exit-minimized')) return;
    setMinimized(false);
  });

  btnClear?.addEventListener('click', clearRoute);
  btnClose?.addEventListener('click', close);
  btnExitMinimized?.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });

  // Escape key: minimizes if expanded, closes if already minimized
  document.addEventListener('keydown', (e) => {
    if (appRoot?.classList.contains('selecting-entrance')) {
      cancelEntranceSelection();
      return;
    }
    if (e.key === 'Escape' && !panel.hidden) {
      if (!isMinimized) {
        setMinimized(true);
      } else {
        close();
      }
    }
  });

  // Tap-away: clicking empty map area minimizes sheet instead of canceling route!
  document.addEventListener('click', (e) => {
    if (panel.hidden) return;
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    if (target.closest('#navigation-panel')) return;
    if (target.closest(STALL_SELECTOR)) return;
    if (target.closest('#stall-detail-card')) return;
    if (target.closest('#entrance-preview-card')) return;
    if (target.closest('.entrance-marker')) return;
    if (target.closest('#entrance-selection-banner')) return;
    if (target.closest('.map-controls-group')) return;
    if (target.closest('.top-overlay')) return;

    if (!isMinimized) {
      setMinimized(true);
    }
  });

  return {
    openForStall,
    startEntranceSelection,
    cancelEntranceSelection,
    routeFromEntrance,
    clearRoute,
    close,
    setMinimized,
    syncSelectedEntrance: (entranceId) => {
      if (bannerEntranceSelect) bannerEntranceSelect.value = entranceId ? String(entranceId) : '';
    },
    isOpen: () => !panel.hidden,
    isMinimized: () => isMinimized,
    isSelectingEntrance: () => Boolean(appRoot?.classList.contains('selecting-entrance')),
    getCurrentStallId: () => currentStallId
  };
}

/**
 * Controller for the Floating Entrance Preview Card (Task 4.6).
 * Shows entrance details when an entrance marker on the map is clicked,
 * providing photo/storefront fallback, title, description, and "Start Route Here" button.
 *
 * @param {Object} [options]
 * @param {function(Object): void} [options.onStartRoute] - Called when "Start Route Here" is clicked.
 * @param {function(): void} [options.onDismiss] - Called when preview card is dismissed.
 * @returns {{ show: function(Object): void, hide: function(): void, isOpen: function(): boolean, getCurrentEntrance: function(): Object|null }}
 */
export function initEntrancePreviewCard({ onStartRoute, onDismiss } = {}) {
  const card = document.getElementById('entrance-preview-card');
  const img = document.getElementById('entrance-preview-img');
  const fallback = document.getElementById('entrance-photo-fallback');
  const btnClose = document.getElementById('btn-close-entrance-preview');
  const badgeNumber = document.getElementById('entrance-preview-number');
  const titleEl = document.getElementById('entrance-preview-title');
  const nodeEl = document.getElementById('entrance-preview-node');
  const addressEl = document.getElementById('entrance-preview-address');
  const btnStart = document.getElementById('btn-start-route-here');
  const appRoot = document.getElementById('app');

  let currentEntrance = null;

  if (!card) return null;

  function hide() {
    card.hidden = true;
    currentEntrance = null;
    appRoot?.classList.remove('preview-open');
    if (typeof onDismiss === 'function') {
      onDismiss();
    }
  }

  function show(entrance) {
    if (!entrance) return;
    currentEntrance = entrance;

    if (badgeNumber) badgeNumber.textContent = `Entrance ${entrance.entrance_id}`;
    if (titleEl) titleEl.textContent = entrance.description;
    if (nodeEl) nodeEl.textContent = `PUBLIC MARKET ENTRANCE`;
    if (addressEl) addressEl.textContent = `Street Access Point • Ligao City Public Market`;

    // Handle photo display with graceful civic fallback banner
    if (img && fallback) {
      if (entrance.image_url) {
        img.src = entrance.image_url;
        img.hidden = false;
        fallback.hidden = true;
        img.onerror = () => {
          img.hidden = true;
          fallback.hidden = false;
        };
      } else {
        img.hidden = true;
        fallback.hidden = false;
      }
    }

    card.hidden = false;
    appRoot?.classList.add('preview-open');
  }

  btnClose?.addEventListener('click', (e) => {
    e.stopPropagation();
    hide();
  });

  btnStart?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentEntrance && typeof onStartRoute === 'function') {
      onStartRoute(currentEntrance);
    }
    hide();
  });

  // Escape key closes preview
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !card.hidden) {
      hide();
    }
  });

  return {
    show,
    hide,
    isOpen: () => !card.hidden,
    getCurrentEntrance: () => currentEntrance
  };
}

/**
 * Initializes the Collapsible Category Tags Panel inspired by Image 2.
 * @param {Object} options
 * @param {function(string): void} [options.onCategorySelect] - Callback when category changes.
 * @returns {{ open: function(): void, close: function(): void, selectCategory: function(string, string?): void, getActiveCategory: function(): string }|null}
 */
export function initCategoryPanel({ onCategorySelect } = {}) {
  const container = document.getElementById('search-container');
  const btnToggle = document.getElementById('btn-toggle-categories');
  const dropdown = document.getElementById('search-category-dropdown');
  const grid = document.getElementById('category-grid');
  const labelEl = document.getElementById('search-category-label');
  const countBadgeEl = document.getElementById('dropdown-zone-count');
  const btnReset = document.getElementById('btn-reset-categories');
  const btnDone = document.getElementById('btn-done-categories');

  if (!btnToggle || !dropdown) return null;

  // Set of selected category slugs. Default: ['all']
  const selectedCategories = new Set(['all']);

  function open() {
    dropdown.hidden = false;
    btnToggle.setAttribute('aria-expanded', 'true');
  }

  function close() {
    dropdown.hidden = true;
    btnToggle.setAttribute('aria-expanded', 'false');
  }

  function updateUI() {
    const isAll = selectedCategories.has('all') || selectedCategories.size === 0;

    // Update active class on grid items
    const items = grid ? grid.querySelectorAll('.category-item') : [];
    items.forEach((item) => {
      const slug = item.dataset.category;
      const match = isAll ? slug === 'all' : selectedCategories.has(slug);
      item.classList.toggle('category-item--active', match);
    });

    // Update dropdown header badge
    if (countBadgeEl) {
      if (isAll) {
        countBadgeEl.textContent = '18 Zones';
      } else {
        countBadgeEl.textContent = `${selectedCategories.size} Selected`;
      }
    }

    // Update integrated button label and styling inside search bar
    if (labelEl) {
      if (isAll) {
        labelEl.textContent = '18 Zones';
        btnToggle.classList.remove('btn-search-category--active');
      } else if (selectedCategories.size === 1) {
        const firstSlug = Array.from(selectedCategories)[0];
        const activeItem = grid?.querySelector(`.category-item[data-category="${firstSlug}"]`);
        const name = activeItem?.querySelector('.category-item-label')?.textContent || firstSlug;
        labelEl.textContent = name;
        btnToggle.classList.add('btn-search-category--active');
      } else {
        // Multi-select label: e.g. "Produce +1"
        const slugs = Array.from(selectedCategories);
        const firstItem = grid?.querySelector(`.category-item[data-category="${slugs[0]}"]`);
        const firstName = firstItem?.querySelector('.category-item-label')?.textContent || slugs[0];
        const shortFirst = firstName.split('(')[0].trim();
        const extra = slugs.length - 1;
        labelEl.textContent = `${shortFirst} +${extra}`;
        btnToggle.classList.add('btn-search-category--active');
      }
    }

    onCategorySelect?.(isAll ? ['all'] : Array.from(selectedCategories));
  }

  function toggleCategory(categorySlug) {
    if (categorySlug === 'all') {
      selectedCategories.clear();
      selectedCategories.add('all');
    } else {
      // Remove 'all' if present
      selectedCategories.delete('all');

      if (selectedCategories.has(categorySlug)) {
        // Toggle OFF (deselect)
        selectedCategories.delete(categorySlug);
        // If all specific categories deselected, revert to 'all'
        if (selectedCategories.size === 0) {
          selectedCategories.add('all');
        }
      } else {
        // Toggle ON (multi-select)
        selectedCategories.add(categorySlug);
      }
    }

    updateUI();
  }

  btnToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dropdown.hidden) {
      open();
    } else {
      close();
    }
  });

  // Tap category item in 2-column grid (supports multi-select & toggle off)
  grid?.addEventListener('click', (e) => {
    const item = e.target.closest('.category-item');
    if (!item) return;
    const slug = item.dataset.category || 'all';
    toggleCategory(slug);
  });

  // Reset / Clear All
  btnReset?.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedCategories.clear();
    selectedCategories.add('all');
    updateUI();
  });

  // Done button collapses panel
  btnDone?.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });

  // Escape key collapses
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dropdown.hidden) {
      close();
    }
  });

  // Tap outside collapses
  document.addEventListener('click', (e) => {
    if (dropdown.hidden) return;
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    if (target.closest('#search-container')) return;
    close();
  });

  return {
    open,
    close,
    toggleCategory,
    getSelectedCategories: () => (selectedCategories.has('all') ? ['all'] : Array.from(selectedCategories))
  };
}

/**
 * Initializes the live real-time clock & date badge in the header brand bar.
 * Displays user's requested date format (e.g. "Wed 9/2 • 10:37 PM") and updates live.
 */
export function initLiveClock() {
  const dateEl = document.getElementById('live-date-text');
  const timeEl = document.getElementById('live-time-text');
  if (!dateEl || !timeEl) return;

  function update() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekday = now.toLocaleDateString('en-US', { weekday: 'short' });

    // Top line: Date e.g. "Wed, 9/2"
    dateEl.textContent = `${weekday}, ${month}/${day}`;

    // Bottom line: Time with seconds e.g. "10:41:25 PM"
    timeEl.textContent = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }

  update();
  setInterval(update, 1000);
}

