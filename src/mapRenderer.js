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

let currentMapRotation = 0;

/**
 * Counter-rotates any active walking pedestrian avatar in #route-layer by -rotationDeg
 * so the character and speech bubble HUD always remain 100% upright facing the user.
 * @param {SVGGElement} routeLayer - The #route-layer SVG group
 * @param {number} rotationDeg - Current map rotation in degrees
 */
export function updateWalkingAvatarRotation(routeLayer, rotationDeg) {
  currentMapRotation = rotationDeg;
  if (!routeLayer) return;
  const rotators = routeLayer.querySelectorAll('.walker-rotator');
  const counterAngle = -rotationDeg;
  rotators.forEach((rotator) => {
    rotator.setAttribute('transform', `rotate(${counterAngle}, 0, 0)`);
  });
}

/**
 * Creates an animated vector walking pedestrian avatar.
 * Features articulated legs and arms with synchronized walk cycles,
 * a crimson market tote bag, a forest green cap, directional orientation flipping,
 * and a celebratory greeting wave upon arrival at the destination stall.
 * @returns {{ avatarGroup: SVGGElement, rotator: SVGGElement, visual: SVGGElement }}
 */
function createWalkingAvatar() {
  const NS = 'http://www.w3.org/2000/svg';
  const avatarGroup = document.createElementNS(NS, 'g');
  avatarGroup.setAttribute('class', 'route-walking-avatar is-walking');

  // Rotator group for dynamic billboarding:
  // Counter-rotates the entire avatar, speech bubble, and shadows by -currentMapRotation around (0, 0)
  // so the pedestrian and turn-by-turn announcement bubble ALWAYS stand upright facing the user
  const rotator = document.createElementNS(NS, 'g');
  rotator.setAttribute('class', 'walker-rotator');
  rotator.setAttribute('transform', `rotate(${-currentMapRotation}, 0, 0)`);

  // Scaler group: scaled to 3.5x for crisp corridor visibility with balanced anatomy
  const scaler = document.createElementNS(NS, 'g');
  scaler.setAttribute('class', 'walker-scaler');
  scaler.setAttribute('transform', 'scale(3.5)');

  // 1. Soft glowing aura underneath
  const halo = document.createElementNS(NS, 'circle');
  halo.setAttribute('class', 'avatar-pulse-halo');
  halo.setAttribute('cx', '0');
  halo.setAttribute('cy', '-2');
  halo.setAttribute('r', '24');
  scaler.appendChild(halo);

  // 2. Ground shadow that responds to step rhythm
  const shadow = document.createElementNS(NS, 'ellipse');
  shadow.setAttribute('class', 'walker-shadow');
  shadow.setAttribute('cx', '0');
  shadow.setAttribute('cy', '15.5');
  shadow.setAttribute('rx', '13');
  shadow.setAttribute('ry', '4.5');
  scaler.appendChild(shadow);

  // 3. Inner visual container that flips dynamically based on horizontal heading
  const visual = document.createElementNS(NS, 'g');
  visual.setAttribute('class', 'walker-visual');

  // --- Left Leg (Back leg in walk-cycle) ---
  const leftLeg = document.createElementNS(NS, 'g');
  leftLeg.setAttribute('class', 'walker-leg walker-leg--left');

  const leftLegPants = document.createElementNS(NS, 'path');
  leftLegPants.setAttribute('d', 'M -5 1.5 L -4.5 11.5 L -1.5 11.5 L -2 1.5 Z');
  leftLegPants.setAttribute('fill', '#143818');

  const leftShoe = document.createElementNS(NS, 'g');
  leftShoe.setAttribute('class', 'walker-shoe');
  const leftShoeUpper = document.createElementNS(NS, 'path');
  leftShoeUpper.setAttribute('d', 'M -5.2 11 L -1.2 11 L 0 13.2 L -6 13.2 Z');
  leftShoeUpper.setAttribute('fill', '#1E293B');
  const leftShoeSole = document.createElementNS(NS, 'rect');
  leftShoeSole.setAttribute('x', '-6.5');
  leftShoeSole.setAttribute('y', '13.2');
  leftShoeSole.setAttribute('width', '6.8');
  leftShoeSole.setAttribute('height', '2.2');
  leftShoeSole.setAttribute('rx', '1');
  leftShoeSole.setAttribute('fill', '#FFFFFF');
  leftShoeSole.setAttribute('stroke', '#E2E8F0');
  leftShoeSole.setAttribute('stroke-width', '0.4');
  leftShoe.appendChild(leftShoeUpper);
  leftShoe.appendChild(leftShoeSole);

  leftLeg.appendChild(leftLegPants);
  leftLeg.appendChild(leftShoe);

  // --- Left Arm (Back arm, swings counter-rhythm) ---
  const leftArm = document.createElementNS(NS, 'g');
  leftArm.setAttribute('class', 'walker-arm walker-arm--left');
  const leftSleeve = document.createElementNS(NS, 'line');
  leftSleeve.setAttribute('x1', '-6');
  leftSleeve.setAttribute('y1', '-7.5');
  leftSleeve.setAttribute('x2', '-7');
  leftSleeve.setAttribute('y2', '-3');
  leftSleeve.setAttribute('stroke', '#1B5E20');
  leftSleeve.setAttribute('stroke-width', '3');
  leftSleeve.setAttribute('stroke-linecap', 'round');

  const leftForearm = document.createElementNS(NS, 'line');
  leftForearm.setAttribute('x1', '-7');
  leftForearm.setAttribute('y1', '-3');
  leftForearm.setAttribute('x2', '-8.5');
  leftForearm.setAttribute('y2', '2.5');
  leftForearm.setAttribute('stroke', '#F5D0A9');
  leftForearm.setAttribute('stroke-width', '2.6');
  leftForearm.setAttribute('stroke-linecap', 'round');

  const leftHand = document.createElementNS(NS, 'circle');
  leftHand.setAttribute('cx', '-8.5');
  leftHand.setAttribute('cy', '2.5');
  leftHand.setAttribute('r', '1.6');
  leftHand.setAttribute('fill', '#F5D0A9');

  leftArm.appendChild(leftSleeve);
  leftArm.appendChild(leftForearm);
  leftArm.appendChild(leftHand);

  // --- Torso & Body Group ---
  const bodyGroup = document.createElementNS(NS, 'g');
  bodyGroup.setAttribute('class', 'walker-body-group');

  // Neck
  const neck = document.createElementNS(NS, 'rect');
  neck.setAttribute('x', '-2');
  neck.setAttribute('y', '-11.5');
  neck.setAttribute('width', '4');
  neck.setAttribute('height', '3.5');
  neck.setAttribute('rx', '1');
  neck.setAttribute('fill', '#E8BA8A');

  // Polo Shirt Torso (#2E7D32 with clean tailoring)
  const torso = document.createElementNS(NS, 'path');
  torso.setAttribute('class', 'walker-torso');
  torso.setAttribute('d', 'M -6.5 1.5 L -7.5 -8.5 C -7.5 -10.5, 7.5 -10.5, 7.5 -8.5 L 6.5 1.5 Z');
  torso.setAttribute('fill', '#2E7D32');
  torso.setAttribute('stroke', '#1B5E20');
  torso.setAttribute('stroke-width', '0.8');

  // Crisp White Collar & Button Placket
  const collar = document.createElementNS(NS, 'path');
  collar.setAttribute('d', 'M -3.2 -9.5 L 0 -6 L 3.2 -9.5 L 2.2 -10.8 L -2.2 -10.8 Z');
  collar.setAttribute('fill', '#FFFFFF');

  const placket = document.createElementNS(NS, 'line');
  placket.setAttribute('x1', '0');
  placket.setAttribute('y1', '-6');
  placket.setAttribute('x2', '0');
  placket.setAttribute('y2', '-1.5');
  placket.setAttribute('stroke', '#1B5E20');
  placket.setAttribute('stroke-width', '1.2');
  placket.setAttribute('stroke-linecap', 'round');

  const btn1 = document.createElementNS(NS, 'circle');
  btn1.setAttribute('cx', '0');
  btn1.setAttribute('cy', '-4.5');
  btn1.setAttribute('r', '0.5');
  btn1.setAttribute('fill', '#FFFFFF');

  const btn2 = document.createElementNS(NS, 'circle');
  btn2.setAttribute('cx', '0');
  btn2.setAttribute('cy', '-2.5');
  btn2.setAttribute('r', '0.5');
  btn2.setAttribute('fill', '#FFFFFF');

  // Crimson Red Cross-Body Market Tote Bag (Bayong)
  const toteBag = document.createElementNS(NS, 'g');
  toteBag.setAttribute('class', 'walker-tote');

  const toteStrap = document.createElementNS(NS, 'path');
  toteStrap.setAttribute('d', 'M -6.5 -9 L 3.5 0.5');
  toteStrap.setAttribute('stroke', '#B71C1C');
  toteStrap.setAttribute('stroke-width', '1.6');
  toteStrap.setAttribute('stroke-linecap', 'round');

  // Rounded stylish tote body at hip
  const toteBody = document.createElementNS(NS, 'rect');
  toteBody.setAttribute('x', '0');
  toteBody.setAttribute('y', '-1');
  toteBody.setAttribute('width', '8.5');
  toteBody.setAttribute('height', '9.5');
  toteBody.setAttribute('rx', '2.2');
  toteBody.setAttribute('fill', '#E53935');
  toteBody.setAttribute('stroke', '#B71C1C');
  toteBody.setAttribute('stroke-width', '0.6');

  // White tote handle loops
  const toteHandle = document.createElementNS(NS, 'path');
  toteHandle.setAttribute('d', 'M 2 -1 C 2 -2.8, 6.5 -2.8, 6.5 -1');
  toteHandle.setAttribute('fill', 'none');
  toteHandle.setAttribute('stroke', '#FFFFFF');
  toteHandle.setAttribute('stroke-width', '0.8');
  toteHandle.setAttribute('stroke-linecap', 'round');

  // White circular emblem with green leaf motif
  const toteEmblem = document.createElementNS(NS, 'circle');
  toteEmblem.setAttribute('cx', '4.2');
  toteEmblem.setAttribute('cy', '4');
  toteEmblem.setAttribute('r', '1.8');
  toteEmblem.setAttribute('fill', '#FFFFFF');

  const toteLeaf = document.createElementNS(NS, 'path');
  toteLeaf.setAttribute('d', 'M 4.2 3.0 C 4.9 3.5, 4.9 4.5, 4.2 5.0 C 3.5 4.5, 3.5 3.5, 4.2 3.0 Z');
  toteLeaf.setAttribute('fill', '#1B5E20');

  toteBag.appendChild(toteStrap);
  toteBag.appendChild(toteBody);
  toteBag.appendChild(toteHandle);
  toteBag.appendChild(toteEmblem);
  toteBag.appendChild(toteLeaf);

  // --- Head & Sporty Cap (Clean Pristine Faceless Design) ---
  const headGroup = document.createElementNS(NS, 'g');
  headGroup.setAttribute('class', 'walker-head-group');

  // Base head - smooth warm skin tone, completely faceless
  const head = document.createElementNS(NS, 'circle');
  head.setAttribute('class', 'walker-head');
  head.setAttribute('cx', '0');
  head.setAttribute('cy', '-16.5');
  head.setAttribute('r', '6.6');
  head.setAttribute('fill', '#F5D0A9');

  // Forest Green Sporty Cap
  const capCrown = document.createElementNS(NS, 'path');
  capCrown.setAttribute('class', 'walker-cap-crown');
  capCrown.setAttribute('d', 'M -6.6 -18 C -7.2 -24.5, 4.5 -25.5, 6.0 -18.5 C 3.2 -19.8, -3.5 -19.5, -6.6 -18 Z');
  capCrown.setAttribute('fill', '#1B5E20');

  const capPanel = document.createElementNS(NS, 'path');
  capPanel.setAttribute('d', 'M -2 -19 C -1.5 -24, 4.2 -24, 5.2 -18.5 Z');
  capPanel.setAttribute('fill', '#2E7D32');
  capPanel.setAttribute('opacity', '0.8');

  // Curved visor pointing forward
  const capVisor = document.createElementNS(NS, 'path');
  capVisor.setAttribute('class', 'walker-cap-visor');
  capVisor.setAttribute('d', 'M 3.8 -19 C 6 -20.2, 9.6 -19.8, 11 -17.2 C 9 -17, 5.5 -17.5, 3.2 -17.8 Z');
  capVisor.setAttribute('fill', '#144618');

  // Button on top
  const capButton = document.createElementNS(NS, 'circle');
  capButton.setAttribute('cx', '-0.5');
  capButton.setAttribute('cy', '-24.2');
  capButton.setAttribute('r', '0.9');
  capButton.setAttribute('fill', '#FFFFFF');

  headGroup.appendChild(head);
  headGroup.appendChild(capCrown);
  headGroup.appendChild(capPanel);
  headGroup.appendChild(capVisor);
  headGroup.appendChild(capButton);

  bodyGroup.appendChild(neck);
  bodyGroup.appendChild(torso);
  bodyGroup.appendChild(collar);
  bodyGroup.appendChild(placket);
  bodyGroup.appendChild(btn1);
  bodyGroup.appendChild(btn2);

  // --- Right Leg (Front leg) ---
  const rightLeg = document.createElementNS(NS, 'g');
  rightLeg.setAttribute('class', 'walker-leg walker-leg--right');

  const rightLegPants = document.createElementNS(NS, 'path');
  rightLegPants.setAttribute('d', 'M 1 1.5 L 1.5 11.5 L 4.5 11.5 L 4 1.5 Z');
  rightLegPants.setAttribute('fill', '#1B4D20');

  const rightShoe = document.createElementNS(NS, 'g');
  rightShoe.setAttribute('class', 'walker-shoe');
  const rightShoeUpper = document.createElementNS(NS, 'path');
  rightShoeUpper.setAttribute('d', 'M 0.8 11 L 4.8 11 L 6.5 13.2 L 0 13.2 Z');
  rightShoeUpper.setAttribute('fill', '#1E293B');
  const rightShoeSole = document.createElementNS(NS, 'rect');
  rightShoeSole.setAttribute('x', '-0.5');
  rightShoeSole.setAttribute('y', '13.2');
  rightShoeSole.setAttribute('width', '7.4');
  rightShoeSole.setAttribute('height', '2.2');
  rightShoeSole.setAttribute('rx', '1');
  rightShoeSole.setAttribute('fill', '#FFFFFF');
  rightShoeSole.setAttribute('stroke', '#E2E8F0');
  rightShoeSole.setAttribute('stroke-width', '0.4');
  rightShoe.appendChild(rightShoeUpper);
  rightShoe.appendChild(rightShoeSole);

  rightLeg.appendChild(rightLegPants);
  rightLeg.appendChild(rightShoe);

  // --- Right Arm (Dual-Mode: Walking Swing vs. Simple Clean Wave) ---
  const rightArm = document.createElementNS(NS, 'g');
  rightArm.setAttribute('class', 'walker-arm walker-arm--right');

  // 1. Walking Arm Pose
  const rightArmWalking = document.createElementNS(NS, 'g');
  rightArmWalking.setAttribute('class', 'walker-arm-walking');

  const rightSleeveW = document.createElementNS(NS, 'line');
  rightSleeveW.setAttribute('x1', '6');
  rightSleeveW.setAttribute('y1', '-7.5');
  rightSleeveW.setAttribute('x2', '7');
  rightSleeveW.setAttribute('y2', '-3');
  rightSleeveW.setAttribute('stroke', '#2E7D32');
  rightSleeveW.setAttribute('stroke-width', '3');
  rightSleeveW.setAttribute('stroke-linecap', 'round');

  const rightForearmW = document.createElementNS(NS, 'line');
  rightForearmW.setAttribute('x1', '7');
  rightForearmW.setAttribute('y1', '-3');
  rightForearmW.setAttribute('x2', '8.5');
  rightForearmW.setAttribute('y2', '2.5');
  rightForearmW.setAttribute('stroke', '#F5D0A9');
  rightForearmW.setAttribute('stroke-width', '2.6');
  rightForearmW.setAttribute('stroke-linecap', 'round');

  const rightHandW = document.createElementNS(NS, 'circle');
  rightHandW.setAttribute('cx', '8.5');
  rightHandW.setAttribute('cy', '2.5');
  rightHandW.setAttribute('r', '1.6');
  rightHandW.setAttribute('fill', '#F5D0A9');

  rightArmWalking.appendChild(rightSleeveW);
  rightArmWalking.appendChild(rightForearmW);
  rightArmWalking.appendChild(rightHandW);

  // 2. Arrival Greeting Waving Arm Pose (Simple natural bent arm beside head)
  const rightArmWaving = document.createElementNS(NS, 'g');
  rightArmWaving.setAttribute('class', 'walker-arm-waving');

  // Sleeve at shoulder
  const waveSleeve = document.createElementNS(NS, 'line');
  waveSleeve.setAttribute('x1', '6');
  waveSleeve.setAttribute('y1', '-7.5');
  waveSleeve.setAttribute('x2', '8.5');
  waveSleeve.setAttribute('y2', '-6.5');
  waveSleeve.setAttribute('stroke', '#2E7D32');
  waveSleeve.setAttribute('stroke-width', '3');
  waveSleeve.setAttribute('stroke-linecap', 'round');

  // Forearm bent upward beside head (from elbow 8.5,-6.5 to hand 8,-13.5)
  const waveForearm = document.createElementNS(NS, 'line');
  waveForearm.setAttribute('class', 'walker-wave-forearm');
  waveForearm.setAttribute('x1', '8.5');
  waveForearm.setAttribute('y1', '-6.5');
  waveForearm.setAttribute('x2', '8');
  waveForearm.setAttribute('y2', '-13.5');
  waveForearm.setAttribute('stroke', '#F5D0A9');
  waveForearm.setAttribute('stroke-width', '2.6');
  waveForearm.setAttribute('stroke-linecap', 'round');

  // Hand circle right beside cheek/ear level
  const waveHand = document.createElementNS(NS, 'circle');
  waveHand.setAttribute('class', 'walker-wave-hand');
  waveHand.setAttribute('cx', '8');
  waveHand.setAttribute('cy', '-13.8');
  waveHand.setAttribute('r', '1.6');
  waveHand.setAttribute('fill', '#F5D0A9');

  rightArmWaving.appendChild(waveSleeve);
  rightArmWaving.appendChild(waveForearm);
  rightArmWaving.appendChild(waveHand);

  rightArm.appendChild(rightArmWalking);
  rightArm.appendChild(rightArmWaving);

  // Assemble visual (Back-to-front rendering order):
  // 1. leftArm (swings behind body)
  // 2. leftLeg (back leg)
  // 3. bodyGroup (neck, torso, polo collar, placket, buttons)
  // 4. rightLeg (front leg, strides naturally behind the hip bag)
  // 5. toteBag (market tote slung across shoulder, rests on the hip OVER the leg)
  // 6. headGroup (clean pristine faceless head with sporty cap)
  // 7. rightArm (front arm swinging or waving)
  visual.appendChild(leftArm);
  visual.appendChild(leftLeg);
  visual.appendChild(bodyGroup);
  visual.appendChild(rightLeg);
  visual.appendChild(toteBag);
  visual.appendChild(headGroup);
  visual.appendChild(rightArm);

  scaler.appendChild(visual);

  // 4. Floating Wayfinding Turn Direction Bubble (Dynamic Turn-by-Turn Announcement)
  const bubble = document.createElementNS(NS, 'g');
  bubble.setAttribute('class', 'walker-turn-bubble');

  const bubbleBg = document.createElementNS(NS, 'rect');
  bubbleBg.setAttribute('class', 'walker-bubble-bg');
  bubbleBg.setAttribute('x', '-58');
  bubbleBg.setAttribute('y', '-54');
  bubbleBg.setAttribute('width', '116');
  bubbleBg.setAttribute('height', '24');
  bubbleBg.setAttribute('rx', '12');

  const bubbleTail = document.createElementNS(NS, 'polygon');
  bubbleTail.setAttribute('class', 'walker-bubble-tail');
  bubbleTail.setAttribute('points', '-4,-30 4,-30 0,-25');

  // Vector Destination Pin Icon for Arrival State (Pure SVG, zero emojis as per Impeccable guidelines)
  const bubbleIcon = document.createElementNS(NS, 'g');
  bubbleIcon.setAttribute('class', 'walker-bubble-icon');
  bubbleIcon.style.display = 'none';

  // Optically elevated & vertically centered: top -47.7, tip -36.5, head center -43.5
  const pinPath = document.createElementNS(NS, 'path');
  pinPath.setAttribute('d', 'M -23.5 -47.7 C -25.8 -47.7, -27.7 -45.8, -27.7 -43.5 C -27.7 -40.5, -23.5 -36.5, -23.5 -36.5 C -23.5 -36.5, -19.3 -40.5, -19.3 -43.5 C -19.3 -45.8, -21.2 -47.7, -23.5 -47.7 Z');
  pinPath.setAttribute('fill', '#E53935');

  const pinDot = document.createElementNS(NS, 'circle');
  pinDot.setAttribute('cx', '-23.5');
  pinDot.setAttribute('cy', '-43.5');
  pinDot.setAttribute('r', '1.35');
  pinDot.setAttribute('fill', '#FFFFFF');

  bubbleIcon.appendChild(pinPath);
  bubbleIcon.appendChild(pinDot);

  const bubbleText = document.createElementNS(NS, 'text');
  bubbleText.setAttribute('class', 'walker-bubble-text');
  bubbleText.setAttribute('x', '0');
  bubbleText.setAttribute('y', '-41');
  bubbleText.setAttribute('text-anchor', 'middle');
  bubbleText.setAttribute('dominant-baseline', 'middle');

  bubble.appendChild(bubbleBg);
  bubble.appendChild(bubbleTail);
  bubble.appendChild(bubbleIcon);
  bubble.appendChild(bubbleText);
  scaler.appendChild(bubble);

  rotator.appendChild(scaler);
  avatarGroup.appendChild(rotator);
  return { avatarGroup, rotator, visual, bubble, bubbleBg, bubbleIcon, bubbleText };
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

  const totalLength = dottedPath.getTotalLength();
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  const shouldAnimate = options.animateAvatar !== false && !prefersReducedMotion && totalLength > 0;

  if (!shouldAnimate) {
    trackCasing.style.strokeDasharray = 'none';
    trackCasing.style.strokeDashoffset = '0';
    dottedPath.style.strokeDasharray = 'none';
    dottedPath.style.strokeDashoffset = '0';
    if (typeof options.onComplete === 'function') {
      options.onComplete();
    }
    return { polyline: dottedPath, cancel: () => {} };
  }

  // 4. Pedestrian Walking Vector Avatar (Animated Person Walk Cycle)
  const { avatarGroup, visual, bubble, bubbleBg, bubbleIcon, bubbleText } = createWalkingAvatar();

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
        label = `Arrived!`;
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

      // Calculate the trigger distance for the speech bubble:
      // - Start: triggers at 0
      // - Arrive: triggers at destination
      // - Turns: announce 30px before reaching the intersection
      // - Straight: announce right as the walker enters the straight corridor
      let triggerDist = dist;
      if (step.direction === 'start') {
        triggerDist = 0;
      } else if (step.direction === 'arrive') {
        triggerDist = Math.max(0, totalLength - 10);
      } else if (step.direction === 'left' || step.direction === 'right' || step.direction.includes('turn')) {
        triggerDist = Math.max(0, dist - 30);
      } else {
        triggerDist = dist;
      }

      stepMarkers.push({
        stepNumber: step.stepNumber,
        dist,
        triggerDist,
        label
      });
    }

    // Strict sequential pacing guarantee: ensure every consecutive step marker has
    // at least 35px of travel distance separating them so no step is ever skipped or flashed
    for (let i = 1; i < stepMarkers.length - 1; i++) {
      if (stepMarkers[i].triggerDist <= stepMarkers[i - 1].triggerDist + 35) {
        stepMarkers[i].triggerDist = stepMarkers[i - 1].triggerDist + 35;
      }
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
    const isArrived = text.includes('Arrived');
    const safeText = isArrived ? 'Arrived!' : (text.length > 20 ? text.slice(0, 18) + '…' : text);
    bubbleText.textContent = safeText;

    if (isArrived) {
      bubbleIcon.style.display = 'block';
      bubbleText.setAttribute('x', '6');
      const pillWidth = 84;
      bubbleBg.setAttribute('x', `${(-pillWidth / 2).toFixed(1)}`);
      bubbleBg.setAttribute('width', `${pillWidth.toFixed(1)}`);
    } else {
      bubbleIcon.style.display = 'none';
      bubbleText.setAttribute('x', '0');
      const textLen = safeText.length;
      const pillWidth = Math.min(130, Math.max(72, textLen * 6.8 + 18));
      bubbleBg.setAttribute('x', `${(-pillWidth / 2).toFixed(1)}`);
      bubbleBg.setAttribute('width', `${pillWidth.toFixed(1)}`);
    }

    bubble.classList.add('is-active');

    if (bubbleTimeout) clearTimeout(bubbleTimeout);
    if (!isArrived) {
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

    // Place avatar at final destination point and trigger arrival celebration
    const endPt = dottedPath.getPointAtLength(totalLength);
    avatarGroup.setAttribute('transform', `translate(${endPt.x.toFixed(2)}, ${endPt.y.toFixed(2)})`);
    avatarGroup.classList.remove('is-walking');
    avatarGroup.classList.add('is-arrived');
    showStepBubble('Arrived!');

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

    // Directional orientation: face the direction of walking across screen space
    const nextDist = Math.min(currentDist + 8, totalLength);
    const nextPt = dottedPath.getPointAtLength(nextDist);
    const dx = nextPt.x - currentPt.x;
    const dy = nextPt.y - currentPt.y;

    // Project layer displacement (dx, dy) into screen space via active rotation angle
    const rad = currentMapRotation * (Math.PI / 180);
    const dx_screen = dx * Math.cos(rad) - dy * Math.sin(rad);

    if (dx_screen < -0.8) {
      visual.style.transform = 'scaleX(-1)';
    } else if (dx_screen > 0.8) {
      visual.style.transform = 'scaleX(1)';
    }

    // Progressive line reveal: draws line and casing out from start to current position as person walks!
    const remaining = Math.max(0, totalLength - currentDist);
    trackCasing.style.strokeDashoffset = `${remaining}`;
    dottedPath.style.strokeDashoffset = `${remaining}`;

    // Dynamic Turn-by-Turn Announcement Bubble: check if walker reached any turn marker
    for (let i = 0; i < stepMarkers.length; i++) {
      const marker = stepMarkers[i];
      if (currentDist >= marker.triggerDist && activeStepIndex < i) {
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
 * Counter-rotates all entrance marker groups by -rotationDeg around (0,0) so that
 * the location pin tip remains locked to the entrance coordinate while the pin body,
 * avatar, entry badge pill, and touch hitbox remain 100% upright and readable facing the user.
 *
 * @param {SVGGElement} markersLayer - The #markers-layer SVG group
 * @param {number} rotationDeg - Current map rotation in degrees
 */
export function updateEntranceMarkersRotation(markersLayer, rotationDeg) {
  currentMapRotation = rotationDeg;
  if (!markersLayer) return;
  const rotators = markersLayer.querySelectorAll('.entrance-marker-rotator');
  const counterAngle = -rotationDeg;
  rotators.forEach((rotator) => {
    rotator.setAttribute('transform', `rotate(${counterAngle}, 0, 0)`);
  });
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

    // Rotator group for dynamic billboarding:
    // Counter-rotates everything around (0,0) by -currentEntranceMarkersRotation.
    // Pin tip stays anchored at the entrance coordinate while pin body, avatar,
    // and entry badge pill always remain upright facing the user.
    const rotator = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    rotator.setAttribute('class', 'entrance-marker-rotator');
    rotator.setAttribute('transform', `rotate(${-currentMapRotation}, 0, 0)`);

    // Scaled-up high-contrast vector pin with crown badge above the pin:
    // Pin head circle center: (0, -96), radius R = 48. Top of pin at y = -144.
    // Pin tip touches coordinate at (0, 0).
    // Tangent points from (0, 0) to circle (0, -96) with R = 48: x = ±41.6, y = -72.

    // 1. Transparent Hitbox (270x275 units covering jumbo crown badge and pin)
    const hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    hitbox.setAttribute('class', 'entrance-marker-hitbox');
    hitbox.setAttribute('x', '-135');
    hitbox.setAttribute('y', '-245');
    hitbox.setAttribute('width', '270');
    hitbox.setAttribute('height', '275');
    hitbox.setAttribute('fill', 'transparent');

    // Inner visual group: scales locally around (0,0) so the parent SVG translation is NEVER overridden
    const visual = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    visual.setAttribute('class', 'entrance-marker-visual');

    // 2. Soft Ground Shadow Ellipse at pin tip
    const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    shadow.setAttribute('class', 'entrance-marker-shadow');
    shadow.setAttribute('cx', '0');
    shadow.setAttribute('cy', '4');
    shadow.setAttribute('rx', '30');
    shadow.setAttribute('ry', '8');
    shadow.setAttribute('fill', 'rgba(0, 0, 0, 0.22)');

    // 3. Teardrop Location Pin Body (Vibrant Red #E53935)
    const pin = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pin.setAttribute('class', 'entrance-marker-pin-body');
    pin.setAttribute('d', 'M 0 0 L -41.6 -72 A 48 48 0 1 1 41.6 -72 Z');

    // 4. Subtle 3D Beveled Shade on Right Half (#C62828)
    const shade = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    shade.setAttribute('class', 'entrance-marker-pin-shade');
    shade.setAttribute('d', 'M 0 0 L 0 -144 A 48 48 0 0 1 41.6 -72 Z');

    // 5. Crisp White Inner Circle
    const disc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    disc.setAttribute('class', 'entrance-marker-disc');
    disc.setAttribute('cx', '0');
    disc.setAttribute('cy', '-96');
    disc.setAttribute('r', '33');

    // 6. User / Person Avatar Silhouette in Red (#E53935)
    const avatarHead = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    avatarHead.setAttribute('class', 'entrance-marker-avatar');
    avatarHead.setAttribute('cx', '0');
    avatarHead.setAttribute('cy', '-106');
    avatarHead.setAttribute('r', '11');

    const avatarTorso = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    avatarTorso.setAttribute('class', 'entrance-marker-avatar');
    avatarTorso.setAttribute('d', 'M -21 -71 C -21 -90, 21 -90, 21 -71 A 32.5 32.5 0 0 1 -21 -71 Z');

    // 7. Crown Entry Badge Pill Above Pin (White bg, Red border #E53935, Dark text #1E293B)
    // Jumbo high-visibility dimensions for 42px ultra-bold text readable from any distance
    const pillWidth = entry.entrance_id >= 10 ? 256 : 230;
    const halfPill = pillWidth / 2;

    const pillBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    pillBg.setAttribute('class', 'entrance-marker-pill-bg');
    pillBg.setAttribute('x', String(-halfPill));
    pillBg.setAttribute('y', '-226');
    pillBg.setAttribute('width', String(pillWidth));
    pillBg.setAttribute('height', '70');
    pillBg.setAttribute('rx', '35');

    const pillText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    pillText.setAttribute('class', 'entrance-marker-pill-text');
    pillText.setAttribute('x', '0');
    pillText.setAttribute('y', '-191');
    pillText.textContent = `Entry ${entry.entrance_id}`;

    visual.appendChild(shadow);
    visual.appendChild(pin);
    visual.appendChild(shade);
    visual.appendChild(disc);
    visual.appendChild(avatarHead);
    visual.appendChild(avatarTorso);
    visual.appendChild(pillBg);
    visual.appendChild(pillText);

    rotator.appendChild(hitbox);
    rotator.appendChild(visual);
    g.appendChild(rotator);

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

    container.appendChild(svgElement);

    // Dismiss splash loading screen gracefully once minimum display timer has elapsed (1500ms like mobile app)
    dismissSplashScreen(1500);

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

const splashInitTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

/**
 * Dismisses the splash loading screen with a smooth fade-out once minimum display timer has elapsed.
 * Mirrors Flutter's _startSplashTimer() (1500ms delay).
 * @param {number} minDuration - Minimum milliseconds the splash screen stays visible (default: 1500)
 */
export function dismissSplashScreen(minDuration = 1500) {
  const loadingIndicator = document.getElementById('map-loading');
  if (!loadingIndicator || loadingIndicator.dataset.dismissed === 'true') return;

  loadingIndicator.dataset.dismissed = 'true';
  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - splashInitTime;
  const remaining = Math.max(0, minDuration - elapsed);

  setTimeout(() => {
    loadingIndicator.classList.add('is-fade-out');
    setTimeout(() => {
      loadingIndicator.style.display = 'none';
    }, 600);
  }, remaining);
}


