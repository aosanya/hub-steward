import { useChatAboutSubject } from "../residents/SubjectChat";
import { assetPathOf, assetPaths } from "./paths";

type Item = Record<string, unknown>;

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

export function ChatAboutAsset({ asset }: { asset: Item }) {
  const id = textOf(asset.id);
  useChatAboutSubject(id === "" ? null : { kind: "asset", id, name: textOf(asset.name) }, assetPathOf(textOf(asset.category), id));
  return null;
}

export function ChatAboutWorkOrder({ order }: { order: Item }) {
  const id = textOf(order.id);
  useChatAboutSubject(id === "" ? null : { kind: "workorder", id, name: textOf(order.title) }, assetPaths.workOrders.path({ item: id }));
  return null;
}
