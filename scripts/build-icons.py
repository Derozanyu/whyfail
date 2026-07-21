from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
SIZE = 1024


def build_icon():
    image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((32, 32, 992, 992), radius=224, fill="#151515")
    red = "#ef2b22"
    white = "#f7f5ef"
    draw.line([(650, 160), (760, 270)], fill=red, width=36)
    draw.line([(760, 140), (870, 250)], fill=red, width=36)
    points = [(232, 304), (372, 728), (512, 420), (652, 728), (792, 304)]
    draw.line(points, fill=white, width=88, joint="curve")
    return image


def main():
    icon = build_icon()
    icon.save(PUBLIC / "icon.png", optimize=True)
    icon.save(PUBLIC / "icon.ico", format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    for size in (32, 64, 128, 256, 512):
        icon.resize((size, size), Image.Resampling.LANCZOS).save(PUBLIC / f"icon-{size}.png", optimize=True)


if __name__ == "__main__":
    main()
