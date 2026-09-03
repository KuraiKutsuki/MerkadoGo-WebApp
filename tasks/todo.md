# MerkadoGo Web Tasks

## Phase 1: Foundation (Vite + Shell)
- [x] Task 1.1: Scaffold Vite Vanilla JS project and clear boilerplate
  - **Acceptance:** Vite dev server runs, serving basic `index.html`.
  - **Verification:** Run `npm run dev` and hit localhost.
  - **Files:** `package.json`, `index.html`, `main.js`
- [x] Task 1.2: Implement "Civic Craft & Flat Utility" CSS Design System
  - **Acceptance:** CSS variables match `UI-UX Design System.md`. Typography loaded. 0 gradients, 0 shadows.
  - **Verification:** Inspect compiled CSS.
  - **Files:** `style.css`
- [x] Task 1.3: Build Base Layout Shell
  - **Acceptance:** `#map-viewport` and floating UI placeholders exist in DOM.
  - **Verification:** Visual check in browser.
  - **Files:** `index.html`, `style.css`

## Checkpoint: Foundation
- [x] Vite builds cleanly.
- [x] CSS variables are accessible in the DOM.

## Phase 2: Map Rendering & Interactivity
- [x] Task 2.1: Inject SVG into DOM
  - **Acceptance:** `LigaoCity_PublicMarket_Map.svg` is fetched and its inner content injected into `#map-viewport`.
  - **Verification:** SVG elements exist in the DOM tree.
  - **Files:** `src/mapRenderer.js`, `index.html`
- [x] Task 2.2: Implement Pan & Zoom
  - **Acceptance:** Mouse/touch drag pans the map; scroll/pinch zooms via CSS `transform` on a wrapper `<g>`.
  - **Verification:** Map can be navigated visually.
  - **Files:** `src/mapControls.js`
- [x] Task 2.3: Initial Styling & Hit Testing
  - **Acceptance:** All stalls default to `#E2E8F0` / `#94A3B8`. Clicks on `data-stall-id` elements fire a log.
  - **Verification:** Click a stall, see ID in console.
  - **Files:** `src/mapRenderer.js`

## Checkpoint: Map Rendering
- [x] Map renders and is fully navigable.
- [x] No canvas elements are used.

## Phase 3: Data Integration (Static JSON Fallback + Live Firestore Sync)
- [x] Task 3.1: Load Static Assets
  - **Acceptance:** `map_nodes.json`, `stall_nodes.json`, `market_entry_points.json`, `subcategory_search_directory.json` are fetched and stored in memory.
  - **Verification:** Console logs show parsed JSON objects.
  - **Files:** `src/dataStore.js`
- [x] Task 3.2: Load & Apply Vendor Data
  - **Acceptance:** `vendor_notes.json` fetched. Polygons colored by `primary_category` using the 18-Zone Palette.
  - **Verification:** Map shows correct colors based on vendor data.
  - **Files:** `src/dataStore.js` (normalizeStallRecord + loadVendorData), `src/mapRenderer.js` (applyVendorColors/applyVendorToStall), `src/theme/colors.js` (pre-existing), `src/main.js`
- [x] Task 3.3: Stall Details UI Card
  - **Acceptance:** Clicking a stall populates the floating Stall Details card with vendor info.
  - **Verification:** Vendor name, category, and stall number display correctly on click.
  - **Files:** `src/uiController.js`, `index.html`, `style.css`
- [x] Task 3.4: Live Firestore Stall Sync
  - **Acceptance:** App subscribes to `collection(db, "stalls")` via `onSnapshot` using `VITE_FIREBASE_*` credentials from `.env`. `added`/`modified` changes recolor the matching SVG polygon via `normalizeStallDoc()` defensive fallbacks (`category||primary_category`, `name||business_name`, etc.) and refresh the in-memory store/search index. `removed` events or `status === "closed"` / `isActive === false` reset the polygon to the Unassigned palette (`#E2E8F0` / `#94A3B8`). Static JSON remains the initial paint and the graceful fallback when Firestore is unreachable (no crash, no blank map).
  - **Verification:** Initial load paints from static JSON, then live snapshot reconciles. Simulate a document change in the Firestore console → map polygon and stall card update without reload. Block network → app still renders fully from static data with a console warning.
  - **Files:** `src/services/stallSync.js`, `src/services/stallNormalizer.js`, `.env`, `src/main.js`, `src/mapRenderer.js`, `package.json` (requires `firebase` npm dependency — install before starting this task)
  - **NOTE (2026-09-02):** Code complete & live connection verified! Live Firestore connection to `merkado-go` retrieved 134 documents from `/stalls` with 0 errors. Real-time updates automatically reconcile SVG polygon styling, stall metadata, photos, and business hours.
- [x] Checkpoint: Live `/stalls` stream updates the map in real time; app degrades gracefully to static JSON when offline. (Verified live against production database: 134 stall documents retrieved).

## Phase 4: Navigation & Pathfinding Engine
- [x] Task 4.1: Build A* Graph
  - **Acceptance:** `map_nodes.json` parsed into a weighted bidirectional graph based on Euclidean distance.
  - **Verification:** Unit test or console output verifying graph structure.
  - **Files:** `src/pathfinder.js`
  - **NOTE (2026-09-02):** Complete. `buildPathfindingGraph()` materializes `{ nodes, adjacency }` with Euclidean edge weights (`{ id, weight }`), dedupes duplicate neighbor entries, and excludes coordinate-less nodes / dangling neighbors (warn-not-throw). `verifyPathfindingGraph()` checks edge reciprocity + undirected connectivity + isolated nodes; `analyzeReachability()` cross-checks routing-critical nodes. All pure functions (Guardrail 9), zero DOM/Firebase access. Wired into `main.js` after static data load; graph exposed at `window.merkadoApp.pathGraph`. Verified live: 116 nodes / 388 directed edges / 0 asymmetric / 1 connected component / 245 of 245 routing-critical nodes (14 entrances + 231 index-0 stall snaps) reachable; 10/10 defensive malformed-input tests pass; `npm run build` clean (~10.8kB gzip main bundle unchanged).
- [x] Task 4.2: Implement A* Search & Turn Generation
  - **Acceptance:** `findPath(start, goal)` returns node array. Turn generator creates text directions from bearing deltas.
  - **Verification:** Console logs show correct route arrays and turn lists.
  - **Files:** `src/pathfinder.js`, `src/turnGenerator.js`
  - **NOTE (2026-09-02):** Complete. `findPath(graph, startNodeId, goalNodeId)` — pure A* with binary min-heap (deterministic FIFO tie-break), Euclidean heuristic = edge-cost metric (optimal paths); `[]` on unknown/disconnected (mirrors mobile), warn-not-throw. `getPrimarySnapNode()` resolves the index-0 snap rule. `src/turnGenerator.js` `generateDirections(path, nodes, {entranceDescription, destinationName})` — mirrored mobile values per user decision (18°/45°/135°/165° buckets, 50-unit straight-merge minimum, zone flavor from node prefixes); step distances sum to full path length. Mobile quirk fixed: its 50-unit merge was dead code (could never fire); this port flushes pending straight runs correctly. Verified live: 3234/3234 entrance→stall routes valid (0 empty/bad-endpoint/adjacency-violation/duplicate), 40/40 sampled routes provably optimal vs independent Dijkstra, 3210/3210 direction lists structurally valid with exact distance-sum invariant, 5011 straight steps all >50 units, deterministic; unit + edge matrices all green; build clean.
- [x] Task 4.3: Route UI Overlay
  - **Acceptance:** Entrance selector UI works. Selected route draws a `<polyline>` in `#route-layer` and turn instructions appear in a panel.
  - **Verification:** Visually verify route line from entrance to stall.
  - **Files:** `src/uiController.js`, `src/mapRenderer.js`
  - **NOTE (2026-09-02):** Complete. `mapRenderer.drawRoute()/clearRoute()` render the flat `<polyline id="active-route">` in `#route-layer` (inside `#map-transform-layer` — pans/zooms/rotates with the map); `uiController.initNavigationPanel()` owns the entrance `<select>` (14 gates from market_entry_points.json), route recompute on every gate change, instruction list (step number + text only — NO distances per the angle-only product decision), "N Steps" summary badge, Clear Route / X / Escape / tap-away dismissal. Nearest entrance preselected by SHORTEST A* WALKING DISTANCE (not straight line) via new pure `pathfinder.getPathCost()`. `main.js` wires the now-enabled Route button (card yields to panel, one sheet at a time; destination stall keeps its selection outline; controls yield via `#app.nav-open`). Viewport auto-frames the route bbox (fit-width from container aspect, 40% padding). **CRITICAL FIX — node→SVG coordinate calibration**: map_nodes.json lives in a DIFFERENT frame than the SVG (all 116 nodes at negative x; Master Context §3.1's "1:1 with viewBox units" assumption is false for this dataset). Routes initially drew ~7400 units off-map (caught by the visual check). Mirroring the mobile app's hand-calibrated constants (interactive_market_map.dart `_nodeOffsetX/_nodeOffsetY`), `mapRenderer.NODE_TO_SVG_OFFSET = {x:+7706.4, y:+3163.3}` (pure translation) is applied in `drawRoute()` and route-bounds computation; routing math stays in node space (translation-invariant — all 4.1/4.2 verification unaffected). Verified: route endpoint lands 78 units from id_3's center (walkway edge); full functional matrix green (14 unique entrance ids/nodes, card→panel handoff, entrance switch recomputes 3→5 steps, clear/escape/tap-away/stall-tap all clear, vacant-slot openForStall rejected, controls yield opacity 0, no distance markup anywhere); visual screenshots confirm the corridor-aligned green route line + destination outline on desktop 1280×720 and phone 412×915; build clean.

## Checkpoint: Navigation
- [x] Route is optimal Euclidean path. *(Proven 2026-09-02 in Task 4.2 verification: 40/40 sampled routes with A* cost exactly equal to an independent in-test Dijkstra; Euclidean heuristic = edge-cost metric ⇒ admissible & consistent.)*
- [x] `stall_nodes.json` array values correctly snap to index-0. *(Proven 2026-09-02: `getPrimarySnapNode()` index-0 rule; all 3234 swept routes terminated on the primary snap node, both single-string and array shapes covered.)*

- [x] Route UI overlay, entrance selector, and node-to-SVG coordinate calibration (`NODE_TO_SVG_OFFSET`) complete and verified. Phase 4 is 100% complete.

## Phase 4 Extension: Navigation, Wayfinding & Stall UI Refinements
- [x] Task 4.4: Exact Pathway Calibration & Animated Route Tracing
  - **Acceptance:** `NODE_TO_SVG_OFFSET` calibrated to `{ x: 7823.47, y: 3174.0 }` matching all 112 SVG vector node rects. Polyline runs strictly inside pedestrian aisles without clipping stalls. Route drawing animates progressively using SVG `stroke-dasharray` / `stroke-dashoffset` over ~1.2s.
  - **Verification:** Visual verification on mobile and desktop (including Entrance 14 → PERILLO'S EATERY 1 `id_193`), confirming route runs strictly within walkways and animates smoothly.
  - **Files:** `src/mapRenderer.js`, `src/style.css`, `src/uiController.js`
  - **NOTE (2026-09-02):** Complete. `NODE_TO_SVG_OFFSET` calibrated to exact mathematical center `{ x: 7823.47, y: 3174.0 }`, verified across all 112 embedded `<rect id="node_*">` elements in the SVG floorplan with 0.0000 coordinate diff. Polyline now runs dead-center inside walking corridors (e.g. at Perillo's Eatery 1, line runs in the 63-unit aisle between slot_ea_1 and id_193 with zero stall clipping). Progressive stroke animation implemented in `mapRenderer.drawRoute()` using `stroke-dasharray` / `stroke-dashoffset` over 1.2s cubic ease-out, respecting `prefers-reduced-motion`. Tap-away dismissal in `uiController.js` hardened so zoom and header interactions never dismiss active routes. `npm run build` clean.
- [x] Task 4.5: Enhanced Stall Details Card (Photos & Business Hours)
  - **Acceptance:** `#stall-detail-card` displays a photo header (Cloudinary CDN `vendor.photoUrls[0]` with graceful flat category banner fallback). Displays operating hours (`openTime` – `closeTime`) with `Open Now` / `Closed` badge. Primary action CTA rephrased to "How Do I Get Here?" entering Entrance Selection mode.
  - **Verification:** Click stalls with/without photos; verify image loading, hours formatting, and responsive card sizing on mobile viewport.
  - **Files:** `src/uiController.js`, `index.html`, `src/style.css`
  - **NOTE (2026-09-02):** Complete. Photo header implemented with support for Cloudinary CDN `photoUrls[0]` and graceful category-tinted fallback banner with category icon and section title. Operating hours dynamically computed with real-time `Open Now` / `Closed` status badge. CTA button rephrased to "How Do I Get Here?" with smooth handoff to Indoor Route Navigation. Verified via browser screenshots on mobile viewport (`enhanced_stall_card_1788361215887.png`, `navigation_route_active_1788361221628.png`). Build clean (1.73s).
- [ ] Task 4.6: Demand-Driven Entrance Markers & Entrance Preview Popup
  - **Acceptance:** 14 entrance markers in `#markers-layer` stay hidden during general browsing and appear only when in "Select Your Entrance" mode. Tapping an entrance pin on the map opens an Entrance Preview card with real-life photo, entrance title/description, and "Start Route Here" button. Tapping starts the animated route and opens the turn-by-turn navigation panel. All labels use "Entrance" / "Entry" (never "Gate").
  - **Verification:** End-to-end verification: Stall tap → "How Do I Get Here?" → entrance markers appear → tap marker → entrance preview card opens → tap "Start Route Here" → route animates and turn-by-turn panel displays.
  - **Files:** `src/mapRenderer.js`, `src/uiController.js`, `src/main.js`, `index.html`, `src/style.css`, `public/data/market_entry_points.json`

## Checkpoint: Navigation & Wayfinding Refinements
- [ ] Route lines strictly follow pedestrian walkways with zero stall intersections.
- [ ] Entrance markers display on demand and allow interactive map selection with preview.
- [ ] Animated line drawing is smooth on both mobile and desktop.
- [ ] Stall card presents Cloudinary photos and business hours.

## Phase 5: Search & Directory
- [ ] Task 5.1: Search Engine Logic
  - **Acceptance:** Function normalizes input and matches keywords from `subcategory_search_directory.json` and vendor `search_categories[]`.
  - **Verification:** Console test of search queries (e.g. "gulay", "sardines").
  - **Files:** `src/searchEngine.js`
- [ ] Task 5.2: Search UI & Map Integration
  - **Acceptance:** Search bar dropdown displays results. Clicking a result scrolls to stall, highlights it, and opens Stall Details.
  - **Verification:** End-to-end test of search -> click -> highlight -> details.
  - **Files:** `src/uiController.js`, `index.html`, `style.css`

## Checkpoint: Complete
- [ ] All features functional.
- [ ] Ready for review.
