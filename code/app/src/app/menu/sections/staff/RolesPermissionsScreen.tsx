import { useSearchParams } from "react-router-dom";
import { useWord } from "../../../../features/agency/useWord";
import { MenuWindow } from "../../MenuWindow";
import { ChatAboutRole } from "./ChatAboutRole";
import { RolePage } from "./RolePage";
import { loadRole, loadRoles } from "./roleData";
import { homeEmpty } from "./staffData";

export function RolesPermissionsScreen() {
  const word = useWord("actor");
  const [search] = useSearchParams();
  return (
    <MenuWindow
      title={word("Roles & Permissions")}
      withTabs
      bandless
      startAt={search.get("role") ?? undefined}
      list={{ title: word("Roles & Permissions"), tool: "agency_list_roles", load: loadRoles, fields: { title: "name", meta: "meta" }, empty: homeEmpty(`No ${word("Roles").toLowerCase()} yet.`) }}
      detail={{ tool: "actor_list_role_holders", load: loadRole, fields: {}, status: "", extra: (role) => (
        <>
          <ChatAboutRole role={role} />
          <RolePage role={role} />
        </>
      ) }}
    />
  );
}
