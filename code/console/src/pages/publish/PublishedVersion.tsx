import { hubPath } from "../../api";
import { getPublication, type PublicationDocument } from "../../data/draft";
import { permissionsOfStep } from "../../data/stepPermissions";
import { useI18n } from "../../i18n";
import { Button, Card, Cell, Chip, DataTable, Empty, Note, SectionTitle, Stack, TextLink, TitleRow } from "../../ui";
import { useLoaded } from "../../shell/useLoaded";
import { PageContent } from "../work/PageContent";
import { textOf } from "../spec/usersRead";

const nested = ["work_items", "workflow_objectives"];

const heading = (key: string) => {
  const words = key.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

const componentsOf = (document: Record<string, unknown>): [string, Record<string, unknown>[]][] =>
  Object.entries(document)
    .filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]) && entry[1].length > 0)
    .map(([key, items]): [string, Record<string, unknown>[]] => [key, items.filter(isRecord)])
    .filter(([, items]) => items.length > 0);

const ownName = (item: Record<string, unknown>): string =>
  [item.title, item.name, item.text, item.question].map((value) => textOf(value)).find((value) => value !== "") ?? "";

const labelOf = (item: Record<string, unknown>): string => [textOf(item.code), ownName(item)].filter((value) => value !== "").join(" ");

type Labels = { byId: Map<string, string>; byCode: Map<string, string> };

const labelsOf = (components: [string, Record<string, unknown>[]][]): Labels => {
  const labels: Labels = { byId: new Map(), byCode: new Map() };
  for (const [, items] of components) {
    for (const item of items) {
      const label = labelOf(item);
      if (label === "") continue;
      if (textOf(item.id) !== "") labels.byId.set(textOf(item.id), label);
      if (textOf(item.code) !== "") labels.byCode.set(textOf(item.code), label);
    }
  }
  return labels;
};

const referencesOf = (item: Record<string, unknown>, labels: Labels): string[] =>
  Object.entries(item).flatMap(([key, value]) => {
    const held = textOf(value);
    if (held === "" || key === "id") return [];
    if (key.endsWith("_id")) return labels.byId.get(held) ?? [];
    if (key.endsWith("_code")) return labels.byCode.get(held) ?? held;
    return [];
  });

const nameOf = (item: Record<string, unknown>, labels: Labels): string => {
  const own = ownName(item);
  if (own !== "") return own;
  const references = referencesOf(item, labels);
  return references.length > 0 ? references.join(" → ") : textOf(item.code) || textOf(item.id);
};

const subOf = (item: Record<string, unknown>): string =>
  ownName(item) === "" ? "" : [item.code, item.description].map((value) => textOf(value)).filter((value) => value !== "").join(" · ");

export const fileNameOf = (publication: PublicationDocument): string => {
  const agency = isRecord(publication.document.agency) ? textOf(publication.document.agency.name) : "";
  const base = (agency || "agency") + "-" + (publication.tag || "v" + publication.version);
  return base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".json";
};

export const downloadJson = (publication: PublicationDocument) => {
  const blob = new Blob([JSON.stringify(publication.document, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileNameOf(publication);
  link.click();
  URL.revokeObjectURL(url);
};

const byOrder = (a: Record<string, unknown>, b: Record<string, unknown>): number => Number(a.ordinality ?? 0) - Number(b.ordinality ?? 0);

const listOf = (document: Record<string, unknown>, key: string): Record<string, unknown>[] =>
  Array.isArray(document[key]) ? (document[key] as unknown[]).filter(isRecord) : [];

function Workflows({ document, labels }: { document: Record<string, unknown>; labels: Labels }) {
  const { t } = useI18n();
  const items = listOf(document, "work_items");
  const links = listOf(document, "workflow_objectives");
  return (
    <section>
      <Stack gap={12}>
        <SectionTitle title={heading("workflows") + " (" + listOf(document, "workflows").length + ")"} />
        {listOf(document, "workflows")
          .sort(byOrder)
          .map((workflow) => {
            const id = textOf(workflow.id);
            const serves = links.filter((link) => textOf(link.workflow_id) === id).map((link) => labels.byId.get(textOf(link.objective_id)) ?? "");
            const steps = items.filter((item) => textOf(item.workflow_id) === id).sort(byOrder);
            const rows = steps.map((step) => ({
              key: textOf(step.id),
              cells: [
                <Cell key="step" text={textOf(step.title)} sub={[step.code, step.description].map((value) => textOf(value)).filter((value) => value !== "").join(" · ") || undefined} />,
                <Chip key="kind" kind="mute">
                  {textOf(step.kind)}
                </Chip>,
                labels.byId.get(textOf(step.role_id)) ?? "",
                <span key="needs" className="count">
                  {permissionsOfStep(textOf(step.title), textOf(step.kind), textOf(step.description)).join(", ")}
                </span>,
              ],
            }));
            return (
              <Card key={id} title={labelOf(workflow)}>
                {textOf(workflow.description) ? <Note>{textOf(workflow.description)}</Note> : null}
                {serves.filter((one) => one !== "").length > 0 ? (
                  <p className="soft">
                    {t("publish.serves")}: {serves.filter((one) => one !== "").join("; ")}
                  </p>
                ) : null}
                <DataTable columns={[t("publish.colStep"), t("draft.colKind"), t("roles.colRole"), t("publish.colNeeds")]} rows={rows} empty="" />
              </Card>
            );
          })}
      </Stack>
    </section>
  );
}

function Component({ name, items, labels }: { name: string; items: Record<string, unknown>[]; labels: Labels }) {
  const rows = items.map((item, index) => ({
    key: textOf(item.id) || String(index),
    cells: [<Cell key="name" text={nameOf(item, labels)} sub={subOf(item) || undefined} />],
  }));
  return (
    <section>
      <Stack gap={8}>
        <SectionTitle title={heading(name) + " (" + items.length + ")"} />
        <DataTable columns={[heading(name)]} rows={rows} empty="" />
      </Stack>
    </section>
  );
}

export function PublishedVersion({ hubId, version }: { hubId: string; version: number }) {
  const { t } = useI18n();
  const { state } = useLoaded(() => getPublication(hubId, version), [hubId, version]);
  if (state.kind === "loading") return <TitleRow title={t("menu.publish")} />;
  if (state.kind === "failed")
    return (
      <>
        <TitleRow title={t("menu.publish")} />
        <PageContent>
          <Empty text={t("loadFailed")} failed />
        </PageContent>
      </>
    );
  const publication = state.value;
  const components = componentsOf(publication.document);
  const labels = labelsOf(components);
  return (
    <>
      <TitleRow title={publication.tag || "v" + publication.version}>
        <Button onClick={() => downloadJson(publication)}>{t("publish.download")}</Button>
      </TitleRow>
      <PageContent>
        <Stack gap={20}>
          <Stack gap={4}>
            {publication.channel ? <Chip kind="mute">{publication.channel}</Chip> : null}
            <TextLink to={hubPath(hubId, "publish")} size="sm">
              {t("publish.back")}
            </TextLink>
          </Stack>
          {components.map(([name, items]) =>
            name === "workflows" ? (
              <Workflows key={name} document={publication.document} labels={labels} />
            ) : nested.includes(name) ? null : (
              <Component key={name} name={name} items={items} labels={labels} />
            ),
          )}
        </Stack>
      </PageContent>
    </>
  );
}
