import { Chip } from "../../../../shared/ui/Chip";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { behindAny } from "./AreaCounts";
import { MeTooButton } from "./MeTooButton";

type Item = Record<string, unknown>;

type Props = { item: Item; said: boolean; failed: boolean; onPress: () => void };

const textOf = (item: Item, key: string) => (typeof item[key] === "string" ? (item[key] as string) : "");

const numberOf = (value: unknown) => (typeof value === "number" ? value : 0);

const areasOf = (item: Item) => (Array.isArray(item.areas) ? (item.areas as Item[]) : []).filter(behindAny);

const quietOf = (item: Item) =>
  [textOf(item, "kindWord"), `Raised by ${numberOf(item.raised_by)}`, `${numberOf(item.me_too)} said Me too`].filter(Boolean).join(" · ");

const factRows = (item: Item) => [
  ...(textOf(item, "kindWord") ? [<ListRow key="kind" title="Kind" meta={textOf(item, "kindWord")} />] : []),
  <ListRow key="raised" title="Raised by" meta={String(numberOf(item.raised_by))} />,
  <ListRow key="said" title="Said Me too" meta={String(numberOf(item.me_too))} />,
];

const areaRow = (area: Item, at: number) => (
  <ListRow
    key={at}
    title={textOf(area, "area") || "No area"}
    meta={numberOf(area.population) > 0 ? `${numberOf(area.population)} live there` : undefined}
    end={<Chip>{`raised by ${numberOf(area.raised_by)} · ${numberOf(area.me_too)} said Me too`}</Chip>}
  />
);

export function WishPage({ item, said, failed, onPress }: Props) {
  const areas = areasOf(item);
  const foot = <MeTooButton title={textOf(item, "title")} said={said} failed={failed} onPress={onPress} />;
  return (
    <>
      <div className="title-block">
        <h1 className="person-name">{textOf(item, "title")}</h1>
        <p className="quiet-line">{quietOf(item)}</p>
      </div>
      <div className="sections">
        <Section word="Wish" plain rows={factRows(item)} foot={foot} />
        {areas.length > 0 ? <Section word="Areas" icon="flag" rows={areas.map(areaRow)} /> : null}
      </div>
    </>
  );
}
