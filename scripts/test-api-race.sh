set -eu

shards=${1:-6}
filter=${2:-.}
package=./internal/api/http
timeout=45m

case "$shards" in
  ''|*[!0-9]*|0) echo "shards must be a positive number" >&2; exit 2 ;;
esac

here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

started=$(date +%s)

go test -c -race -o "$work/http.race.test" "$package"
echo "compiled in $(($(date +%s) - started)) s"

(cd "$package" && "$work/http.race.test" -test.list "$filter") \
  | grep -E '^(Test|Example|Fuzz)' | sort -u > "$work/all"

total=$(wc -l < "$work/all" | tr -d ' ')
[ "$total" -gt 0 ] || { echo "no tests match $filter" >&2; exit 1; }

sh "$here/split-test-names.sh" "$shards" "$work/names" < "$work/all"

n=1
while [ "$n" -le "$shards" ]; do
  names="$work/names/shard-$n"
  if [ -s "$names" ]; then
    pattern="^($(paste -sd'|' "$names"))\$"
    (
      cd "$package"
      code=0
      "$work/http.race.test" -test.v -test.count=1 -test.timeout="$timeout" -test.run "$pattern" \
        > "$work/out-$n" 2>&1 || code=$?
      echo "$code" > "$work/code-$n"
    ) &
  else
    echo 0 > "$work/code-$n"
  fi
  n=$((n + 1))
done
wait

status=0
n=1
while [ "$n" -le "$shards" ]; do
  code=$(cat "$work/code-$n")
  count=$(wc -l < "$work/names/shard-$n" | tr -d ' ')
  echo "shard $n: $count tests, exit $code"
  [ "$code" -eq 0 ] || status=1
  n=$((n + 1))
done

cat "$work"/names/shard-* | sort > "$work/union"
if ! cmp -s "$work/all" "$work/union"; then
  echo "tests missing from or repeated across the shards:" >&2
  diff "$work/all" "$work/union" >&2 || true
  status=1
fi

cat "$work"/out-* 2>/dev/null | grep -E '^--- FAIL: ' | sed 's/^--- FAIL: \([^ ]*\).*/\1/' | sort > "$work/failed" || true
if [ -s "$work/failed" ]; then
  echo "failed tests:"
  sed 's/^/  /' "$work/failed"
fi

if cat "$work"/out-* 2>/dev/null | grep -qE '^panic: test timed out'; then
  echo "a shard hit the $timeout timeout"
fi

ran=$(cat "$work"/out-* 2>/dev/null | grep -cE '^--- (PASS|FAIL|SKIP): ' || true)
echo "$total tests listed, $ran ran, $(($(date +%s) - started)) s"

if [ "$status" -ne 0 ]; then
  echo "FAIL"
  exit 1
fi
echo "PASS"
