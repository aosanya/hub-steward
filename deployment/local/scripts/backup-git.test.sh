set -eu

here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
writer_pid=

cleanup() {
  if [ -n "$writer_pid" ]; then
    kill "$writer_pid" 2>/dev/null || true
    wait "$writer_pid" 2>/dev/null || true
  fi
  rm -rf "$work"
}
trap cleanup EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }

rows() { sqlite3 "$1" 'SELECT count(*) FROM commits;'; }

make_db() {
  mkdir -p "$(dirname "$1")"
  sqlite3 "$1" "PRAGMA journal_mode=WAL; CREATE TABLE commits (id INTEGER PRIMARY KEY, body BLOB);" >/dev/null
  sqlite3 "$1" "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i < $2) INSERT INTO commits(body) SELECT randomblob(2000) FROM n;"
}

source_dir="$work/git-repositories"
backups="$work/backups"
mkdir -p "$backups"
make_db "$source_dir/agyone/first.db" 20000
make_db "$source_dir/agytwo/second.db" 5000

(
  while :; do
    sqlite3 -cmd '.timeout 30000' "$source_dir/agyone/first.db" "INSERT INTO commits(body) VALUES (randomblob(2000));" || true
  done
) >/dev/null 2>&1 &
writer_pid=$!

sleep 0.5
before_one=$(rows "$source_dir/agyone/first.db")
before_two=$(rows "$source_dir/agytwo/second.db")

out=$(sh "$here/backup-git.sh" "$source_dir" "$backups" 20261116-120000) || fail "backup of a healthy folder failed"
printf '%s\n' "$out" | grep -q '(2 files)' || fail "backup did not report two files: $out"

kill "$writer_pid" 2>/dev/null || true
wait "$writer_pid" 2>/dev/null || true
writer_pid=

copy="$backups/hubsteward-20261116-120000-git"
[ -f "$copy/agyone/first.db" ] || fail "first file not copied under its agency folder"
[ -f "$copy/agytwo/second.db" ] || fail "second file not copied under its agency folder"
[ ! -e "$copy.partial" ] || fail "partial folder left behind"
[ "$(sqlite3 "$copy/agyone/first.db" 'PRAGMA quick_check;')" = "ok" ] || fail "first copy does not pass the check"
[ "$(sqlite3 "$copy/agytwo/second.db" 'PRAGMA quick_check;')" = "ok" ] || fail "second copy does not pass the check"
[ "$(rows "$copy/agyone/first.db")" -ge "$before_one" ] || fail "first copy lost rows written before the backup"
[ "$(rows "$copy/agytwo/second.db")" -eq "$before_two" ] || fail "second copy has the wrong row count"

target="$work/restored"
mkdir -p "$target/agyone"
echo stale > "$target/agyone/first.db-wal"
echo stale > "$target/agyone/first.db-shm"
sh "$here/restore-git.sh" "$copy" "$target" >/dev/null || fail "restore failed"
[ ! -e "$target/agyone/first.db-wal" ] || fail "stale wal file survived the restore"
[ ! -e "$target/agyone/first.db-shm" ] || fail "stale shm file survived the restore"
[ "$(rows "$target/agyone/first.db")" -eq "$(rows "$copy/agyone/first.db")" ] || fail "restored first file differs from the copy"
[ "$(rows "$target/agytwo/second.db")" -eq "$before_two" ] || fail "restored second file differs from the copy"

printf 'this is not a database file at all, it is just text that sqlite will refuse to read' > "$source_dir/agytwo/broken.db"
if sh "$here/backup-git.sh" "$source_dir" "$backups" 20261116-130000 >/dev/null 2>&1; then
  fail "backup succeeded although one file is not a database"
fi
[ ! -e "$backups/hubsteward-20261116-130000-git" ] || fail "a failed backup left a finished folder"
[ ! -e "$backups/hubsteward-20261116-130000-git.partial" ] || fail "a failed backup left a partial folder"
[ -d "$copy" ] || fail "an earlier backup was touched by a failed one"

if sh "$here/backup-git.sh" "$work/nowhere" "$backups" 20261116-140000 >/dev/null 2>&1; then
  fail "backup succeeded with a missing git folder"
fi

if sh "$here/restore-git.sh" "$work/nowhere" "$target" >/dev/null 2>&1; then
  fail "restore succeeded with a missing backup"
fi

echo "backup-git tests passed"
