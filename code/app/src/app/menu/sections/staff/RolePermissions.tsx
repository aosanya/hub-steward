import { useState } from "react";
import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { ChoiceGroup, ChoiceRow } from "../../../../shared/ui/ChoiceRow";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { refusalWords } from "../../MenuEditForm";
import { listOf, text, type Item } from "./staffData";

type Offered = { code: string; name: string };

export const offeredPermissions = async (): Promise<Offered[]> =>
  (await listOf("agency_list_permissions"))
    .filter((permission) => permission.locked !== true)
    .map((permission) => ({ code: text(permission, "code"), name: text(permission, "name") || text(permission, "code") }));

export const heldCodes = (role: Item) => (Array.isArray(role.permissions) ? role.permissions.filter((code): code is string => typeof code === "string") : []);

const sameCodes = (one: string[], other: string[]) => one.length === other.length && one.every((code) => other.includes(code));

function Ticks({ role, offered, onSaved }: { role: Item; offered: Offered[]; onSaved: () => void }) {
  const word = useWord("actor");
  const held = heldCodes(role).filter((code) => offered.some((permission) => permission.code === code));
  const [ticked, setTicked] = useState(held);
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState("");
  const chosen = offered.map((permission) => permission.code).filter((code) => ticked.includes(code));
  const flip = (code: string, on: boolean) => setTicked((was) => (on ? [...was, code] : was.filter((one) => one !== code)));
  const save = async () => {
    setSaving(true);
    setRefused("");
    try {
      await callTool("", "agency_set_role_permissions", { role_id: text(role, "id"), permissions: chosen });
      onSaved();
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <ChoiceGroup label={word("Permissions")}>
        {offered.map((permission) => (
          <ChoiceRow key={permission.code} type="checkbox" label={permission.name} checked={ticked.includes(permission.code)} onChange={(on) => flip(permission.code, on)} />
        ))}
      </ChoiceGroup>
      <Button kind="primary" disabled={saving || sameCodes(chosen, held)} onClick={save}>Save permissions</Button>
      {refused ? <LoadFailed words={refused} /> : null}
    </>
  );
}

export function RolePermissions({ role, onSaved }: { role: Item; onSaved: () => void }) {
  const catalogue = useLoad(offeredPermissions, `permission-catalogue:${openAgencyId()}`);
  if (catalogue.state === "loading") return <LoadingLine />;
  if (catalogue.state === "error") return <LoadFailed words="The permissions could not be loaded." />;
  return <Ticks role={role} offered={catalogue.data} onSaved={onSaved} />;
}
