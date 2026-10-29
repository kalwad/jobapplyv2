"""Exact-source cache policy: wire bookkeeping is not code identity."""

from __future__ import annotations

import hashlib
import importlib.util
import marshal
import py_compile
import struct
import types
from pathlib import Path
from typing import Any, cast

import check_portability
import pytest


def _signature(wire: bytes) -> bytes:
    return check_portability._marshal312_signature(wire)


def _code() -> types.CodeType:
    return compile(
        "value = 'not interned spaces'\n",
        "owned-bytecode-control.py",
        "exec",
        dont_inherit=True,
        optimize=0,
    )


def _raw_code(
    field: str = "", replacement: object = None, *, consts_wire: bytes | None = None
) -> bytes:
    """Independent no-reference field fixture from the primary 3.12 layout."""
    code = _code()
    fields: dict[str, object] = {
        "argcount": code.co_argcount,
        "posonlyargcount": code.co_posonlyargcount,
        "kwonlyargcount": code.co_kwonlyargcount,
        "stacksize": code.co_stacksize,
        "flags": code.co_flags,
        "code": code.co_code,
        "consts": code.co_consts,
        "names": code.co_names,
        "localsplusnames": (),
        "localspluskinds": b"",
        "filename": code.co_filename,
        "name": code.co_name,
        "qualname": code.co_qualname,
        "firstlineno": code.co_firstlineno,
        "linetable": code.co_linetable,
        "exceptiontable": code.co_exceptiontable,
    }
    if field:
        fields[field] = replacement
    wire = bytearray(b"c")
    for key, value in fields.items():
        if key in {
            "argcount",
            "posonlyargcount",
            "kwonlyargcount",
            "stacksize",
            "flags",
            "firstlineno",
        }:
            assert isinstance(value, int)
            wire.extend(struct.pack("<i", value))
        elif key == "consts" and consts_wire is not None:
            wire.extend(consts_wire)
        else:
            wire.extend(marshal.dumps(cast(Any, value), 2))
    return bytes(wire)


def test_same_compiled_object_reference_state_is_accepted() -> None:
    code = _code()
    released = marshal.dumps(code)
    held = code.co_consts[0]
    shared = marshal.dumps(code)
    assert held == "not interned spaces"
    assert released != shared
    assert _signature(released) == _signature(shared)


def test_no_reference_layout_does_not_erase_compiler_identity() -> None:
    # marshal2 erases meaningful interning/alias information; it is not a
    # positive oracle for arbitrary marshal4 graphs.
    assert _signature(_raw_code()) != _signature(marshal.dumps(_code()))


@pytest.mark.parametrize(
    ("field", "replacement"),
    [
        ("argcount", 1),
        ("posonlyargcount", 1),
        ("kwonlyargcount", 1),
        ("stacksize", 99),
        ("flags", 123),
        ("code", b"\x09\x00"),
        ("consts", ("forged", None)),
        ("names", ("forged",)),
        ("localsplusnames", ("forged",)),
        ("localspluskinds", b"\x20"),
        ("filename", "different-source.py"),
        ("name", "different_name"),
        ("qualname", "different_qualname"),
        ("firstlineno", 99),
        ("linetable", b"different"),
        ("exceptiontable", b"different"),
    ],
    ids=[
        "argcount",
        "posonlyargcount",
        "kwonlyargcount",
        "stacksize",
        "flags",
        "opcode",
        "consts",
        "names",
        "localsplusnames",
        "localspluskinds",
        "filename",
        "name",
        "qualname",
        "firstlineno",
        "linetable",
        "exceptiontable",
    ],
)
def test_every_serialized_code_field_changes_identity(
    field: str, replacement: object
) -> None:
    assert _signature(_raw_code(field, replacement)) != _signature(_raw_code())


@pytest.mark.parametrize("field", ["co_filename", "co_qualname", "co_stacksize"])
def test_plain_code_equality_omissions_are_preserved(field: str) -> None:
    code = _code()
    if field == "co_stacksize":
        changed = code.replace(co_stacksize=code.co_stacksize + 1)
    elif field == "co_filename":
        changed = code.replace(co_filename="changed")
    else:
        changed = code.replace(co_qualname="changed")
    assert code == changed
    assert _signature(marshal.dumps(code)) != _signature(marshal.dumps(changed))


@pytest.mark.parametrize(
    ("left", "right"),
    [(True, 1), (False, 0), (b"x", "x"), (0.0, -0.0), (1.0, 1), (None, Ellipsis)],
    ids=[
        "bool-int",
        "false-zero",
        "bytes-unicode",
        "signed-zero",
        "float-int",
        "singletons",
    ],
)
def test_scalar_type_and_bits_are_preserved(left: object, right: object) -> None:
    assert _signature(_raw_code("consts", (left,))) != _signature(
        _raw_code("consts", (right,))
    )


def test_nested_filename_and_closure_fields_are_preserved() -> None:
    code = compile(
        "def outer(value):\n def inner():\n  return value\n return inner\n",
        "owned-nested.py",
        "exec",
        dont_inherit=True,
        optimize=0,
    )
    function = next(c for c in code.co_consts if isinstance(c, types.CodeType))
    changed = function.replace(co_filename="foreign.py")
    altered = code.replace(
        co_consts=tuple(changed if c is function else c for c in code.co_consts)
    )
    assert code == altered
    assert _signature(marshal.dumps(code)) != _signature(marshal.dumps(altered))


@pytest.mark.parametrize(
    "wire",
    [
        b"?",
        b"r\x00\x00\x00\x00",
        b"r\xff\xff\xff\xff",
        b"\xf2\x00\x00\x00\x00",
        b"\xa9\x01r\x00\x00\x00\x00",
        b"s\xff\xff\xff\x7f",
        b"u\x01\x00\x00\x00\xff",
        b"l\x01\x00\x00\x00\x00\x80",
        b")\xff",
    ],
    ids=[
        "unknown",
        "dangling-ref",
        "negative-ref",
        "flagged-ref",
        "active-cycle",
        "huge-length",
        "utf8",
        "long-digit",
        "truncated-tuple",
    ],
)
def test_malformed_or_noncode_wire_is_refused(wire: bytes) -> None:
    with pytest.raises(ValueError, match="marshal312"):
        _signature(wire)


def test_every_truncation_and_trailing_byte_is_refused() -> None:
    wire = marshal.dumps(_code())
    for index in range(len(wire)):
        with pytest.raises(ValueError, match="marshal312"):
            _signature(wire[:index])
    with pytest.raises(ValueError, match="marshal312"):
        _signature(wire + b"N")


def test_deep_and_oversized_input_is_refused() -> None:
    for wire in [b")\x01" * 1000 + b"N", b"N" * (2 * 1024 * 1024 + 1)]:
        with pytest.raises(ValueError, match="marshal312"):
            _signature(wire)


def test_local_pycompile_and_reference_variants_retain_exact_source_policy(
    tmp_path: Path,
) -> None:
    source = tmp_path / "owned.py"
    source.write_bytes(b"value='not interned spaces'\n")
    compiled_path = py_compile.compile(str(source), doraise=True, optimize=0)
    assert compiled_path is not None
    cache = Path(compiled_path)
    check_portability._check_linux_bytecode(tmp_path, frozenset({source.name}))
    header = cache.read_bytes()[:16]
    code = compile(
        source.read_bytes(), str(source), "exec", dont_inherit=True, optimize=0
    )
    held = code.co_consts[0]
    cache.write_bytes(header + marshal.dumps(code))
    assert held == "not interned spaces"
    check_portability._check_linux_bytecode(tmp_path, frozenset({source.name}))
    changed = code.replace(co_filename="foreign.py")
    cache.write_bytes(header + marshal.dumps(changed))
    with pytest.raises(ValueError, match="cache differs"):
        check_portability._check_linux_bytecode(tmp_path, frozenset({source.name}))


def test_header_flag_and_magic_remain_exact(tmp_path: Path) -> None:
    source = tmp_path / "owned.py"
    source.write_bytes(b"value=1\n")
    compiled_path = py_compile.compile(str(source), doraise=True, optimize=0)
    assert compiled_path is not None
    cache = Path(compiled_path)
    valid = cache.read_bytes()
    assert valid[:4] == importlib.util.MAGIC_NUMBER
    for offset in [0, 4, 8, 12]:
        corrupted = bytearray(valid)
        corrupted[offset] ^= 1
        cache.write_bytes(corrupted)
        with pytest.raises(ValueError, match="cache differs"):
            check_portability._check_linux_bytecode(tmp_path, frozenset({source.name}))


def test_completed_references_and_inline_values_have_distinct_identity() -> None:
    value = "repeated non interned string"
    constants = (value, value)
    inline = _raw_code("consts", constants)
    shared = marshal.dumps(_code().replace(co_consts=constants))
    assert inline != shared
    assert _signature(inline) != _signature(shared)


@pytest.mark.parametrize(
    "value",
    [
        2**100,
        -(2**100),
        "\ud800",
        "é\U0001f600",
        b"\x00\xff",
        (1, 2),
        frozenset({1, "a"}),
    ],
    ids=[
        "positive-long",
        "negative-long",
        "surrogate",
        "unicode",
        "bytes",
        "tuple",
        "frozenset",
    ],
)
def test_compiler_constant_forms_preserve_values_across_wire_bookkeeping(
    value: object,
) -> None:
    code = _code().replace(co_consts=(value,))
    ordinary = marshal.dumps(code)
    held = code.co_consts[0]
    assert held is value
    assert _signature(ordinary) == _signature(marshal.dumps(code))


@pytest.mark.parametrize("tag", [b"g", b"y"], ids=["float", "complex"])
def test_nan_payload_and_complex_component_bits_remain_distinct(tag: bytes) -> None:
    left = struct.pack("<Q", 0x7FF8000000000001)
    right = struct.pack("<Q", 0x7FF8000000000002)
    if tag == b"y":
        left += struct.pack("<d", -0.0)
        right += struct.pack("<d", -0.0)
    assert _signature(_raw_code(consts_wire=b")\x01" + tag + left)) != _signature(
        _raw_code(consts_wire=b")\x01" + tag + right)
    )


def test_frozenset_order_is_value_order_independent_but_keeps_multiplicity() -> None:
    left = b"g" + struct.pack("<Q", 0x7FF8000000000001)
    right = b"g" + struct.pack("<Q", 0x7FF8000000000002)
    prefix = b")\x01>" + struct.pack("<i", 2)
    ordered = _raw_code(consts_wire=prefix + left + right)
    reversed_order = _raw_code(consts_wire=prefix + right + left)
    duplicated_same_bits = _raw_code(consts_wire=prefix + left + left)
    single = _raw_code(consts_wire=b")\x01>" + struct.pack("<i", 1) + left)
    assert _signature(ordered) == _signature(reversed_order)
    assert _signature(ordered) != _signature(duplicated_same_bits)
    assert _signature(duplicated_same_bits) != _signature(single)


def test_reference_dag_cannot_bypass_semantic_depth_or_expand_exponentially() -> None:
    items = [b"\xa9\x00"]
    for index in range(85):
        reference = b"r" + struct.pack("<i", index)
        items.append(b"\xa9\x02" + reference + reference)
    wire = _raw_code(consts_wire=b"(" + struct.pack("<i", len(items)) + b"".join(items))
    assert len(wire) < 2048
    with pytest.raises(ValueError, match="depth"):
        _signature(wire)


def test_wide_reference_replay_cannot_bypass_token_budget() -> None:
    wire = _raw_code(consts_wire=b"(" + struct.pack("<i", 100_001))
    with pytest.raises(ValueError, match="budget"):
        _signature(wire)


def _noninterned_wire(payload: bytes, *, flagged: bool = False) -> bytes:
    return (
        bytes([ord("u") | (0x80 if flagged else 0)])
        + struct.pack("<i", len(payload))
        + payload
    )


def _ref(index: int) -> bytes:
    return b"r" + struct.pack("<i", index)


def _alias_change() -> tuple[types.CodeType, types.CodeType]:
    source = (
        "a = ('not interned spaces!', 1)\n"
        "b = ('not interned spaces!', 2)\n"
        "answer = a[0] is b[0]\n"
    )
    original = compile(
        source, "/synthetic/approved/source.py", "exec", dont_inherit=True, optimize=0
    )
    left, right = original.co_consts[:2]
    assert isinstance(left, tuple)
    assert isinstance(right, tuple)
    assert left[0] is right[0]
    assert isinstance(left[0], str)
    duplicate = left[0].encode().decode()
    assert duplicate == left[0]
    assert duplicate is not left[0]
    changed = original.replace(
        co_consts=((duplicate, *left[1:]), *original.co_consts[1:])
    )
    assert original.co_consts == changed.co_consts
    return original, changed


def test_reviewer_equal_content_alias_change_is_refused() -> None:
    original, changed = _alias_change()
    assert _signature(marshal.dumps(original)) != _signature(marshal.dumps(changed))


def test_exact_source_helper_refuses_reviewer_alias_change(tmp_path: Path) -> None:
    original, changed = _alias_change()
    source = tmp_path / "owned.py"
    source.write_text(
        "a = ('not interned spaces!', 1)\n"
        "b = ('not interned spaces!', 2)\n"
        "answer = a[0] is b[0]\n"
    )
    # The code is freshly compiled trusted source, never constructed from cache.
    original = original.replace(co_filename=str(source))
    changed = changed.replace(co_filename=str(source))
    cache = tmp_path / "__pycache__" / "owned.cpython-312.pyc"
    cache.parent.mkdir()
    info = source.stat()
    header = (
        importlib.util.MAGIC_NUMBER
        + bytes(4)
        + struct.pack("<II", int(info.st_mtime) & 0xFFFFFFFF, info.st_size)
    )
    cache.write_bytes(header + marshal.dumps(original))
    check_portability._check_linux_bytecode(tmp_path, frozenset({source.name}))
    cache.write_bytes(header + marshal.dumps(changed))
    with pytest.raises(ValueError, match="cache differs"):
        check_portability._check_linux_bytecode(tmp_path, frozenset({source.name}))


@pytest.mark.parametrize(
    "scalar",
    [
        _noninterned_wire(b"uninterned spaces"),
        b"s" + struct.pack("<i", 4) + b"data",
        b"g" + struct.pack("<d", 1.25),
        b"y" + struct.pack("<dd", 1.25, -0.0),
        b"l" + struct.pack("<i", 3) + struct.pack("<HHH", 1, 2, 3),
        b")\x01g" + struct.pack("<d", 1.25),
        b">" + struct.pack("<i", 1) + b"g" + struct.pack("<d", 1.25),
    ],
    ids=["string", "bytes", "float", "complex", "long", "tuple", "frozenset"],
)
def test_non_global_value_sharing_is_preserved(scalar: bytes) -> None:
    flagged = bytes([scalar[0] | 0x80]) + scalar[1:]
    shared = _raw_code(consts_wire=b")\x02" + flagged + _ref(0))
    distinct = _raw_code(consts_wire=b")\x02" + scalar + scalar)
    assert _signature(shared) != _signature(distinct)


@pytest.mark.parametrize(
    "scalar",
    [
        b"i" + struct.pack("<i", -5),
        b"i" + struct.pack("<i", 256),
        b")\x00",
        b"s" + bytes(4),
        b"t" + struct.pack("<i", 5) + b"names",
    ],
    ids=[
        "small-int-low",
        "small-int-high",
        "empty-tuple",
        "empty-bytes",
        "interned-string",
    ],
)
def test_primary_constructor_globals_do_not_invent_distinct_identity(
    scalar: bytes,
) -> None:
    flagged = bytes([scalar[0] | 0x80]) + scalar[1:]
    assert _signature(
        _raw_code(consts_wire=b")\x02" + flagged + _ref(0))
    ) == _signature(_raw_code(consts_wire=b")\x02" + scalar + scalar))


@pytest.mark.parametrize("integer", [-6, 257])
def test_integer_sharing_outside_primary_cache_is_preserved(integer: int) -> None:
    scalar = b"i" + struct.pack("<i", integer)
    flagged = bytes([scalar[0] | 0x80]) + scalar[1:]
    assert _signature(
        _raw_code(consts_wire=b")\x02" + flagged + _ref(0))
    ) != _signature(_raw_code(consts_wire=b")\x02" + scalar + scalar))


def test_meaningful_string_intern_state_is_preserved() -> None:
    payload = struct.pack("<i", 16) + b"not interned !  "
    assert _signature(_raw_code(consts_wire=b")\x01u" + payload)) != _signature(
        _raw_code(consts_wire=b")\x01t" + payload)
    )


def test_unused_memo_slots_and_reference_reindexing_are_normalized() -> None:
    first = _noninterned_wire(b"unused held spaces", flagged=True)
    second = _noninterned_wire(b"actually shared spaces", flagged=True)
    with_unused = _raw_code(consts_wire=b")\x03" + first + second + _ref(1))
    without_unused = _raw_code(
        consts_wire=b")\x03" + bytes([first[0] & 0x7F]) + first[1:] + second + _ref(0)
    )
    assert _signature(with_unused) == _signature(without_unused)


def test_distinct_frozenset_member_order_preserves_external_aliases() -> None:
    first = b"g" + struct.pack("<d", 1.25)
    second = b"g" + struct.pack("<d", 2.25)
    ffirst = bytes([first[0] | 0x80]) + first[1:]
    fsecond = bytes([second[0] | 0x80]) + second[1:]
    prefix = b")\x02>" + struct.pack("<i", 2)
    ordinary = _raw_code(consts_wire=prefix + ffirst + fsecond + _ref(0))
    reordered = _raw_code(consts_wire=prefix + fsecond + ffirst + _ref(1))
    changed = _raw_code(consts_wire=prefix + ffirst + fsecond + _ref(1))
    assert _signature(ordinary) == _signature(reordered)
    assert _signature(ordinary) != _signature(changed)


def test_tied_unordered_members_with_external_alias_are_refused() -> None:
    scalar = b"g" + struct.pack("<Q", 0x7FF8000000000001)
    flagged = bytes([scalar[0] | 0x80]) + scalar[1:]
    wire = _raw_code(
        consts_wire=b")\x02>" + struct.pack("<i", 2) + flagged + scalar + _ref(0)
    )
    with pytest.raises(ValueError, match="unordered alias"):
        _signature(wire)


def test_global_reference_replay_does_not_rehash_large_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # A large interned leaf can have many short REF edges. Hashing its payload
    # per edge would expand work far beyond the bounded input graph.
    payload = b"interned spaces !" * 512
    leaf = b"\xf4" + struct.pack("<i", len(payload)) + payload
    wire = _raw_code(consts_wire=b"(" + struct.pack("<i", 65) + leaf + _ref(0) * 64)
    real_sha256 = hashlib.sha256
    hashed_bytes = 0

    class CountingHash:
        def __init__(self, initial: bytes = b"") -> None:
            self.actual = real_sha256()
            self.update(initial)

        def update(self, value: bytes) -> None:
            nonlocal hashed_bytes
            hashed_bytes += len(value)
            self.actual.update(value)

        def digest(self) -> bytes:
            return self.actual.digest()

    monkeypatch.setattr(hashlib, "sha256", CountingHash)
    _signature(wire)
    assert hashed_bytes < len(wire) * 20
