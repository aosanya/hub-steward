set -eu

here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }

printf 'TestA\nTestB\nTestC\nTestD\nTestE\nTestF\nTestG\nTestH\nTestI\nTestJ\n' > "$work/ten"
sort "$work/ten" > "$work/ten.sorted"

sh "$here/split-test-names.sh" 3 "$work/three" < "$work/ten"

[ -f "$work/three/shard-1" ] || fail "shard 1 missing"
[ -f "$work/three/shard-2" ] || fail "shard 2 missing"
[ -f "$work/three/shard-3" ] || fail "shard 3 missing"
[ ! -e "$work/three/shard-4" ] || fail "a fourth shard appeared"

cat "$work"/three/shard-* | sort > "$work/three.union"
cmp -s "$work/ten.sorted" "$work/three.union" || fail "the union of three shards is not the list"

[ "$(wc -l < "$work/three.union" | tr -d ' ')" -eq 10 ] || fail "a name was lost or repeated"
[ "$(sort -u "$work/three.union" | wc -l | tr -d ' ')" -eq 10 ] || fail "a name appears twice"

sizes=$(for f in "$work"/three/shard-*; do wc -l < "$f" | tr -d ' '; done | sort -n | tr '\n' ' ')
[ "$sizes" = "3 3 4 " ] || fail "shards are not balanced: $sizes"

sh "$here/split-test-names.sh" 12 "$work/twelve" < "$work/ten"
cat "$work"/twelve/shard-* | sort > "$work/twelve.union"
cmp -s "$work/ten.sorted" "$work/twelve.union" || fail "the union of twelve shards is not the list"
[ -f "$work/twelve/shard-11" ] || fail "empty shard 11 was not made"
[ -f "$work/twelve/shard-12" ] || fail "empty shard 12 was not made"
[ ! -s "$work/twelve/shard-11" ] || fail "shard 11 should be empty"
[ ! -s "$work/twelve/shard-12" ] || fail "shard 12 should be empty"

sh "$here/split-test-names.sh" 1 "$work/one" < "$work/ten"
cmp -s "$work/ten" "$work/one/shard-1" || fail "one shard should hold the whole list in order"

: > "$work/none"
sh "$here/split-test-names.sh" 3 "$work/nothing" < "$work/none"
for f in "$work"/nothing/shard-*; do
  [ ! -s "$f" ] || fail "an empty list produced a name"
done

if sh "$here/split-test-names.sh" 0 "$work/zero" < "$work/ten" >/dev/null 2>&1; then fail "zero shards was accepted"; fi
if sh "$here/split-test-names.sh" x "$work/bad" < "$work/ten" >/dev/null 2>&1; then fail "a non-number of shards was accepted"; fi

echo "split-test-names: ok"
