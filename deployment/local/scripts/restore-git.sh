set -eu

backup_dir=${1:?usage: restore-git.sh BACKUP_GIT_DIR TARGET_DIR}
target_dir=${2:?usage: restore-git.sh BACKUP_GIT_DIR TARGET_DIR}

[ -d "$backup_dir" ] || { echo "git backup not found: $backup_dir" >&2; exit 1; }
mkdir -p "$target_dir"

count=0
list=$(mktemp)
trap 'rm -f "$list"' EXIT
find "$backup_dir" -type f -name '*.db' | sort > "$list"

while IFS= read -r file; do
  relative=${file#"$backup_dir"/}
  target="$target_dir/$relative"
  mkdir -p "$(dirname "$target")"
  cp "$file" "$target.restoring" || { rm -f "$target.restoring"; echo "restore failed for $relative" >&2; exit 1; }
  rm -f "$target-wal" "$target-shm"
  mv "$target.restoring" "$target"
  count=$((count + 1))
done < "$list"

echo "git restore done: $count files into $target_dir"
