from PIL import Image, ImageDraw

SIZE = 256
PAD = 24
img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# rounded square background
r = 52
c1 = (62, 115, 220, 255)    # #3d73dc
c2 = (45, 85, 175, 255)     # #2d55af
for y in range(PAD, SIZE - PAD):
    ratio = (y - PAD) / (SIZE - 2 * PAD)
    color = tuple(int(c1[i] + (c2[i] - c1[i]) * ratio) for i in range(4))
    draw.line([(PAD, y), (SIZE - PAD, y)], fill=color)

# rounded corners mask: draw four corner arcs and fill rectangles to clip
mask = Image.new('L', (SIZE, SIZE), 0)
md = ImageDraw.Draw(mask)
md.rectangle([PAD + r, PAD, SIZE - PAD - r, SIZE - PAD], fill=255)
md.rectangle([PAD, PAD + r, SIZE - PAD, SIZE - PAD - r], fill=255)
md.ellipse([PAD, PAD, PAD + 2 * r, PAD + 2 * r], fill=255)
md.ellipse([SIZE - PAD - 2 * r, PAD, SIZE - PAD, PAD + 2 * r], fill=255)
md.ellipse([PAD, SIZE - PAD - 2 * r, PAD + 2 * r, SIZE - PAD], fill=255)
md.ellipse([SIZE - PAD - 2 * r, SIZE - PAD - 2 * r, SIZE - PAD, SIZE - PAD], fill=255)
img.putalpha(mask)

# subtle highlight at top
draw = ImageDraw.Draw(img)
hl = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
hld = ImageDraw.Draw(hl)
hld.ellipse([PAD + 20, PAD + 8, SIZE - PAD - 20, PAD + 80], fill=(255, 255, 255, 35))
img = Image.alpha_composite(img, hl)
draw = ImageDraw.Draw(img)

# three white list lines
bar_w = 128
bar_h = 18
bar_r = 9
cx = SIZE // 2
ys = [94, 128, 162]
for y in ys:
    x1 = cx - bar_w // 2
    x2 = cx + bar_w // 2
    draw.rounded_rectangle([x1, y - bar_h // 2, x2, y + bar_h // 2], radius=bar_r, fill=(255, 255, 255, 240))

# small accent dot (notification-style)
draw.ellipse([SIZE - PAD - 38, PAD + 22, SIZE - PAD - 12, PAD + 48], fill=(255, 200, 80, 255))

img.save('assets/app-icon.png')

# 从 256x256 原图生成 ICO 各尺寸，避免小图放大发糊
ico_sizes = [16, 24, 32, 48, 64, 128, 256]
img.save('assets/app-icon.ico', sizes=[(s, s) for s in ico_sizes], format='ICO')

print('icon generated')
