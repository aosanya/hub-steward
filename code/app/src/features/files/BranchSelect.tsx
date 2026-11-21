import type { Branch } from "./api";

type Props = { branches: Branch[]; value: string; onChange: (id: string) => void };

const defaultFirst = (branches: Branch[]) => [...branches].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));

export function BranchSelect({ branches, value, onChange }: Props) {
  if (branches.length === 0) return null;
  return (
    <div className="wf-branch">
      <select aria-label="Branch" value={value} onChange={(event) => onChange(event.target.value)}>
        {defaultFirst(branches).map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </div>
  );
}
