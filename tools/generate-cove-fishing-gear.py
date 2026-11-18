#!/usr/bin/env python3
"""Create native RGBA pixel-art fishing gear for the sea cove.

Only author-designed geometry is used. Palette/scale follow approved village
sprites (roof thatch, 32px barrels, 80x112 NPCs), with late-SFC-era sparse
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
    a=Art(192,150)
    # Non-blocking translucent cast shadow at the sand contact points.
    a.oval(94,141,87,6,SHADOW)
    # Sagging hanging net: lattice first, then structural poles in foreground.
    def top(x):return 40+int(8*math.sin(math.pi*(x-28)/136))
    def bottom(x):return 109+int(12*math.sin(math.pi*(x-28)/136))
    for x in range(29,165):
        t,b=top(x),bottom(x)
        for y in range(t,b):
            if (x+y)%17<2 or (x-y)%17<2:
                color=NET_LIT if (x+y)//17%4==0 else NET
                a.dot(x,y,color)
            elif (x*3+y*7)%39==0:
                a.dot(x,y,NET_SHADE)
    # Rope selvage across the top and bottom edge of the net.
    for x in range(28,164):
        a.dot(x,top(x),ROPE_LIGHT if x%7<3 else ROPE)
        a.dot(x,bottom(x),NET_DARK if x%9<4 else ROPE_DARK)
        if x%19==0:
            a.rect(x-1,top(x)-1,x+2,top(x)+3,ROPE)
            a.rect(x-1,bottom(x)-1,x+2,bottom(x)+3,ROPE_DARK)
    # Drooping bunches/weights, staggered to break any tile-like regularity.
    for x in (42,70,102,136,157):
        y=bottom(x)
        a.line(x-1,y,x+1,y+6,ROPE_DARK,2)
        a.rect(x-4,y+6,x+5,y+10,WOOD_DARK)
        a.rect(x-3,y+6,x+3,y+8,WOOD_GOLD)
    # Long pole braces and substantial dark contour.
    a.line(24,28,17,133,WOOD_DARK,10)
    a.line(24,26,19,131,WOOD,6)
    a.line(22,28,22,115,WOOD_LIT,2)
    a.line(168,25,175,134,WOOD_DARK,10)
    a.line(168,27,172,132,WOOD,6)
    a.line(169,30,172,111,WOOD_LIT,2)
    a.line(18,34,174,30,WOOD_DARK,11)
    a.line(18,30,174,26,WOOD,7)
    a.line(24,28,169,25,WOOD_GOLD,2)
    for x in (29,73,119,158):
        y=round(27+(x-29)*(25-27)/(169-29))
        a.rect(x-2,y,x+4,y+5,ROPE_DARK)
        a.rect(x-1,y+1,x+3,y+3,ROPE_LIGHT)
    # Floats tied to the top cord, irregular and expressive rather than circles.
    for x,y in ((46,36),(91,38),(139,36)):
        a.oval(x,y+3,7,6,WOOD_DARK)
        a.oval(x,y+2,5,5,FLOAT)
        a.rect(x-2,y-2,x+1,y+1,FLOAT_LIT)
        a.line(x,y-4,x,y-8,ROPE,2)
    return a


def rolled_net():
    a=Art(112,66)
    a.oval(56,57,51,7,SHADOW)
    # Irregular rolled net, with dark folded lower lip.
    a.oval(57,43,46,17,WOOD_DARK)
    a.oval(55,39,47,17,NET_DARK)
    a.oval(54,34,43,15,NET)
    a.oval(56,31,41,12,NET_LIT)
    for y in range(20,54):
        for x in range(11,101):
            if ((x-56)/47)**2+((y-36)/19)**2>1:continue
            if (x+y)%10<2 or (x-y)%10<2:
                a.dot(x,y,ROPE if (x*5+y)%6<3 else NET_DARK)
            if (x*7+y*11)%47==1:
                a.rect(x,y,x+2,y+1,ROPE_LIGHT)
    for x in (22,43,69,89):
        a.line(x,21+abs(55-x)//8,x+4,53-abs(55-x)//8,ROPE_DARK,3)
        a.line(x+2,24+abs(55-x)//8,x+4,48-abs(55-x)//8,ROPE_LIGHT,1)
    a.line(17,43,29,55,ROPE_DARK,3)
    a.line(83,18,96,29,ROPE,3)
    return a


def rope_coil():
    a=Art(68,50)
    a.oval(35,44,31,5,SHADOW)
    # Loops made of segmented pixel ropes with a dark shade under each run.
    for ring in range(3):
        cy=28-ring*3
        rx=23-ring*5
        ry=11-ring*2
        for theta in range(0,360,3):
            x=34+int(rx*math.cos(math.radians(theta)))
            y=cy+int(ry*math.sin(math.radians(theta)))
            a.rect(x-2,y-1,x+2,y+3,WOOD_DARK)
            a.rect(x-1,y-2,x+2,y+1,ROPE if theta%19>6 else ROPE_LIGHT)
    a.line(49,25,61,30,ROPE_DARK,4)
    a.line(49,23,60,28,ROPE_LIGHT,2)
    a.rect(18,35,23,39,ROPE_DARK)
    return a


for name,art in (
    ('net-drying-rack-192x150.png',drying_rack()),
    ('net-bundle-112x66.png',rolled_net()),
    ('rope-coil-68x50.png',rope_coil())
):
    art.png(DEST/name)
