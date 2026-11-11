import type { ReactNode } from "react";
import type { InboxClient } from "../inbox/api";
import { AccountMenu } from "./AccountMenu";
import { DrawerFrame } from "./DrawerFrame";
import { ScreenHead } from "./ScreenHead";
import { TabBar } from "./TabBar";
import { TopBar } from "./TopBar";

type Props = { title: string; sub?: string; onBack?: () => void; backLabel?: string; action?: ReactNode; headEnd?: ReactNode; inbox?: InboxClient; tabless?: boolean; children: ReactNode };

export function Shell({ title, sub, onBack, backLabel, action, headEnd, inbox, tabless, children }: Props) {
  const bar = { action, menu: !tabless || Boolean(onBack) || Boolean(action) };
  return (
    <DrawerFrame drawer={<AccountMenu />}>
      {onBack ? <TopBar back={{ onClick: onBack, label: backLabel }} title={backLabel ? title : undefined} {...bar} /> : <TopBar title={title} {...bar} />}
      <main className="body">
        <ScreenHead title={onBack && !backLabel ? title : undefined} sub={sub} end={headEnd} />
        {children}
      </main>
      {tabless ? null : <TabBar inbox={inbox} />}
    </DrawerFrame>
  );
}
