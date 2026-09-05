/**
 * MerkadoGo Web — A* Pathfinder Graph Builder (Task 4.1)
 *
 * Parses map_nodes.json (Master Context §3.1/§7.1) into a weighted
 * bidirectional graph: every materialized edge carries its Euclidean
 * distance in SVG coordinate units, so the A* search (Task 4.2) never
 * recomputes geometry mid-run.
 *
 * Pure data layer (Guardrail 9): no DOM access, no global mutable state —
 * every function takes its inputs and returns new objects, and the raw
 * map_nodes.json payload is never mutated.
 */

/**
 * Euclidean distance between two { x, y } points in SVG coordinate units.
 * Also the A* heuristic basis (Master Context §7.2): edge cost and heuristic
 * share the same metric, which keeps the heuristic admissible and consistent.
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @returns {number}
 */
export function euclideanDistance(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Builds the weighted routing graph from raw map_nodes.json (Master Context
 * §7.1). Shapes per Master Context: nodes map to { x, y }, adjacency maps to
 * arrays of { id, weight } edges. Duplicate neighbor entries are deduped
 * (the mobile reference hit this anomaly on id_39). Nodes without valid
 * numeric coordinates are excluded — they cannot carry Euclidean weights —
 * and dangling neighbor references are skipped. Every anomaly warns instead
 * of throwing: a graph data hiccup must not crash the kiosk.
 * @param {Object} mapNodes - Raw map_nodes.json payload.
 * @returns {{ nodes: Object.<string, {x: number, y: number}>, adjacency: Object.<string, Array<{id: string, weight: number}>> }}
 */
export function buildPathfindingGraph(mapNodes) {
  const nodes = {};
  const adjacency = {};

  for (const [nodeId, node] of Object.entries(mapNodes || {})) {
    if (typeof node?.x !== 'number' || typeof node?.y !== 'number') {
      console.warn(`[MerkadoGo Path] graph build: node "${nodeId}" lacks numeric x/y — excluded from the routing graph`);
      continue;
    }
    nodes[nodeId] = { x: node.x, y: node.y };
  }

  for (const [nodeId, coords] of Object.entries(nodes)) {
    const rawNeighbors = mapNodes[nodeId].neighbors;
    const edges = [];
    const seen = new Set();

    for (const neighborId of Array.isArray(rawNeighbors) ? rawNeighbors : []) {
      if (typeof neighborId !== 'string' || !nodes[neighborId]) {
        console.warn(`[MerkadoGo Path] graph build: skipping dangling neighbor "${nodeId}" -> "${neighborId}"`);
        continue;
      }
      if (seen.has(neighborId)) continue;
      seen.add(neighborId);
      edges.push({ id: neighborId, weight: euclideanDistance(coords, nodes[neighborId]) });
    }

    adjacency[nodeId] = edges;
  }

  return { nodes, adjacency };
}

/**
 * Flood fill over the graph treating materialized edges as undirected
 * walkways: a missing reverse entry is a data bug surfaced separately by the
 * reciprocity check, not a physical one-way corridor, so connectivity and
 * reachability must judge the walkable network, not the raw adjacency lists.
 * @param {{nodes: Object, adjacency: Object}} graph
 * @returns {Object.<string, Set<string>>} nodeId -> neighbor IDs (both directions)
 */
function buildUndirectedView(graph) {
  const undirected = {};
  for (const nodeId of Object.keys(graph.nodes)) {
    undirected[nodeId] = new Set();
  }
  for (const [nodeId, edges] of Object.entries(graph.adjacency)) {
    if (!undirected[nodeId]) continue;
    for (const edge of edges) {
      if (undirected[nodeId].has(edge.id)) continue;
      if (!undirected[edge.id]) continue;
      undirected[nodeId].add(edge.id);
      undirected[edge.id].add(nodeId);
    }
  }
  return undirected;
}

/**
 * Collects every node ID reachable from startId over the undirected view.
 * @param {Object.<string, Set<string>>} undirected
 * @param {string} startId
 * @returns {Set<string>}
 */
function collectComponent(undirected, startId) {
  const visited = new Set([startId]);
  const stack = [startId];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const neighborId of undirected[current]) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        stack.push(neighborId);
      }
    }
  }
  return visited;
}

/**
 * Structural verification of a built graph (Task 4.1 acceptance): bidirectional
 * edge reciprocity, connectivity via undirected flood fill, and isolated nodes.
 * Pure — reads the graph, mutates nothing.
 * @param {{nodes: Object, adjacency: Object}} graph
 * @returns {{
 *   nodeCount: number,
 *   edgeCount: number,
 *   asymmetricEdges: string[],
 *   components: number,
 *   isolatedNodes: string[],
 *   isConnected: boolean
 * }}
 */
export function verifyPathfindingGraph(graph) {
  const nodeIds = Object.keys(graph.nodes);

  // Reciprocity: every materialized edge A->B must have a B->A counterpart,
  // otherwise A* could reach a node it can never route back through
  const asymmetricEdges = [];
  for (const [nodeId, edges] of Object.entries(graph.adjacency)) {
    for (const edge of edges) {
      const reverseEdges = graph.adjacency[edge.id];
      if (!reverseEdges || !reverseEdges.some((e) => e.id === nodeId)) {
        asymmetricEdges.push(`${nodeId} -> ${edge.id}`);
      }
    }
  }

  // Connectivity: flood fill the undirected walkway network, count disjoint
  // components
  const undirected = buildUndirectedView(graph);
  const visited = new Set();
  let components = 0;
  for (const startId of nodeIds) {
    if (visited.has(startId)) continue;
    components++;
    for (const nodeId of collectComponent(undirected, startId)) {
      visited.add(nodeId);
    }
  }

  const isolatedNodes = nodeIds.filter((id) => graph.adjacency[id].length === 0);

  return {
    nodeCount: nodeIds.length,
    edgeCount: nodeIds.reduce((sum, id) => sum + graph.adjacency[id].length, 0),
    asymmetricEdges,
    components,
    isolatedNodes,
    isConnected: nodeIds.length > 0 && components === 1
  };
}

/**
 * Reachability cross-check for routing-critical node IDs (Task 4.1
 * verification): every entrance gate node and every stall's primary snap
 * node (index 0) must exist in the graph AND sit in the same connected
 * walkway component as the rest of the market — otherwise some routes can
 * never be found. Pure.
 * @param {{nodes: Object, adjacency: Object}} graph
 * @param {string[]} requiredNodeIds - Entrance node_ids + primary stall snap nodes.
 * @returns {{ missing: string[], unreachable: string[], reachable: number }}
 */
export function analyzeReachability(graph, requiredNodeIds) {
  // Flood fill from the first node to define the reachable walkway component
  const undirected = buildUndirectedView(graph);
  const firstId = Object.keys(graph.nodes)[0];
  const visited = firstId ? collectComponent(undirected, firstId) : new Set();

  const missing = [];
  const unreachable = [];
  for (const nodeId of requiredNodeIds) {
    if (!graph.nodes[nodeId]) {
      missing.push(nodeId);
    } else if (!visited.has(nodeId)) {
      unreachable.push(nodeId);
    }
  }

  return {
    missing,
    unreachable,
    reachable: requiredNodeIds.length - missing.length - unreachable.length
  };
}

/**
 * Resolves a stall's primary snap node — the index-0 rule (Master Context
 * §3.2). Accepts the raw stall_nodes.json value, which may legally be a
 * single node ID string or an array of candidates; anything else yields
 * null. Deterministic by design: index 0, never averaging or randomizing.
 * @param {string|string[]|null} stallNodeValue - Raw stall_nodes.json value.
 * @returns {string|null} Primary snap node ID, or null if unresolvable.
 */
export function getPrimarySnapNode(stallNodeValue) {
  if (typeof stallNodeValue === 'string' && stallNodeValue) return stallNodeValue;
  if (Array.isArray(stallNodeValue) && typeof stallNodeValue[0] === 'string' && stallNodeValue[0]) {
    return stallNodeValue[0];
  }
  return null;
}

/**
 * Resolves all candidate snap nodes for a stall from stall_nodes.json.
 * Handles both single-string node IDs and array-of-strings candidates.
 * Deduplicates candidates while preserving order.
 * @param {string|string[]|null} stallNodeValue - Raw stall_nodes.json value.
 * @returns {string[]} Array of candidate node IDs (empty array if unresolvable).
 */
export function getCandidateSnapNodes(stallNodeValue) {
  if (typeof stallNodeValue === 'string' && stallNodeValue.trim()) {
    return [stallNodeValue.trim()];
  }
  if (Array.isArray(stallNodeValue)) {
    const candidates = [];
    const seen = new Set();
    for (const node of stallNodeValue) {
      if (typeof node === 'string' && node.trim() && !seen.has(node.trim())) {
        seen.add(node.trim());
        candidates.push(node.trim());
      }
    }
    return candidates;
  }
  return [];
}

/**
 * Binary min-heap priority queue for A*'s open set. Array-based with a
 * monotonic insertion counter, so equal-priority pops come out FIFO and the
 * search is fully deterministic (same inputs -> same path, Guardrail 9).
 */
class MinHeap {
  constructor() {
    this.items = [];
    this.counter = 0;
  }

  get size() {
    return this.items.length;
  }

  /**
   * @param {string} item
   * @param {number} priority - Lower values pop first.
   */
  push(item, priority) {
    const entry = { priority, order: this.counter++, item };
    this.items.push(entry);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(this.items[i], this.items[parent]) < 0) {
        this.items[i] = this.items[parent];
        this.items[parent] = entry;
        i = parent;
      } else {
        break;
      }
    }
  }

  /**
   * @returns {string} The item with the lowest priority.
   */
  pop() {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.items.length && this.compare(this.items[left], this.items[smallest]) < 0) smallest = left;
        if (right < this.items.length && this.compare(this.items[right], this.items[smallest]) < 0) smallest = right;
        if (smallest === i) break;
        const tmp = this.items[i];
        this.items[i] = this.items[smallest];
        this.items[smallest] = tmp;
        i = smallest;
      }
    }
    return top.item;
  }

  /**
   * Total order on entries: priority first, insertion order breaking ties.
   * @param {{priority: number, order: number}} a
   * @param {{priority: number, order: number}} b
   * @returns {number}
   */
  compare(a, b) {
    return a.priority !== b.priority ? a.priority - b.priority : a.order - b.order;
  }
}

/**
 * Reconstructs the ordered node path by walking the came-from chain backwards.
 * @param {Map<string, string>} cameFrom
 * @param {string} currentId
 * @returns {string[]}
 */
function reconstructPath(cameFrom, currentId) {
  const path = [currentId];
  let cursor = currentId;
  while (cameFrom.has(cursor)) {
    cursor = cameFrom.get(cursor);
    path.push(cursor);
  }
  return path.reverse();
}

/**
 * A* search over a built graph (Task 4.2, Master Context §7.2). Pure and
 * synchronous: same inputs always produce the same output, no DOM or Firebase
 * access. Edge costs come from the materialized Euclidean weights and the
 * heuristic is the straight-line distance to the goal — the same metric, so
 * the heuristic is admissible and consistent and returned paths are optimal.
 *
 * Mirrors the mobile reference's behavior: an empty array means "no route"
 * (unknown endpoints or disconnected graph), never an exception.
 *
 * @param {{nodes: Object, adjacency: Object}} graph - Built via buildPathfindingGraph().
 * @param {string} startNodeId - Entrance gate node (route origin).
 * @param {string} goalNodeId - Destination snap node (getPrimarySnapNode index 0).
 * @returns {string[]} Ordered node IDs from start to goal; [] when unroutable.
 */
export function findPath(graph, startNodeId, goalNodeId) {
  const nodes = graph?.nodes;
  const adjacency = graph?.adjacency;

  if (!nodes || !adjacency) {
    console.warn('[MerkadoGo Path] findPath: no graph provided');
    return [];
  }
  if (!nodes[startNodeId]) {
    console.warn(`[MerkadoGo Path] findPath: unknown start node "${startNodeId}"`);
    return [];
  }
  if (!nodes[goalNodeId]) {
    console.warn(`[MerkadoGo Path] findPath: unknown goal node "${goalNodeId}"`);
    return [];
  }
  if (startNodeId === goalNodeId) {
    return [startNodeId];
  }

  const gScore = new Map([[startNodeId, 0]]);
  const cameFrom = new Map();
  const closed = new Set();
  const open = new MinHeap();
  open.push(startNodeId, euclideanDistance(nodes[startNodeId], nodes[goalNodeId]));

  while (open.size > 0) {
    const currentId = open.pop();
    if (closed.has(currentId)) continue; // stale heap entry (lazy deletion)
    if (currentId === goalNodeId) {
      return reconstructPath(cameFrom, currentId);
    }
    closed.add(currentId);

    const currentG = gScore.get(currentId);
    for (const edge of adjacency[currentId] || []) {
      if (closed.has(edge.id)) continue;
      const tentativeG = currentG + edge.weight;
      if (tentativeG < (gScore.get(edge.id) ?? Infinity)) {
        cameFrom.set(edge.id, currentId);
        gScore.set(edge.id, tentativeG);
        open.push(edge.id, tentativeG + euclideanDistance(nodes[edge.id], nodes[goalNodeId]));
      }
    }
  }

  return []; // goal sits outside the start's connected component
}

/**
 * Total Euclidean cost of an ordered path — the sum of its materialized edge
 * weights. Used for "nearest entrance by walking distance" selection, which
 * beats straight-line distance because it respects the actual corridor graph.
 * @param {{nodes: Object, adjacency: Object}} graph
 * @param {string[]} path - Ordered node IDs as returned by findPath().
 * @returns {number} Total cost; Infinity for a broken path (missing edge).
 */
export function getPathCost(graph, path) {
  if (!Array.isArray(path) || path.length < 2) return 0;
  let cost = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const edge = graph.adjacency[path[i]]?.find((e) => e.id === path[i + 1]);
    if (!edge) return Infinity;
    cost += edge.weight;
  }
  return cost;
}

/**
 * Evaluates all candidate access nodes for a destination stall from a starting node
 * (e.g. entrance gate), returning the path with the shortest Euclidean walking cost.
 * Mirrors the mobile app's multi-candidate A* evaluation (PathfindingService.aStarPath).
 * 
 * @param {{nodes: Object, adjacency: Object}} graph - Built via buildPathfindingGraph().
 * @param {string} startNodeId - Entrance gate node ID.
 * @param {string[]} candidateGoalNodeIds - Candidate goal node IDs.
 * @returns {{ path: string[], goalNodeId: string, cost: number } | null}
 */
export function findOptimalPath(graph, startNodeId, candidateGoalNodeIds) {
  if (!Array.isArray(candidateGoalNodeIds) || candidateGoalNodeIds.length === 0) {
    return null;
  }

  let bestPath = [];
  let bestGoalId = null;
  let bestCost = Infinity;

  for (const candidateId of candidateGoalNodeIds) {
    if (!graph?.nodes?.[candidateId]) continue;
    const path = findPath(graph, startNodeId, candidateId);
    if (path.length > 0) {
      const cost = getPathCost(graph, path);
      if (cost < bestCost) {
        bestCost = cost;
        bestPath = path;
        bestGoalId = candidateId;
      }
    }
  }

  if (bestPath.length === 0 || !bestGoalId) {
    return null;
  }

  return { path: bestPath, goalNodeId: bestGoalId, cost: bestCost };
}

