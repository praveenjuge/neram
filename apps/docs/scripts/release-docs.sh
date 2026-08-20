#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ "$#" -ne 1 ]; then
  echo "usage: release:docs <version-id>  (e.g. v0.2.0)" >&2
  echo "freezes the current docs as an archived version aligned to a neram CLI release" >&2
  exit 1
fi

VERSION_ID="$1"
npx blume version "$VERSION_ID"
echo ""
echo "Docs frozen at /$VERSION_ID."
echo "Review the snapshot, then commit alongside the neram release."
