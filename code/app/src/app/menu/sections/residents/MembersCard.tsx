import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMay } from "../../../../features/agency/useMay";
import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { SearchBox } from "../../../../shared/ui/SearchBox";
import { Section, sectionLimit } from "../../../../shared/ui/Section";
import { Sheet } from "../../../../shared/ui/Sheet";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { residentPaths } from "./paths";

type Member = { id: string; name: string };

type Page = { members: Member[]; total: number };

export const membersPageSize = 20;

const unnamed = "Unnamed person";

const readMembers = async (groupId: string, offset: number, limit: number, q: string): Promise<Page> => {
  const reply = (await callTool("", "actor_list_group_members", { group_id: groupId, limit, offset, ...(q ? { q } : {}) })) as { items?: Record<string, unknown>[]; total?: number } | null;
  const members = (reply?.items ?? []).map((item) => ({ id: String(item.actor_id ?? ""), name: typeof item.display_name === "string" ? item.display_name : "" }));
  return { members, total: typeof reply?.total === "number" ? reply.total : members.length };
};

function MemberRow({ member, onOpen }: { member: Member; onOpen: (id: string) => void }) {
  const word = useWord("actor");
  return <ListRow title={member.name || word(unnamed)} meta="Resident" end="›" onClick={() => onOpen(member.id)} />;
}

function MembersSheet({ groupId, onClose, onOpen }: { groupId: string; onClose: () => void; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const latest = useRef(0);
  const load = async (offset: number, q: string) => {
    const mine = ++latest.current;
    setLoading(true);
    try {
      const page = await readMembers(groupId, offset, membersPageSize, q.trim());
      if (mine !== latest.current) return;
      setRows((was) => (offset === 0 ? page.members : [...was, ...page.members]));
      setTotal(page.total);
      setFailed(false);
    } catch {
      if (mine === latest.current) setFailed(true);
    } finally {
      if (mine === latest.current) setLoading(false);
    }
  };
  useEffect(() => {
    load(0, query);
  }, [query]);
  return (
    <Sheet title="Members" onClose={onClose}>
      <SearchBox label="Search members" value={query} onChange={setQuery} />
      {failed ? <LoadFailed words="The members could not be loaded." /> : null}
      <Rows>
        {rows.map((member) => (
          <MemberRow key={member.id} member={member} onOpen={onOpen} />
        ))}
      </Rows>
      {loading ? <LoadingLine /> : null}
      {!loading && rows.length < total ? <Button onClick={() => load(rows.length, query)}>Show more</Button> : null}
    </Sheet>
  );
}

export type MembersView = Page;

export const useGroupMembers = (groupId: string) => {
  const may = useMay("member.view");
  const view = useLoad(() => (may ? readMembers(groupId, 0, sectionLimit, "") : Promise.resolve({ members: [], total: 0 })), `group-members:${openAgencyId()}:${groupId}:${may}`);
  return { may, view };
};

export const membersCountWords = (total: number) => `${total} ${total === 1 ? "member" : "members"}`;

export function MembersSection({ groupId, members }: { groupId: string; members: ReturnType<typeof useGroupMembers> }) {
  const navigate = useNavigate();
  const [all, setAll] = useState(false);
  const { may, view } = members;
  if (!may || view.state !== "ready") return null;
  const open = (id: string) => navigate(residentPaths.people.path({ person: id }));
  return (
    <>
      <Section
        icon="users"
        word="Members"
        total={view.data.total}
        opens={() => setAll(true)}
        empty={{ words: "No members yet." }}
        rows={view.data.members.map((member) => (
          <MemberRow key={member.id} member={member} onOpen={open} />
        ))}
      />
      {all ? <MembersSheet groupId={groupId} onClose={() => setAll(false)} onOpen={open} /> : null}
    </>
  );
}

export function MembersCard({ groupId }: { groupId: string }) {
  return <MembersSection groupId={groupId} members={useGroupMembers(groupId)} />;
}
