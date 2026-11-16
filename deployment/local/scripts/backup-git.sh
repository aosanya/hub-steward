set -eu

source_dir=${1:?usage: backup-git.sh SOURCE_DIR BACKUP_DIR STAMP}
backup_dir=${2:?usage: backup-git.sh SOURCE_DIR BACKUP_DIR STAMP}
stamp=${3:?usage: backup-git.sh SOURCE_DIR BACKUP_DIR STAMP}

[ -d "$source_dir" ] || { echo "git folder not found: $source_dir" >&2; exit 1; }
command -v sqlite3 >/dev/null || { echo "sqlite3 is not installed" >&2; exit 1; }

final="$backup_dir/hubsteward-$stamp-git"
partial="$final.partial"
rm -rf "$partial"
mkdir -p "$partial"
chmod 700 "$partial"

count=0
list=$(mktemp)
trap 'rm -f "$list"' EXIT
find "$source_dir" -type f -name '*.db' | sort > "$list"

while IFS= read -r file; do
  relative=${file#"$source_dir"/}
  target="$partial/$relative"
  mkdir -p "$(dirname "$target")"
  if ! sqlite3 -cmd '.timeout 30000' "$file" ".backup '$target'"; then
    echo "git backup failed for $file" >&2
    rm -rf "$partial"
    exit 1
  fi
  check=$(sqlite3 "$target" 'PRAGMA quick_check;') || check=failed
  if [ "$check" != "ok" ]; then
    echo "git backup of $file did not pass the check: $check" >&2
    rm -rf "$partial"
    exit 1
  fi
  count=$((count + 1))
done < "$list"

rm -rf "$final"
mv "$partial" "$final"
echo "git backup written: $final ($count files)"
