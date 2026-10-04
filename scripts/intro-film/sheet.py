import sys,glob
from PIL import Image, ImageDraw
fs=sorted(glob.glob(sys.argv[4]+'/t_*.jpg'), key=lambda f: float(f.split('t_')[1][:-4]))
sel=fs[int(sys.argv[1]):int(sys.argv[2])]
cols=2; w,h=960,540
sheet=Image.new('RGB',(cols*w,((len(sel)+cols-1)//cols)*h),'white')
for i,f in enumerate(sel):
    im=Image.open(f).resize((w,h)); d=ImageDraw.Draw(im); d.text((10,10),f.split('t_')[1][:-4],fill='yellow')
    sheet.paste(im,((i%cols)*w,(i//cols)*h))
sheet.save(sys.argv[3])
