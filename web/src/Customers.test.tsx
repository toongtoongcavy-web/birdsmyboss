import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { Customers } from "./Customers";

const invoke = vi.fn();
vi.mock("./functions", () => ({ invoke: (...args: unknown[]) => invoke(...args), thaiError: (error: unknown) => String(error) }));

const customers = [
  { customerId: "customer-secret-1", displayName: "คุณอรุณ วัฒนชัย", phone: "081-234-5678", email: "arun@example.test", status: "active" },
  { customerId: "customer-secret-2", displayName: "คุณศิริพร แสงทอง", phone: "089-765-4321", email: "siriporn@example.test", status: "archived" },
];
const birds = [{ birdId: "bird-secret-1", displayName: "ข้าวหอม", ringId: "BMB-2608-014", status: "sold" }];

beforeEach(() => { cleanup(); invoke.mockReset(); invoke.mockResolvedValue({ ...customers[0], reservations: [{ reservationId: "reservation-secret", birdId: "bird-secret-1", reservedOn: "2026-08-10", status: "completed" }], sales: [{ saleId: "sale-secret", birdId: "bird-secret-1", createdOn: "2026-08-12", completedOn: "2026-08-14", status: "completed" }] }); });

it("uses truthful Customer identity, search semantics, status, and concealed IDs without CRM metrics", () => {
  const { container } = render(<Customers customers={customers} birds={birds} createForm={<form>existing create workflow</form>}/>);
  expect(screen.getByText("THE RELATIONSHIP LEDGER")).toBeTruthy();
  expect(screen.getByRole("textbox", { name: "ค้นหารายชื่อลูกค้า" }).getAttribute("placeholder")).toBe("ชื่อ โทรศัพท์ หรืออีเมล");
  expect(screen.getByText("Active")).toBeTruthy(); expect(screen.getByText("Archived")).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/VIP|lifetime|total spent|score|customer-secret/i);
  expect(container.querySelector(".orange-ring")).toBeNull();
  fireEvent.change(screen.getByRole("textbox", { name: "ค้นหารายชื่อลูกค้า" }), { target: { value: "089" } });
  expect(screen.getByText("คุณศิริพร แสงทอง")).toBeTruthy(); expect(screen.queryByText("คุณอรุณ วัฒนชัย")).toBeNull();
});

it("opens trusted detail, keeps Reservation and Sale separate, and reserves Orange Ring for Bird references", async () => {
  const { container } = render(<Customers customers={customers} birds={birds} createForm={<button>existing create workflow</button>}/>);
  fireEvent.click(screen.getByRole("button", { name: /Display Name: คุณอรุณ/ }));
  expect(await screen.findByText("THE TRUSTED KEEPER")).toBeTruthy();
  expect(invoke).toHaveBeenCalledWith("getCustomerDetails", { customerId: "customer-secret-1" });
  expect(container.querySelector(".keeper-contact-ledger dd")?.textContent).toBe("081-234-5678");
  const relationships = screen.getByRole("region", { name: "ความสัมพันธ์ที่บันทึกไว้" });
  expect(within(relationships).getByText("RESERVATION REFERENCES")).toBeTruthy();
  expect(within(relationships).getByText("SALE REFERENCES")).toBeTruthy();
  expect(within(relationships).getAllByText("Ring ID: BMB-2608-014")).toHaveLength(2);
  expect(container.querySelectorAll(".orange-ring")).toHaveLength(2);
  expect(document.body.textContent).not.toMatch(/customer-secret|reservation-secret|sale-secret|bird-secret/);
  expect(document.body.textContent).not.toContain("Reservation → Sale");
});
