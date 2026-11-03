"""DIAGNOSTIC SCRATCH ONLY - never merge.

Summarise a Windows x64 kernel small memory dump (PAGEDU64, triage) without
retaining it: bugcheck code and parameters, the loaded-driver list, the module
holding each parameter, an exception record, data blocks covering the faulting
address, and a heuristic return-address scan of the captured stack.

usage: minidump_triage.py DUMP > summary.json
"""

import json
import struct
import sys
from pathlib import Path

data = Path(sys.argv[1]).read_bytes()
out: dict = {"bytes": len(data)}


def u32(offset: int) -> int:
    return struct.unpack_from("<I", data, offset)[0]


def u64(offset: int) -> int:
    return struct.unpack_from("<Q", data, offset)[0]


if data[:8] != b"PAGEDU64":
    out["error"] = "not PAGEDU64: " + data[:8].hex()
    print(json.dumps(out, indent=1))
    raise SystemExit(0)
out["version"] = [u32(0x8), u32(0xC)]
out["bugcheck_code"] = hex(u32(0x38))
params = [u64(0x40 + 8 * i) for i in range(4)]
out["bugcheck_parameters"] = [hex(p) for p in params]
out["dump_type"] = u32(0xF98)
exception_code = u32(0xF00)
out["header_exception"] = {"code": hex(exception_code), "address": hex(u64(0xF10))}
out["header_context_rip"] = hex(u64(0x348 + 0xF8))

t = 0x2000
fields = [
    "ServicePackBuild", "SizeOfDump", "ValidOffset", "ContextOffset", "ExceptionOffset",
    "MmOffset", "UnloadedDriversOffset", "PrcbOffset", "ProcessOffset", "ThreadOffset",
    "CallStackOffset", "SizeOfCallStack", "DriverListOffset", "DriverCount",
    "StringPoolOffset", "StringPoolSize", "BrokenDriverOffset", "TriageOptions",
]
triage = {name: u32(t + 4 * i) for i, name in enumerate(fields)}
triage["TopOfStack"] = u64(t + 0x48)
out["triage"] = {k: (hex(v) if k.endswith("Offset") or k == "TopOfStack" else v) for k, v in triage.items()}


def dump_string(offset: int) -> str:
    if not 0 < offset < len(data) - 4:
        return "?"
    length = u32(offset)
    raw = data[offset + 4 : offset + 4 + 2 * min(length, 512)]
    return raw.decode("utf-16-le", "replace")


drivers = []
count = triage["DriverCount"]
base = triage["DriverListOffset"]
stride = 0x90
if count and triage["StringPoolOffset"] > base:
    span = triage["StringPoolOffset"] - base
    if span % count == 0 and 0x80 <= span // count <= 0x200:
        stride = span // count
out["driver_entry_stride"] = hex(stride)
for i in range(min(count, 1024)):
    entry = base + i * stride
    if entry + stride > len(data):
        break
    name_offset = u32(entry)
    ldr = entry + 8
    dll_base = u64(ldr + 0x30)
    size = u32(ldr + 0x40)
    stamp = u32(ldr + 0x80) if stride >= 0x90 else 0
    drivers.append({"name": dump_string(name_offset), "base": dll_base, "size": size, "timestamp": hex(stamp)})
out["drivers"] = [{**d, "base": hex(d["base"]), "size": hex(d["size"])} for d in drivers]


def locate(address: int) -> str | None:
    for d in drivers:
        if d["base"] <= address < d["base"] + d["size"]:
            return d["name"] + "+" + hex(address - d["base"])
    return None


out["parameter_modules"] = [locate(p) for p in params]

if 0 < triage["ExceptionOffset"] < len(data) - 0x98:
    e = triage["ExceptionOffset"]
    out["exception_record"] = {
        "code": hex(u32(e)), "flags": hex(u32(e + 4)), "address": hex(u64(e + 0x10)),
        "address_module": locate(u64(e + 0x10)), "parameters": [hex(u64(e + 0x20 + 8 * i)) for i in range(min(u32(e + 0x18), 4))],
    }
if 0 < triage["ContextOffset"] < len(data) - 0x4D0:
    c = triage["ContextOffset"]
    rip = u64(c + 0xF8)
    out["context"] = {"rip": hex(rip), "rip_module": locate(rip), "rsp": hex(u64(c + 0x98)), "rcx": hex(u64(c + 0x80)), "rax": hex(u64(c + 0x78)), "rdx": hex(u64(c + 0x88))}

# Data blocks: capture bytes that cover the faulting address when present.
blocks_offset = u32(t + 0x78)
blocks_count = u32(t + 0x7C)
out["data_blocks"] = {"offset": hex(blocks_offset), "count": blocks_count}
covering = []
page_address, page_offset, page_size = u64(t + 0x60), u32(t + 0x68), u32(t + 0x6C)
out["data_page"] = {"address": hex(page_address), "offset": hex(page_offset), "size": hex(page_size)}
if 0 < blocks_offset < len(data) and blocks_count < 4096:
    for i in range(blocks_count):
        b = blocks_offset + 16 * i
        if b + 16 > len(data):
            break
        address, offset, size = u64(b), u32(b + 8), u32(b + 12)
        for p in params[1:3]:
            if address <= p < address + size and offset + size <= len(data):
                start = offset + (p - address)
                covering.append({"address": hex(p), "bytes_from_address": data[max(offset, start - 16) : start + 32].hex(), "starts_16_before": start - 16 >= offset})
out["blocks_covering_parameters"] = covering

stack = []
if 0 < triage["CallStackOffset"] < len(data):
    s = triage["CallStackOffset"]
    for i in range(0, min(triage["SizeOfCallStack"], 0x8000) - 7, 8):
        value = u64(s + i)
        where = locate(value)
        if where:
            stack.append({"slot": hex(triage["TopOfStack"] + i), "value": hex(value), "module": where})
out["stack_module_addresses"] = stack[:120]

# The current process: printable ASCII runs in the captured EPROCESS that look like
# an image file name (ImageFileName is 15 bytes, NUL padded; its offset varies by build).
import re

names = []
if 0 < triage["ProcessOffset"] < len(data):
    block = data[triage["ProcessOffset"] : triage["ProcessOffset"] + 0x1000]
    for match in re.finditer(rb"[A-Za-z0-9_.\-]{4,15}\x00", block):
        text = match.group()[:-1].decode()
        if "." in text or text.lower() in ("system", "registry", "idle"):
            names.append({"offset": hex(match.start()), "text": text})
out["process_name_candidates"] = names[:20]
print(json.dumps(out, indent=1))
