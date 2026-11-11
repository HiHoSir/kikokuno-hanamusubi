// Image paths are relative to the repository root on GitHub Pages.
window.YK_FIELD_ASSETS = (() => {
 const script = new URL(document.currentScript.src);
 const version = script.searchParams.get('v');
 const url = path => {
  const asset = new URL('../../' + path, script);
  if (version) asset.searchParams.set('v', version);
  return asset.href;
 };
 const landscape = {
  waterMotion: 'assets/field/effects/water-motion.png',
  waterfallMotion: 'assets/field/effects/waterfall-motion.png',
  newVillage: 'assets/field/objects/village.png',
  newHouse: 'assets/field/objects/house.png',
  newTorii: 'assets/field/objects/torii.png',
  newCaveLarge: 'assets/field/objects/cave-large.png',
  newFort: 'assets/field/objects/fort.png',
  newPagoda: 'assets/field/objects/pagoda.png',
  newTrees: 'assets/field/objects/trees.png',
  newMountainSmall: 'assets/field/objects/mountain-small.png',
  newMountainLarge: 'assets/field/objects/mountain-large.png',
  bridgeNS: 'assets/field/objects/bridge-ns.png',
  castle: 'assets/field/objects/castle.png',
  sacredTree: 'assets/field/objects/sacred-tree.png',
  stoneMonument: 'assets/field/objects/stone-monument.png',
  waterfall: 'assets/field/objects/waterfall.png',
  horizon: 'assets/field/objects/horizon.png',
  grass: 'assets/field/terrain/grass.png',
  grassCliff: 'assets/field/terrain/grass-cliff.png',
  ladder: 'assets/field/objects/ladder.png',
  water: 'assets/field/terrain/water.png',
  snow: 'assets/field/terrain/snow.png',
  barren: 'assets/field/terrain/barren.png',
  sand: 'assets/field/terrain/sand.png',
  shrine: 'assets/field/objects/shrine.png',
  lantern: 'assets/field/objects/lantern.png',
  bridge: 'assets/field/objects/bridge.png',
  flowers: 'assets/field/objects/flowers.png',
  wildflowers: 'assets/field/objects/wildflowers.png',
  road: 'assets/field/terrain/road.png',
  village: 'assets/field/objects/village-112x80.png',
  town: 'assets/field/objects/town.png',
  hermit: 'assets/field/objects/hermit.png',
  jizo: 'assets/field/objects/jizo.png',
  cave: 'assets/field/objects/cave-entrance-80x64.png',
  torii: 'assets/field/objects/torii-64x64.png',
 };
 const autotile = {
  grass_base: 'assets/field/terrain/grass-base.png',
  forest_core: 'assets/field/terrain/forest-core.png',
  forest_edge_top: 'assets/field/terrain/forest-edge-top.png',
  forest_edge_right: 'assets/field/terrain/forest-edge-right.png',
  forest_edge_bottom: 'assets/field/terrain/forest-edge-bottom.png',
  forest_edge_left: 'assets/field/terrain/forest-edge-left.png',
  forest_corner_tl: 'assets/field/terrain/forest-corner-tl.png',
  forest_corner_tr: 'assets/field/terrain/forest-corner-tr.png',
  forest_corner_bl: 'assets/field/terrain/forest-corner-bl.png',
  forest_corner_br: 'assets/field/terrain/forest-corner-br.png',
  crown: 'assets/field/objects/forest-crown-64.png',
 };
 return {url, landscape, autotile, hero: 'assets/characters/hizuki/walk-sd-32.png'};
})();
