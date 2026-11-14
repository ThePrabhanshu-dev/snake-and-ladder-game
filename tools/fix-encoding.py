#!/usr/bin/env python3
"""Repair files that were double-encoded by a PowerShell read/write round-trip.

PowerShell read the UTF-8 files as CP1252 and wrote them back as UTF-8, so
every non-ASCII character went through the classic "Ã¢â‚¬â€"" mojibake
mangling — twice, in this case. This reverses the round-trip.

Usage:  python tools/fix-encoding.py <file> [...]
"""
import sys

# Characters CP1252 cannot represent back to the original bytes.
_FALLBACK = {
    "\u20ac": "\u0080",  # euro sign
    "\u201a": "\u0082",
    "\u0192": "\u0083",
    "\u201e": "\u0084",
    "\u2026": "\u0085",
    "\u2020": "\u0086",
    "\u2021": "\u0087",
    "\u02c6": "\u0088",
    "\u2030": "\u0089",
    "\u0160": "\u008a",
    "\u2039": "\u008b",
    "\u0152": "\u008c",
    "\u017d": "\u008e",
    "\u2018": "\u0091",
    "\u2019": "\u0092",
    "\u201c": "\u0093",
    "\u201d": "\u0094",
    "\u2022": "\u0095",
    "\u2013": "\u0096",
    "\u2014": "\u0097",
    "\u02dc": "\u0098",
    "\u2122": "\u0099",
    "\u0161": "\u009a",
    "\u203a": "\u009b",
    "\u0153": "\u009c",
    "\u017e": "\u009e",
    "\u0178": "\u009f",
}


def to_latin1_bytes(text):
    """Map text back to the single-byte code page it came from."""
    out = bytearray()
    for ch in text:
        if 0x80 <= ord(ch) <= 0x9F:
            # Already a raw C1 control byte from a partially-unwound pass.
            out.append(ord(ch))
            continue
        try:
            out.append(ch.encode("cp1252")[0])
        except UnicodeEncodeError:
            out.append(_FALLBACK[ch].encode("latin-1")[0])
    return bytes(out)


def unmojibake(text):
    """Undo one round-trip of 'read as CP1252, write as UTF-8'."""
    return to_latin1_bytes(text).decode("utf-8")


def repair(path):
    raw = open(path, "rb").read()
    text = raw.decode("utf-8")

    # Keep unwinding while the result still looks mangled and keeps decoding.
    for _ in range(4):
        if not any(m in text for m in ("Ã", "â€", "Â")):
            break
        try:
            candidate = unmojibake(text)
        except UnicodeDecodeError:
            break
        if candidate == text:
            break
        text = candidate

    open(path, "wb").write(text.encode("utf-8"))
    return text


def main():
    for path in sys.argv[1:]:
        result = repair(path)
        bad = sum(result.count(m) for m in ("Ã", "â€", "Â"))
        print(f"{path}: remaining_mojibake={bad}")


if __name__ == "__main__":
    main()
