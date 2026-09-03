# Task Plan: MerkadoGo Web

## Goal
Build the browser-accessible indoor kiosk map and search directory for the Ligao City Public Market using a flat SVG DOM architecture, pure JS A* routing, and Vite.

## Current Phase: Phase 4 Extension: Navigation, Wayfinding & Stall UI Refinements
## Next Step: Execute Task 4.6: Demand-Driven Entrance Markers & Entrance Preview Popup.

### Phase 1: Foundation (Vite + Shell)
**Status:** complete
- [x] Scaffold Vite Vanilla JS project (Task 1.1 complete).
- [x] Implement CSS Tokens and typography based on the "Civic Craft" design system (Task 1.2 complete).
- [x] Setup layout shell for map viewport and floating cards (Task 1.3 complete).

### Phase 2: Map Rendering & Interactivity
**Status:** complete
- [x] Inject `LigaoCity_PublicMarket_Map.svg` into `#map-viewport` and index stalls (Task 2.1 complete).
- [x] Implement CSS transform-based pan and zoom (Task 2.2 complete).
- [x] Apply Unassigned Stall default styles and hit testing (Task 2.3 complete).

### Phase 3: Data Integration (Static JSON Fallback + Live Firestore Sync)
**Status:** complete
- [x] Task 3.1: Fetch static JSONs (`map_nodes.json`, `stall_nodes.json`, `market_entry_points.json`, `subcategory_search_directory.json` into `src/dataStore.js`).
- [x] Task 3.2: Color SVG polygons dynamically based on `primary_category` using canonical `ZONE_PALETTE`.
- [x] Task 3.3: Implement Stall Details floating card population on click (`src/uiController.js`).
- [x] Task 3.4: Connect live Cloud Firestore `/stalls` stream using public read permissions and `.env` credentials (`FIREBASE_WEB_API_KEY`).

### Phase 4: Navigation & Pathfinding Engine
**Status:** complete
- [x] Task 4.1: Convert `map_nodes.json` to an in-memory weighted graph (`src/pathfinder.js`).
- [x] Task 4.2: Implement A* pathfinding and turn-by-turn text generation (`src/pathfinder.js`, `src/turnGenerator.js`).
- [x] Task 4.3: Route UI Overlay & Entrance Selector (`src/uiController.js`, `src/mapRenderer.js`).

### Phase 4 Extension: Navigation, Wayfinding & Stall UI Refinements
**Status:** in_progress
- [x] Task 4.4: Exact Pathway Calibration & Animated Route Tracing (`src/mapRenderer.js`, `src/style.css`).
- [x] Task 4.5: Enhanced Stall Details Card: Photos & Business Hours (`src/uiController.js`, `index.html`, `src/style.css`).
- [ ] Task 4.6: Demand-Driven Entrance Markers & Entrance Preview Popup (`src/uiController.js`, `src/mapRenderer.js`, `public/data/market_entry_points.json`).

### Phase 5: Search & Directory
**Status:** paused (holding off per user request until Phase 4 extension is complete)
- Build text normalization and keyword matching logic.
- Cross-reference with vendors' `search_categories[]`.
- Build Search UI and connect click to map highlight and routing.

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Browser evaluate sandbox: `await import()` inside `playwright.evaluate` fails with "importModule is not defined" | Task 4.1/4.2 in-page module verification | Inject a `<script type="module">` that imports the module and stores it on `window` (e.g. `window.__pf`), evaluate against that, then reload the tab to drop test artifacts. Same root cause as the Task 3.2 cache-bust gotcha. |
| TypeError in verification harness: verification report object passed to `analyzeReachability()` instead of a built graph | Task 4.1 in-page tests, attempt 1 | Test-script bug, not a module bug — fixed the harness call. Also surfaced a real semantic gap the same session: connectivity was counted via directed traversal; corrected to undirected walkway semantics in `pathfinder.js`. |
| Task 4.2 checkbox left unticked in `todo.md` despite completion NOTE | Session wrap-up | Caught on user review; ticked and checkpoint items filled with verification evidence. |
| Route polyline drew ~7400 units off the map (blank map in first visual check): map_nodes.json coordinates live in a different frame than the SVG (all nodes at negative x) | Task 4.3 visual verification | Applied the mobile app's hand-calibrated node→SVG translation as `mapRenderer.NODE_TO_SVG_OFFSET = {x:+7706.4, y:+3163.3}` in `drawRoute()` and route-bounds framing; routing math stays in node space (translation-invariant). Route endpoint now lands 78 units from the destination stall center (walkway edge). |
