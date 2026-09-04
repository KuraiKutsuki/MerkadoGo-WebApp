/**
 * MerkadoGo Web — Main Application Entry Point
 */
import { loadAndInjectMap, setupStallHitTesting, applyVendorColors, applyVendorToStall, applyUnassignedStyle, selectStall, renderEntranceMarkers, setEntranceMarkersVisibility, highlightEntranceMarker } from './mapRenderer.js';
import { MapControls } from './mapControls.js';
import { initStallDetailCard, initNavigationPanel, initEntrancePreviewCard, initCategoryPanel, initLiveClock } from './uiController.js';
import { loadStaticData, getStaticData, getStallNodeIds, loadVendorData, getVendorData, getVendorByStallId, upsertVendorRecord, removeVendorRecord } from './dataStore.js';
import { buildPathfindingGraph, verifyPathfindingGraph, analyzeReachability } from './pathfinder.js';
import { initLiveStallSync } from './services/stallSync.js';

let appState = {
  mapContext: null,
  mapControls: null,
  staticData: null,
  vendorData: null,
  pathGraph: null,
  navPanel: null,
  stallCard: null,
  entrancePreviewCard: null,
  unsubscribeStallSync: null,
  selectedStallId: null
};

/**
 * Task 3.4 — applies one live /stalls change to the map, store, and card.
 * Rules per Master Context §4.1: removed docs or closed/inactive stalls reset
 * their polygon to the Unassigned palette; everything else recolors and
 * updates the in-memory store so the detail card always shows live truth.
 * A stall ID without a matching SVG element warns and skips — never crashes.
 * @param {string} changeType - "added" | "modified" | "removed"
 * @param {Object} stall - Normalized vendor record (services/stallNormalizer.js)
 */
function handleLiveStallChange(changeType, stall) {
  const stallEl = appState.mapContext?.stallElements.get(stall.stallId);
  const isGone = changeType === 'removed' || stall.status === 'closed' || stall.isOpen === false;

  if (isGone) {
    removeVendorRecord(stall.stallId);
    applyUnassignedStyle(stallEl);
    if (!stallEl) {
      console.warn(`[MerkadoGo Sync] Removed/closed stall "${stall.stallId}" has no matching SVG element — store updated only`);
    }
  } else {
    upsertVendorRecord(stall);
    applyVendorToStall(stall, appState.mapContext.stallElements);
  }

  // Refresh the detail card live if the user is looking at this exact stall
  if (appState.selectedStallId === stall.stallId) {
    appState.stallCard.showStall(stall.stallId);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const mapViewport = document.getElementById('map-viewport');
  
  try {
    const mapContext = await loadAndInjectMap(mapViewport);
    const mapControls = new MapControls(mapContext.svgElement, mapContext.transformLayer, mapViewport);

    appState.mapContext = mapContext;
    appState.mapControls = mapControls;

    // Phase 3 / Tasks 3.1 + 3.2: fetch & validate static datasets, then load
    // the vendor directory fallback (both in parallel — they are independent)
    const [staticData, vendorData] = await Promise.all([loadStaticData(), loadVendorData()]);
    appState.staticData = staticData;
    appState.vendorData = vendorData;

    // Task 4.1: build the weighted A* routing graph from map_nodes.json and
    // verify its structure — bidirectional edge reciprocity, connectivity,
    // and reachability of every entrance gate + primary stall snap node
    const pathGraph = buildPathfindingGraph(staticData.mapNodes);
    const graphReport = verifyPathfindingGraph(pathGraph);
    appState.pathGraph = pathGraph;

    const requiredRouteNodes = [
      ...staticData.entryPoints.map((entry) => entry.node_id),
      ...Object.keys(staticData.stallNodes).map((stallId) => getStallNodeIds(stallId)[0])
    ];
    const reachability = analyzeReachability(pathGraph, requiredRouteNodes);

    console.log('[MerkadoGo App] Task 4.1 verification — weighted A* graph:', {
      nodes: graphReport.nodeCount,
      directedEdges: graphReport.edgeCount,
      asymmetricEdges: graphReport.asymmetricEdges.length,
      components: graphReport.components,
      isConnected: graphReport.isConnected,
      isolatedNodes: graphReport.isolatedNodes.length
    });
    console.log('[MerkadoGo App] Task 4.1 verification — routing-critical nodes:', {
      entranceGates: staticData.entryPoints.length,
      stallSnapNodes: Object.keys(staticData.stallNodes).length,
      requiredNodes: requiredRouteNodes.length,
      missing: reachability.missing,
      unreachable: reachability.unreachable
    });

    // Task 3.2: color polygons by primary_category via the canonical ZONE_PALETTE
    applyVendorColors(vendorData.records, mapContext.stallElements);

    // Task 3.3: Stall Details card — populate on stall click, dismissible
    appState.stallCard = initStallDetailCard({
      stallElements: mapContext.stallElements,
      getVendor: getVendorByStallId,
      stallNodes: staticData.stallNodes
    });

    // Task 4.6: Render 14 demand-driven entrance markers in #markers-layer
    renderEntranceMarkers(
      mapContext.markersLayer,
      staticData.entryPoints,
      staticData.mapNodes,
      (entrance) => {
        // Tapping an entrance marker on the map opens the Entrance Preview card
        appState.stallCard?.hide();
        appState.navPanel?.syncSelectedEntrance(entrance.entrance_id);
        appState.entrancePreviewCard?.show(entrance);
      }
    );

    // Task 4.6: Entrance Preview Card — shows real-life photo/storefront fallback,
    // entrance description, and "Start Route Here" button
    appState.entrancePreviewCard = initEntrancePreviewCard({
      onStartRoute: (entrance) => {
        appState.navPanel?.routeFromEntrance(entrance);
      },
      onDismiss: () => {
        highlightEntranceMarker(mapContext.markersLayer, null);
        appState.navPanel?.syncSelectedEntrance('');
      }
    });

    // Task 4.3 + 4.6: Navigation panel — entrance selector, route polyline,
    // entrance selection mode banner, and turn-by-turn instruction list
    appState.navPanel = initNavigationPanel({
      routeLayer: mapContext.routeLayer,
      markersLayer: mapContext.markersLayer,
      graph: pathGraph,
      stallNodes: staticData.stallNodes,
      entryPoints: staticData.entryPoints,
      getVendor: getVendorByStallId,
      stallElements: mapContext.stallElements,
      onSelectEntranceFromDropdown: (entrance) => {
        // User selected an entrance from the quick dropdown in the selection banner
        const node = staticData.mapNodes[entrance.node_id];
        if (node) {
          mapControls.focusOnCoordinates(node.x + 7823.47, node.y + 3174.0, 1600);
        }
        appState.stallCard?.hide();
        appState.entrancePreviewCard?.show(entrance);
      },
      onEntranceSelectionChange: (isSelecting, stallIdToRestore) => {
        if (isSelecting) {
          appState.stallCard?.hide();
          appState.entrancePreviewCard?.hide();
          // Frame overview around market center
          mapControls.focusOnCoordinates(3900, 3400, 3200);
        } else if (stallIdToRestore) {
          appState.stallCard?.showStall(stallIdToRestore);
        }
      },
      onFocusBounds: (bounds) => {
        // Frame the whole route in the viewport; fit width from the
        // container's aspect so both dimensions fit, with 40% breathing room
        const rect = mapViewport.getBoundingClientRect();
        const aspect = (rect.height || 1) / (rect.width || 1);
        const fitWidth = Math.max(bounds.width, bounds.height / aspect) * 1.4;
        mapControls.focusOnCoordinates(bounds.cx, bounds.cy, fitWidth > 0 ? fitWidth : 1200);
      },
      onAvatarMove: (pt) => {
        // Real-time camera tracking: smoothly centers on walking avatar with closer zoom for clarity
        mapControls.centerOnCoordinates(pt.x, pt.y, 1050);
      }
    });

    // Route button on the stall detail card enters "Select Your Entrance" mode (Task 4.6)
    document.getElementById('btn-route-here')?.addEventListener('click', () => {
      const stallId = appState.selectedStallId;
      if (!stallId) return;
      appState.stallCard.hide();
      appState.navPanel?.startEntranceSelection(stallId);
    });

    // Set up delegated stall hit-testing; card population rides the callback.
    // Selecting a stall while the navigation panel or entrance selection is open closes them
    setupStallHitTesting(mapContext.svgElement, mapContext.stallElements, (stallId, stallNode) => {
      if (appState.navPanel?.isOpen()) {
        appState.navPanel.close();
      }
      if (appState.navPanel?.isSelectingEntrance()) {
        appState.navPanel.cancelEntranceSelection();
      }
      appState.entrancePreviewCard?.hide();
      appState.selectedStallId = stallId;
      appState.stallCard.showStall(stallId);
    });

    // Collapsible Category Tags Panel (Image 2 Inspiration)
    appState.categoryPanel = initCategoryPanel({
      onCategorySelect: (categorySlug) => {
        console.log('[MerkadoGo App] Category filter selected:', categorySlug);
        // Phase 5: Filter map polygons / search directory
      }
    });

    // Real-time civic clock & date badge ("Wed 9/2 • 10:37 PM")
    initLiveClock();

    // Task 3.4: live Firestore /stalls stream — reconciles the static paint
    // in real time (adds/edits recolor, removals & closures reset to Unassigned)
    initLiveStallSync(handleLiveStallChange, (err) => {
      console.warn('[MerkadoGo App] Live sync unavailable — kiosk continues on static vendor data.');
    }).then((unsubscribe) => {
      appState.unsubscribeStallSync = unsubscribe;
    });

    // Attach to global window for debugging in browser console
    window.merkadoApp = appState;

    console.log('[MerkadoGo App] Map initialized with interactive Pan & Zoom controls and Hit-Testing.');
    console.log('[MerkadoGo App] Task 3.1 verification — static datasets in memory:', {
      mapNodes: Object.keys(appState.staticData.mapNodes).length,
      stallNodes: Object.keys(appState.staticData.stallNodes).length,
      entryPoints: appState.staticData.entryPoints.length,
      searchDirectoryCategories: Object.keys(appState.staticData.searchDirectory.categories).length
    });
    console.log('[MerkadoGo App] Task 3.1 verification — sample objects:', {
      sampleNode: getStaticData().mapNodes['node_dm_t1'],
      sampleStallMapping: { id_3: getStallNodeIds('id_3'), id_9: getStallNodeIds('id_9') },
      sampleEntryPoint: appState.staticData.entryPoints[0]
    });
    console.log('[MerkadoGo App] Task 3.2 verification — vendor data in memory:', {
      vendors: getVendorData().records.length,
      sampleVendor: getVendorByStallId('id_1'),
      splitStallVendor: getVendorByStallId('id_41.1')
    });

    // Expose the live-sync handler for debugging/verification in the console
    appState.handleLiveStallChange = handleLiveStallChange;
  } catch (err) {
    console.error('[MerkadoGo App] Failed to initialize application:', err);
  }
});

