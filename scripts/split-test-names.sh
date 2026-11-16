set -eu

shards=${1:?usage: split-test-names.sh SHARDS OUTDIR < names}
outdir=${2:?usage: split-test-names.sh SHARDS OUTDIR < names}

case "$shards" in
  ''|*[!0-9]*|0) echo "shards must be a positive number" >&2; exit 2 ;;
esac

mkdir -p "$outdir"
n=1
while [ "$n" -le "$shards" ]; do
  : > "$outdir/shard-$n"
  n=$((n + 1))
done

awk -v shards="$shards" -v outdir="$outdir" '
  NF { print $0 >> (outdir "/shard-" (((++count - 1) % shards) + 1)) }
'
