"""Draw 32px coast and cliff chips from the game's sand and rock textures."""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TERRAIN = ROOT / "assets/field/terrain"
OUT = TERRAIN / "atlas"
OUT.mkdir(exist_ok=True)
CELL = 32
Y, X = np.indices((CELL, CELL), dtype=float)
U, V = (X + .5) / CELL, (Y + .5) / CELL

def contour(mask):
    a,b,c,d = [int(bool(mask & (1<<i))) for i in range(4)]
    # Corner samples are the centers of the four adjacent logical tiles.
    # Smooth interpolation produces diagonal runs and quarter bays that share edges.
    value = a*(1-U)*(1-V) + b*U*(1-V) + c*U*V + d*(1-U)*V
    if mask in (5,10):
        # A diagonal pair meets at a water saddle, leaving a visible channel.
        value -= .18 * np.sin(np.pi*U) * np.sin(np.pi*V)
    gx = (b-a)*(1-V) + (c-d)*V
    gy = (d-a)*(1-U) + (c-b)*U
    slope = np.maximum(.3,np.hypot(gx,gy))
    wiggle=.035*np.sin(2*np.pi*U)*np.sin(2*np.pi*V)
    return (value-.5+wiggle)*CELL/slope, gx/slope, gy/slope

def texture(name):
    return np.array(Image.open(TERRAIN / name).convert("RGB"))

def tone(rgb, scale, shift=0):
    return np.clip(np.rint(rgb*scale+shift),0,255).astype(np.uint8)

def rgba(rgb, alpha):
    colors=np.broadcast_to(rgb,(32,32,3))
    return Image.fromarray(np.dstack((colors,np.broadcast_to(alpha,(32,32)))).astype(np.uint8),"RGBA")

def atlas(name, entries):
    image=Image.new("RGBA",(128,CELL*((len(entries)+3)//4)))
    for i,entry in enumerate(entries):
        image.paste(entry,((i%4)*CELL,(i//4)*CELL))
    image.save(OUT/(name+".png"),optimize=True)

distances={mask:contour(mask) for mask in range(1,15)}
full=Image.new("RGBA",(32,32),"white")
empty=Image.new("RGBA",(32,32))
atlas("coast-mask-32",[empty]+[rgba((255,255,255),(distances[m][0]>=0)*255) for m in range(1,15)]+[full])

sand=texture("sand.png")
rock=texture("grass-cliff.png")
def bank(mask, phase):
    dist,_,_=distances[mask]
    xx=16+32*(phase%2)+X.astype(int)
    yy=16+32*(phase//2)+Y.astype(int)
    pixels=sand[yy%64,xx%64].copy()
    # Pale dry sand feathers into turf. Dark wet edge stays with the land.
    broken=np.sin(X*.8+Y*.61)+.45*np.cos(X*1.7-Y*.3)
    alpha=np.where(dist<0,0,np.where(dist<10+broken,255,np.where(dist<13+broken,110,0)))
    pixels[(dist>=0)&(dist<3)] = tone(pixels[(dist>=0)&(dist<3)],.72)
    pixels[(dist>=0)&(dist<1.15)] = (52,58,43)
    return rgba(pixels,alpha)

for phase in range(4):
    atlas(f"coast-sand-{phase}-32",[empty]+[bank(m,phase) for m in range(1,15)]+[empty])
atlas("coast-river-32",[empty]+[
    rgba(np.where((distances[m][0]<1.2)[:,:,None],np.array([43,62,47]),np.array([116,123,68])),
         np.where((distances[m][0]>=0)&(distances[m][0]<2.7),255,0))
    for m in range(1,15)]+[empty])
atlas("coast-rock-32",[empty]+[
    rgba(rock,np.where((distances[m][0]>=0)&(distances[m][0]<3.4),255,0))
    for m in range(1,15)]+[empty])
atlas("coast-shallow-32",[empty]+[
    rgba((71,161,152), np.where((distances[m][0]<0)&(distances[m][0]>=-5),np.where(distances[m][0]>=-2,115,48),0))
    for m in range(1,15)]+[empty])

def cliff(mask, drop, forest=False):
    dist,gx,gy=distances[mask]
    # Keep the north edge as a narrow lip. East and west turn the rock face
    # around the shoulder. The south side carries the main illustrated face.
    south=np.maximum(0,-gy)
    side=np.abs(gx)
    breadth=2+south*(10+drop*2)+side*(2+drop)
    foot=-south*(4+drop)
    if forest:
        # Extend the face on both sides of the crest near crowded trees.
        # Keep the north rim thin and confine the change to the same chip.
        corner_distance=np.hypot(np.minimum(X,31-X),np.minimum(Y,31-Y))
        expansion=np.minimum(1,corner_distance/8)
        breadth += (south*(3+drop)+side*3)*expansion
        foot -= (south*(4+drop)+side*3)*expansion
    breaks=(np.sin(X*.59+Y*.93)+np.sin(X*1.41-Y*.67))*.67
    depth=(dist-foot)/(breadth-foot)
    inside=(dist>=foot)&(dist<breadth+breaks)
    # Same source-art density in all parts. Darkening is baked into the pixels.
    brightness=.74+south*.19+np.maximum(0,gx)*.08-np.maximum(0,-gx)*.13
    rgb=tone(rock,brightness[:,:,None])
    if forest:
        # Shade the toe and pick out broad, irregular bands through the face.
        ribs=.05*np.sin(X*.99+np.sin(Y*.22))+.05*np.cos(X*.49-Y*.13)
        shade=np.clip(.68+.34*depth+ribs,.65,1.1)
        rgb=tone(rgb,shade[:,:,None])
    rgb[(depth>=0)&(depth<.13)]=tone(rgb[(depth>=0)&(depth<.13)],.69)
    rgb[(depth>.83)&(depth<=1.1)]=tone(rgb[(depth>.83)&(depth<=1.1)],1.14,8)
    rim=(dist>=breadth+breaks)&(dist<breadth+breaks+1.5)
    rgb[rim]=(176,178,100)
    return rgba(rgb,(inside|rim)*255)

for drop in (1,2,3):
    atlas(f"cliff-{drop}-32",[empty]+[cliff(m,drop) for m in range(1,15)]+[empty])
    atlas(f"cliff-forest-{drop}-32",[empty]+[cliff(m,drop,forest=True) for m in range(1,15)]+[empty])

# Coverage extends between adjacent corners. All legal shared-edge pairs use
# the same binary water seam, apart from the subpixel center tie in a saddle.
for a in range(16):
    for b in range(16):
        aa=np.ones((32,32),bool) if a==15 else np.zeros((32,32),bool) if a==0 else distances[a][0]>=0
        bb=np.ones((32,32),bool) if b==15 else np.zeros((32,32),bool) if b==0 else distances[b][0]>=0
        if ((a>>1)&3)==((b&1)|((b>>2)&2)):
            assert np.count_nonzero(aa[:,-1]!=bb[:,0])<=1,(a,b,"ew")
        if (((a>>3)&1)|((a>>1)&2))==(b&3):
            assert np.count_nonzero(aa[-1]!=bb[0])<=1,(a,b,"ns")
print(f"{len(list(OUT.glob('*.png')))} atlas PNGs")
