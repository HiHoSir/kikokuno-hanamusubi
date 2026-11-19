#!/usr/bin/env python3
"""Generate ONLY the existing wooden drying rack used in the sea cove.

The basket, folded net and rope coil are no longer procedural and MUST NOT
be overwritten by this generator. Reprocess their source paintings with
`tools/process-cove-gear-source.py` instead.

Only author-designed geometry is used. Palette/scale follow approved village
sprites (390x357 thatch, 80x112 NPCs and native village props), with late-SFC-era sparse
clusters, dark outlines, warm rope highlights and muted blue-green net twine.
No external imagery, packages or services are involved.
"""
from pathlib import Path
import math
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/sea-cove/objects'

INK=(29,32,31,255)
SHADE=(47,55,46,255)
WOOD=(86,62,43,255)
WOOD_LIT=(155,113,69,255)
WOOD_GOLD=(194,149,87,255)
WOOD_DARK=(54,40,32,255)
ROPE=(192,176,128,255)
ROPE_LIGHT=(230,214,165,255)
ROPE_DARK=(111,103,77,255)
NET=(111,141,126,255)
NET_LIT=(163,183,150,255)
NET_DARK=(62,94,90,255)
NET_SHADE=(49,79,80,105)
FLOAT=(195,98,67,255)
FLOAT_LIT=(235,166,112,255)
HIGHLIGHT=(220,197,151,255)
SHADOW=(25,39,39,63)

class Art:
    def __init__(self,w,h):
        self.w=w;self.h=h
        self.p=bytearray(w*h*4)
    def dot(self,x,y,c):
        x=int(x);y=int(y)
        if not (0<=x<self.w and 0<=y<self.h):return
        i=(y*self.w+x)*4
        if c[3]>=255:
            self.p[i:i+4]=bytes(c)
        else:
            a=c[3]/255.
            old=self.p[i:i+4]
            aa=a+old[3]/255.*(1-a)
            if aa==0:return
            rgb=[round((c[j]*a+old[j]*(old[3]/255.)*(1-a))/aa) for j in range(3)]
            self.p[i:i+4]=bytes([*rgb,round(aa*255)])
    def rect(self,x0,y0,x1,y1,color):
        for y in range(int(y0),int(y1)):
            for x in range(int(x0),int(x1)):self.dot(x,y,color)
    def line(self,x0,y0,x1,y1,color,thick=1):
        x0=int(x0);y0=int(y0);x1=int(x1);y1=int(y1)
        dx=abs(x1-x0);dy=-abs(y1-y0)
        sx=1 if x0<x1 else -1;sy=1 if y0<y1 else -1
        err=dx+dy
        while True:
            self.rect(x0-thick//2,y0-thick//2,x0+(thick+1)//2,y0+(thick+1)//2,color)
            if x0==x1 and y0==y1:break
            ee=2*err
            if ee>=dy:err+=dy;x0+=sx
            if ee<=dx:err+=dx;y0+=sy
    def oval(self,cx,cy,rx,ry,c):
        for y in range(int(cy-ry),int(cy+ry+1)):
            for x in range(int(cx-rx),int(cx+rx+1)):
                q=((x-cx)/max(1,rx))**2+((y-cy)/max(1,ry))**2
                if q<=1:self.dot(x,y,c)
    def png(self,path):
        scan=bytearray()
        for y in range(self.h):
            scan.append(0);scan.extend(self.p[y*self.w*4:(y+1)*self.w*4])
        def chunk(name,body):
            return struct.pack('>I',len(body))+name+body+struct.pack('>I',zlib.crc32(name+body)&0xffffffff)
        data=b'\x89PNG\r\n\x1a\n'
        data+=chunk(b'IHDR',struct.pack('>IIBBBBB',self.w,self.h,8,6,0,0,0))
        data+=chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b'')
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes(data)
        print(path.relative_to(ROOT),self.w,self.h,len(data),'bytes')


def drying_rack():
    """Human-height working net: timber 12px wide and a deliberately coarse mesh.

    Village 390x357 thatched cottage and 80x112 people are the physical
    reference. The mesh uses 20px knots with 3px yarn, not single pixels.
    """
    a=Art(232,176)
    a.oval(116,163,107,7,SHADOW)
    def top(x):return 50+int(8*math.sin(math.pi*(x-35)/162))
    def bottom(x):return 125+int(9*math.sin(math.pi*(x-35)/162))
    # Subdued cloth shadows, not thousands of noisy standalone dots.
    for x in range(35,198):
        for y in range(top(x),bottom(x)):
            lattice=(x+y)%20<3 or (x-y)%20<3
            if lattice:
                c=NET_LIT if ((x//20+y//20)%5)==0 else NET_DARK
                a.dot(x,y,c)
            elif (x//14+y//13)%13==0 and x%3<2 and y%3<2:
                a.dot(x,y,NET_SHADE)
    # Coarse rope-bound perimeter, with visible weights and knots.
    for x in range(34,199):
        for j in range(3):
            a.dot(x,top(x)+j,ROPE if x%23<12 else ROPE_DARK)
            a.dot(x,bottom(x)+j,NET_DARK)
        if (x-36)%20==0:
            a.rect(x-3,top(x)-2,x+5,top(x)+5,ROPE_DARK)
            a.rect(x-1,top(x)-1,x+3,top(x)+2,ROPE_LIGHT)
            a.rect(x-2,bottom(x)-2,x+4,bottom(x)+4,ROPE_DARK)
    for x in (51,83,116,151,186):
        y=bottom(x)
        a.line(x,y+2,x+2,y+10,ROPE_DARK,3)
        a.rect(x-5,y+8,x+7,y+14,WOOD_DARK)
        a.rect(x-3,y+8,x+4,y+11,WOOD_GOLD)
    # Strong angular timbers, same visual weight as village posts.
    a.line(28,31,23,158,WOOD_DARK,14)
    a.line(28,31,23,156,WOOD,10)
    a.line(26,35,25,145,WOOD_LIT,3)
    a.line(203,29,211,159,WOOD_DARK,14)
    a.line(202,30,209,157,WOOD,10)
    a.line(204,35,209,145,WOOD_LIT,3)
    a.line(20,39,213,35,WOOD_DARK,14)
    a.line(20,34,213,30,WOOD,9)
    a.line(26,31,206,28,WOOD_GOLD,3)
    for x in (42,90,145,195):
        y=31-(x-42)//65
        a.rect(x-4,y-2,x+6,y+7,ROPE_DARK)
        a.rect(x-1,y,x+4,y+3,ROPE_LIGHT)
    # Cork floats, large enough to read as fishing gear at PSP resolution.
    for x,y in ((58,46),(113,47),(174,46)):
        a.line(x,y-4,x,y-14,ROPE_DARK,3)
        a.oval(x,y+4,10,8,WOOD_DARK)
        a.oval(x,y+2,8,6,FLOAT)
        a.rect(x-4,y-2,x+2,y+2,FLOAT_LIT)
    return a


# Never re-generate basket / net bundle / rope coil from the old code.
# They now have independent source paintings and a dedicated image processor.
if __name__=='__main__':
    drying_rack().png(DEST/'net-drying-rack-232x176.png')
