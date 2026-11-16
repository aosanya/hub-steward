import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DrawerFrame, useDrawer } from "./DrawerFrame";

function Handle() {
  const { open, id, button, toggle } = useDrawer();
  return (
    <button ref={button} type="button" aria-expanded={open} aria-controls={id} onClick={toggle}>
      handle
    </button>
  );
}

function Drawer() {
  const { close } = useDrawer();
  return (
    <div>
      <p>drawer rows</p>
      <button type="button" onClick={close}>
        pick
      </button>
    </div>
  );
}

const frame = () =>
  render(
    <DrawerFrame drawer={<Drawer />}>
      <header>
        <Handle />
      </header>
      <main>page body</main>
      <nav>tabs</nav>
    </DrawerFrame>,
  );

const handle = () => screen.getByRole("button", { name: "handle" });
const page = () => screen.getByRole("main").closest(".page") as HTMLElement;

describe("the drawer frame", () => {
  it("holds the drawer's rows only while it is open", async () => {
    frame();
    expect(screen.queryByText("drawer rows")).toBeNull();
    await userEvent.click(handle());
    expect(screen.getByText("drawer rows")).toBeInTheDocument();
    await userEvent.click(handle());
    expect(screen.queryByText("drawer rows")).toBeNull();
  });

  it("slides the whole page, bar, body and tab bar, while the drawer is open", async () => {
    frame();
    expect(page().classList.contains("open")).toBe(false);
    await userEvent.click(handle());
    expect(page().classList.contains("open")).toBe(true);
    expect(page()).toContainElement(screen.getByRole("banner"));
    expect(page()).toContainElement(screen.getByRole("main"));
    expect(page()).toContainElement(screen.getByRole("navigation"));
    expect(page()).not.toContainElement(screen.getByText("drawer rows"));
  });

  it("puts the drawer behind the page, before it in the frame", async () => {
    frame();
    await userEvent.click(handle());
    const slot = screen.getByText("drawer rows").closest(".drawer-slot")!;
    expect(slot.compareDocumentPosition(page()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(slot.parentElement).toBe(page().parentElement);
  });

  it("gives the handle an aria-controls that names the drawer's slot, closed or open", async () => {
    frame();
    const id = handle().getAttribute("aria-controls")!;
    expect(document.getElementById(id)).not.toBeNull();
    await userEvent.click(handle());
    expect(document.getElementById(id)).toContainElement(screen.getByText("drawer rows"));
  });

  it("closes on Escape from anywhere and gives focus back to the handle", async () => {
    frame();
    await userEvent.click(handle());
    await userEvent.click(screen.getByText("drawer rows"));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText("drawer rows")).toBeNull();
    expect(handle()).toHaveAttribute("aria-expanded", "false");
    expect(handle()).toHaveFocus();
  });

  it("ignores Escape while it is closed and takes no focus", async () => {
    frame();
    await userEvent.keyboard("{Escape}");
    expect(handle()).not.toHaveFocus();
    expect(handle()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on a tap on the page and on a tap on the frame, but not inside the drawer", async () => {
    frame();
    await userEvent.click(handle());
    await userEvent.click(screen.getByText("drawer rows"));
    expect(screen.getByText("drawer rows")).toBeInTheDocument();
    await userEvent.click(screen.getByText("page body"));
    expect(screen.queryByText("drawer rows")).toBeNull();
    await userEvent.click(handle());
    await userEvent.click(page().parentElement!);
    expect(screen.queryByText("drawer rows")).toBeNull();
  });

  it("does not reopen from the tap that closes it on the handle", async () => {
    frame();
    await userEvent.click(handle());
    await userEvent.click(handle());
    expect(screen.queryByText("drawer rows")).toBeNull();
  });

  it("lets the drawer close itself", async () => {
    frame();
    await userEvent.click(handle());
    await userEvent.click(screen.getByRole("button", { name: "pick" }));
    expect(screen.queryByText("drawer rows")).toBeNull();
    expect(page().classList.contains("open")).toBe(false);
  });

  it("gives a handle outside any frame nothing to open", async () => {
    render(<Handle />);
    await userEvent.click(handle());
    expect(handle()).toHaveAttribute("aria-expanded", "false");
    expect(handle()).not.toHaveAttribute("aria-controls");
  });
});
