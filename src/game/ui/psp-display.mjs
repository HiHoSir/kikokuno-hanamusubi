// Hardware reference for a future PSP native port; NOT a browser viewport lock.
// The iPhone is a QA device, not the world-map dimension requirement.
// Sony PSP: 480x272 physical output pixels (30:17 screen ratio).
export const PSP_DISPLAY=Object.freeze({width:480,height:272});
export const PSP_ASPECT=PSP_DISPLAY.width/PSP_DISPLAY.height;

// Number of world tiles needed to cover the complete PSP screen, for any
// scrolling map rendered at the supplied world-pixel zoom. Keep integer cells;
// don't enlarge the art, zoom dynamically, or add filler scenery for a wider
// Safari viewport. Non-scrolling interiors can use deliberate screen framing.
export function minPSPScrollingMapCells(tileSize,zoom){
 if(!(tileSize>0&&Number.isFinite(tileSize)&&zoom>0&&Number.isFinite(zoom)))
   throw new RangeError('tileSize and zoom must be finite positive values');
 return Object.freeze({
   columns:Math.ceil(PSP_DISPLAY.width/(tileSize*zoom)),
   rows:Math.ceil(PSP_DISPLAY.height/(tileSize*zoom))
 });
}

export function pspScrollingMapCoverage({width,height,tileSize},zoom){
 const minimum=minPSPScrollingMapCells(tileSize,zoom);
 return Object.freeze({
   minimum,
   coversScreen:width>=minimum.columns&&height>=minimum.rows,
   worldPixels:Object.freeze({width:width*tileSize,height:height*tileSize}),
   displayPixels:Object.freeze({width:width*tileSize*zoom,height:height*tileSize*zoom}),
   // Nonnegative clamp range ensures a PSP-sized camera can stay fully on-map
   // at every edge without showing anything outside the authored terrain.
   cameraRange:Object.freeze({
     x:Math.max(0,width*tileSize-PSP_DISPLAY.width/zoom),
     y:Math.max(0,height*tileSize-PSP_DISPLAY.height/zoom)
   })
 });
}
