import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { MenuWindow } from "../../MenuWindow";
import { ChatAboutDeclaration } from "./ChatAboutCouncil";
import { homeEmpty, noneYet } from "./councilData";
import { declarationEmpty, declarationsTool, readDeclarations, type Declaration, type Declarations } from "./declarationsData";

export const declarationsTitle = "Declarations of interest";

export const notYetDeclaredWords = "Not yet declared";

function NotYetDeclared({ declarations }: { declarations: Declarations }) {
  if (declarations.notDeclaredCount === 0) return null;
  return (
    <div role="group" aria-label={notYetDeclaredWords}>
      <SectionHeading>{`${notYetDeclaredWords} (${declarations.notDeclaredCount})`}</SectionHeading>
      <Rows>
        {declarations.notDeclared.map((name, at) => (
          <ListRow key={at} title={name} />
        ))}
      </Rows>
    </div>
  );
}

export function DeclarationsScreen() {
  const word = useWord("council");
  const title = word(declarationsTitle);
  const [search] = useSearchParams();
  const read = useMemo(readDeclarations, []);
  const view = useLoad(() => read, `declarations:${openAgencyId()}`);
  const declarations = view.state === "ready" ? view.data : null;
  const find = async (id: string): Promise<Declaration> => (await read).declared.find((one) => one.id === id) ?? ({} as Declaration);
  return (
    <MenuWindow
      title={title}
      withTabs
      bandless
      startAt={search.get("id") ?? undefined}
      list={{ title, tool: declarationsTool, load: async () => (await read).declared, fields: { title: "title", meta: "meta" }, empty: declarationEmpty(declarations, homeEmpty(noneYet(word, declarationsTitle, "No declarations yet."))) }}
      detail={{
        tool: declarationsTool,
        load: async (id) => ({ ...(await find(id)) }),
        fields: { Member: "name", "Declared on": "declaredOn" },
        status: "status",
        extra: (declaration) => (
          <>
            <ChatAboutDeclaration declaration={declaration} />
            <Rows>
              {((declaration as Declaration).answers ?? []).map((one, at) => (
                <ListRow key={at} title={one.prompt} meta={one.answer} />
              ))}
            </Rows>
          </>
        ),
      }}
      below={declarations ? <NotYetDeclared declarations={declarations} /> : null}
    />
  );
}
