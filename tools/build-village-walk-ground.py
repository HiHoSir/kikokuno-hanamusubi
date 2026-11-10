"""Rebuild village terrain and collision from the one runtime scene definition."""
from pathlib import Path
from collections import Counter
import argparse,json,math
import numpy as np
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parents[1]
def build(root=ROOT/'previews/village-walk'):
 s=json.loads((root/'map/scene.json').read_text());width,height=s['bounds'][2:];river=s['river'];baseCount=s['terrain']['baseTileCount']
 original=Image.open(root/'map/terrain.png').convert('RGBA');atlas=Image.new('RGBA',(512,416));atlas.alpha_composite(original.crop((0,0,256,416)))
 tiles=s['terrain']['tiles'][:baseCount]
 # Add an unscaled central plank column between existing bridge side rails.
 bridgeTiles=river['bridgeTiles'];centers=[]
 for row in range(3):
  sx,sy,*_=tiles[bridgeTiles[row*2]];piece=original.crop((sx+16,sy,sx+32,sy+32));tile=Image.new('RGBA',(32,32));tile.alpha_composite(piece,(0,0));tile.alpha_composite(piece,(16,0));x=256+row*32
  atlas.alpha_composite(tile,(x,0));centers.append(len(tiles));tiles.append([x,0,32])
 fields=[l for l in s['terrain']['layers'] if l['name']=='field'];grass=next(l for l in s['terrain']['layers'] if l['name']=='grass')
 mask=Image.new('L',(width,height));d=ImageDraw.Draw(mask)
 for path in s['roads']:
  w=path['width']
  for (x1,y1),(x2,y2) in zip(path['points'],path['points'][1:]):
   if x1!=x2 and y1!=y2:raise ValueError('Roads must be horizontal or vertical')
   d.rectangle((min(x1,x2)-w//2,min(y1,y2)-w//2,max(x1,x2)+w//2-1,max(y1,y2)+w//2-1),fill=255)
 road=Image.new('RGBA',(width,height));soil=Image.open(root/'map/path-soil.png').convert('RGBA')
 for y in range(0,height,soil.height):
  for x in range(0,width,soil.width):road.paste(soil,(x,y))
 road.putalpha(mask)
 # Native tiny grass fragments break the material edge without bending the lane.
 tuft=Image.open(ROOT/'assets/village/terrain/grass-tuft.png').convert('RGBA').resize((12,12),Image.Resampling.NEAREST)
 a=np.array(mask)>0;rng=np.random.default_rng(63)
 for y in range(5,height-5,18):
  for x in range(5,width-5,18):
   patch=a[y-2:y+3,x-2:x+3]
   if patch.any() and not patch.all() and rng.random()<.6:road.alpha_composite(tuft,(x-6,y-8))
 new=[];cells=[];unique={};first=len(tiles)
 for y in range(0,height,32):
  for x in range(0,width,32):
   tile=road.crop((x,y,x+32,y+32))
   if not tile.getbbox():cells.append(-1);continue
   key=tile.tobytes()
   if key not in unique:unique[key]=len(new);new.append(tile)
   cells.append(first+unique[key])
 out=Image.new('RGBA',(512,416+math.ceil(len(new)/16)*32));out.alpha_composite(atlas)
 for i,tile in enumerate(new):
  x=i%16*32;y=416+i//16*32;out.alpha_composite(tile,(x,y));tiles.append([x,y,32])
 out.save(root/'map/terrain.png');s['terrain']['tiles']=tiles
 roadLayer={'name':'road','origin':[0,0],'cellPx':32,'columns':math.ceil(width/32),'rows':math.ceil(height/32),'cells':cells}
 columns=math.ceil(width/16);rows=river['height']//16;water=[];modes=river['tileRows']
 for row in range(rows):
  source=0 if row==0 else 5 if row==rows-1 else 1+(row-1)%4
  water.extend([modes[source]]*columns)
 waterLayer={'name':'river','origin':[0,river['top']],'cellPx':16,'columns':columns,'rows':rows,'cells':water}
 bridge=[]
 for row in [0,1,1,2]:bridge.extend([bridgeTiles[row*2],centers[row],bridgeTiles[row*2+1]])
 bridgeLayer={'name':'bridge','origin':river['bridge'][:2],'cellPx':32,'columns':3,'rows':4,'cells':bridge}
 s['terrain']['layers']=[grass,roadLayer]+fields+[waterLayer,bridgeLayer]
 collision=Image.new('L',(width,height));c=ImageDraw.Draw(collision)
 c.rectangle((0,0,width-1,height-1),outline=255,width=20)
 c.rectangle((0,river['top'],width-1,river['top']+river['height']-1),fill=255)
 x,y,w,h=river['walkway'];c.rectangle((x,y,x+w-1,y+h-1),fill=0)
 for l in fields:
  x,y=l['origin'];w=l['columns']*32;h=l['rows']*32;c.rectangle((x,y,x+w-1,y+h-1),fill=255)
 for p in s['sprites']:
  for x,y,w,h in p.get('blockers',[]):c.rectangle((x,y,x+w-1,y+h-1),fill=255)
  if p.get('footprint'):
   x,y,r=p['footprint'];c.ellipse((x-r,y-r,x+r,y+r),fill=255)
  if p['file']=='sprite-60.png':
   x,y=p['point'];c.rectangle((x,p['depth']-3,x+27,p['depth']),fill=255)
 collision.convert('RGB').save(root/'map/collision.png');(root/'map/scene.json').write_text(json.dumps(s,ensure_ascii=False,separators=(',',':')))
 print(f'Built {width}x{height}; {len(new)} road tiles; 80px clear bridge; 1.0 camera zoom')
if __name__=='__main__':build()
