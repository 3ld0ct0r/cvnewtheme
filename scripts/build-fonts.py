#!/usr/bin/env python3
"""Build deterministic, OFL-compliant CV Resume Sans webfont subsets."""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import platform
import sys
from pathlib import Path
from typing import Final

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


FONTTOOLS_VERSION: Final = "4.63.0"
BROTLI_VERSION: Final = "1.2.0"
ZOPFLI_VERSION: Final = "0.4.3"
PYTHON_VERSION: Final = (3, 14, 6)
FAMILY_NAME: Final = "CV Resume Sans"
POSTSCRIPT_PREFIX: Final = "CVResumeSans"
SOURCE_VERSION: Final = "2.0.27"
SOURCE_ARCHIVE_SHA256: Final = (
    "a95127550b2957ff84cd636d4532b227ddc33d3485082437fa27816ef1d066ec"
)

LATIN_RANGE: Final = (
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,"
    "U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,"
    "U+2212,U+2215,U+FEFF,U+FFFD"
)

# The supplied source specification calls these ranges non-overlapping, but its
# literal broad Latin-ext definition overlaps Latin at seven codepoints. The
# declared range is retained here for auditability; the effective range assigns
# every overlap to Latin so browser subset selection is deterministic without
# reducing the combined repertoire.
LATIN_EXT_DECLARED_RANGE: Final = (
    "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,"
    "U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,"
    "U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"
)
LATIN_EXT_RANGE: Final = (
    "U+0100-0130,U+0132-0151,U+0154-02BA,U+02BD-02C5,U+02C7-02CC,"
    "U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+20A0-20AB,"
    "U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"
)

SOURCE_FILES: Final = {
    "normal": {
        "filename": "MonaSansVF[wdth,opsz,wght].ttf",
        "sha256": "9d96bf1303b964cc9101ea2419de780204cb6ace16375b017b66d1fe98a3a435",
    },
    "italic": {
        "filename": "MonaSansVF-Italic[wdth,opsz,wght].ttf",
        "sha256": "a22a930591bff52f624a86e24f3172c51bb4c4b7fd252b07d170cdb163c4dea8",
    },
}

OUTPUTS: Final = (
    ("normal", "latin", LATIN_RANGE, "cv-resume-sans-latin-normal.woff2"),
    (
        "normal",
        "latin-ext",
        LATIN_EXT_RANGE,
        "cv-resume-sans-latin-ext-normal.woff2",
    ),
    ("italic", "latin", LATIN_RANGE, "cv-resume-sans-latin-italic.woff2"),
    (
        "italic",
        "latin-ext",
        LATIN_EXT_RANGE,
        "cv-resume-sans-latin-ext-italic.woff2",
    ),
)

INITIAL_FONT_BUDGET: Final = 90 * 1024
INDIVIDUAL_FONT_BUDGET: Final = 96 * 1024
TOTAL_FONT_BUDGET: Final = 240 * 1024


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_unicode_range(value: str) -> set[int]:
    codepoints: set[int] = set()
    for raw_part in value.split(","):
        part = raw_part.strip().upper()
        if not part.startswith("U+"):
            raise ValueError(f"Invalid Unicode range component: {raw_part}")
        bounds = part[2:].split("-", maxsplit=1)
        start = int(bounds[0], 16)
        end = int(bounds[-1], 16)
        if start > end or end > 0x10FFFF:
            raise ValueError(f"Invalid Unicode range component: {raw_part}")
        codepoints.update(range(start, end + 1))
    return codepoints


def replace_name(font: TTFont, name_id: int, value: str) -> None:
    name_table = font["name"]
    records = [record for record in name_table.names if record.nameID == name_id]
    if not records:
        name_table.setName(value, name_id, 3, 1, 0x409)
        return
    for record in records:
        name_table.setName(
            value,
            name_id,
            record.platformID,
            record.platEncID,
            record.langID,
        )


def rename_font(font: TTFont, style: str) -> None:
    subfamily = "Italic" if style == "italic" else "Regular"
    full_name = f"{FAMILY_NAME} {subfamily}" if style == "italic" else FAMILY_NAME
    postscript_name = f"{POSTSCRIPT_PREFIX}-{subfamily}"

    names = {
        1: FAMILY_NAME,
        2: subfamily,
        3: f"2.027;CVRS;{postscript_name}",
        4: full_name,
        6: postscript_name,
        16: FAMILY_NAME,
        17: subfamily,
        25: POSTSCRIPT_PREFIX,
    }
    for name_id, value in names.items():
        replace_name(font, name_id, value)

    # Variable-font named instances carry their own PostScript name records.
    # Leaving those untouched would reintroduce the reserved upstream family
    # name when a browser materializes a 500-800 weight instance for PDF output.
    for instance in font["fvar"].instances:
        if instance.postscriptNameID == 0xFFFF:
            continue
        subfamilies = {
            record.toUnicode()
            for record in font["name"].names
            if record.nameID == instance.subfamilyNameID
        }
        if len(subfamilies) != 1:
            raise RuntimeError(
                "Expected one named-instance subfamily for name ID "
                f"{instance.subfamilyNameID}; found {sorted(subfamilies)}"
            )
        suffix = "".join(
            character
            for character in next(iter(subfamilies))
            if character.isalnum()
        )
        replace_name(
            font,
            instance.postscriptNameID,
            f"{POSTSCRIPT_PREFIX}-{suffix}",
        )


def subset_options() -> subset.Options:
    options = subset.Options()
    options.canonical_order = True
    options.glyph_names = True
    options.hinting = True
    options.layout_features = ["*"]
    options.legacy_cmap = True
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.name_legacy = True
    options.notdef_glyph = True
    options.notdef_outline = True
    options.prune_unicode_ranges = True
    options.recalc_average_width = True
    options.recalc_bounds = True
    options.recalc_max_context = True
    options.recalc_timestamp = False
    options.recommended_glyphs = True
    options.symbol_cmap = True
    return options


def layout_feature_tags(font: TTFont, table_tag: str) -> list[str]:
    if table_tag not in font:
        return []
    feature_list = font[table_tag].table.FeatureList
    if feature_list is None:
        return []
    return sorted({record.FeatureTag for record in feature_list.FeatureRecord})


def build_font(
    source: Path, output: Path, style: str, codepoints: set[int]
) -> dict[str, object]:
    font = TTFont(source, recalcTimestamp=False)
    source_metadata = {
        "cmapRecords": sorted(
            {
                (table.platformID, table.platEncID, table.format)
                for table in font["cmap"].tables
            }
        ),
        "created": font["head"].created,
        "expectedCodepoints": set(font.getBestCmap()) & codepoints,
        "layoutFeatures": {
            table_tag: layout_feature_tags(font, table_tag)
            for table_tag in ("GPOS", "GSUB")
        },
        "modified": font["head"].modified,
    }
    actual_axes = {
        axis.axisTag: (axis.minValue, axis.defaultValue, axis.maxValue)
        for axis in font["fvar"].axes
    }
    expected_axes = {
        "wdth": (75.0, 100.0, 125.0),
        "wght": (200.0, 200.0, 900.0),
        "opsz": (0.0, 0.0, 100.0),
    }
    if actual_axes != expected_axes:
        raise RuntimeError(f"Unexpected source axes in {source.name}: {actual_axes}")

    # A three-value limit sets a new in-range default. This is required because
    # the upstream font's historical wght default is 200, outside our 400-800 use.
    font = instantiateVariableFont(
        font,
        {
            "opsz": 20,
            "wdth": (95, 100, 100),
            "wght": (400, 400, 800),
        },
        inplace=False,
        optimize=True,
    )
    font.recalcTimestamp = False
    rename_font(font, style)

    subsetter = subset.Subsetter(options=subset_options())
    subsetter.populate(unicodes=sorted(codepoints))
    subsetter.subset(font)
    font.flavor = "woff2"
    output.parent.mkdir(parents=True, exist_ok=True)
    font.save(output, reorderTables=True)
    return source_metadata


def decoded_names(font: TTFont, name_id: int) -> set[str]:
    result: set[str] = set()
    for record in font["name"].names:
        if record.nameID == name_id:
            result.add(record.toUnicode())
    return result


def validate_output(
    output: Path,
    style: str,
    subset_name: str,
    requested_codepoints: set[int],
    source_metadata: dict[str, object],
) -> dict[str, object]:
    font = TTFont(output, recalcTimestamp=False)
    if font.flavor != "woff2":
        raise RuntimeError(f"{output.name} is not WOFF2")

    axes = {
        axis.axisTag: [axis.minValue, axis.defaultValue, axis.maxValue]
        for axis in font["fvar"].axes
    }
    expected_axes = {"wdth": [95.0, 100.0, 100.0], "wght": [400.0, 400.0, 800.0]}
    if axes != expected_axes:
        raise RuntimeError(f"Unexpected output axes in {output.name}: {axes}")

    expected_subfamily = "Italic" if style == "italic" else "Regular"
    expected_full_name = (
        f"{FAMILY_NAME} Italic" if style == "italic" else FAMILY_NAME
    )
    expected_names = {
        1: {FAMILY_NAME},
        2: {expected_subfamily},
        3: {f"2.027;CVRS;{POSTSCRIPT_PREFIX}-{expected_subfamily}"},
        4: {expected_full_name},
        6: {f"{POSTSCRIPT_PREFIX}-{expected_subfamily}"},
        16: {FAMILY_NAME},
        17: {expected_subfamily},
        25: {POSTSCRIPT_PREFIX},
    }
    for name_id, expected in expected_names.items():
        actual = decoded_names(font, name_id)
        if actual != expected:
            raise RuntimeError(
                f"Unexpected name ID {name_id} in {output.name}: {sorted(actual)}"
            )

    descriptive_name_ids = {0, 7, 8, 9, 10, 11, 12, 13, 14}
    for name_id in {record.nameID for record in font["name"].names}:
        if name_id in descriptive_name_ids:
            continue
        if any("Mona" in value for value in decoded_names(font, name_id)):
            raise RuntimeError(
                "Reserved source family name remains outside descriptive metadata "
                f"in name ID {name_id}: {output.name}"
            )

    for instance in font["fvar"].instances:
        if instance.postscriptNameID == 0xFFFF:
            continue
        postscript_names = decoded_names(font, instance.postscriptNameID)
        if not postscript_names or any(
            not value.startswith(f"{POSTSCRIPT_PREFIX}-")
            for value in postscript_names
        ):
            raise RuntimeError(
                f"Unexpected named-instance PostScript name in {output.name}: "
                f"{sorted(postscript_names)}"
            )

    cmap = set(font.getBestCmap())
    expected_codepoints = source_metadata["expectedCodepoints"]
    if cmap != expected_codepoints:
        missing = expected_codepoints - cmap
        unexpected = cmap - expected_codepoints
        raise RuntimeError(
            f"Unexpected cmap partition in {output.name}; "
            f"missing={','.join(f'U+{value:04X}' for value in sorted(missing)[:8])}; "
            f"unexpected={','.join(f'U+{value:04X}' for value in sorted(unexpected)[:8])}"
        )

    required_tables = {"GDEF", "GPOS", "GSUB", "STAT", "avar", "cmap", "fvar", "gvar"}
    missing_tables = required_tables - set(font.keys())
    if missing_tables:
        raise RuntimeError(
            f"Required OpenType tables missing from {output.name}: {sorted(missing_tables)}"
        )

    cmap_records = sorted(
        {
            (table.platformID, table.platEncID, table.format)
            for table in font["cmap"].tables
        }
    )
    if cmap_records != source_metadata["cmapRecords"]:
        raise RuntimeError(
            f"Cmap records changed in {output.name}: {cmap_records}"
        )

    layout_features = {
        table_tag: layout_feature_tags(font, table_tag)
        for table_tag in ("GPOS", "GSUB")
    }
    required_layout_features = {
        "GPOS": {"kern"},
        "GSUB": {"aalt", "case", "ccmp", "locl"},
    }
    if subset_name == "latin":
        required_layout_features["GPOS"].update({"mark", "mkmk"})
        required_layout_features["GSUB"].update({"liga", "tnum"})
    for table_tag, required in required_layout_features.items():
        actual = set(layout_features[table_tag])
        source = set(source_metadata["layoutFeatures"][table_tag])
        missing = required - actual
        unexpected = actual - source
        if missing or unexpected:
            raise RuntimeError(
                f"Layout features changed unexpectedly in {output.name} {table_tag}; "
                f"missing={sorted(missing)}; not-in-source={sorted(unexpected)}"
            )

    if font.getGlyphOrder()[0] != ".notdef":
        raise RuntimeError(f"{output.name} does not retain .notdef as glyph zero")
    notdef = font["glyf"][".notdef"]
    if notdef.numberOfContours == 0 and not getattr(notdef, "components", None):
        raise RuntimeError(f"{output.name} does not retain the .notdef outline")

    if (
        font["head"].created != source_metadata["created"]
        or font["head"].modified != source_metadata["modified"]
    ):
        raise RuntimeError(f"Source timestamps changed in {output.name}")

    size = output.stat().st_size
    if size > INDIVIDUAL_FONT_BUDGET:
        raise RuntimeError(
            f"{output.name} is {size} bytes; budget is {INDIVIDUAL_FONT_BUDGET}"
        )

    return {
        "axes": axes,
        "bytes": size,
        "codepoints": len(cmap),
        "glyphs": len(font.getGlyphOrder()),
        "layoutFeatures": layout_features,
        "sha256": sha256(output),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--vendor-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    args = parser.parse_args()

    if sys.version_info[:3] != PYTHON_VERSION:
        raise RuntimeError(
            f"Python {'.'.join(map(str, PYTHON_VERSION))} is required; "
            f"found {platform.python_version()}"
        )
    installed_fonttools = importlib.metadata.version("fonttools")
    if installed_fonttools != FONTTOOLS_VERSION:
        raise RuntimeError(
            f"FontTools {FONTTOOLS_VERSION} is required; found {installed_fonttools}"
        )
    installed_brotli = importlib.metadata.version("brotli")
    installed_zopfli = importlib.metadata.version("zopfli")
    if installed_brotli != BROTLI_VERSION or installed_zopfli != ZOPFLI_VERSION:
        raise RuntimeError(
            "Unexpected WOFF2 compression environment: "
            f"Brotli {installed_brotli}, Zopfli {installed_zopfli}"
        )

    source_paths: dict[str, Path] = {}
    for style, source in SOURCE_FILES.items():
        source_path = args.vendor_dir / source["filename"]
        if not source_path.is_file():
            raise RuntimeError(f"Missing vendored source: {source_path}")
        actual_hash = sha256(source_path)
        if actual_hash != source["sha256"]:
            raise RuntimeError(
                f"Vendored source hash mismatch for {source_path.name}: {actual_hash}"
            )
        source_paths[style] = source_path

    license_path = args.vendor_dir / "OFL.txt"
    license_hash = sha256(license_path)
    if license_hash != "9261dcb61fb5e3c587d50d7a9fdae12bc7422d8822d7ac06b8f34550479575de":
        raise RuntimeError(f"Vendored OFL hash mismatch: {license_hash}")

    latin_codepoints = parse_unicode_range(LATIN_RANGE)
    declared_latin_ext_codepoints = parse_unicode_range(LATIN_EXT_DECLARED_RANGE)
    latin_ext_codepoints = parse_unicode_range(LATIN_EXT_RANGE)
    declared_overlap = latin_codepoints & declared_latin_ext_codepoints
    expected_declared_overlap = {
        0x0131,
        0x0152,
        0x0153,
        0x0304,
        0x0308,
        0x0329,
        0x2020,
    }
    if declared_overlap != expected_declared_overlap:
        raise RuntimeError(
            "Declared subset overlap changed: "
            f"{','.join(f'U+{value:04X}' for value in sorted(declared_overlap))}"
        )
    if latin_ext_codepoints != declared_latin_ext_codepoints - latin_codepoints:
        raise RuntimeError(
            "Effective Latin-ext range must equal the declared range minus Latin"
        )
    overlap = latin_codepoints & latin_ext_codepoints
    if overlap:
        raise RuntimeError(f"Font subset Unicode ranges overlap: {sorted(overlap)}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    results: dict[str, object] = {}
    for style, subset_name, unicode_range, filename in OUTPUTS:
        codepoints = (
            latin_codepoints if subset_name == "latin" else latin_ext_codepoints
        )
        output = args.output_dir / filename
        source_metadata = build_font(source_paths[style], output, style, codepoints)
        result = validate_output(
            output, style, subset_name, codepoints, source_metadata
        )
        result.update(
            {
                "filename": filename,
                "style": style,
                "subset": subset_name,
                "unicodeRange": unicode_range,
            }
        )
        results[filename] = result

    initial_size = int(results["cv-resume-sans-latin-normal.woff2"]["bytes"])
    total_size = sum(int(result["bytes"]) for result in results.values())
    if initial_size > INITIAL_FONT_BUDGET:
        raise RuntimeError(
            f"Initial normal Latin font is {initial_size} bytes; "
            f"budget is {INITIAL_FONT_BUDGET}"
        )
    if total_size > TOTAL_FONT_BUDGET:
        raise RuntimeError(
            f"Font output total is {total_size} bytes; budget is {TOTAL_FONT_BUDGET}"
        )

    manifest = {
        "family": FAMILY_NAME,
        "brotliVersion": installed_brotli,
        "fontToolsVersion": installed_fonttools,
        "declaredUnicodeRanges": {
            "latin": LATIN_RANGE,
            "latinExt": LATIN_EXT_DECLARED_RANGE,
        },
        "overlapAssignment": {
            "codepoints": [
                f"U+{value:04X}" for value in sorted(expected_declared_overlap)
            ],
            "owner": "latin",
        },
        "outputs": results,
        "pythonVersion": platform.python_version(),
        "sourceArchiveSha256": SOURCE_ARCHIVE_SHA256,
        "sourceVersion": SOURCE_VERSION,
        "totals": {
            "initialBytes": initial_size,
            "initialBudgetBytes": INITIAL_FONT_BUDGET,
            "individualBudgetBytes": INDIVIDUAL_FONT_BUDGET,
            "totalBudgetBytes": TOTAL_FONT_BUDGET,
            "totalBytes": total_size,
        },
        "zopfliVersion": installed_zopfli,
    }
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
