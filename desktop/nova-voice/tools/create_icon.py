"""Generate a small Windows ICO without third-party graphics dependencies."""

import struct
import zlib
from pathlib import Path


def png_chunk(kind: bytes, payload: bytes) -> bytes:
    return (
        struct.pack(">I", len(payload))
        + kind
        + payload
        + struct.pack(">I", zlib.crc32(kind + payload))
    )


def make_icon(destination: Path) -> None:
    size = 256
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            dx, dy = max(56 - x, 0, x - 199), max(56 - y, 0, y - 199)
            inside = 8 <= x < 248 and 8 <= y < 248 and dx * dx + dy * dy <= 48 * 48
            color = (255, 176, 0, 255) if inside else (0, 0, 0, 0)
            for center, half_height in ((58, 18), (93, 52), (128, 76), (163, 44), (198, 18)):
                if abs(x - center) <= 7 and abs(y - 128) <= half_height:
                    color = (30, 41, 59, 255)
            if (x - 202) ** 2 + (y - 54) ** 2 <= 15**2:
                color = (255, 214, 0, 255)
            rows.extend(color)
    png = b"\x89PNG\r\n\x1a\n"
    png += png_chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += png_chunk(b"IDAT", zlib.compress(rows, level=9))
    png += png_chunk(b"IEND", b"")
    header = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack("<BBBBHHII", 0, 0, 0, 0, 1, 32, len(png), 22)
    destination.write_bytes(header + entry + png)


if __name__ == "__main__":
    make_icon(Path(__file__).resolve().parents[1] / "assets" / "icon.ico")
