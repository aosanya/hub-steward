import type { NotificationItem } from "./api";

export const isUnpaidList = (n: NotificationItem) => n.event === "payment_list_handed_over";

export const unpaidRowsOf = (n: NotificationItem) =>
  (n.names.list ?? "")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [payer, ...rest] = line.split(" · ");
      return { payer, detail: rest.join(" · ") };
    });
