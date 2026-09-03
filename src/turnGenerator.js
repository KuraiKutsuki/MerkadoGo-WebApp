/**
 * MerkadoGo Web — Turn-by-Turn Direction Generator (Task 4.2)
 *
 * Ports the companion mobile app's bearing-delta instruction logic
 * (PathfindingService.generateTurnInstructions) as pure functions
 * (Guardrail 9). Thresholds and instruction flavor MIRROR THE MOBILE
 * REFERENCE for cross-platform behavioral parity (user decision 2026-09-02):
 * - |delta| <= 18° straight; <= 45° slight; <= 135° normal; <= 165° sharp; else U-turn
 * - Consecutive straight segments collapse into one "Continue straight" step,
 *   emitted only when the accumulated distance exceeds 50 SVG units
 * - Turn steps name the market zone from the node-ID prefix
 *
 * Bearings use atan2(dy, dx) in the SVG's y-down screen coordinate space, so
 * a positive signed delta is a right-hand turn and negative is left-handed.
 *
 * Known mobile quirk fixed in this port: the mobile merge only fired when the
 * previous step was already a straight step, which could never happen (start
 * and turn steps are the only kinds added), making its 50-unit rule dead
 * code. Here the pending straight run is flushed correctly — both when a turn
 * interrupts it and after the final turn before arrival.
 */

import { euclideanDistance } from './pathfinder.js';

/** Turn classification thresholds in degrees (mobile reference values). */
export const TURN_THRESHOLDS = Object.freeze({
  straightMax: 18,
  slightMax: 45,
  turnMax: 135,
  sharpMax: 165,
  straightMergeMinUnits: 50
});

const TURN_LABELS = Object.freeze({
  'slight-right': 'Slight right',
  'right': 'Turn right',
  'sharp-right': 'Sharp right',
  'slight-left': 'Slight left',
  'left': 'Turn left',
  'sharp-left': 'Sharp left',
  'u-turn': 'Make a U-turn'
});

/**
 * Normalizes an angle delta into [-180, 180].
 * @param {number} delta - Raw angular difference in degrees.
 * @returns {number}
 */
export function normalizeAngleDelta(delta) {
  let d = delta;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

/**
 * Classifies a signed bearing delta into a direction token. Positive deltas
 * are right-handed (SVG y-down screen space), negative left-handed.
 * @param {number} delta - Normalized signed delta in degrees.
 * @returns {'straight'|'slight-right'|'right'|'sharp-right'|'slight-left'|'left'|'sharp-left'|'u-turn'}
 */
export function classifyTurn(delta) {
  const abs = Math.abs(delta);

  if (abs <= TURN_THRESHOLDS.straightMax) return 'straight';
  if (delta > 0) {
    if (abs <= TURN_THRESHOLDS.slightMax) return 'slight-right';
    if (abs <= TURN_THRESHOLDS.turnMax) return 'right';
    if (abs <= TURN_THRESHOLDS.sharpMax) return 'sharp-right';
    return 'u-turn';
  }
  if (abs <= TURN_THRESHOLDS.slightMax) return 'slight-left';
  if (abs <= TURN_THRESHOLDS.turnMax) return 'left';
  if (abs <= TURN_THRESHOLDS.sharpMax) return 'sharp-left';
  return 'u-turn';
}

/**
 * Human zone name from the pathway node naming convention
 * node_[zone]_[intersection][#] (Master Context §5.1).
 * @param {string} nodeId
 * @returns {string}
 */
export function getZoneDescription(nodeId) {
  if (typeof nodeId !== 'string') return 'Market Walkway';
  if (nodeId.startsWith('node_wm')) return 'Wet Market';
  if (nodeId.startsWith('node_ea')) return 'Eateries Section';
  if (nodeId.startsWith('node_dm')) return 'Dry Market';
  if (nodeId.startsWith('node_rs')) return 'Rice Section';
  if (nodeId.startsWith('node_fs')) return 'Fruits Section';
  if (nodeId.startsWith('node_ex')) return 'Main Corridor';
  return 'Market Walkway';
}

/**
 * Generates the static turn-by-turn instruction list for a resolved path
 * (Master Context §7.3). The kiosk has no navigation-in-motion use case, so
 * this list is computed once per route and displayed as-is.
 *
 * Output shape (mirrors the mobile NavigationStep): every step carries
 * { stepNumber, direction, instruction, distance, nodeId, fromNodeId,
 * toNodeId }, distances are SVG coordinate units, and the step distances sum
 * to the full path length (the start step owns segment 0→1; every later
 * segment belongs to exactly one straight or turn step).
 *
 * @param {string[]} path - Ordered node IDs from findPath() (length >= 1).
 * @param {Object.<string, {x: number, y: number}>} nodes - Graph node coordinates.
 * @param {{entranceDescription?: string, destinationName?: string}} [options]
 * @returns {Array<Object>} Instruction steps; [] for an empty path or a path
 *   referencing unknown nodes (warns instead of throwing).
 */
export function generateDirections(path, nodes, options = {}) {
  if (!Array.isArray(path) || path.length === 0) return [];
  if (!nodes || typeof nodes !== 'object') {
    console.warn('[MerkadoGo Directions] generateDirections: no node coordinates provided');
    return [];
  }
  for (const nodeId of path) {
    if (!nodes[nodeId]) {
      console.warn(`[MerkadoGo Directions] generateDirections: path references unknown node "${nodeId}"`);
      return [];
    }
  }

  const entranceDescription = options.entranceDescription || 'the entrance';
  const destinationName = options.destinationName || 'your destination';
  const distance = (aId, bId) => euclideanDistance(nodes[aId], nodes[bId]);

  // Single-node path: start and goal coincide (already at the stall)
  if (path.length === 1) {
    return [{
      stepNumber: 1,
      direction: 'arrive',
      instruction: `You are already at ${destinationName}`,
      distance: 0,
      nodeId: path[0],
      fromNodeId: null,
      toNodeId: null
    }];
  }

  const steps = [];
  steps.push({
    stepNumber: 1,
    direction: 'start',
    instruction: `Enter via ${entranceDescription} and head into the aisle`,
    distance: distance(path[0], path[1]),
    nodeId: path[0],
    fromNodeId: path[0],
    toNodeId: path[1]
  });

  // Consecutive straight segments accumulate; flush as one step only when
  // they exceed the 50-unit merge minimum (mobile reference value)
  let straightAccumulated = 0;
  let straightStartIndex = -1;

  const flushStraight = (endIndex) => {
    if (straightAccumulated > TURN_THRESHOLDS.straightMergeMinUnits) {
      steps.push({
        stepNumber: steps.length + 1,
        direction: 'straight',
        instruction: 'Continue straight along the corridor',
        distance: straightAccumulated,
        nodeId: path[endIndex],
        fromNodeId: path[straightStartIndex],
        toNodeId: path[endIndex]
      });
    }
    straightAccumulated = 0;
    straightStartIndex = -1;
  };

  for (let i = 0; i < path.length - 2; i++) {
    const aId = path[i];
    const bId = path[i + 1];
    const cId = path[i + 2];

    const bearingAB = Math.atan2(nodes[bId].y - nodes[aId].y, nodes[bId].x - nodes[aId].x) * (180 / Math.PI);
    const bearingBC = Math.atan2(nodes[cId].y - nodes[bId].y, nodes[cId].x - nodes[bId].x) * (180 / Math.PI);
    const delta = normalizeAngleDelta(bearingBC - bearingAB);
    const direction = classifyTurn(delta);

    if (direction === 'straight') {
      if (straightStartIndex === -1) straightStartIndex = i + 1;
      straightAccumulated += distance(bId, cId);
      continue;
    }

    flushStraight(i + 1);
    steps.push({
      stepNumber: steps.length + 1,
      direction,
      instruction: `${TURN_LABELS[direction]} at the intersection towards ${getZoneDescription(bId)}`,
      distance: distance(bId, cId),
      nodeId: bId,
      fromNodeId: bId,
      toNodeId: cId
    });
  }

  // Straight run between the last turn and the destination
  if (straightStartIndex !== -1) {
    flushStraight(path.length - 1);
  }

  steps.push({
    stepNumber: steps.length + 1,
    direction: 'arrive',
    instruction: `Arrive at ${destinationName} on your pathway`,
    distance: 0,
    nodeId: path[path.length - 1],
    fromNodeId: null,
    toNodeId: null
  });

  return steps;
}
