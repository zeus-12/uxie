#!/usr/bin/env bash
# Cut a release with a single version input:
#   pnpm release 0.1.1
# Bumps apps/desktop/package.json, commits, tags v0.1.1, and pushes branch + tag.
# Pushing the tag is what triggers the GitHub Actions release build.
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "usage: pnpm release <version>   e.g. pnpm release 0.1.1" >&2
  exit 1
fi

v="${1#v}"   # accept either 0.1.1 or v0.1.1
tag="v$v"

branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$branch" != "main" ]; then
  echo "releases must be cut from main (you are on '$branch')" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "working tree not clean — commit or stash first" >&2
  exit 1
fi

(cd apps/desktop && npm version "$v" --no-git-tag-version)
git commit -am "release $tag"
git tag "$tag"
git push
git push origin "$tag"

echo "pushed $tag — watch the build in the Actions tab"
