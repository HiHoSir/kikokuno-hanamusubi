// Shared, native-size shell artwork for the cove and its shoreline preview. Glyphs are hand-authored, not
// scaled photos, browser emoji or canvas vector strokes. Pixel density is
// 1 source pixel = 1 world pixel; preview may zoom the whole camera only.
export const SHELL_ART_SIZE=20;
export const SHELL_ART=Object.freeze({
 white:Object.freeze([
   '....................','....................',
   '.......OOOOOO.......','.....OOddddddOO.....',
   '....OddrrfrffddO....','...OddrfhfhfrrddO...',
   '..OddrfhhfhhfrrddO..','..OddrfhfhfhfrrddO..',
   '.OddrffhhhhhffrrddO.','.OddrffhhhhfffrddO..',
   '..OddrfffffffrrddO..','...OddddddddddddO...',
   '....OOOOOOOOOOOO....','......ssssssss......',
   '....................','....................',
   '....................','....................',
   '....................','....................'
 ]),
 sakura:Object.freeze([
   '....................','....................',
   '.......OO..OO.......','.....OOddOOddOO.....',
   '....OdddrrrdddO.....','...OddrrfrfrrddO....',
   '..OddrfhrhrhfrrdO...','..OdrfhfhfhfhrddO...',
   '.OddrfhhfhfhhfrddO..','.OddrfhhfhfhhfrddO..',
   '..OddrffhhffrrddO...','..OddddffffddddO....',
   '...OddddddddddO.....','.....OOddddOO.......',
   '.......OOOO.........','......ssssss........',
   '....................','....................',
   '....................','....................'
 ]),
 spiral:Object.freeze([
   '....................','....................',
   '.........OO.........','.......OOddOO.......',
   '......OdmmdmO.......','.....OdmrhhmdO......',
   '....OddrhfrddmO.....','...OddrfOOfrddmO....',
   '..OddrffOOfrrddmO...','..OdmrfhffrrfddmO...',
   '..OdmrrffhhfrddmO...','...OddrrrffffdddO...',
   '....OdddddddddddO...','.....OOddddddOO.....',
   '.......OOOOOO.......','......sssssss.......',
   '....................','....................',
   '....................','....................'
 ])
});
export const SHELL_COLORS=Object.freeze({
 white:Object.freeze({O:[40,46,49,255],d:[93,105,111,255],
   m:[154,166,166,255],r:[195,172,130,255],f:[224,214,177,255],
   h:[255,248,222,255],s:[87,80,68,100]}),
 sakura:Object.freeze({O:[69,49,61,255],d:[140,90,99,255],
   m:[177,108,120,255],r:[194,116,139,255],f:[234,156,165,255],
   h:[255,211,208,255],s:[96,70,65,95]}),
 spiral:Object.freeze({O:[68,58,48,255],d:[119,93,64,255],
   m:[162,127,81,255],r:[187,141,88,255],f:[222,186,126,255],
   h:[250,227,176,255],s:[93,83,66,95]})
});
export function createShellAtlas(doc=document){
 const ids=['white','sakura','spiral'];
 const canvas=doc.createElement('canvas');
 canvas.width=SHELL_ART_SIZE*ids.length;canvas.height=SHELL_ART_SIZE;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 const image=ctx.createImageData(canvas.width,canvas.height);
 for(const [n,id] of ids.entries()){
   const rows=SHELL_ART[id],colors=SHELL_COLORS[id];
   if(rows.length!==SHELL_ART_SIZE)throw Error('shell sprite must have 20 rows: '+id);
   rows.forEach((row,y)=>{
     if(row.length>SHELL_ART_SIZE)throw Error('shell exceeds 20px: '+id+' '+y);
     for(const [x,char] of [...row].entries()){
       if(char==='.')continue;
       const rgba=colors[char];
       if(!rgba)throw Error('invalid shell color token '+char);
       const at=(y*canvas.width+n*SHELL_ART_SIZE+x)*4;
       for(let k=0;k<4;k++)image.data[at+k]=rgba[k];
     }
   });
 }
 ctx.putImageData(image,0,0);
 return {canvas,ids};
}
