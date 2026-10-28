import { hiddenPages } from "../data/menu";
import { useConsole } from "../shell/context";
import { SpecPage } from "./SpecPage";
import { views } from "./views";

export function PageView() {
  const { page } = useConsole();
  const View =
    Object.hasOwn(views, page) && !hiddenPages.includes(page)
      ? views[page]
      : SpecPage;
  return <View key={page} />;
}
