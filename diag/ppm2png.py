"""Convert a binary PPM (P6, maxval 255) to PNG with the standard library only."""
import struct, sys, zlib
from pathlib import Path
src, dst = Path(sys.argv[1]), Path(sys.argv[2])
data = src.read_bytes()
fields, pos = [], 0
while len(fields) < 4:
    while data[pos:pos + 1].isspace():
        pos += 1
    if data[pos:pos + 1] == b"#":
        pos = data.index(b"\n", pos) + 1
        continue
    end = pos
    while not data[end:end + 1].isspace():
        end += 1
    fields.append(data[pos:end]); pos = end
pos += 1
assert fields[0] == b"P6" and fields[3] == b"255", fields
width, height = int(fields[1]), int(fields[2])
pixels = data[pos:pos + width * height * 3]
assert len(pixels) == width * height * 3
raw = b"".join(b"\x00" + pixels[y * width * 3:(y + 1) * width * 3] for y in range(height))
def chunk(kind, body):
    return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF)
png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
dst.write_bytes(png)
print(width, height, len(png))
