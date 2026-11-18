#!/usr/bin/env python3
"""Fail closed before uploading any public Pages artifact.

IMPORTANT: This CI check is a secondary guard only. Files committed to a public
repository are already public even when the workflow subsequently fails.
Never commit raw/protected source data or credentials to this repository.
"""
from __future__ import annotations
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
SITE = ROOT / "docs"

DISALLOWED_SUFFIXES = {
    ".csv", ".tsv", ".sqlite", ".sqlite3", ".db",
    ".parquet", ".feather", ".arrow", ".xls", ".xlsx",
    ".zip", ".gz", ".7z", ".pdf", ".pem", ".key", ".p12",
    ".env", ".bin", ".db3", ".pfx"
}
# Source code, manifest, and supported web assets only.
WEB_SUFFIXES = {".html", ".css", ".js", ".json", ".svg", ".png", ".jpg", ".webp", ".ico"}
EXPECTED_SITE_FILES = {
    "index.html", ".nojekyll",
    "assets/style.css", "assets/app.js", "assets/public-manifest.json"
}
SENSITIVE = [
    re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"),
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
]
problems = []
files = subprocess.check_output(["git", "-C", str(ROOT), "ls-files"], text=True).splitlines()
for rel in files:
    if not (rel in {"README.md", ".gitignore"} or rel.startswith(("docs/", "scripts/", ".github/workflows/"))):
        problems.append(f"Unapproved path in public Git: {rel}")
    if pathlib.PurePosixPath(rel).suffix.lower() in DISALLOWED_SUFFIXES:
        problems.append(f"Forbidden artifact tracked in public Git: {rel}")
    if rel.startswith(("data/", "private/", "protected/", "exports/")):
        problems.append(f"Private dataset folder tracked in public Git: {rel}")

for p in SITE.rglob("*"):
    if not p.is_file():
        continue
    rel = p.relative_to(SITE).as_posix()
    if p.stat().st_size > 150_000:
        problems.append(f"Public file unexpectedly large: {rel}")
    if rel != ".nojekyll" and p.suffix.lower() not in WEB_SUFFIXES:
        problems.append(f"Unknown public artifact type: {rel}")
    if p.suffix.lower() in {".js", ".html", ".css", ".json"}:
        content = p.read_text(encoding="utf-8")
        for token in SENSITIVE:
            if token.search(content):
                problems.append(f"Credential-like token in published file: {rel}")

actual = {p.relative_to(SITE).as_posix() for p in SITE.rglob("*") if p.is_file()}
if actual != EXPECTED_SITE_FILES:
    problems.append(f"Unexpected/missing public files: {sorted(actual ^ EXPECTED_SITE_FILES)}")

manifest_path = SITE / "assets/public-manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
expected = {
    "type", "fiscal_year", "procedure_code_count",
    "secondary_area_count", "data_policy",
    "includes_protected_data", "details_api_enabled",
    "source_description"
}
if set(manifest) != expected:
    problems.append("Public manifest contains unknown fields or lacks expected fields")
if manifest.get("includes_protected_data") is not False:
    problems.append("A protected data field was enabled in the public manifest")
if manifest.get("details_api_enabled") is not False:
    problems.append("Public site must not claim protected API is online")
if manifest.get("procedure_code_count") != 9275 or manifest.get("secondary_area_count") != 330:
    problems.append("Published overview counts differ from approved initial release")

html = (SITE / "index.html").read_text(encoding="utf-8")
if not re.search(r'<script src="\./assets/app\.js(?:\?v=[0-9.]+)?" defer></script>', html):
    problems.append("Missing external JS reference")
if not re.search(r'<link rel="stylesheet" href="\./assets/style\.css(?:\?v=[0-9.]+)?">', html):
    problems.append("Missing external CSS reference")
if not (SITE / "assets/app.js").is_file():
    problems.append("Missing JS asset")

if problems:
    raise SystemExit("\n".join(["PUBLIC RELEASE BLOCKED:"] + problems))
print(f"PUBLIC RELEASE CHECK PASS: {len(files)} tracked files; {len(actual)} approved web assets; no detailed data or secrets included")
