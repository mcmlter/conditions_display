#!/usr/bin/env python3
"""
Make the "Learn more" QR code (img/qr-learn-more.svg).

    pip install qrcode
    python maintenance/make_qr.py                         # https://mcm.lternet.edu/
    python maintenance/make_qr.py https://example.org/    # another address

Keep CONFIG.footer.learnMore.url in config.js the same as the address used here.
"""

import sys
from pathlib import Path

import qrcode
import qrcode.image.svg

url = sys.argv[1] if len(sys.argv) > 1 else "https://mcm.lternet.edu/"
out = Path(__file__).resolve().parent.parent / "img" / "qr-learn-more.svg"
qrcode.make(url, image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=2).save(out)
print(f"{out} -> {url}")
