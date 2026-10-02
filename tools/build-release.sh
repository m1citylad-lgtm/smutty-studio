#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SLUG="smutty-bear-studio"
BASE_URL="${1:-${SBS_UPDATE_BASE_URL:-}}"
OUT="$ROOT/build/release"
MAIN="$ROOT/smutty-bear-studio.php"

fail() { printf 'error: %s\n' "$*" >&2; exit 1; }
command -v git >/dev/null || fail "git is required"
command -v python3 >/dev/null || fail "python3 is required"
[[ "$BASE_URL" =~ ^https://[^/]+(/.*)?$ ]] || fail "provide an HTTPS update base URL"
BASE_URL="${BASE_URL%/}"

HEADER_VERSION="$(sed -n 's/^ \* Version: \([0-9A-Za-z.+-]*\)$/\1/p' "$MAIN")"
CONST_VERSION="$(sed -n "s/^define('SBS_VERSION', '\([^']*\)');$/\1/p" "$MAIN")"
[[ -n "$HEADER_VERSION" && "$HEADER_VERSION" == "$CONST_VERSION" ]] || fail "plugin version declarations do not match"
[[ "$HEADER_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-+][A-Za-z0-9.-]+)?$ ]] || fail "plugin version is not valid semver"

if [[ "${SBS_ALLOW_DIRTY:-0}" != "1" ]] && [[ -n "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]]; then
  fail "tracked files are dirty; commit the release first"
fi

rm -rf "$OUT"
mkdir -p "$OUT/stage/$SLUG"

while IFS= read -r -d '' file; do
  case "$file" in
    .github/*|tools/*|build/*|.gitignore|README.md) continue ;;
  esac
  mkdir -p "$OUT/stage/$SLUG/$(dirname "$file")"
  cp "$ROOT/$file" "$OUT/stage/$SLUG/$file"
done < <(git -C "$ROOT" ls-files -z)

python3 - "$OUT/stage/$SLUG" "$HEADER_VERSION" <<'PY'
import hashlib, json, pathlib, sys
root, version = pathlib.Path(sys.argv[1]), sys.argv[2]
files = {}
for path in sorted(p for p in root.rglob('*') if p.is_file()):
    files[path.relative_to(root).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
manifest = {
    'slug': 'smutty-bear-studio', 'version': version,
    'requires_wp': '5.8.17', 'requires_php': '7.4', 'files': files,
}
(root / 'release.json').write_text(json.dumps(manifest, separators=(',', ':'), sort_keys=True), encoding='utf-8')
PY

PACKAGE="$SLUG-$HEADER_VERSION.zip"
(cd "$OUT/stage" && python3 - "$SLUG" "$OUT/$PACKAGE" <<'PY'
import pathlib, sys, zipfile
root, output = pathlib.Path(sys.argv[1]), sys.argv[2]
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(p for p in root.rglob('*') if p.is_file()):
        archive.write(path, path.as_posix())
PY
)

PACKAGE_SHA="$(python3 - "$OUT/$PACKAGE" <<'PY'
import hashlib, pathlib, sys
print(hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest())
PY
)"
python3 - "$OUT/release-feed.json" "$HEADER_VERSION" "$BASE_URL/$PACKAGE" "$PACKAGE_SHA" <<'PY'
import json, pathlib, sys
out, version, url, checksum = sys.argv[1:]
record = {'slug':'smutty-bear-studio','version':version,'package_url':url,
          'package_sha256':checksum,'requires_wp':'5.8.17','requires_php':'7.4'}
pathlib.Path(out).write_text(json.dumps(record, separators=(',', ':'), sort_keys=True), encoding='utf-8')
PY
rm -rf "$OUT/stage"
printf 'Built %s and release-feed.json in %s\n' "$PACKAGE" "$OUT"
