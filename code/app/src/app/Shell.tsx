import type { ReactNode } from "react";
import type { InboxClient } from "../features/inbox/api";
import { AccountMenu } from "../shared/ui/AccountMenu";
import { DrawerFrame } from "../shared/ui/DrawerFrame";
import { ScreenHead } from "../shared/ui/ScreenHead";
import { TabBar } from "./TabBar";
import { TopBar } from "./TopBar";

type Props = { title: string; sub?: string; onBack?: () => void; backLabel?: string; action?: ReactNode; headEnd?: ReactNode; inbox?: InboxClient; tabless?: boolean; unnamed?: boolean; titleUnder?: boolean; titleless?: boolean; children: ReactNode };

export function Shell({ title, sub, onBack, backLabel, action, headEnd, inbox, tabless, unnamed, titleUnder, titleless, children }: Props) {
  const bar = { action, unnamed, menu: !tabless || Boolean(onBack) || Boolean(action) };
  return (
    <DrawerFrame drawer={<AccountMenu />}>
      {onBack ? <TopBar back={{ onClick: onBack, label: backLabel }} title={backLabel && !titleUnder && !titleless ? title : undefined} {...bar} /> : <TopBar title={title} {...bar} />}
      <main className="body">
        <ScreenHead title={onBack && !titleless && (!backLabel || titleUnder) ? title : undefined} sub={sub} end={headEnd} />
        {children}
      </main>
      {tabless ? null : <TabBar inbox={inbox} />}
    </DrawerFrame>
  );
}
