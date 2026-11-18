import { useState, type ReactNode } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { MenuEditForm, type EditField } from "../../MenuEditForm";
import { WorkOrderAssignee } from "./WorkOrderAssignee";
import { WorkOrderStatus } from "./WorkOrderStatus";
import { maintenanceKeys } from "./maintenanceHistory";

type Item = Record<string, unknown>;

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const rowsOf = (pairs: [string, string][]) => pairs.filter(([, value]) => value !== "").map(([label, value]) => <ListRow key={label} title={label} meta={value} />);

const linesOf = (item: Item, keys: string[]) => keys.map((key) => textOf(item[key])).filter((line) => line !== "").map((line) => <ListRow key={line} title={line} />);

const movementKeys = ["movement0", "movement1", "movement2"];

function EditAct({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="sec-act" onClick={onClick}>
      Edit
    </button>
  );
}

function PageHead({ name, line }: { name: string; line: string }) {
  return (
    <div className="title-block">
      <h1 className="person-name">{name}</h1>
      {line ? <p className="quiet-line">{line}</p> : null}
    </div>
  );
}

function Page({ name, line, children }: { name: string; line: string; children: ReactNode }) {
  return (
    <div className="person-page">
      <PageHead name={name} line={line} />
      <div className="sections">{children}</div>
    </div>
  );
}

type AssetPanelProps = { asset: Item; fields: EditField[]; build: (sent: Record<string, unknown>) => Record<string, unknown>; onSaved: () => void };

export function AssetPanel({ asset, fields, build, onSaved }: AssetPanelProps) {
  const may = useMay("asset.manage");
  const [editing, setEditing] = useState(false);
  const detail = rowsOf([
    ["Name", textOf(asset.name)],
    ["Code", textOf(asset.code)],
    ["Category", textOf(asset.category)],
    ["Condition", textOf(asset.condition)],
    ["Kept by", textOf(asset.keeperName)],
    ["Location", textOf(asset.place)],
  ]);
  const stop = () => setEditing(false);
  return (
    <Page name={textOf(asset.name)} line={[textOf(asset.category), textOf(asset.condition)].filter(Boolean).join(" · ")}>
      {editing ? (
        <MenuEditForm item={asset} id={textOf(asset.id)} idArg="assetID" tool="assetmanager_asset_update" permission="asset.manage" bare openCount={1} fields={fields} build={build} onSaved={() => { stop(); onSaved(); }} onCancel={stop} />
      ) : (
        <Section word="Asset detail" plain foot={may ? <EditAct onClick={() => setEditing(true)} /> : undefined} rows={detail} />
      )}
      <Section word="Movements" icon="clock" plain rows={linesOf(asset, movementKeys)} />
      <Section word="Maintenance history" icon="document" plain rows={linesOf(asset, maintenanceKeys)} />
    </Page>
  );
}

const workOrderEditFields: EditField[] = [{ label: "Title", key: "title", required: true }];

type WorkOrderPanelProps = { order: Item; onChanged: () => void };

export function WorkOrderPanel({ order, onChanged }: WorkOrderPanelProps) {
  const may = useMay("task.edit");
  const [editing, setEditing] = useState(false);
  const detail = rowsOf([
    ["Title", textOf(order.title)],
    ["State", textOf(order.state)],
    ["Due", textOf(order.due)],
    ["About", textOf(order.about)],
    ["Place", textOf(order.place)],
  ]);
  const foot = (
    <>
      {may ? <EditAct onClick={() => setEditing(true)} /> : null}
      <WorkOrderStatus order={order} onMoved={onChanged} />
    </>
  );
  const stop = () => setEditing(false);
  return (
    <Page name={textOf(order.title)} line={textOf(order.state)}>
      {editing ? (
        <MenuEditForm item={order} id={textOf(order.id)} idArg="taskID" tool="taskmanager_task_patch" permission="task.edit" bare openCount={1} fields={workOrderEditFields} onSaved={() => { stop(); onChanged(); }} onCancel={stop} />
      ) : (
        <Section word="Work order" plain foot={foot} rows={detail} />
      )}
      <section className="sec" aria-label="Assignee">
        <div className="sec-head">
          <h2 className="sec-title">Assignee</h2>
        </div>
        <div className="sec-body">
          <WorkOrderAssignee order={order} onAssigned={onChanged} />
        </div>
      </section>
    </Page>
  );
}

export function SchedulePanel({ item }: { item: Item }) {
  const rows = rowsOf([
    ["How often", textOf(item.often)],
    ["Last upkeep", textOf(item.lastUpkeep)],
    ["Last job due", textOf(item.lastJobDue)],
    ["Next upkeep", textOf(item.next)],
    ["Schedule rule", textOf(item.rule)],
  ]);
  return (
    <Page name={textOf(item.title)} line={textOf(item.oftenAndNext)}>
      <Section word="Schedule" plain rows={rows} />
    </Page>
  );
}
