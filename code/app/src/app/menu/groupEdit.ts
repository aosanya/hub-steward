type Item = Record<string, unknown>;

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

export const groupEditTool = "actor_edit_group";

export const groupNameFields = [{ label: "Name", key: "name", required: true }];

export const groupKept = (group: Item) => ({
  NodeType: textOf(group.node_type),
  AnchorLevelOverrideID: textOf(group.anchor_level_override),
});

const resent = (group: Item) => ({
  NodeType: textOf(group.NodeType) || textOf(group.node_type),
  AnchorLevelOverrideID: textOf(group.AnchorLevelOverrideID) || textOf(group.anchor_level_override),
});

export const groupEditArgs = (id: string, group: Item, name: unknown) => ({ group_id: id, Name: name, ...resent(group) });

export const groupNameBuild = (id: string, group: Item) => (sent: Record<string, unknown>) => groupEditArgs(id, group, sent.name);
