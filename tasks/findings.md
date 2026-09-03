# Findings & Discoveries

## Architecture Context
- **Target**: Browser-native Web Application for Ligao City Public Market.
- **Rendering**: Inline SVG DOM (`LigaoCity_PublicMarket_Map.svg`). No canvas.
- **Routing**: Pure JS A* pathfinding via Euclidean heuristics using `map_nodes.json` and `stall_nodes.json`. No GPS.
- **Data**: Static JSON assets in `public/data/` + enhanced `vendor_notes.json` (with explicit `stall_id`) + live Cloud Firestore stream (`collection(db, "stalls")`).
- **Design System**: "Civic Craft & Flat Utility" - 0 gradients, 0 drop shadows, 1px `#E2E8E2` borders, 2px SVG strokes. 18-Zone Palette applied.

## Database Schema & Live Firestore Findings (2026-09-01)
- **Schema Bundle**: Official bundle provided in `database_schema/` (`models/`, `constants/`, `firebase/`, `typescript_types/`, `json_assets/`).
- **Collection Name**: The Firestore collection is `/stalls` (Document ID = stall ID e.g. `id_3`), NOT `vendors`.
- **Security Rules**: `firestore.rules` updated to `allow read: if true;` for `/stalls` and `/category_metadata`. Confirmed public read access for the Web Kiosk without login.
- **Firebase Web Credentials**: Verified from `d:\Projects\MerkadoGo\.env`:
  - `FIREBASE_WEB_API_KEY`: `AIzaSyAbuf1qm6p56qL2sRbnVb0igd7--mN_ApE`
  - Project ID: `merkado-go`
  - Web App ID: `1:25184120050:web:a4fc524db9f7d15b5ef46b`
  - Auth Domain: `merkado-go.firebaseapp.com`
  - Storage Bucket: `merkado-go.firebasestorage.app`
- **Enhanced Datasets**: `database_schema/json_assets/vendor_notes.json` explicitly populates `"stall_id"` on all 134 records, perfectly matching SVG shape IDs (`id="id_3"`).
- **Official Categories & Sections**: 17 categories in `constants/market_categories.dart` and 23 market buildings/sections in `constants/market_sections.dart`.

## Dev Vault Suite Ingested (2026-09-02)
Read all 7 documents in `d:/Projects/Dev Vault/02 - Projects/MerkadoGO Map/` (MOC, Database & Live Firestore Schema, UI-UX Design System, Tech Stack & Architecture, Project Rules & Guardrails, System Structure & Flows, Active Status & Roadmap). Key load-bearing facts beyond local files:
- **`normalizeStallDoc()` reference implementation** (Database & Live Firestore Schema §4): defensive field mapping `name||business_name`, `category||primary_category`, `section||building_or_section`, `stallNumber||stall_number`, `tags||search_categories`. Web app must mirror these fallbacks for both static JSON and Firestore docs.
- **Full Vite `.env` block** documented: `VITE_FIREBASE_*` (API key, auth domain, project id, storage bucket, sender id, app id, measurement id) + `VITE_CLOUDINARY_CLOUD_NAME=diiuzmjnk` / `VITE_CLOUDINARY_UPLOAD_PRESET=merkadogo`.
- **18-Zone Palette exact hexes** (fill + outline per zone) canonical in UI-UX Design System; zone keys use snake_case tokens (`rice_grains`, `coconut_gata`, `wellness_spa`, `salon_beauty`) — note `market_categories.dart` canonical keys differ slightly (`rice_and_grains`, `coconut_and_gata`), so `normalizeCategorySlug()` in `src/theme/colors.js` must bridge both.
- **Typography**: Outfit 700 (display/headings), Poppins 400/600 (body/UI), Poppins 800 (brand wordmark "Merkado" #1B5E20 + "Go" #E53935).
- **Planned module map** (Tech Stack & System Flows): `src/dataStore.js`, `src/uiController.js` (Phase 3); `src/pathfinder.js`, `src/turnGenerator.js` (Phase 4); `src/searchEngine.js` + `src/services/stallSync.js` / `stallNormalizer.js` (Firestore, Phase 3.4).
- **Interaction specs**: rotation auto-snaps to North at <15° offset; double-tap zoom = 1.75× at focal point; recenter resets ViewBox/scale/rotation.
- **DISCREPANCY**: Vault `Active Status & Roadmap` defines Phase 3 with **4 tasks** — local `tasks/todo.md` only lists 3.1–3.3 and is missing **Task 3.4: live Firestore `/stalls` stream** (`initLiveStallSync` pattern with `onSnapshot`, graceful static fallback on error). `task_plan.md` narrative does mention Firestore sync. TODO list should be amended before Phase 3 completion sign-off.

## Task 3.1 Verification Facts (2026-09-02)
- SVG contains exactly **231 unique stall shapes** (134 `id_*` + 97 `slot_*`), matching `stall_nodes.json` 231 keys 1:1; the historical "463" figure was a pre-dedup DOM query count — use 231 everywhere.
- Graph integrity: 116 nodes, **0 asymmetric/dangling edges**; all 14 entrance `node_id`s resolve.
- `stall_nodes.json` split: 29 single-string values, 202 arrays (index 0 = primary snap node).
- `subcategory_search_directory.json` nests its 17 slugs under a top-level `categories` object.

## Live Firestore Reality Check (2026-09-02)
- The deployed rules on the live `merkado-go` project DENY public reads on `/stalls` (real probe: `FirebaseError [permission-denied]`). The `allow read: if true` rule exists only in the local `database_schema/firebase/firestore.rules` bundle. Deployment to Firebase is required before true live sync activates — needs the owner's Firebase auth.
- The `firebase_options.dart` in the Flutter repo contains ONLY the Android app block (no web appId) — the web app id / auth domain / measurement ID come from the vault Database doc's recorded web block.

## Dev Vault Deep Read + Flutter Pathfinder Reference (2026-09-02)
- Vault-wide governance read: `Strict Execution Rules` (5 laws, mirror MASTER_PROMPT), `Zero-Assumption Protocol` (read/analyze/confirm before code), `UI-UX Design Rules` (no emojis in production UI — SVG icon sets only; no ad-hoc hex outside tokens; WCAG AA; ≤10% accent-color area), `Home MOC` (vault topology; sibling projects Ligao Vendors & BayaniLink out of scope).
- The parallel suite in `Dev Vault/02 - Projects/MerkadoGo/` (dated 2026-08-31) is a superseded pre-implementation snapshot; the `MerkadoGO Map/` suite (2026-09-02) is authoritative. No spec conflicts.
- **Flutter reference implementation** found at `d:/Projects/MerkadoGo/lib/features/map/services/pathfinding_service.dart` (432 lines). Port-relevant facts for Task 4.2:
  - Turn thresholds shipped on mobile: |Δ| ≤ 18° straight; ≤ 45° slight; ≤ 135° normal; ≤ 165° sharp; else U-turn. Positive signed delta (atan2 in SVG screen coords, y-down) = right turn, negative = left.
  - Straight segments accumulate distance; a merged "Continue straight" step is emitted only when accumulated distance > 50 SVG units (stricter than the web doc's "collapse all consecutive straights").
  - Turn instructions name the zone from node prefixes: `node_wm`→Wet Market, `node_ea`→Eateries Section, `node_dm`→Dry Market, `node_rs`→Rice Section, `node_fs`→Fruits Section, `node_ex`→Main Corridor, else Market Walkway.
  - Stall→node candidate arrays are deduped (`toSet()`) because `id_39` contains a duplicated `node_ex_6`.
  - Mobile service is a stateful class; web port must stay pure functions (Guardrail 9) — port algorithm + thresholds, not the class shape.
  - Open deltas to settle at Task 4.2: straight threshold 18° (mobile) vs ~15° (web Master Context §7.3); 50-unit straight-collapse minimum (mobile-only rule). Recommendation: mirror mobile for cross-platform behavioral parity.

## Task 4.1 Verification Facts (2026-09-02)
- Real graph shape: **116 nodes, 388 directed edges (194 undirected corridors), 0 asymmetric edges, 1 connected component, 0 isolated nodes** — fully symmetric bidirectional walkway network.
- **245/245 routing-critical nodes reachable**: 14 entrance `node_id`s + 231 primary (index-0) stall snap nodes; 0 missing, 0 unreachable. Phase 4.2 can assume every entrance→stall route exists.
- `pathfinder.js` API (all pure, zero DOM/Firebase): `buildPathfindingGraph(mapNodes)` → `{ nodes: {id:{x,y}}, adjacency: {id:[{id, weight}]}}`; `verifyPathfindingGraph(graph)` → reciprocity/components/isolated report; `analyzeReachability(graph, ids)` → missing/unreachable/reachable; `euclideanDistance(a,b)` shared metric (edge cost = heuristic basis → admissible & consistent).
- Design decision: connectivity/reachability judged on the **undirected** view of the materialized graph (walkway semantics) — a missing reverse entry is a data bug surfaced by the reciprocity check, not a physical one-way corridor. Real data is fully symmetric so both interpretations agree on it.
- Defensive behaviors proven in-page: coordinate-less nodes excluded, dangling neighbors skipped, duplicate neighbor entries deduped, empty/null input → empty graph, 3-4-5 triangle weight sanity (`=== 5`), asymmetric edge reported, disjoint components detected.

## Task 4.2 Verification Facts (2026-09-02)
- **User decision recorded: MIRROR the mobile reference** — 18°/45°/135°/165° turn buckets, 50-unit straight-merge minimum, zone flavor text (over the web doc's ~15° / unconditional collapse).
- Real-route sweep: **3234/3234 entrance→stall routes** (14 × 231) resolve — 0 empty, 0 wrong endpoints, 0 adjacency violations, 0 node revisits. Optimality proven on 40 sampled routes (A* cost === independent Dijkstra cost, exact).
- Direction lists: 3210/3210 structurally valid; step distances sum EXACTLY to path length (invariant holds because the start step owns segment 0→1 and every later segment belongs to exactly one straight/turn step); 5011 straight steps all > 50 units; turn kinds observed on real geometry: right / left / slight-left / slight-right only (no sharp turns or U-turns — plausible for market grid walkways); zone flavor present on 2867 routes.
- **MOBILE DEAD-CODE QUIRK FIXED in the port**: the Flutter merge required the previous step to already have direction `straight`, which never occurs (only `start`/turn/`arrive` steps are ever appended), so its 50-unit rule never fired and straight distance was silently dropped. The web port flushes pending straight runs at turn interruptions AND after the final turn. All actual threshold VALUES still mirror mobile.
- API decisions: `findPath(graph, startNodeId, goalNodeId)` follows Master Context §7.2 parameter order (the vault roadmap's `(start, goal, graph)` is its summary shorthand — todo.md acceptance "findPath(start, goal)" satisfied). `getPrimarySnapNode(value)` accepts both stall_nodes shapes; null on unresolvable. `findPath` returns `[]` (never throws) on unknown/disconnected endpoints, mirroring mobile.
- A* implementation: binary min-heap with monotonic insertion-counter tie-break → fully deterministic output; lazy deletion of stale heap entries.
- **RESOLVED BY USER (2026-09-02, before Task 4.3)**: distances are raw SVG coordinate units (~2265 units for a 12-node cross-market route) and there is NO documented SVG-units→meters conversion factor. The user confirmed they deliberately OMITTED meters — the direction system is angle-based only (turns from bearing deltas), because without GPS any units→meters scale would be a guess and the route count makes calibration impractical. Task 4.3 consequence: display NO distances anywhere — the route summary badge shows step count only (no "~0m"), turn-by-turn list shows instruction text only. Internal SVG-unit distances remain in the step data solely for the 50-unit straight-merge rule and as inert step fields.
- Generate-directions returns 24 same-node routes as single "You are already at X" arrive steps (14 entrances whose node IS a stall's primary snap node — 231 stall snaps include entrance-adjacent nodes).

## CRITICAL: Node→SVG Coordinate Calibration (discovered 2026-09-02, Task 4.3)
- **Master Context §3.1's claim that map_nodes.json x/y "line up 1:1 with the SVG asset's viewBox units" is FALSE for this dataset.** Measured first-hand: all 116 graph nodes sit at x ∈ [-5724, -2293], y ∈ [-919, 1515] (negative-x frame), while the SVG stall artwork occupies x ∈ [2095, 4689], y ∈ [2264, 4621] on an 8004×8000 canvas. Drawing route geometry raw put it ~7400 units off-map (first visual check showed a blank map — graph-internal tests in 4.1/4.2 could never catch this; it took the Task 4.3 visual acceptance check).
- **Canonical mapping (mirrored from the mobile reference)**: `interactive_market_map.dart` lines 104–106 ship hand-calibrated constants — `_nodeOffsetX = 7706.4, _nodeOffsetY = 3163.3` — applied there as a PURE TRANSLATION (`node.x + offset`) for both its RouteOverlayPainter and entrance-gate markers. No scale, no rotation. Sanity check: id_3's snap node maps to (3741, 3728), 78 units from id_3's polygon center (3816, 3706) — exactly a walkway-side snap point.
- Web implementation: `mapRenderer.NODE_TO_SVG_OFFSET = Object.freeze({ x: 7706.4, y: 3163.3 })`, applied in `drawRoute()` (polyline points) and in the navigation panel's route-bounds framing. **Routing/path math stays in node space** — Euclidean distances are translation-invariant, so every Task 4.1/4.2 verification and threshold remains valid untouched.
- Per-stall (stall centroid − snap node) deltas naturally VARY (~7509–8064 in x) because snap nodes are walkway points beside stalls, not centroids — do not mistake that variance for a scale mismatch; the calibration translation is the correct and sufficient model, exactly as the mobile team determined.
- If entrance markers / destination pins are ever added (Task 4.3 stretch / polish), they MUST use the same NODE_TO_SVG_OFFSET — and any future re-export of map_nodes.json that changes frames must re-derive these constants.

## Phase 4 Wayfinding Refinements & Discoveries (2026-09-02)
- **Exact Vector Node Calibration Root Cause**:
  - Measured `map_nodes.json` against all 112 embedded `<rect id="node_*">` elements in `LigaoCity_PublicMarket_Map.svg`.
  - The previous mobile offset `{ x: 7706.4, y: 3163.3 }` was ~117 units too far left (e.g. `node_ea_x1` shifted into `slot_ea_1`), causing polylines to clip and draw across food stalls.
  - Mathematically exact node center offset: `NODE_TO_SVG_OFFSET = Object.freeze({ x: 7823.47, y: 3174.0 })`. Every single SVG node rect matches this offset with 0.0001 precision, aligning routes dead-center in walkways.
- **Terminology Directive**: Use "Entrance" / "Entry" across all UI labels, banners, and buttons (never "Gate").
- **Cloudinary CDN Ingestion**:
  - Cloud Name: `diiuzmjnk`, Upload Preset: `merkadogo`.
  - Stall photos read from `photoUrls[]` on vendor documents with flat Civic Craft fallback artwork.
  - Entrance photos will be mapped via `image_url` property in `market_entry_points.json` pointing to Cloudinary.
- **Stall Hours Display**: Display `openTime` and `closeTime` from schema (defaulting to 6:00 AM – 6:00 PM if absent) with active open/closed status badge.
- **Demand-Driven Entrance Markers**: 14 entrance markers in `#markers-layer` stay hidden during normal exploration and become visible only when the user is in "Select Your Entrance" mode.
- **Progressive Route Animation**: Route polyline animates via SVG `stroke-dasharray` / `stroke-dashoffset` (1.2s smooth draw) from entrance to destination stall.
