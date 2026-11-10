set -eu

branch=$(git -C "$(dirname "$0")" rev-parse --abbrev-ref HEAD)

if [ "$branch" != "master" ]; then
  echo "deploy refused: this checkout is on '$branch'; only master deploys" >&2
  exit 1
fi
