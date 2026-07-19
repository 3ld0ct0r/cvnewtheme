#!/usr/bin/env python3
"""Verify the pinned Mona Sans release archive and vendor only approved inputs."""

from __future__ import annotations

import argparse
import hashlib
import os
import platform
import shutil
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path
from typing import Final


PYTHON_VERSION: Final = (3, 14, 6)
VERSION: Final = "2.0.27"
ARCHIVE_NAME: Final = f"mona-sans-variable-v{VERSION}.zip"
ARCHIVE_URL: Final = (
    f"https://github.com/github/mona-sans/releases/download/v{VERSION}/{ARCHIVE_NAME}"
)
ARCHIVE_SHA256: Final = (
    "a95127550b2957ff84cd636d4532b227ddc33d3485082437fa27816ef1d066ec"
)
MEMBERS: Final = {
    "fonts/variable/MonaSansVF[wdth,opsz,wght].ttf": (
        "MonaSansVF[wdth,opsz,wght].ttf",
        "9d96bf1303b964cc9101ea2419de780204cb6ace16375b017b66d1fe98a3a435",
    ),
    "fonts/variable/MonaSansVF-Italic[wdth,opsz,wght].ttf": (
        "MonaSansVF-Italic[wdth,opsz,wght].ttf",
        "a22a930591bff52f624a86e24f3172c51bb4c4b7fd252b07d170cdb163c4dea8",
    ),
    "OFL.txt": (
        "OFL.txt",
        "9261dcb61fb5e3c587d50d7a9fdae12bc7422d8822d7ac06b8f34550479575de",
    ),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_and_extract(archive: Path, destination: Path) -> None:
    actual_archive_hash = sha256(archive)
    if actual_archive_hash != ARCHIVE_SHA256:
        raise RuntimeError(
            f"Archive SHA-256 mismatch: expected {ARCHIVE_SHA256}, "
            f"found {actual_archive_hash}"
        )

    with zipfile.ZipFile(archive) as source:
        archive_names = source.namelist()
        for member, (filename, expected_hash) in MEMBERS.items():
            if archive_names.count(member) != 1:
                raise RuntimeError(
                    f"Expected exactly one {member!r} in {ARCHIVE_NAME}"
                )
            contents = source.read(member)
            actual_hash = hashlib.sha256(contents).hexdigest()
            if actual_hash != expected_hash:
                raise RuntimeError(
                    f"Extracted SHA-256 mismatch for {member}: expected "
                    f"{expected_hash}, found {actual_hash}"
                )
            (destination / filename).write_bytes(contents)


def replace_vendor_directory(staged: Path, target: Path) -> None:
    backup = target.with_name(f"{target.name}.backup-{os.getpid()}")
    if backup.exists():
        shutil.rmtree(backup)
    had_target = target.exists()
    if had_target:
        os.replace(target, backup)
    try:
        os.replace(staged, target)
    except BaseException:
        if had_target:
            os.replace(backup, target)
        raise
    if had_target:
        shutil.rmtree(backup)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--archive",
        type=Path,
        help="Verify a local archive instead of downloading the pinned release asset.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify archive and extracted hashes without replacing vendored files.",
    )
    args = parser.parse_args()

    if sys.version_info[:3] != PYTHON_VERSION:
        raise RuntimeError(
            f"Python {'.'.join(map(str, PYTHON_VERSION))} is required; "
            f"found {platform.python_version()}"
        )

    project_root = Path(__file__).resolve().parent.parent
    vendor_target = project_root / "assets/vendor/mona-sans-v2.0.27"
    vendor_parent = vendor_target.parent
    vendor_parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(
        prefix="mona-sans-v2.0.27-", dir=vendor_parent
    ) as temporary:
        temporary_root = Path(temporary)
        archive = args.archive.resolve() if args.archive else temporary_root / ARCHIVE_NAME
        if not args.archive:
            request = urllib.request.Request(
                ARCHIVE_URL, headers={"User-Agent": "cvnewtheme-font-vendor/1"}
            )
            with urllib.request.urlopen(request) as response, archive.open("wb") as output:
                shutil.copyfileobj(response, output)

        staged = temporary_root / "vendored"
        staged.mkdir()
        verify_and_extract(archive, staged)

        if args.check:
            print(
                f"Verified {ARCHIVE_NAME} ({ARCHIVE_SHA256}) and "
                f"{len(MEMBERS)} approved extracted files."
            )
            return

        replace_vendor_directory(staged, vendor_target)
        print(
            f"Vendored {len(MEMBERS)} verified Mona Sans {VERSION} inputs from "
            f"{ARCHIVE_URL}."
        )


if __name__ == "__main__":
    main()
