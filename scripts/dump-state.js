// playwright-cli run-code scripts/dump-state.js
// Dump full studio state as JSON for debugging

const state = await page.evaluate(() => ({
  activeSceneId: state.activeSceneId,
  sceneOrder: state.sceneOrder,
  sceneCount: state.sceneOrder.length,
  capturedCoords: state.capturedCoords,
  viewerLoaded: state.pannellumViewer?.isLoaded || false,
  viewerYaw: state.pannellumViewer?.getYaw?.() ?? null,
  viewerPitch: state.pannellumViewer?.getPitch?.() ?? null,
  viewerHfov: state.pannellumViewer?.getHfov?.() ?? null,
  scenes: Object.fromEntries(
    state.sceneOrder.map(id => [
      id,
      {
        title: state.scenes[id].title,
        panorama: state.scenes[id].panorama,
        _thumb: state.scenes[id]._thumb,
        _original: state.scenes[id]._original,
        hotspotCount: (state.scenes[id].hotSpots || []).length,
        hotspots: (state.scenes[id].hotSpots || []).map((h, i) => ({
          index: i, text: h.text, type: h.type,
          yaw: h.yaw.toFixed(2), pitch: h.pitch.toFixed(2),
          target: h.sceneId || h.URL?.substring(0, 60)
        }))
      }
    ])
  ),
  url: window.location.href
}));

console.log('=== State Dump ===');
console.log(JSON.stringify(state, null, 2));
console.log('=== End Dump ===');
