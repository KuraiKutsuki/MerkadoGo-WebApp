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
 * @param {Object} [options={}] - Animation and callback options.
 * @param {boolean} [options.animateAvatar=true] - Whether to animate the walking avatar.
 * @param {function({x: number, y: number}): void} [options.onProgress] - Real-time camera tracking callback.
 * @param {function(): void} [options.onComplete] - Arrival callback.
 * @returns {{ polyline: SVGPathElement, cancel: function(): void }|null}
 */
let activeWalkingAnimation = null;

export function cancelActiveWalkingAnimation() {
  if (activeWalkingAnimation && typeof activeWalkingAnimation.cancel === 'function') {
    activeWalkingAnimation.cancel();
    activeWalkingAnimation = null;
  }
}

/**
 * Creates an animated vector walking pedestrian avatar.
 * Features articulated legs and arms with synchronized walk cycles,
 * a crimson market tote bag, a forest green cap, directional orientation flipping,
 * and a celebratory greeting wave upon arrival at the destination stall.
 * @returns {{ avatarGroup: SVGGElement, visual: SVGGElement }}
 */
function createWalkingAvatar() {
  const NS = 'http://www.w3.org/2000/svg';
  const avatarGroup = document.createElementNS(NS, 'g');
  avatarGroup.setAttribute('class', 'route-walking-avatar is-walking');

  // Scaler group: scales the pedestrian character prominently (~4.0x) for ideal corridor proportions
  const scaler = document.createElementNS(NS, 'g');
  scaler.setAttribute('class', 'walker-scaler');
  scaler.setAttribute('transform', 'scale(4.0)');

  // 1. Soft glowing aura underneath
  const halo = document.createElementNS(NS, 'circle');
  halo.setAttribute('class', 'avatar-pulse-halo');
  halo.setAttribute('cx', '0');
  halo.setAttribute('cy', '-3');
  halo.setAttribute('r', '26');
  scaler.appendChild(halo);

  // 2. Ground shadow that breathes with steps
  const shadow = document.createElementNS(NS, 'ellipse');
  shadow.setAttribute('class', 'walker-shadow');
  shadow.setAttribute('cx', '0');
  shadow.setAttribute('cy', '16');
  shadow.setAttribute('rx', '15');
  shadow.setAttribute('ry', '5.5');
  scaler.appendChild(shadow);

  // 3. Inner visual container that flips dynamically based on horizontal heading
  const visual = document.createElementNS(NS, 'g');
  visual.setAttribute('class', 'walker-visual');

  // Left Leg (back leg in walk-cycle)
  const leftLeg = document.createElementNS(NS, 'g');
  leftLeg.setAttribute('class', 'walker-leg walker-leg--left');
  const leftLegPants = document.createElementNS(NS, 'line');
  leftLegPants.setAttribute('x1', '-4');
  leftLegPants.setAttribute('y1', '2');
  leftLegPants.setAttribute('x2', '-4');
  leftLegPants.setAttribute('y2', '14');
  leftLegPants.setAttribute('stroke', '#144618');
  leftLegPants.setAttribute('stroke-width', '4');
  leftLegPants.setAttribute('stroke-linecap', 'round');
  const leftShoe = document.createElementNS(NS, 'path');
  leftShoe.setAttribute('d', 'M -6 13 L -1 13 L 2 16 L -7 16 Z');
  leftShoe.setAttribute('fill', '#0B240D');
  leftLeg.appendChild(leftLegPants);
  leftLeg.appendChild(leftShoe);

  // Right Leg (front leg in walk-cycle)
  const rightLeg = document.createElementNS(NS, 'g');
  rightLeg.setAttribute('class', 'walker-leg walker-leg--right');
  const rightLegPants = document.createElementNS(NS, 'line');
  rightLegPants.setAttribute('x1', '4');
  rightLegPants.setAttribute('y1', '2');
  rightLegPants.setAttribute('x2', '4');
  rightLegPants.setAttribute('y2', '14');
  rightLegPants.setAttribute('stroke', '#1B5E20');
  rightLegPants.setAttribute('stroke-width', '4');
  rightLegPants.setAttribute('stroke-linecap', 'round');
  const rightShoe = document.createElementNS(NS, 'path');
  rightShoe.setAttribute('d', 'M 1 13 L 6 13 L 9 16 L 0 16 Z');
  rightShoe.setAttribute('fill', '#0B240D');
  rightLeg.appendChild(rightLegPants);
  rightLeg.appendChild(rightShoe);

  // Body Group (torso, tote bag, neck, head, cap)
  const bodyGroup = document.createElementNS(NS, 'g');
  bodyGroup.setAttribute('class', 'walker-body-group');

  // Torso / Polo shirt (#2E7D32 with white collar trim)
  const torso = document.createElementNS(NS, 'path');
  torso.setAttribute('class', 'walker-torso');
  torso.setAttribute('d', 'M -7.5 2 L -8.5 -10 C -8.5 -13, 8.5 -13, 8.5 -10 L 7.5 2 Z');
  torso.setAttribute('fill', '#2E7D32');
  torso.setAttribute('stroke', '#1B5E20');
  torso.setAttribute('stroke-width', '1.2');

  // Crimson Red Market Tote Bag slung across body (#E53935)
  const toteBag = document.createElementNS(NS, 'g');
  toteBag.setAttribute('class', 'walker-tote');
  const toteStrap = document.createElementNS(NS, 'line');
  toteStrap.setAttribute('x1', '-6');
  toteStrap.setAttribute('y1', '-9');
  toteStrap.setAttribute('x2', '5');
  toteStrap.setAttribute('y2', '0');
  toteStrap.setAttribute('stroke', '#B71C1C');
  toteStrap.setAttribute('stroke-width', '1.8');
  const toteBody = document.createElementNS(NS, 'rect');
  toteBody.setAttribute('x', '1.5');
  toteBody.setAttribute('y', '-2');
  toteBody.setAttribute('width', '9.5');
  toteBody.setAttribute('height', '10.5');
  toteBody.setAttribute('rx', '2');
  toteBody.setAttribute('fill', '#E53935');
  toteBody.setAttribute('stroke', '#FFFFFF');
  toteBody.setAttribute('stroke-width', '1');
  toteBag.appendChild(toteStrap);
  toteBag.appendChild(toteBody);

  // Head with warm tone and white stroke outline
  const head = document.createElementNS(NS, 'circle');
  head.setAttribute('class', 'walker-head');
  head.setAttribute('cx', '0');
  head.setAttribute('cy', '-17.5');
  head.setAttribute('r', '7');
  head.setAttribute('fill', '#F5D0A9');
  head.setAttribute('stroke', '#FFFFFF');
  head.setAttribute('stroke-width', '1.4');

  // Forest Green Cap
  const cap = document.createElementNS(NS, 'path');
  cap.setAttribute('class', 'walker-cap');
  cap.setAttribute('d', 'M -7 -18.5 C -7 -25, 7 -25, 7 -18.5 L 9.5 -17 Q 0 -20 -7 -18 Z');
  cap.setAttribute('fill', '#1B5E20');

  bodyGroup.appendChild(torso);
  bodyGroup.appendChild(toteBag);
  bodyGroup.appendChild(head);
  bodyGroup.appendChild(cap);

  // Left Arm (swinging)
  const leftArm = document.createElementNS(NS, 'g');
  leftArm.setAttribute('class', 'walker-arm walker-arm--left');
  const leftArmLimb = document.createElementNS(NS, 'line');
  leftArmLimb.setAttribute('x1', '-7.5');
  leftArmLimb.setAttribute('y1', '-7.5');
  leftArmLimb.setAttribute('x2', '-10');
  leftArmLimb.setAttribute('y2', '1.5');
  leftArmLimb.setAttribute('stroke', '#1B5E20');
  leftArmLimb.setAttribute('stroke-width', '3');
  leftArmLimb.setAttribute('stroke-linecap', 'round');
  const leftHand = document.createElementNS(NS, 'circle');
  leftHand.setAttribute('cx', '-10');
  leftHand.setAttribute('cy', '2');
  leftHand.setAttribute('r', '1.8');
  leftHand.setAttribute('fill', '#F5D0A9');
  leftArm.appendChild(leftArmLimb);
  leftArm.appendChild(leftHand);

  // Right Arm (swinging / waving)
  const rightArm = document.createElementNS(NS, 'g');
  rightArm.setAttribute('class', 'walker-arm walker-arm--right');
  const rightArmLimb = document.createElementNS(NS, 'line');
  rightArmLimb.setAttribute('x1', '7.5');
  rightArmLimb.setAttribute('y1', '-7.5');
  rightArmLimb.setAttribute('x2', '10');
  rightArmLimb.setAttribute('y2', '1.5');
  rightArmLimb.setAttribute('stroke', '#2E7D32');
  rightArmLimb.setAttribute('stroke-width', '3');
  rightArmLimb.setAttribute('stroke-linecap', 'round');
  const rightHand = document.createElementNS(NS, 'circle');
  rightHand.setAttribute('cx', '10');
  rightHand.setAttribute('cy', '2');
  rightHand.setAttribute('r', '1.8');
  rightHand.setAttribute('fill', '#F5D0A9');
  rightArm.appendChild(rightArmLimb);
  rightArm.appendChild(rightHand);

  // Assemble visual (Back-to-front rendering order):
  // left arm -> left leg -> body group -> right leg -> right arm
  visual.appendChild(leftArm);
  visual.appendChild(leftLeg);
  visual.appendChild(bodyGroup);
  visual.appendChild(rightLeg);
  visual.appendChild(rightArm);

  scaler.appendChild(visual);

  // 4. Floating Wayfinding Turn Direction Bubble (Dynamic Turn-by-Turn Announcement)
  const bubble = document.createElementNS(NS, 'g');
  bubble.setAttribute('class', 'walker-turn-bubble');

  const bubbleBg = document.createElementNS(NS, 'rect');
  bubbleBg.setAttribute('class', 'walker-bubble-bg');
  bubbleBg.setAttribute('x', '-58');
  bubbleBg.setAttribute('y', '-48');
  bubbleBg.setAttribute('width', '116');
  bubbleBg.setAttribute('height', '24');
  bubbleBg.setAttribute('rx', '12');

  const bubbleTail = document.createElementNS(NS, 'polygon');
  bubbleTail.setAttribute('class', 'walker-bubble-tail');
  bubbleTail.setAttribute('points', '-4,-24 4,-24 0,-18');

  const bubbleText = document.createElementNS(NS, 'text');
  bubbleText.setAttribute('class', 'walker-bubble-text');
  bubbleText.setAttribute('x', '0');
  bubbleText.setAttribute('y', '-35');
  bubbleText.setAttribute('text-anchor', 'middle');
  bubbleText.setAttribute('dominant-baseline', 'middle');

  bubble.appendChild(bubbleBg);
  bubble.appendChild(bubbleTail);
  bubble.appendChild(bubbleText);
  scaler.appendChild(bubble);

  avatarGroup.appendChild(scaler);
  return { avatarGroup, visual, bubble, bubbleBg, bubbleText };
}

export function drawRoute(routeLayer, nodeIds, nodes, destinationPoint = null, options = {}) {
  cancelActiveWalkingAnimation();
  routeLayer.replaceChildren();
  if (!Array.isArray(nodeIds) || nodeIds.length === 0 || !nodes) {
    return null;
  }

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
    coords.push({ x: sx, y: sy });
  }

  // Extend line from last corridor snap node straight into the destination stall center
  if (destinationPoint && typeof destinationPoint.x === 'number' && typeof destinationPoint.y === 'number') {
    const lastCoord = coords[coords.length - 1];
    const dist = Math.hypot(destinationPoint.x - lastCoord.x, destinationPoint.y - lastCoord.y);
    if (dist > 1) {
      coords.push({ x: destinationPoint.x, y: destinationPoint.y });
    }
  }

  if (coords.length < 2) {
    if (coords.length === 1) {
      // Micro-segment ensuring valid non-zero path length for single-node arrival
      coords.push({ x: coords[0].x + 0.5, y: coords[0].y + 0.5 });
    } else {
      return null;
    }
  }

  // Build SVG Path 'd' string
  const d = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(' ');

  // 1. Base translucent track casing
  const trackCasing = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  trackCasing.setAttribute('class', 'route-track-casing');
  trackCasing.setAttribute('stroke-width', '54');
  trackCasing.setAttribute('d', d);
  routeLayer.appendChild(trackCasing);

  // 2. Animated solid walking line
  const dottedPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  dottedPath.setAttribute('id', 'active-route');
  dottedPath.setAttribute('class', 'route-dotted-line');
  dottedPath.setAttribute('stroke-width', '28');
  dottedPath.setAttribute('d', d);
  routeLayer.appendChild(dottedPath);

  // 3. Destination arrival pulse ring inside stall
  const destPulse = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  destPulse.setAttribute('class', 'destination-arrival-pulse');
  const finalCoord = coords[coords.length - 1];
  destPulse.setAttribute('cx', finalCoord.x.toFixed(2));
  destPulse.setAttribute('cy', finalCoord.y.toFixed(2));
  destPulse.setAttribute('r', '24');
  destPulse.style.display = 'none';
  routeLayer.appendChild(destPulse);

  const totalLength = dottedPath.getTotalLength();
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  const shouldAnimate = options.animateAvatar !== false && !prefersReducedMotion && totalLength > 0;

  if (!shouldAnimate) {
    trackCasing.style.strokeDasharray = 'none';
    trackCasing.style.strokeDashoffset = '0';
    dottedPath.style.strokeDasharray = 'none';
    dottedPath.style.strokeDashoffset = '0';
    destPulse.style.display = 'block';
    if (typeof options.onComplete === 'function') {
      options.onComplete();
    }
    return { polyline: dottedPath, cancel: () => {} };
  }

  // 4. Pedestrian Walking Vector Avatar (Animated Person Walk Cycle)
  const { avatarGroup, visual, bubble, bubbleBg, bubbleText } = createWalkingAvatar();

  const startPt = dottedPath.getPointAtLength(0);
  avatarGroup.setAttribute('transform', `translate(${startPt.x.toFixed(2)}, ${startPt.y.toFixed(2)})`);
  routeLayer.appendChild(avatarGroup);

  // Prepare step markers for turn-by-turn speech bubble announcements
  const stepMarkers = [];
  if (Array.isArray(options.steps) && options.steps.length > 0) {
    const cumulativeDists = [0];
    for (let i = 1; i < coords.length; i++) {
      const seg = Math.hypot(coords[i].x - coords[i - 1].x, coords[i].y - coords[i - 1].y);
      cumulativeDists.push(cumulativeDists[i - 1] + seg);
    }

    for (const step of options.steps) {
      let dist = 0;
      let label = step.instruction || '';

      if (step.direction === 'start') {
        dist = 0;
        const entryId = options.entrance?.entrance_id;
        const rawName = options.entrance?.name || options.entrance?.description || '';
        const shortName = entryId ? `Entry ${entryId}` : (rawName.length > 14 ? rawName.slice(0, 12) + '…' : (rawName || 'Entrance'));
        label = `1. Enter via ${shortName}`;
      } else if (step.direction === 'arrive') {
        dist = totalLength;
        label = `🏁 Arrived!`;
      } else {
        const idx = nodeIds.indexOf(step.nodeId);
        dist = idx >= 0 && idx < cumulativeDists.length ? cumulativeDists[idx] : 0;
        if (step.direction === 'left') {
          label = `${step.stepNumber}. Turn Left`;
        } else if (step.direction === 'right') {
          label = `${step.stepNumber}. Turn Right`;
        } else if (step.direction === 'straight') {
          label = `${step.stepNumber}. Continue Straight`;
        } else {
          label = `${step.stepNumber}. ${step.direction}`;
        }
      }

      stepMarkers.push({
        stepNumber: step.stepNumber,
        dist,
        label
      });
    }
  }

  // Progressive reveal setup: line is completely hidden at start and draws as person walks!
  trackCasing.style.strokeDasharray = `${totalLength} ${totalLength}`;
  trackCasing.style.strokeDashoffset = `${totalLength}`;
  dottedPath.style.strokeDasharray = `${totalLength} ${totalLength}`;
  dottedPath.style.strokeDashoffset = `${totalLength}`;

  // Slower, more leisurely walking pace so user can comfortably watch each turn
  const duration = Math.max(5500, Math.min(10000, totalLength * 3.2));
  let startTime = null;
  let rafId = null;
  let completed = false;
  let activeStepIndex = -1;
  let bubbleTimeout = null;

  function showStepBubble(text) {
    const safeText = text.length > 20 ? text.slice(0, 18) + '…' : text;
    bubbleText.textContent = safeText;
    const textLen = safeText.length;
    const pillWidth = Math.min(130, Math.max(72, textLen * 6.8 + 18));
    bubbleBg.setAttribute('x', `${(-pillWidth / 2).toFixed(1)}`);
    bubbleBg.setAttribute('width', `${pillWidth.toFixed(1)}`);
    bubble.classList.add('is-active');

    if (bubbleTimeout) clearTimeout(bubbleTimeout);
    if (!text.includes('Arrived')) {
      bubbleTimeout = setTimeout(() => {
        bubble.classList.remove('is-active');
      }, 2200);
    }
  }

  function finishAnimation() {
    if (completed) return;
    completed = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (bubbleTimeout) clearTimeout(bubbleTimeout);
    activeWalkingAnimation = null;

    // Fully reveal line
    trackCasing.style.strokeDasharray = 'none';
    trackCasing.style.strokeDashoffset = '0';
    dottedPath.style.strokeDasharray = 'none';
    dottedPath.style.strokeDashoffset = '0';

    // Place avatar at final destination point, trigger arrival celebration, and show arrival ripple
    const endPt = dottedPath.getPointAtLength(totalLength);
    avatarGroup.setAttribute('transform', `translate(${endPt.x.toFixed(2)}, ${endPt.y.toFixed(2)})`);
    avatarGroup.classList.remove('is-walking');
    avatarGroup.classList.add('is-arrived');
    showStepBubble('🏁 Arrived!');
    destPulse.style.display = 'block';

    if (typeof options.onComplete === 'function') {
      options.onComplete();
    }
  }

  function step(timestamp) {
    if (completed) return;
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Smooth cubic ease-in-out
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    const currentDist = eased * totalLength;
    const currentPt = dottedPath.getPointAtLength(currentDist);

    // Update avatar position
    avatarGroup.setAttribute('transform', `translate(${currentPt.x.toFixed(2)}, ${currentPt.y.toFixed(2)})`);

    // Directional orientation: face the direction of walking
    const nextDist = Math.min(currentDist + 8, totalLength);
    const nextPt = dottedPath.getPointAtLength(nextDist);
    const dx = nextPt.x - currentPt.x;
    if (dx < -0.8) {
      visual.style.transform = 'scaleX(-1)';
    } else if (dx > 0.8) {
      visual.style.transform = 'scaleX(1)';
    }

    // Progressive line reveal: draws line and casing out from start to current position as person walks!
    const remaining = Math.max(0, totalLength - currentDist);
    trackCasing.style.strokeDashoffset = `${remaining}`;
    dottedPath.style.strokeDashoffset = `${remaining}`;

    // Dynamic Turn-by-Turn Announcement Bubble: check if walker reached any turn marker
    for (let i = 0; i < stepMarkers.length; i++) {
      const marker = stepMarkers[i];
      if (currentDist >= Math.max(0, marker.dist - 35) && activeStepIndex < i) {
        activeStepIndex = i;
        showStepBubble(marker.label);
        break;
      }
    }

    // Camera follow callback
    if (typeof options.onProgress === 'function') {
      options.onProgress(currentPt);
    }

    if (progress < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      finishAnimation();
    }
  }

  rafId = requestAnimationFrame(step);

  const controller = {
    polyline: dottedPath,
    cancel: () => {
      finishAnimation();
    }
  };

  activeWalkingAnimation = controller;
  return controller;
}

/**
 * Removes the active route overlay from #route-layer.
 * @param {SVGGElement} routeLayer
 */
export function clearRoute(routeLayer) {
  cancelActiveWalkingAnimation();
  routeLayer.replaceChildren();
}

/**
 * Renders the 14 demand-driven entrance markers into #markers-layer.
 * Each marker is positioned using NODE_TO_SVG_OFFSET and features a 48x48px
 * touch hitbox for kiosk and mobile ergonomics.
 *
 * @param {SVGGElement} markersLayer - The #markers-layer SVG group
 * @param {Array<Object>} entryPoints - 14 entrance records from market_entry_points.json
 * @param {Object} mapNodes - Graph nodes from map_nodes.json
 * @param {function(Object): void} onEntranceClick - Callback when an entrance pin is tapped
 */
export function renderEntranceMarkers(markersLayer, entryPoints, mapNodes, onEntranceClick) {
  if (!markersLayer || !Array.isArray(entryPoints) || !mapNodes) return;
  markersLayer.replaceChildren();

  entryPoints.forEach((entry) => {
    const node = mapNodes[entry.node_id];
    if (!node) {
      console.warn(`[MerkadoGo Map] Entrance ${entry.entrance_id} references unknown node "${entry.node_id}"`);
      return;
    }

    const sx = node.x + NODE_TO_SVG_OFFSET.x;
    const sy = node.y + NODE_TO_SVG_OFFSET.y;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'entrance-marker');
    g.setAttribute('data-entrance-id', String(entry.entrance_id));
    g.setAttribute('transform', `translate(${sx}, ${sy})`);
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', `Entrance ${entry.entrance_id}: ${entry.description}`);

    // Large high-contrast vector pin matching user reference:
    // Pin head circle center: (0, -74), radius R = 38. Top of pin at y = -112.
    // Pin tip touches coordinate at (0, 0).
    // Tangent points from (0, 0) to circle (0, -74) with R = 38: x = ±32.6, y = -54.5.

    // 1. Transparent Hitbox (140x185 units for effortless touch ergonomics)
    const hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    hitbox.setAttribute('class', 'entrance-marker-hitbox');
    hitbox.setAttribute('x', '-70');
    hitbox.setAttribute('y', '-125');
    hitbox.setAttribute('width', '140');
    hitbox.setAttribute('height', '185');
    hitbox.setAttribute('fill', 'transparent');

    // Inner visual group: scales locally around (0,0) so the parent SVG translation is NEVER overridden
    const visual = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    visual.setAttribute('class', 'entrance-marker-visual');

    // 2. Soft Ground Shadow Ellipse at pin tip
    const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    shadow.setAttribute('class', 'entrance-marker-shadow');
    shadow.setAttribute('cx', '0');
    shadow.setAttribute('cy', '3');
    shadow.setAttribute('rx', '24');
    shadow.setAttribute('ry', '6');
    shadow.setAttribute('fill', 'rgba(0, 0, 0, 0.20)');

    // 3. Teardrop Location Pin Body (Vibrant Red #E53935)
    const pin = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pin.setAttribute('class', 'entrance-marker-pin-body');
    pin.setAttribute('d', 'M 0 0 L -32.6 -54.5 A 38 38 0 1 1 32.6 -54.5 Z');

    // 4. Subtle 3D Beveled Shade on Right Half (#C62828)
    const shade = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    shade.setAttribute('class', 'entrance-marker-pin-shade');
    shade.setAttribute('d', 'M 0 0 L 0 -112 A 38 38 0 0 1 32.6 -54.5 Z');

    // 5. Crisp White Inner Circle
    const disc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    disc.setAttribute('class', 'entrance-marker-disc');
    disc.setAttribute('cx', '0');
    disc.setAttribute('cy', '-74');
    disc.setAttribute('r', '26');

    // 6. User / Person Avatar Silhouette in Red (#E53935)
    const avatarHead = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    avatarHead.setAttribute('class', 'entrance-marker-avatar');
    avatarHead.setAttribute('cx', '0');
    avatarHead.setAttribute('cy', '-82');
    avatarHead.setAttribute('r', '8.5');

    const avatarTorso = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    avatarTorso.setAttribute('class', 'entrance-marker-avatar');
    avatarTorso.setAttribute('d', 'M -16.5 -55 C -16.5 -69, 16.5 -69, 16.5 -55 A 25.5 25.5 0 0 1 -16.5 -55 Z');

    // 7. Option A Entry Badge Pill Below Pin (White bg, Red border #E53935, Dark text #1E293B)
    // Larger dimensions and bold 19px font for crystal-clear readability on mobile
    const pillWidth = entry.entrance_id >= 10 ? 126 : 116;
    const halfPill = pillWidth / 2;

    const pillBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    pillBg.setAttribute('class', 'entrance-marker-pill-bg');
    pillBg.setAttribute('x', String(-halfPill));
    pillBg.setAttribute('y', '8');
    pillBg.setAttribute('width', String(pillWidth));
    pillBg.setAttribute('height', '36');
    pillBg.setAttribute('rx', '18');

    const pillText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    pillText.setAttribute('class', 'entrance-marker-pill-text');
    pillText.setAttribute('x', '0');
    pillText.setAttribute('y', '26.5');
    pillText.textContent = `Entry ${entry.entrance_id}`;

    visual.appendChild(shadow);
    visual.appendChild(pin);
    visual.appendChild(shade);
    visual.appendChild(disc);
    visual.appendChild(avatarHead);
    visual.appendChild(avatarTorso);
    visual.appendChild(pillBg);
    visual.appendChild(pillText);

    g.appendChild(hitbox);
    g.appendChild(visual);

    g.addEventListener('click', (e) => {
      e.stopPropagation();
      highlightEntranceMarker(markersLayer, entry.entrance_id);
      if (typeof onEntranceClick === 'function') {
        onEntranceClick(entry);
      }
    });

    // Keyboard accessibility: Enter or Space activates pin
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        highlightEntranceMarker(markersLayer, entry.entrance_id);
        if (typeof onEntranceClick === 'function') {
          onEntranceClick(entry);
        }
      }
    });

    markersLayer.appendChild(g);
  });

  console.log(`[MerkadoGo Map] Rendered ${entryPoints.length} demand-driven entrance markers in #markers-layer.`);
}

/**
 * Highlights a specific entrance marker and unhighlights others.
 * @param {SVGGElement} markersLayer
 * @param {number|string|null} entranceId
 */
export function highlightEntranceMarker(markersLayer, entranceId) {
  if (!markersLayer) return;
  const markers = markersLayer.querySelectorAll('.entrance-marker');
  markers.forEach((m) => {
    if (entranceId && m.getAttribute('data-entrance-id') === String(entranceId)) {
      m.classList.add('entrance-marker--active');
    } else {
      m.classList.remove('entrance-marker--active');
    }
  });
}

/**
 * Toggles visibility of the entrance markers layer.
 * If activeEntranceId is provided, displays ONLY that entrance marker and hides all other 13.
 * If activeEntranceId is null, displays all entrance markers when visible is true.
 * @param {SVGGElement} markersLayer
 * @param {boolean} visible
 * @param {number|string|null} [activeEntranceId=null]
 */
export function setEntranceMarkersVisibility(markersLayer, visible, activeEntranceId = null) {
  if (!markersLayer) return;
  markersLayer.style.display = visible ? 'block' : 'none';
  markersLayer.style.pointerEvents = visible ? 'auto' : 'none';

  const markers = markersLayer.querySelectorAll('.entrance-marker');
  markers.forEach((m) => {
    if (!visible) {
      m.style.display = 'none';
    } else if (activeEntranceId != null && activeEntranceId !== '') {
      if (m.getAttribute('data-entrance-id') === String(activeEntranceId)) {
        m.style.display = 'block';
      } else {
        m.style.display = 'none';
      }
    } else {
      m.style.display = 'block';
    }
  });
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

