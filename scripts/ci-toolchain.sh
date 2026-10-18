#!/usr/bin/env bash
# ci-toolchain.sh — install the build toolchain WITHOUT touching package.json deps.
#
# Why this exists: `npm install` in this repo cannot work, and that is not a bug we
# are allowed to paper over. package.json declares
#
#     "@quilt/core": "workspace:*", "@quilt/ai": "workspace:*", "@quilt/evolve": "workspace:*"
#
# and quilt-claw is a standalone repo with no workspace root to resolve them against,
# so npm fails hard:
#
#     npm error code EUNSUPPORTEDPROTOCOL
#     npm error Unsupported URL Type "workspace:": workspace:*
#
# The root @quilt/core is declared by NO repository and 404s on npm. Whether the
# scope belongs to a private registry, a monorepo, or something else is the HOUSE's
# decision, not this repo's. So we do not resolve it here.
#
# What we DO need for CI is just typescript + @types/node, both of which are already
# declared in devDependencies and are installable standalone. So we build the
# toolchain in an isolated prefix and drop it into ./node_modules, leaving the
# unresolvable workspace deps untouched and un-faked.
#
# Zero network calls beyond the registry that serves typescript itself.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS_DIR="${TOOLS_DIR:-${RUNNER_TEMP:-/tmp}/qc-toolchain}"

echo "==> repo:        $REPO_ROOT"
echo "==> toolchain:   $TOOLS_DIR"

rm -rf "$TOOLS_DIR"
mkdir -p "$TOOLS_DIR"
cd "$TOOLS_DIR"

cat > package.json <<'JSON'
{
  "name": "quilt-claw-toolchain",
  "private": true,
  "version": "0.0.0",
  "description": "Isolated build toolchain. Deliberately does NOT declare the workspace:* deps."
}
JSON

echo "==> installing typescript + @types/node (standalone; workspace:* deps are NOT resolvable)"
npm install --no-audit --no-fund --loglevel=error \
  "typescript@^5.0.0" \
  "@types/node@^20.0.0"

mkdir -p "$REPO_ROOT/node_modules"
# NOTE: a real directory, not a symlink. The repo's .gitignore has `node_modules/`
# with a trailing slash, which matches directories but NOT symlinks — a symlinked
# node_modules shows up as an untracked file in git status. A real dir stays ignored.
cp -a "$TOOLS_DIR/node_modules/." "$REPO_ROOT/node_modules/"

cd "$REPO_ROOT"
echo "==> tsc: $("$REPO_ROOT/node_modules/.bin/tsc" --version)"
echo "==> toolchain ready; package.json dependencies left untouched"
