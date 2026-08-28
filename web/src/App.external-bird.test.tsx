import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(async (name: string) => name === "getDashboardSummary" ? {} : name.startsWith("list") ? [] : {}) }));
vi.mock("./functions", () => ({ invoke: mocks.invoke, thaiError: () => "error" }));
import { App } from "./App";
afterEach(() => { cleanup(); mocks.invoke.mockClear(); });

it("keeps external Bird creation separate and moves Egg creation out of the generic Birds page", async () => {
  render(<App />); fireEvent.click(await screen.findByRole("button", { name: "Birds" }));
  const external = screen.getByRole("heading", { name: "เพิ่มนกจากภายนอก" }).closest("form")!;
  expect(within(external).queryByText(/Egg ID/)).toBeNull();
  expect(screen.queryByRole("heading", { name: "สร้างนกจากไข่" })).toBeNull();
  expect(screen.queryByText(/Egg ID/)).toBeNull();
  const origin = within(external).getByRole("combobox");
  expect(within(origin).getAllByRole("option").map(x => [x.textContent, x.getAttribute("value")])).toEqual([["เลือก", ""], ["External", "external"], ["Purchased", "purchased"], ["Rescued", "rescued"], ["Unknown", "unknown"]]);
  expect(within(origin).queryByRole("option", { name: "farm_hatched" })).toBeNull();
});

it("keeps the external form reset after the created Bird appears during refresh", async () => {
  let created = false;
  mocks.invoke.mockImplementation(async (name: string) => {
    if (name === "createExternalBird") { created = true; return { birdId: "external-1", ringId: "EXT-001" }; }
    if (name === "listBirds") return created ? [{ birdId: "external-1", ringId: "EXT-001", displayName: "Foundation", origin: "external", status: "active" }] : [];
    return name === "getDashboardSummary" ? {} : name.startsWith("list") ? [] : {};
  });
  render(<App />); fireEvent.click(await screen.findByRole("button", { name: "Birds" }));
  const form = screen.getByRole("heading", { name: "เพิ่มนกจากภายนอก" }).closest("form")!;
  const inputs = within(form).getAllByRole("textbox");
  fireEvent.change(inputs[0], { target: { value: " ext-001 " } });
  fireEvent.change(inputs[1], { target: { value: "Foundation" } });
  const origin = within(form).getByRole("combobox") as HTMLSelectElement;
  expect(origin.value).toBe("external");
  const date = within(form).getByLabelText("วันฟัก/วันเกิด") as HTMLInputElement;
  const mutation = within(form).getByText("Mutation/สี").querySelector("input") as HTMLInputElement;
  fireEvent.change(date, { target: { value: "01012026" } });
  fireEvent.change(mutation, { target: { value: "Blue" } });
  fireEvent.click(within(form).getByRole("button", { name: "บันทึก" }));
  await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("createExternalBird", expect.objectContaining({ ringId: " ext-001 ", displayName: "Foundation", origin: "external" })));
  await screen.findByText("บันทึกสำเร็จ");
  await screen.findByRole("button", { name: /Ring ID: EXT-001/ });
  await waitFor(() => { expect((inputs[0] as HTMLInputElement).value).toBe(""); expect((inputs[1] as HTMLInputElement).value).toBe(""); expect(date.value).toBe(""); expect(mutation.value).toBe(""); expect(origin.value).toBe("external"); });
});

it("preserves external Bird values on failure without exposing a generic Egg ID form", async () => {
  mocks.invoke.mockImplementation(async (name: string) => { if (name === "createExternalBird") throw new Error("failed"); return name === "getDashboardSummary" ? {} : name.startsWith("list") ? [] : {}; });
  render(<App />); fireEvent.click(await screen.findByRole("button", { name: "Birds" }));
  const external = screen.getByRole("heading", { name: "เพิ่มนกจากภายนอก" }).closest("form")!;
  const extInputs = within(external).getAllByRole("textbox") as HTMLInputElement[];
  const mutation = within(external).getByText("Mutation/สี").querySelector("input") as HTMLInputElement;
  fireEvent.change(extInputs[0], { target: { value: "EXT-FAIL" } }); fireEvent.change(extInputs[1], { target: { value: "Retry me" } }); fireEvent.change(mutation, { target: { value: "Green" } });
  const extDate = within(external).getByLabelText("วันฟัก/วันเกิด") as HTMLInputElement; fireEvent.change(extDate, { target: { value: "02022026" } });
  fireEvent.change(within(external).getByRole("combobox"), { target: { value: "rescued" } });
  fireEvent.click(within(external).getByRole("button", { name: "บันทึก" })); await screen.findByText("error");
  expect(extInputs[0].value).toBe("EXT-FAIL"); expect(extInputs[1].value).toBe("Retry me"); expect(mutation.value).toBe("Green"); expect(extDate.value).toBe("02/02/2026"); expect((within(external).getByRole("combobox") as HTMLSelectElement).value).toBe("rescued");
  expect(screen.queryByText(/Egg ID/)).toBeNull();
});
