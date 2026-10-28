import type { ReactNode } from "react";
import type { InboxClient } from "../inbox/api";
import { AccountMenu } from "./AccountMenu";
import { DrawerFrame } from "./DrawerFrame";
import { ScreenHead } from "./ScreenHead";
import { TabBar } from "./TabBar";
import { TopBar } from "./TopBar";

type Props = { title: string; sub?: string; onBack?: () => void; action?: ReactNode; inbox?: InboxClient; tabless?: boolean; children: ReactNode };

export function Shell({ title, sub, onBack, action, inbox, tabless, children }: Props) {
  const bar = { action, menu: !tabless || Boolean(onBack) || Boolean(action) };
  return (
    <DrawerFrame drawer={<AccountMenu />}>
      {onBack ? <TopBar back={{ onClick: onBack }} {...bar} /> : <TopBar title={title} {...bar} />}
      <main className="body">
        <ScreenHead title={onBack ? title : undefined} sub={sub} />
        {children}
      </main>
      {tabless ? null : <TabBar inbox={inbox} />}
    </DrawerFrame>
  );
}
