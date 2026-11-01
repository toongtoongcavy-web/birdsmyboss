import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Commercial } from "./Commercial";

const mocks=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock("./functions",async importOriginal=>({...await importOriginal<typeof import("./functions")>(),invoke:mocks.invoke}));

const birds=[{birdId:"bird-secret-1",ringId:"TH-001",displayName:"Sunny",mutation:"Lutino",currentSex:"male",status:"active",origin:"farm_hatched"},{birdId:"bird-secret-2",ringId:"TH-002",displayName:"Moon",mutation:"Normal",currentSex:"female",status:"active",origin:"external"}];
const customers=[{customerId:"customer-secret-1",displayName:"สมชาย",phone:"0812345678",email:"somchai@example.com",status:"active"}];
const reservations=[{reservationId:"reservation-secret-1",birdId:"bird-secret-1",customerId:"customer-secret-1",reservedOn:"2026-08-14",expiresOn:"2026-08-20",status:"active"}];
const payments=[{paymentId:"payment-secret-1",reservationId:"reservation-secret-1",amount:1000,currency:"THB",receivedOn:"2026-08-14",paymentMethod:"transfer",status:"received"}];
const refunds=[{refundId:"refund-secret-1",paymentId:"payment-secret-1",amount:100,outcome:"partial_refund",refundedOn:"2026-08-15",reason:"adjustment"}];
const sales=[{saleId:"sale-secret-1",birdId:"bird-secret-2",customerId:"customer-secret-1",status:"draft",createdOn:"2026-08-14"}];
const props={birds,customers,reservations,payments,refunds,sales,giveaways:[],onRefresh:vi.fn()};

afterEach(()=>{cleanup();vi.clearAllMocks();});

it.each([false,true])("shows the 5000/2000/0/2000 summary and requires a new decision despite prior no_refund=%s",async prior=>{
  mocks.invoke.mockResolvedValue({});
  render(<Commercial {...props} reservations={[{...reservations[0],agreedPrice:5000,currency:"THB"}]} payments={[{...payments[0],amount:2000}]} refunds={prior?[{...refunds[0],amount:0,outcome:"no_refund"}]:[]}/>);
  fireEvent.click(screen.getByRole("button",{name:/Sunny.*14\/08\/2026/}));
  if(prior){const history=screen.getByRole("region",{name:"ประวัติการคืนเงิน"});expect(history.textContent).toContain("ไม่คืนเงิน");expect(history.textContent).not.toContain("0 THB");}
  fireEvent.click(screen.getByRole("button",{name:"ยกเลิกการจอง"}));
  expect(mocks.invoke).not.toHaveBeenCalled();
  const form=screen.getByRole("heading",{name:"จัดการเงินก่อนยกเลิกการจอง"}).closest("form")!;
  expect(form.textContent).toContain("5000 THB");
  expect(form.textContent).toContain("รับเงินทั้งหมด: 2000 THB · คืนแล้ว: 0 THB · ยอดที่ต้องจัดการ: 2000 THB");
  fireEvent.change(within(form).getByLabelText("การจัดการเงิน"),{target:{value:"partial_refund"}});
  fireEvent.submit(form);expect(mocks.invoke).not.toHaveBeenCalled();
  fireEvent.change(within(form).getByLabelText("เหตุผลยกเลิกการจอง"),{target:{value:"เปลี่ยนแผน"}});
  fireEvent.submit(form);expect(mocks.invoke).not.toHaveBeenCalled();
  fireEvent.change(within(form).getByLabelText("วันที่มีผล / คืนเงิน"),{target:{value:"01112026"}});
  for(const value of ["","0","-1","2000"]){fireEvent.change(within(form).getByLabelText("จำนวนเงินคืนเมื่อยกเลิก"),{target:{value}});fireEvent.submit(form);expect(mocks.invoke).not.toHaveBeenCalled();}
  fireEvent.change(within(form).getByLabelText("จำนวนเงินคืนเมื่อยกเลิก"),{target:{value:"500"}});
  fireEvent.submit(form);
  await waitFor(()=>expect(props.onRefresh).toHaveBeenCalledTimes(1));
  expect(mocks.invoke).toHaveBeenCalledWith("cancelReservation",{reservationId:reservations[0].reservationId,disposition:{outcome:"partial_refund",reason:"เปลี่ยนแผน",refundedOn:"2026-11-01",amount:500}});
});

it("recovers from a retained-money rejection with Thai guidance and mandatory disposition instead of repeating the zero-net call",async()=>{
  mocks.invoke.mockRejectedValueOnce(new Error("Retained reservation money requires an explicit cancellation disposition.")).mockResolvedValue({});
  render(<Commercial {...props} payments={[]} refunds={[]}/>);
  fireEvent.click(screen.getByRole("button",{name:/Sunny.*14\/08\/2026/}));
  fireEvent.click(screen.getByRole("button",{name:"ยกเลิกการจอง"}));
  fireEvent.click(screen.getByRole("button",{name:"ยืนยันยกเลิกการจอง"}));
  const heading=await screen.findByRole("heading",{name:"จัดการเงินก่อนยกเลิกการจอง"});
  const form=heading.closest("form")!;
  expect(form.textContent).toContain("การจองนี้มีเงินที่รับไว้ กรุณาระบุวิธีจัดการเงินก่อนยกเลิกการจอง");
  expect(form.textContent).not.toContain("Retained reservation");
  expect(form.textContent).not.toContain("ยอดที่ต้องจัดการ: 0");
  fireEvent.submit(form);expect(mocks.invoke).toHaveBeenCalledTimes(1);
  fireEvent.change(within(form).getByLabelText("การจัดการเงิน"),{target:{value:"no_refund"}});
  fireEvent.change(within(form).getByLabelText("เหตุผลยกเลิกการจอง"),{target:{value:"ข้อตกลงการยกเลิก"}});
  fireEvent.change(within(form).getByLabelText("วันที่มีผล / คืนเงิน"),{target:{value:"01112026"}});
  fireEvent.submit(form);
  await waitFor(()=>expect(props.onRefresh).toHaveBeenCalledTimes(1));
  expect(mocks.invoke).toHaveBeenLastCalledWith("cancelReservation",{reservationId:reservations[0].reservationId,disposition:{outcome:"no_refund",reason:"ข้อตกลงการยกเลิก",refundedOn:"2026-11-01"}});
});

it.each(["full_refund","partial_refund","no_refund"])("requires explicit %s disposition before paid cancellation and preserves failed input",async outcome=>{
  mocks.invoke.mockRejectedValue(new Error("failed"));
  render(<Commercial {...props}/>);
  fireEvent.click(screen.getByRole("button",{name:/Sunny.*14\/08\/2026/}));
  expect(screen.queryByRole("heading",{name:"จัดการเงินก่อนยกเลิกการจอง"})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"ยกเลิกการจอง"}));
  expect(mocks.invoke).not.toHaveBeenCalled();
  const form=screen.getByRole("heading",{name:"จัดการเงินก่อนยกเลิกการจอง"}).closest("form")!;
  expect(form.textContent).toContain("ยอดที่ต้องจัดการ: 900 THB");
  fireEvent.submit(form);expect(mocks.invoke).not.toHaveBeenCalled();
  fireEvent.change(within(form).getByLabelText("การจัดการเงิน"),{target:{value:outcome}});
  if(outcome==="partial_refund")fireEvent.change(within(form).getByLabelText("จำนวนเงินคืนเมื่อยกเลิก"),{target:{value:"250"}});
  fireEvent.change(within(form).getByLabelText("เหตุผลยกเลิกการจอง"),{target:{value:"เปลี่ยนแผน"}});
  fireEvent.change(within(form).getByLabelText("วันที่มีผล / คืนเงิน"),{target:{value:"30102026"}});
  fireEvent.submit(form);
  await waitFor(()=>expect(within(form).getByRole("status").textContent).toContain("ไม่สามารถบันทึกข้อมูลได้"));
  expect(mocks.invoke).toHaveBeenCalledWith("cancelReservation",{reservationId:reservations[0].reservationId,disposition:{outcome,reason:"เปลี่ยนแผน",refundedOn:"2026-10-30",...(outcome==="partial_refund"?{amount:250}:{})}});
  expect((within(form).getByLabelText("เหตุผลยกเลิกการจอง") as HTMLInputElement).value).toBe("เปลี่ยนแผน");
  expect(props.onRefresh).not.toHaveBeenCalled();
  mocks.invoke.mockResolvedValue({});
});

it.each([false,true])("confirms zero-net cancellation without financial fields (prior payments: %s)",async prior=>{
  mocks.invoke.mockResolvedValue({});
  render(<Commercial {...props} payments={prior?payments:[]} refunds={prior?[{...refunds[0],amount:1000}]:[]}/>);
  fireEvent.click(screen.getByRole("button",{name:/Sunny.*14\/08\/2026/}));
  fireEvent.click(screen.getByRole("button",{name:"ยกเลิกการจอง"}));
  expect(screen.queryByLabelText("การจัดการเงิน")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"ยืนยันยกเลิกการจอง"}));
  await waitFor(()=>expect(props.onRefresh).toHaveBeenCalledTimes(1));
  expect(mocks.invoke).toHaveBeenCalledWith("cancelReservation",{reservationId:reservations[0].reservationId});
});

it("numbers canonical same-day payments 100/196/104 and retains order after refund with totals 400/100/300",()=>{
  const ordered=[100,196,104].map((amount,i)=>({...payments[0],paymentId:`ordered-${i}`,amount}));
  const view=render(<Commercial {...props} payments={ordered} refunds={[]}/>);
  fireEvent.click(screen.getByRole("button",{name:/Sunny.*14\/08\/2026/}));
  const rows=()=>[...view.container.querySelectorAll('.commercial-ledger-row')].map(row=>row.textContent);
  expect(rows()).toEqual([expect.stringContaining("01100 THB"),expect.stringContaining("02196 THB"),expect.stringContaining("03104 THB")]);
  const before=rows();
  view.rerender(<Commercial {...props} payments={ordered} refunds={[{...refunds[0],paymentId:"ordered-0",amount:100,outcome:"full_refund"}]}/>);
  expect(rows()).toEqual(before);
  fireEvent.click(screen.getByRole("button",{name:"ยกเลิกการจอง"}));
  const form=screen.getByRole("heading",{name:"จัดการเงินก่อนยกเลิกการจอง"}).closest("form")!;
  expect(form.textContent).toContain("รับเงินทั้งหมด: 400 THB · คืนแล้ว: 100 THB · ยอดที่ต้องจัดการ: 300 THB");
});

// Follow the same expand step as a user; all original payload/rule assertions remain.
const openForm=(name:string)=>{
  if(!screen.queryByRole("heading",{name})) {
    const label=name==="สร้างการขายโดยตรง"?"ขายโดยตรง":name;
    const toggle=[...screen.getAllByRole("button",{name:label})].find(button=>button.hasAttribute("aria-expanded"))!;
    fireEvent.click(toggle);
  }
  return screen.getByRole("heading",{name}).closest("form")!;
};

it("starts with collapsed create modes, opens only one, and retains draft input when switching",()=>{
  render(<Commercial {...props} reservations={[]} sales={[]}/>);
  expect(screen.queryByRole("heading",{name:"สร้างการจอง"})).toBeNull();
  expect(screen.queryByRole("heading",{name:"สร้างการขายโดยตรง"})).toBeNull();
  const form=openForm("สร้างการจอง");
  fireEvent.change(within(form).getByLabelText("ราคาที่ตกลงสำหรับการจอง"),{target:{value:"1200"}});
  openForm("สร้างการขายโดยตรง");
  expect(screen.queryByRole("heading",{name:"สร้างการจอง"})).toBeNull();
  expect((within(openForm("สร้างการจอง")).getByLabelText("ราคาที่ตกลงสำหรับการจอง") as HTMLInputElement).value).toBe("1200");
  expect(screen.queryByRole("heading",{name:"สร้างการขายโดยตรง"})).toBeNull();
  expect(mocks.invoke).not.toHaveBeenCalled();
});

it("keeps payment and refund history visible while write forms are collapsed and mutually exclusive",()=>{
  render(<Commercial {...props}/>);
  fireEvent.click(screen.getByRole("button",{name:/Sunny.*14\/08\/2026/}));
  expect(screen.queryByRole("heading",{name:"รับชำระเงิน"})).toBeNull();
  expect(screen.queryByRole("heading",{name:"คืนเงิน"})).toBeNull();
  expect(screen.getByRole("region",{name:"ประวัติการคืนเงิน"}).textContent).toContain("100 THB");
  fireEvent.click(screen.getByRole("button",{name:/1000 THB/}));
  expect(screen.getByRole("button",{name:"คืนเงิน"}).getAttribute("aria-expanded")).toBe("false");
  openForm("คืนเงิน");
  expect(screen.queryByRole("heading",{name:"รับชำระเงิน"})).toBeNull();
  openForm("รับชำระเงิน");
  expect(screen.queryByRole("heading",{name:"คืนเงิน"})).toBeNull();
  expect(screen.getByRole("button",{name:/1000 THB/})).toBeTruthy();
});

it.each(["draft","confirmed","completed","cancelled"])("preserves lifecycle controls for %s Sales",status=>{
  render(<Commercial {...props} sales={[{...sales[0],status,agreedPrice:100,currency:"THB"}]} payments={[]} refunds={[]}/>);
  fireEvent.click(screen.getByRole("button",{name:/Moon.*14\/08\/2026/}));
  expect(Boolean(screen.queryByRole("button",{name:"ยืนยันการขาย"}))).toBe(status==="draft");
  expect(Boolean(screen.queryByRole("button",{name:"ยกเลิกการขาย"}))).toBe(["draft","confirmed"].includes(status));
  expect(screen.queryByRole("button",{name:"ปิดการขาย"})).toBeNull();
  expect(screen.queryByRole("heading",{name:"รับชำระเงิน"})).toBeNull();
  expect(screen.getByRole("region",{name:"ประวัติการขาย"})).toBeTruthy();
});

it("opens Reservation detail without the registries or creation forms and preserves its agreement",()=>{
  const {container}=render(<Commercial {...props} reservations={[{...reservations[0],agreedPrice:1500,currency:"THB"}]}/>);
  fireEvent.click(screen.getByRole("button",{name:/Sunny.*14\/08\/2026/}));
  expect(container.querySelector(".sales-registry")).toBeNull();
  expect(container.querySelector(".reservation-registry")).toBeNull();
  expect(screen.getByRole("button",{name:"สร้างการขายจากการจอง"}).getAttribute("aria-expanded")).toBe("false");
  expect(screen.getByRole("button",{name:"หมดอายุการจอง"}).getAttribute("aria-expanded")).toBe("false");
  expect(screen.getByRole("button",{name:"ยกเลิกการจอง"})).toBeTruthy();
  expect(container.textContent).toContain("1500 THB");
  expect(container.textContent).not.toMatch(/bird-secret|reservation-secret|customer-secret|payment-secret/);
});

it.each(["sold","given_away","deceased","lost"])("excludes %s birds from Reservation and Direct Sale selectors while preserving registry data",status=>{const terminal={...birds[0],status};render(<Commercial {...props} birds={[terminal,birds[1]]} reservations={[]} sales={[]}/>);for(const formName of ["สร้างการจอง","สร้างการขายโดยตรง"]){const form=openForm(formName);expect(within(form).queryByRole("option",{name:/TH-001/})).toBeNull();expect(within(form).getByRole("option",{name:/TH-002/})).toBeTruthy();}});

it("shows an otherwise eligible active Bird in both commercial selectors",()=>{render(<Commercial {...props} reservations={[]} sales={[]}/>);for(const formName of ["สร้างการจอง","สร้างการขายโดยตรง"]){const form=openForm(formName);expect(within(form).getByRole("option",{name:/TH-001/})).toBeTruthy();}});

it("excludes an actively reserved Bird from both commercial selectors",()=>{render(<Commercial {...props} sales={[]}/>);for(const formName of ["สร้างการจอง","สร้างการขายโดยตรง"]){const form=openForm(formName);expect(within(form).queryByRole("option",{name:/TH-001/})).toBeNull();}});

it.each(["draft","confirmed","completed"])("excludes a Bird with a %s Sale from both commercial selectors",status=>{const committed=[{...sales[0],birdId:"bird-secret-1",status}];render(<Commercial {...props} reservations={[]} sales={committed}/>);for(const formName of ["สร้างการจอง","สร้างการขายโดยตรง"]){const form=openForm(formName);expect(within(form).queryByRole("option",{name:/TH-001/})).toBeNull();}});

it("allows a Bird with only a cancelled Sale back into both selectors",()=>{const cancelled=[{...sales[0],birdId:"bird-secret-1",status:"cancelled"}];render(<Commercial {...props} reservations={[]} sales={cancelled}/>);for(const formName of ["สร้างการจอง","สร้างการขายโดยตรง"]){const form=openForm(formName);expect(within(form).getByRole("option",{name:/TH-001/})).toBeTruthy();}});

it.each(["planned","completed"])("excludes a Bird with a %s Giveaway from Reservation and Direct Sale selectors",status=>{const giveaways=[{giveawayId:"giveaway-secret-1",birdId:"bird-secret-1",recipientName:"ผู้รับทดสอบ",givenOn:"2026-08-14",status}];render(<Commercial {...props} reservations={[]} sales={[]} giveaways={giveaways}/>);for(const formName of ["สร้างการจอง","สร้างการขายโดยตรง"]){const form=openForm(formName);expect(within(form).queryByRole("option",{name:/TH-001/})).toBeNull();expect(within(form).getByRole("option",{name:/TH-002/})).toBeTruthy();}});

it("allows a Bird with only a cancelled Giveaway back into both commercial selectors",()=>{const giveaways=[{giveawayId:"giveaway-secret-1",birdId:"bird-secret-1",recipientName:"ผู้รับทดสอบ",givenOn:"2026-08-14",status:"cancelled"}];render(<Commercial {...props} reservations={[]} sales={[]} giveaways={giveaways}/>);for(const formName of ["สร้างการจอง","สร้างการขายโดยตรง"]){const form=openForm(formName);expect(within(form).getByRole("option",{name:/TH-001/})).toBeTruthy();}});

it("presents human contexts and conceals canonical IDs",()=>{render(<Commercial {...props}/>);expect(screen.getAllByText(/Sunny/).length).toBeGreaterThan(0);expect(screen.getAllByText(/สมชาย/).length).toBeGreaterThan(0);expect(screen.getAllByText(/14\/08\/2026/).length).toBeGreaterThan(0);for(const id of ["bird-secret-1","customer-secret-1","reservation-secret-1","payment-secret-1","sale-secret-1"])expect(screen.queryByText(id)).toBeNull();});

it("distinguishes Customer from Orange Ring Bird identity and shows only trusted related records",()=>{const completed=[{...sales[0],status:"completed",completedOn:"2026-08-18"}],deliveries=[{deliveryId:"delivery-secret",saleId:"sale-secret-1",distanceKm:14,shippingFee:120,currency:"THB",createdOn:"2026-08-18",status:"planned"}],handovers=[{handoverId:"handover-secret",saleId:"sale-secret-1",birdId:"bird-secret-2",handoverOn:"2026-08-19",recipientSnapshot:{name:"สมชาย"},status:"completed"}];const {container}=render(<Commercial {...props} sales={completed} deliveries={deliveries} handovers={handovers}/>);const sale=screen.getByRole("button",{name:/สมชาย.*Moon.*Ring ID: TH-002.*ขายเสร็จสิ้น/});expect(within(sale).getByText("ลูกค้า")).toBeTruthy();expect(sale.querySelectorAll(".orange-ring")).toHaveLength(1);fireEvent.click(sale);expect(screen.getByText("120 THB")).toBeTruthy();expect(screen.getByText(/19\/08\/2026.*สมชาย/)).toBeTruthy();expect(container.textContent).not.toContain("delivery-secret");expect(container.textContent).not.toContain("handover-secret");expect(screen.queryByText(/ยอดคงเหลือการขาย|เปอร์เซ็นต์ชำระ/)).toBeNull();});

it("uses a restrained canonical status and truthful Commercial Ledger language",()=>{const salePayment={paymentId:"sale-payment-secret",saleId:"sale-secret-1",amount:3500,currency:"THB",receivedOn:"2026-08-14",paymentMethod:"cash",status:"received"};const {container}=render(<Commercial {...props} payments={[...payments,salePayment]}/>);expect(within(screen.getByRole("region",{name:"รายการขาย"})).getByText("การชำระเงิน 1 รายการ")).toBeTruthy();expect(container.textContent).not.toMatch(/ชำระครบ|paid in full|settled/i);fireEvent.click(screen.getByRole("button",{name:/Moon.*14\/08\/2026/}));const hero=container.querySelector(".sale-detail-hero")!;expect(hero.querySelector(".status-badge")?.textContent).toBe("แบบร่าง");expect(hero.querySelector(".sale-status-orb")).toBeNull();const ledger=container.querySelector(".commercial-ledger") as HTMLElement,paymentRow=ledger.querySelector(".commercial-ledger-row") as HTMLElement;expect(within(paymentRow).getByText("3500 THB")).toBeTruthy();expect(within(paymentRow).getByText("14/08/2026")).toBeTruthy();expect(within(paymentRow).getByText("เงินสด")).toBeTruthy();expect(within(paymentRow).getByText("รับเงินแล้ว")).toBeTruthy();});

it.each([["cash","เงินสด"],["transfer","โอนเงิน / พร้อมเพย์"],["card","บัตรเครดิต/เดบิต"],["other","อื่น ๆ"]])("submits canonical payment method %s for %s",async(method,label)=>{mocks.invoke.mockResolvedValue({paymentId:"new-payment"});render(<Commercial {...props}/>);fireEvent.click(screen.getByRole("button",{name:/Sunny.*14\/08\/2026/}));const form=openForm("รับชำระเงิน");const select=within(form).getByLabelText("วิธีชำระเงิน") as HTMLSelectElement;expect((within(select).getByRole("option",{name:label}) as HTMLOptionElement).value).toBe(method);fireEvent.change(within(form).getByLabelText("จำนวนเงิน"),{target:{value:"250"}});fireEvent.change(select,{target:{value:method}});fireEvent.change(within(form).getByLabelText("วันที่รับเงิน"),{target:{value:"16082026"}});fireEvent.submit(form);expect(mocks.invoke).toHaveBeenCalledWith("recordPayment",{reservationId:"reservation-secret-1",amount:250,currency:"THB",paymentMethod:method,receivedOn:"2026-08-16"});});

it("PAY-03 blocks payment submit without a method and preserves entered values",async()=>{mocks.invoke.mockResolvedValue({paymentId:"new-payment"});render(<Commercial {...props}/>);fireEvent.click(screen.getByRole("button",{name:/Sunny.*14\/08\/2026/}));const form=openForm("รับชำระเงิน"),amount=within(form).getByLabelText("จำนวนเงิน") as HTMLInputElement,date=within(form).getByLabelText("วันที่รับเงิน") as HTMLInputElement,method=within(form).getByLabelText("วิธีชำระเงิน") as HTMLSelectElement;fireEvent.change(amount,{target:{value:"250"}});fireEvent.change(date,{target:{value:"16082026"}});fireEvent.submit(form);expect(mocks.invoke.mock.calls.some(([operation])=>operation==="recordPayment")).toBe(false);expect(within(form).getByText("กรุณากรอกข้อมูลการชำระเงินให้ถูกต้อง")).toBeTruthy();expect(amount.value).toBe("250");expect(date.value).toBe("16/08/2026");fireEvent.change(method,{target:{value:"transfer"}});fireEvent.submit(form);expect(mocks.invoke).toHaveBeenCalledWith("recordPayment",{reservationId:"reservation-secret-1",amount:250,currency:"THB",paymentMethod:"transfer",receivedOn:"2026-08-16"});});

it("keeps Reservation semantically separate with its own date, expiry, and status",()=>{const {container}=render(<Commercial {...props}/>);const reservation=screen.getByRole("button",{name:/Sunny.*สมชาย/});expect(within(reservation).getByText("จอง 14/08/2026")).toBeTruthy();expect(within(reservation).getByText("หมดอายุ 20/08/2026")).toBeTruthy();expect(within(reservation).getByText("กำลังจอง")).toBeTruthy();expect(container.querySelector(".reservation-registry .sale-passage-link")).toBeNull();});

it("shows only active unconverted Reservations in the work queue",()=>{const variants=[reservations[0],{...reservations[0],reservationId:"cancelled",status:"cancelled"},{...reservations[0],reservationId:"expired",status:"expired"}];const {container}=render(<Commercial {...props} reservations={variants}/>);const reservationForm=openForm("สร้างการจอง");expect(within(reservationForm).getAllByRole("option",{name:/สมชาย.*ใช้งานอยู่/}).length).toBeGreaterThan(0);const queue=container.querySelector(".reservation-registry") as HTMLElement;expect(within(queue).getByText("กำลังจอง")).toBeTruthy();expect(within(queue).queryByText("ยกเลิกการจอง")).toBeNull();expect(within(queue).queryByText("การจองหมดอายุ")).toBeNull();fireEvent.click(within(queue).getByRole("button",{name:/Sunny.*สมชาย/}));expect(screen.getByText("สถานะ: กำลังจอง")).toBeTruthy();});

it("creates a reservation from selected contexts and canonicalizes dates",async()=>{const onRefresh=vi.fn();mocks.invoke.mockResolvedValue({reservationId:"new"});render(<Commercial {...props} reservations={[]} onRefresh={onRefresh}/>);const reservationForm=openForm("สร้างการจอง");fireEvent.click(within(reservationForm).getByRole("option",{name:/TH-001/}));fireEvent.click(within(reservationForm).getByRole("option",{name:/สมชาย/}));fireEvent.change(within(reservationForm).getByLabelText("วันที่จอง"),{target:{value:"14082026"}});fireEvent.change(within(reservationForm).getByLabelText("วันหมดอายุ"),{target:{value:"20082026"}});fireEvent.submit(reservationForm);expect(mocks.invoke).toHaveBeenCalledWith("createReservation",{birdId:"bird-secret-1",customerId:"customer-secret-1",reservedOn:"2026-08-14",expiresOn:"2026-08-20"});await waitFor(()=>expect(onRefresh).toHaveBeenCalledTimes(1));});

it("captures optional THB agreement snapshots and keeps reservation conversion read-only",async()=>{const onRefresh=vi.fn();mocks.invoke.mockResolvedValue({reservationId:"new"});render(<Commercial {...props} reservations={[]} onRefresh={onRefresh}/>);const reservationForm=openForm("สร้างการจอง");fireEvent.click(within(reservationForm).getByRole("option",{name:/TH-001/}));fireEvent.click(within(reservationForm).getByRole("option",{name:/สมชาย/}));fireEvent.change(within(reservationForm).getByLabelText("วันที่จอง"),{target:{value:"14082026"}});fireEvent.change(within(reservationForm).getByLabelText("ราคาที่ตกลงสำหรับการจอง"),{target:{value:"1250.5"}});fireEvent.submit(reservationForm);expect(mocks.invoke).toHaveBeenCalledWith("createReservation",{birdId:"bird-secret-1",customerId:"customer-secret-1",reservedOn:"2026-08-14",agreedPrice:1250.5,currency:"THB"});const priced=[{...reservations[0],agreedPrice:1250.5,currency:"THB"}];render(<Commercial {...props} reservations={priced}/>);fireEvent.click(screen.getAllByRole("button",{name:/Sunny.*สมชาย/})[0]);expect(screen.getAllByText(/1250.5 THB/).length).toBeGreaterThan(0);const conversion=openForm("สร้างการขายจากการจอง");expect(within(conversion).queryByLabelText("ราคาที่ตกลงสำหรับการขาย")).toBeNull();});

it("requires and submits a THB sale price when the linked Reservation has no snapshot",async()=>{const onRefresh=vi.fn();mocks.invoke.mockResolvedValue({saleId:"new-sale"});render(<Commercial {...props} onRefresh={onRefresh}/>);fireEvent.click(screen.getByRole("button",{name:/Sunny.*14\/08\/2026/}));const conversion=openForm("สร้างการขายจากการจอง");const price=within(conversion).getByLabelText("ราคาที่ตกลงสำหรับการขาย") as HTMLInputElement;expect(price.required).toBe(true);expect(conversion.textContent).toContain("ราคาที่ตกลง (THB) *");fireEvent.change(within(conversion).getByLabelText("วันที่สร้างการขาย"),{target:{value:"09092026"}});fireEvent.submit(conversion);expect(within(conversion).getByText("ราคาที่ตกลงต้องมากกว่าศูนย์")).toBeTruthy();expect(mocks.invoke).not.toHaveBeenCalled();fireEvent.change(price,{target:{value:"0"}});fireEvent.submit(conversion);expect(mocks.invoke).not.toHaveBeenCalled();fireEvent.change(price,{target:{value:"1000"}});fireEvent.submit(conversion);expect(mocks.invoke).toHaveBeenCalledWith("createSale",{birdId:"bird-secret-1",customerId:"customer-secret-1",reservationId:"reservation-secret-1",agreedPrice:1000,currency:"THB",createdOn:"2026-09-09"});await waitFor(()=>expect(onRefresh).toHaveBeenCalledTimes(1));});

it("hides Close Sale while a confirmed Sale still has a remaining balance",()=>{const converted=[{...sales[0],birdId:"bird-secret-1",reservationId:"reservation-secret-1",status:"confirmed",agreedPrice:1000,currency:"THB"}];const {container}=render(<Commercial {...props} sales={converted}/>);fireEvent.click(screen.getByRole("button",{name:/Sunny.*ยืนยันแล้ว/}));expect(container.querySelector(".sale-detail-hero .status-badge")?.textContent).toBe("ยืนยันแล้ว");expect(screen.queryByRole("button",{name:"ยืนยันการขาย"})).toBeNull();expect(screen.queryByRole("heading",{name:"ปิดการขาย"})).toBeNull();expect(screen.getByText("ยังมียอดคงเหลือ ต้องชำระครบก่อนปิดการขาย")).toBeTruthy();});

it("removes a converted Reservation from the queue and preserves Sale provenance",()=>{const converted=[{...sales[0],birdId:"bird-secret-1",reservationId:"reservation-secret-1",status:"confirmed",agreedPrice:1000,currency:"THB"}];const {container}=render(<Commercial {...props} sales={converted}/>);const queue=container.querySelector(".reservation-registry") as HTMLElement;expect(within(queue).queryByRole("button",{name:/Sunny.*สมชาย/})).toBeNull();expect(within(queue).getByText("ไม่มีการจองที่กำลังดำเนินการ")).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:/Sunny.*ยืนยันแล้ว/}));expect(screen.getByText(/สร้างจากการจองวันที่ 14\/08\/2026/)).toBeTruthy();expect(screen.getByText(/วันหมดอายุเดิม 20\/08\/2026/)).toBeTruthy();});

it("includes the Reservation deposit in a fully paid Sale, hides payment entry, and shows Close Sale",()=>{const converted=[{...sales[0],birdId:"bird-secret-1",reservationId:"reservation-secret-1",status:"confirmed",agreedPrice:1000,currency:"THB"}],combined=[{...payments[0],amount:200},{paymentId:"sale-payment",saleId:"sale-secret-1",amount:800,currency:"THB",receivedOn:"2026-09-09",paymentMethod:"cash",status:"received"}];const {container}=render(<Commercial {...props} sales={converted} payments={combined} refunds={[]}/>);fireEvent.click(screen.getByRole("button",{name:/Sunny.*ยืนยันแล้ว/}));const summary=container.querySelector(".commercial-ledger > .sales-truth-note")!;expect(summary.textContent).toContain("รับชำระสุทธิ: 1000 THB");expect(summary.textContent).toContain("คงเหลือ: 0 THB");expect(screen.getByText("ชำระครบแล้ว")).toBeTruthy();expect(screen.queryByRole("heading",{name:"รับชำระเงิน"})).toBeNull();expect(screen.getAllByText("รับเงินแล้ว")).toHaveLength(2);expect(screen.getByRole("button",{name:"ปิดการขาย"}).getAttribute("aria-expanded")).toBe("false");expect(screen.queryByRole("heading",{name:"ปิดการขาย"})).toBeNull();});

it("reopens the Sale balance after a refund, hides Close Sale, and blocks frontend overpayment",()=>{const converted=[{...sales[0],birdId:"bird-secret-1",reservationId:"reservation-secret-1",status:"confirmed",agreedPrice:1000,currency:"THB"}],combined=[{...payments[0],amount:200},{paymentId:"sale-payment",saleId:"sale-secret-1",amount:800,currency:"THB",receivedOn:"2026-09-09",paymentMethod:"cash",status:"received"}],saleRefunds=[{refundId:"sale-refund",paymentId:"sale-payment",amount:100,outcome:"partial_refund",refundedOn:"2026-09-10",reason:"adjustment"}];const {container}=render(<Commercial {...props} sales={converted} payments={combined} refunds={saleRefunds}/>);fireEvent.click(screen.getByRole("button",{name:/Sunny.*ยืนยันแล้ว/}));expect(container.querySelector(".commercial-ledger > .sales-truth-note")?.textContent).toContain("คงเหลือ: 100 THB");expect(screen.getByText("ยังมียอดคงเหลือ ต้องชำระครบก่อนปิดการขาย")).toBeTruthy();expect(screen.queryByRole("heading",{name:"ปิดการขาย"})).toBeNull();const form=openForm("รับชำระเงิน");fireEvent.change(within(form).getByLabelText("จำนวนเงิน"),{target:{value:"101"}});fireEvent.change(within(form).getByLabelText("วิธีชำระเงิน"),{target:{value:"cash"}});fireEvent.change(within(form).getByLabelText("วันที่รับเงิน"),{target:{value:"11092026"}});fireEvent.submit(form);expect(within(form).getByText("จำนวนเงินต้องไม่เกินยอดคงเหลือ 100 THB")).toBeTruthy();expect(mocks.invoke.mock.calls.some(([operation])=>operation==="recordPayment")).toBe(false);});

it("records payment and refund from selected reservation and payment contexts",async()=>{mocks.invoke.mockResolvedValue({});const onRefresh=vi.fn();render(<Commercial {...props} onRefresh={onRefresh}/>);fireEvent.click(screen.getByRole("button",{name:/Sunny.*14\/08\/2026/}));const paymentForm=openForm("รับชำระเงิน"),receivedOn=within(paymentForm).getByLabelText("วันที่รับเงิน") as HTMLInputElement;fireEvent.click(receivedOn);expect(document.activeElement).toBe(receivedOn);expect(document.activeElement).not.toBe(paymentForm.querySelector('input[type="date"]'));fireEvent.change(within(paymentForm).getByLabelText("จำนวนเงิน"),{target:{value:"250"}});fireEvent.change(within(paymentForm).getByLabelText("วิธีชำระเงิน"),{target:{value:"cash"}});fireEvent.change(receivedOn,{target:{value:"16082026"}});fireEvent.submit(paymentForm);expect(mocks.invoke).toHaveBeenCalledWith("recordPayment",{reservationId:"reservation-secret-1",amount:250,currency:"THB",paymentMethod:"cash",receivedOn:"2026-08-16"});fireEvent.click(screen.getByRole("button",{name:/1000 THB/}));const refundForm=openForm("คืนเงิน");expect(within(refundForm).getByText(/คงเหลือ: 900/)).toBeTruthy();fireEvent.change(within(refundForm).getByLabelText("รูปแบบคืนเงิน"),{target:{value:"partial_refund"}});fireEvent.change(within(refundForm).getByLabelText("จำนวนเงินคืน"),{target:{value:"200"}});fireEvent.change(within(refundForm).getByLabelText("เหตุผลคืนเงิน"),{target:{value:"customer request"}});fireEvent.change(within(refundForm).getByLabelText("วันที่คืนเงิน"),{target:{value:"17082026"}});fireEvent.submit(refundForm);expect(mocks.invoke).toHaveBeenCalledWith("refundPayment",{paymentId:"payment-secret-1",outcome:"partial_refund",amount:200,reason:"customer request",refundedOn:"2026-08-17"});await waitFor(()=>expect(onRefresh).toHaveBeenCalledTimes(2));});

it("creates, confirms, and closes fully paid sales using internal selected IDs, preserving failed input",async()=>{mocks.invoke.mockResolvedValue({saleId:"new-sale"});const onRefresh=vi.fn();const view=render(<Commercial {...props} reservations={[]} sales={[]} onRefresh={onRefresh}/>);const direct=openForm("สร้างการขายโดยตรง");fireEvent.click(within(direct).getByRole("option",{name:/TH-001/}));fireEvent.click(within(direct).getByRole("option",{name:/สมชาย/}));fireEvent.change(within(direct).getByLabelText("วันที่สร้างการขาย"),{target:{value:"14082026"}});fireEvent.submit(direct);expect(mocks.invoke).toHaveBeenCalledWith("createSale",{birdId:"bird-secret-1",customerId:"customer-secret-1",createdOn:"2026-08-14"});await waitFor(()=>expect(onRefresh).toHaveBeenCalledTimes(1));view.rerender(<Commercial {...props} reservations={[]} onRefresh={onRefresh}/>);fireEvent.click(screen.getByRole("button",{name:/Moon.*14\/08\/2026/}));fireEvent.click(screen.getByRole("button",{name:"ยืนยันการขาย"}));expect(mocks.invoke).toHaveBeenCalledWith("confirmSale",{saleId:"sale-secret-1"});await waitFor(()=>expect(onRefresh).toHaveBeenCalledTimes(2));const paidSale={...sales[0],status:"confirmed",agreedPrice:100,currency:"THB"},paid=[{paymentId:"paid",saleId:"sale-secret-1",amount:100,currency:"THB",receivedOn:"2026-08-17",paymentMethod:"cash",status:"received"}];view.rerender(<Commercial {...props} reservations={[]} sales={[paidSale]} payments={paid} refunds={[]} onRefresh={onRefresh}/>);mocks.invoke.mockRejectedValueOnce(new Error("failed"));const close=openForm("ปิดการขาย");const date=within(close).getByLabelText("วันที่ปิดการขาย") as HTMLInputElement;fireEvent.change(date,{target:{value:"18082026"}});fireEvent.submit(close);expect(mocks.invoke).toHaveBeenCalledWith("completeSale",{saleId:"sale-secret-1",completedOn:"2026-08-18"});expect(date.value).toBe("18/08/2026");expect(onRefresh).toHaveBeenCalledTimes(2);});

it("renders Thai Sale Timeline labels, preserves unknown events, and conceals internal codes",async()=>{const events=[{saleTimelineId:"created",eventType:"sale_created",occurredAt:"2026-08-14"},{saleTimelineId:"payment",eventType:"payment_recorded",occurredAt:"2026-08-15"},{saleTimelineId:"refund",eventType:"refund_decision_recorded",occurredAt:"2026-08-16"},{saleTimelineId:"completed",eventType:"sale_completed",occurredAt:"2026-08-17"},{saleTimelineId:"timeline-secret",eventType:"legacy_manual_adjustment",occurredAt:"2026-08-18"}];mocks.invoke.mockImplementation(async(operation:string)=>operation==="listSaleTimeline"?events:{});const {container}=render(<Commercial {...props}/>);fireEvent.click(screen.getByRole("button",{name:/Moon.*14\/08\/2026/}));const timeline=await screen.findByRole("region",{name:"ประวัติการขาย"});for(const label of ["สร้างรายการขาย","บันทึกการชำระเงิน","บันทึกผลการคืนเงิน","ปิดการขาย","legacy manual adjustment"])expect(within(timeline).getByText(label)).toBeTruthy();for(const code of ["sale_created","payment_recorded","refund_decision_recorded","sale_completed"])expect(container.textContent).not.toContain(code);expect(container.textContent).not.toContain("timeline-secret");});
