export const FIELD_PLACE_ROUTES=Object.freeze({
 village:'../game/village/?focus=field-exit',
 shrine:'../game/tenyo/',
 cove:'../game/cove/',
 shiomachi:'../game/shiomachi/',
 kozuene:'../game/kozuene/',
 cave:'../game/cave/'
});

export function fieldMarkerPlace(marker){
 const id=marker.destination??marker.placeId??marker.id;
 return Object.hasOwn(FIELD_PLACE_ROUTES,id)?id:null;
}
