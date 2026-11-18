import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useWord } from "../../../../features/agency/useWord";
import { MenuWindow } from "../../MenuWindow";
import { ChatAboutRole } from "./ChatAboutRole";
import { RolePage } from "./RolePage";
import { loadRole, loadRoles } from "./roleData";
import { homeEmpty } from "./staffData";

type RoleRow = Awaited<ReturnType<typeof loadRoles>>[number];

export function RolesPermissionsScreen() {
  const word = useWord("actor");
  const [search] = useSearchParams();
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [chosen, setChosen] = useState("");
  const chosenRole = rows.find((row) => row.id === chosen);
  const loadListed = useCallback(async () => {
    const loaded = await loadRoles();
    setRows(loaded);
    return loaded;
  }, []);
  return (
    <>
      {chosenRole ? <ChatAboutRole role={chosenRole} /> : null}
      <MenuWindow
        title={word("Roles & Permissions")}
        withTabs
        bandless
        startAt={search.get("role") ?? undefined}
        onChosen={setChosen}
        list={{ title: word("Roles & Permissions"), tool: "agency_list_roles", load: loadListed, fields: { title: "name", meta: "meta" }, empty: homeEmpty(`No ${word("Roles").toLowerCase()} yet.`) }}
        detail={{ tool: "actor_list_role_holders", load: loadRole, fields: {}, status: "", extra: (role) => <RolePage role={role} /> }}
      />
    </>
  );
}
