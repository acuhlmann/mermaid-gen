#!/usr/bin/env python3
"""One-shot Artifact Registry prune for mermaid-gen images.

Keeps:
  - digests referenced by recent Cloud Run revisions (passed via --keep-digest)
  - the N most recently updated images per package
  - anything tagged latest
Deletes the rest via `gcloud artifacts docker images delete`.

Prefer the repo cleanup policy (scripts/artifact-registry-cleanup-policy.json)
for ongoing retention. Use this script only for immediate bulk deletes.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

GCLOUD = shutil.which("gcloud") or shutil.which("gcloud.cmd")
if not GCLOUD:
    raise SystemExit("gcloud not found on PATH")


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, check=check, text=True, capture_output=True)


def list_images(image_path: str) -> list[dict]:
    cp = run(
        [
            GCLOUD,
            "artifacts",
            "docker",
            "images",
            "list",
            image_path,
            "--include-tags",
            "--format=json",
        ]
    )
    return json.loads(cp.stdout or "[]")


def normalize_digest(value: str) -> str:
    return value if value.startswith("sha256:") else f"sha256:{value}"


def parse_ts(img: dict) -> datetime:
    raw = img.get("updateTime") or img.get("createTime") or "1970-01-01T00:00:00Z"
    return datetime.fromisoformat(raw.replace("Z", "+00:00"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--image",
        action="append",
        default=[],
        help="Image path to prune (repeatable). Default: web-main in PROJECT/REGION/AR_REPO.",
    )
    parser.add_argument("--project", default="mermaidgen")
    parser.add_argument("--region", default="us-central1")
    parser.add_argument("--ar-repo", default="mermaid-gen")
    parser.add_argument("--images-json", help="Optional pre-fetched images JSON (skips list).")
    parser.add_argument("--keep-count", type=int, default=10)
    parser.add_argument(
        "--keep-digest",
        action="append",
        default=[],
        help="Digest to keep (sha256:...). Repeatable.",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0, help="Max deletes (0=all)")
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()

    if args.images_json:
        with open(args.images_json, encoding="utf-8-sig") as f:
            images = json.load(f)
    else:
        paths = args.image or [
            f"{args.region}-docker.pkg.dev/{args.project}/{args.ar_repo}/web-main",
        ]
        images = []
        for path in paths:
            images.extend(list_images(path))

    keep: set[str] = {normalize_digest(d) for d in args.keep_digest}

    newest = sorted(images, key=parse_ts, reverse=True)[: args.keep_count]
    for img in newest:
        keep.add(normalize_digest(img["version"]))

    for img in images:
        tags = img.get("tags") or []
        if "latest" in tags:
            keep.add(normalize_digest(img["version"]))

    to_delete: list[tuple[str, str]] = []
    for img in images:
        digest = normalize_digest(img["version"])
        if digest not in keep:
            to_delete.append((img["package"], digest))

    to_delete.sort(key=lambda x: x[1])
    if args.limit:
        to_delete = to_delete[: args.limit]

    print(f"total={len(images)} keep={len(keep)} delete={len(to_delete)} dry_run={args.dry_run}")
    for d in sorted(keep):
        print(f"KEEP {d}")

    if args.dry_run:
        for package, digest in to_delete:
            print(f"DRY-RUN delete {package}@{digest}")
        print("done failed=0")
        return 0

    failed = 0
    done = 0

    def delete_one(item: tuple[str, str]) -> tuple[str, int, str]:
        package, digest = item
        ref = f"{package}@{digest}"
        cp = run(
            [
                GCLOUD,
                "artifacts",
                "docker",
                "images",
                "delete",
                ref,
                "--quiet",
                "--delete-tags",
            ],
            check=False,
        )
        err = (cp.stderr or cp.stdout or "").strip().splitlines()
        return digest, cp.returncode, (err[-1] if err else "")

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(delete_one, item) for item in to_delete]
        for fut in as_completed(futures):
            digest, code, err = fut.result()
            done += 1
            if code != 0:
                failed += 1
                print(f"[{done}/{len(to_delete)}] FAIL {digest[:19]}... {err}", file=sys.stderr)
            elif done % 25 == 0 or done == len(to_delete):
                print(f"[{done}/{len(to_delete)}] ok")

    print(f"done failed={failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
