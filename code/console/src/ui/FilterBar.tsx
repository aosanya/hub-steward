import { Chip } from "./Chip";
import { FilterChip } from "./FilterChip";
import type { FilterBarProps } from "./props";
import { SearchField } from "./SearchField";
import { SelectField } from "./SelectField";
import { Toolbar } from "./Toolbar";

export function FilterBar({ placeholder, chips, search, onSearch, selects = [], onRemoveChip, right }: FilterBarProps) {
  return (
    <Toolbar
      right={right}
      left={
        <>
          <SearchField placeholder={placeholder} value={search} onChange={onSearch} />
          {selects.map((select) => (
            <SelectField key={select.key ?? select.label} {...select} />
          ))}
          {chips.map((chip) =>
            onRemoveChip ? <FilterChip key={chip} text={chip} onRemove={() => onRemoveChip(chip)} /> : <Chip key={chip}>{chip}</Chip>,
          )}
        </>
      }
    />
  );
}
