import type { ReactNode } from "react";
import type { InboxClient } from "../../features/inbox/api";
import { AccountMenu } from "./AccountMenu";
import { DrawerFrame } from "./DrawerFrame";
import { ScreenHead } from "./ScreenHead";
import { TabBar } from "./TabBar";
import { TopBar } from "./TopBar";

type Props = { title: string; sub?: string; onBack?: () => void; backLabel?: string; action?: ReactNode; headEnd?: ReactNode; inbox?: InboxClient; tabless?: boolean; unnamed?: boolean; titleUnder?: boolean; children: ReactNode };

export function Shell({ title, sub, onBack, backLabel, action, headEnd, inbox, tabless, unnamed, titleUnder, children }: Props) {
  const bar = { action, unnamed, menu: !tabless || Boolean(onBack) || Boolean(action) };
  return (
    <DrawerFrame drawer={<AccountMenu />}>
      {onBack ? <TopBar back={{ onClick: onBack, label: backLabel }} title={backLabel && !titleUnder ? title : undefined} {...bar} /> : <TopBar title={title} {...bar} />}
      <main className="body">
        <ScreenHead title={onBack && (!backLabel || titleUnder) ? title : undefined} sub={sub} end={headEnd} />
        {children}
      </main>
      {tabless ? null : <TabBar inbox={inbox} />}
    </DrawerFrame>
  );
}
