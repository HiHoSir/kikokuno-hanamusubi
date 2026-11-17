"""Regenerate the native-resolution furniture atlas used by village interiors.

All geometry is authored on the same 4px grid as the room tiles.
Usage: python source-assets/village/interiors/furniture-generator.py

Requires Pillow for asset authoring only; the game itself needs no dependencies.
"""
from pathlib import Path
import sys
from PIL import Image, ImageDraw
im=Image.new('RGBA',(224,176),(0,0,0,0)); d=ImageDraw.Draw(im)
P={'ink':'#34251f','rim':'#51382b','dark':'#68432e','mid':'#91603e','warm':'#ad784e','light':'#c79a63','shine':'#e1bd81','shade':'#563f34','metal':'#687582','steel':'#9cabb0','white':'#eee2bf','ceramic':'#e6d0a5','red':'#ad4f43','redlight':'#d87b60','blue':'#476882','bluelight':'#7197ab','green':'#5e856b','greenlight':'#8ca889','gold':'#c6a052','stone':'#797569','stone2':'#aba48f','shadow':'#281c17'}
class C:
 def __init__(self,x,y):self.ox=x//4;self.oy=y//4
 def box(self,x,y,w,h,c):
  if w<=0 or h<=0:return
  d.rectangle([self.ox+x,self.oy+y,self.ox+x+w-1,self.oy+y+h-1],fill=P.get(c,c))
 def polygon(self,pts,c):d.polygon([(self.ox+x,self.oy+y) for x,y in pts],fill=P.get(c,c))
 def border(self,x,y,w,h,base,edge='ink',t=1):self.box(x,y,w,h,edge);self.box(x+t,y+t,w-2*t,h-2*t,base)
 def grain(self,x,y,w,rows=1):
  for row in range(rows):
   off=(7*row+3)%max(1,w-8);self.box(x+off,y+row*3,max(2,min(8,w-off-1)),1,'dark')
   if w>16:self.box(x+max(2,w//2-3),y+row*3+1,4,1,'light')
 def shadow(self,x,y,w):self.box(x+1,y,w-2,2,'shadow')

def wood_counter(c,w,h,kind):
 c.shadow(2,h-3,w-4)
 c.polygon([(3,8),(w-7,8),(w-2,14),(w-2,h-4),(3,h-4)],'ink')
 c.box(4,17,w-8,h-22,'dark');c.box(5,19,w-10,h-25,'mid')
 c.box(w-7,17,3,h-23,'rim');c.box(5,18,2,h-23,'light')
 for x in range(8,w-12,12):
  c.border(x,20,min(11,w-x-11),h-27,'warm','rim',1)
  c.box(x+2,23,2,3,'light');c.box(x+3,h-11,3,1,'dark')
 c.polygon([(1,10),(6,5),(w-7,5),(w-2,10),(w-5,18),(4,18)],'ink')
 c.polygon([(3,10),(8,7),(w-9,7),(w-4,10),(w-7,16),(6,16)],'light')
 c.box(7,8,w-16,2,'shine')
 for x in range(10,w-8,11):c.box(x,13,5,1,'warm')
 if kind=='tea':
  # tea bowls, tray and hanging cloth
  c.border(11,6,17,7,'dark','rim');
  for x in [13,19,25]:c.box(x,7,3,3,'white');c.box(x+1,6,1,1,'steel')
  c.box(38,5,8,2,'ceramic');c.border(40,3,4,4,'ceramic','dark')
  c.box(24,19,12,10,'red');c.box(25,20,4,8,'redlight');c.box(31,20,3,8,'redlight')
  for x in [27,30,33]:c.box(x,22,1,4,'white')
 elif kind=='weapon':
  c.polygon([(19,7),(22,4),(25,7),(22,9)],'steel');c.box(21,3,2,6,'metal')
  for x in [32,39,46]:
   c.box(x,5,2,8,'metal');c.box(x,6,1,5,'steel');c.box(x-1,12,4,1,'gold')
  c.border(w//2-5,22,10,10,'dark','ink');c.box(w//2-2,25,4,5,'gold')
 elif kind=='inn':
  # Ledger is 44px wide, not a giant open book beside the 112px hero.
  c.border(18,5,11,7,'white','rim')
  c.box(19,6,4,5,'ceramic');c.box(24,6,4,5,'ceramic');c.box(23,6,1,6,'dark')
  for y in [7,9]:c.box(19,y,3,1,'stone2');c.box(25,y,3,1,'stone2')
  c.border(36,5,7,9,'gold','rim');c.box(38,7,3,5,'white')
 elif kind=='shop':
  for x in [12,23,37,46]:c.box(x,5,6,4,'ceramic');c.box(x+1,4,4,1,'steel')

def tea_table(c):
 c.shadow(4,25,35)
 for x in [7,31]:c.border(x,18,5,9,'dark','ink');c.box(x+1,19,2,6,'warm')
 c.polygon([(5,7),(10,3),(35,3),(40,8),(39,20),(6,20)],'ink')
 c.polygon([(7,8),(11,5),(34,5),(38,9),(37,18),(8,18)],'mid')
 c.box(9,7,27,2,'light');c.box(9,15,27,2,'dark')
 c.box(19,7,7,6,'rim');c.box(20,8,5,4,'ceramic');c.box(21,7,3,1,'white');c.box(25,10,4,2,'ceramic')
 for x,y in [(11,11),(31,10),(30,15)]:c.border(x,y,4,4,'white','rim');c.box(x+1,y,2,1,'shine')

def futon(c,color):
 secondary='bluelight' if color=='blue' else 'redlight'
 c.shadow(3,29,19);c.border(3,2,19,28,'ceramic','ink')
 c.box(4,3,17,7,'white');c.box(5,4,15,2,'ceramic');c.box(4,9,17,2,'stone2')
 c.border(4,11,17,18,color,'rim');c.box(5,12,15,3,secondary)
 c.box(5,16,15,2,color);c.box(5,20,15,3,secondary);c.box(5,26,15,1,'dark')
 c.box(7,12,2,14,'white');c.box(17,13,1,12,'shine')
 for y in [17,23]:c.box(10,y,5,1,'ceramic')

def shelf(c,weapon=False):
 w=32 if weapon else 42;h=39 if weapon else 36
 c.shadow(2,h-3,w-3)
 c.border(2,3,w-4,h-6,'dark','ink')
 c.box(4,4,w-8,2,'light');c.box(4,7,w-8,h-13,'shade');c.box(4,7,2,h-13,'mid');c.box(w-6,7,2,h-13,'rim')
 for y in ([14,25,33] if weapon else [13,22,30]):c.box(3,y,w-6,3,'ink');c.box(4,y,w-8,1,'shine')
 if weapon:
  for x in [8,16,24]:
   c.box(x,6,1,20,'steel');c.box(x+1,7,1,18,'metal');c.box(x-1,25,4,2,'gold');c.box(x,27,2,5,'dark')
 else:
  # ceramic jars, rice parcels and cloth stacks
  for x,color in [(8,'ceramic'),(18,'green'),(29,'red')]:
   c.border(x,7,6,5,color,'rim');c.box(x+1,6,4,1,'light')
  for x,color in [(8,'ceramic'),(16,'blue'),(25,'green'),(33,'gold')]:c.border(x,16,5,5,color,'ink');c.box(x+1,17,2,1,'shine')
  for x in [8,20,30]:c.border(x,25,9,4,'ceramic','rim');c.box(x+2,26,4,1,'warm')

def tansu(c):
 c.shadow(2,27,29);c.border(3,2,27,26,'dark','ink')
 c.box(4,3,25,2,'light');c.box(5,5,23,19,'warm')
 for y in [6,12,18]:
  c.border(6,y,21,5,'mid','rim');c.box(7,y+1,19,1,'light');c.box(15,y+2,3,1,'metal');c.box(16,y+3,1,1,'gold')
 c.box(6,24,21,2,'rim');c.box(4,25,4,3,'ink');c.box(25,25,4,3,'ink')

def hearth(c):
 c.shadow(2,35,30)
 c.polygon([(5,16),(10,10),(25,10),(31,16),(31,29),(26,34),(8,34),(3,28)],'ink')
 c.polygon([(7,17),(12,12),(24,12),(29,17),(28,28),(24,32),(10,32),(5,27)],'stone')
 c.polygon([(10,19),(14,16),(22,16),(26,19),(26,27),(21,29),(13,29),(9,26)],'dark')
 for x,y in [(6,19),(25,20),(10,28),(21,30),(15,13)]:c.box(x,y,4,2,'stone2')
 c.box(14,19,10,7,'red');c.box(15,17,7,8,'gold');c.box(18,16,4,6,'shine');c.box(15,25,10,2,'shade')
 c.polygon([(11,11),(14,7),(22,7),(25,11),(23,17),(13,17)],'ink')
 c.polygon([(13,11),(15,9),(21,9),(23,11),(22,15),(14,15)],'metal')
 c.box(16,8,5,1,'steel');c.box(17,5,2,3,'ink');c.box(12,11,1,3,'gold')

def kitchen(c):
 c.shadow(2,20,34);c.border(3,5,33,16,'dark','ink')
 c.box(4,6,31,4,'light');c.box(4,10,31,9,'mid');
 for x in [6,17,28]:c.border(x,12,9,6,'warm','rim')
 c.polygon([(7,3),(10,1),(17,1),(20,3),(18,9),(9,9)],'ink')
 c.polygon([(9,4),(11,2),(16,2),(18,4),(17,7),(10,7)],'metal')
 c.box(12,2,4,1,'steel');c.box(20,5,9,3,'ceramic');c.box(22,4,5,1,'white')
 c.box(25,6,5,1,'red');c.box(32,6,2,4,'stone2')

def supplies(c):
 c.shadow(2,18,24)
 c.border(3,8,11,11,'dark','ink');c.box(5,10,7,7,'warm');c.box(5,11,7,2,'light');c.box(8,14,2,3,'ink')
 c.polygon([(13,7),(16,3),(20,3),(24,8),(23,18),(14,18)],'ink')
 c.polygon([(15,8),(17,5),(20,5),(22,9),(21,17),(16,17)],'ceramic')
 c.box(17,10,3,2,'warm');c.box(16,6,5,1,'rim')
 c.border(6,2,8,7,'dark','ink');c.box(8,3,4,3,'green');c.box(9,4,2,2,'greenlight')

def cushion(c):
 c.shadow(1,7,10)
 c.polygon([(1,4),(3,1),(9,1),(11,4),(11,7),(9,9),(3,9),(1,7)],'ink')
 c.polygon([(2,4),(4,2),(8,2),(10,4),(10,6),(8,8),(4,8),(2,6)],'red')
 c.box(4,3,4,1,'redlight');c.box(3,5,6,1,'redlight');c.box(5,5,2,2,'gold')

def workbench(c):
 c.shadow(3,16,32)
 for x in [5,31]:c.border(x,10,4,7,'dark','ink')
 c.polygon([(3,4),(6,2),(34,2),(37,4),(35,10),(4,10)],'ink');c.polygon([(5,4),(7,3),(33,3),(35,5),(34,8),(5,8)],'mid')
 c.box(7,4,25,2,'light');
 # mallet and woodworking tools
 c.box(9,3,7,2,'stone2');c.box(12,5,1,3,'warm');c.box(20,4,8,1,'metal');c.box(25,3,1,5,'dark');c.box(30,5,3,2,'gold')

def shoe_rack(c):
 c.shadow(1,13,22);c.border(2,3,20,11,'dark','ink')
 for y in [5,10]:c.box(3,y,18,2,'light');c.box(3,y+2,18,1,'rim')
 for x,y in [(5,7),(13,7),(6,11),(14,11)]:
  c.polygon([(x,y),(x+5,y),(x+6,y+2),(x+2,y+2),(x,y+1)],'ink')
  c.box(x+1,y,3,1,'blue' if x%2 else 'red');c.box(x+2,y+1,3,1,'warm')

sprites=[('teaCounter',(0,0),lambda c:wood_counter(c,60,31,'tea')),
('teaTable',(248,0),tea_table),('blueFuton',(496,0),lambda c:futon(c,'blue')),
('redFuton',(744,0),lambda c:futon(c,'red')),
('weaponRack',(0,176),lambda c:shelf(c,True)),('merchantShelf',(248,176),shelf),
('hearth',(496,176),hearth),('tansu',(744,176),tansu),
('kitchen',(0,352),kitchen),('supplies',(248,352),supplies),
('weaponCounter',(496,352),lambda c:wood_counter(c,56,35,'weapon')),
('cushion',(744,352),cushion),('shopCounter',(0,528),lambda c:wood_counter(c,56,25,'shop')),
('innCounter',(248,528),lambda c:wood_counter(c,57,35,'inn')),
('workbench',(496,528),workbench),('shoeRack',(744,528),shoe_rack)]
for name,(x,y),fn in sprites:
 fn(C(x,y))
im=im.resize((896,704),Image.Resampling.NEAREST)
out=Path(sys.argv[1]) if len(sys.argv)>1 else Path('assets/village/interiors/furniture.png')
out.parent.mkdir(parents=True, exist_ok=True)
im.save(out,optimize=True)
print(f'Wrote {out} ({im.width}x{im.height})')