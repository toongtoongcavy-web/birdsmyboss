import { expect, test, type Locator, type Page } from "@playwright/test";

const today = "03/10/2026";

const formByHeading = (page: Page, name: string) => page.getByRole("heading", { name, exact: true }).locator("xpath=ancestor::form[1]");
const sectionByHeading = (page: Page, name: string) => page.getByRole("heading", { name, exact: true }).locator("xpath=ancestor::section[1]");

async function chooseSearchResult(form: Locator, kind: "นก" | "ลูกค้า", query: string, result: RegExp) {
  await form.getByLabel(`ค้นหา${kind}`, { exact: true }).fill(query);
  await form.getByRole("option", { name: result }).click();
}

test("SALE CANCELLATION receives 5000, refunds 4500 and retains 500 before Handover", async ({ page }) => {
  const unique = `QA-E2E-CANCEL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const ringId = unique.toUpperCase();
  const birdName = `${unique}-Bird`;
  const customerName = `${unique}-Customer`;
  const recipientName = `${unique}-Recipient`;
  const agreedPrice = "5000";

  await page.goto("/");
  await page.evaluate(async () => {
    const auth = await import("/e2e/support/browser-auth.ts");
    await auth.signInPlaywrightOperator();
  });
  await expect(page.getByRole("navigation")).toContainText("ข้อมูลนก");

  await page.getByRole("button", { name: "ข้อมูลนก", exact: true }).click();
  const birdForm = formByHeading(page, "เพิ่มนกจากภายนอก");
  await birdForm.getByLabel("รหัสห่วงขา *").fill(ringId);
  await birdForm.getByLabel("ชื่อ *").fill(birdName);
  await birdForm.getByLabel("แหล่งที่มา *").selectOption("purchased");
  await birdForm.getByRole("textbox", { name: "วันฟัก/วันเกิด", exact: true }).fill("01092026");
  await birdForm.getByRole("button", { name: "บันทึก", exact: true }).click();
  const activeBirdRow = page.getByRole("button", { name: new RegExp(`Ring ID: ${ringId}.*Status: อยู่ในฟาร์ม`) });
  await expect(activeBirdRow).toBeVisible();

  await page.getByRole("button", { name: "ข้อมูลลูกค้า", exact: true }).click();
  const customerForm = formByHeading(page, "เพิ่มลูกค้า");
  await customerForm.getByLabel("ชื่อผู้ติดต่อ *").fill(customerName);
  await customerForm.getByLabel("โทรศัพท์").fill("0891234567");
  await customerForm.getByLabel("อีเมล").fill(`${unique.toLowerCase()}@example.test`);
  await customerForm.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByRole("button", { name: new RegExp(`Display Name: ${customerName}`) })).toBeVisible();

  await page.getByRole("button", { name: "การขาย", exact: true }).click();
  await page.getByRole("button", { name: "ขายโดยตรง", exact: true }).click();
  const saleForm = formByHeading(page, "สร้างการขายโดยตรง");
  await chooseSearchResult(saleForm, "นก", ringId, new RegExp(ringId));
  await chooseSearchResult(saleForm, "ลูกค้า", customerName, new RegExp(customerName));
  await saleForm.getByLabel("ราคาที่ตกลงสำหรับการขาย").fill(agreedPrice);
  await saleForm.getByRole("textbox", { name: "วันที่สร้างการขาย", exact: true }).fill(today);
  await saleForm.getByRole("button", { name: "สร้างการขาย", exact: true }).click();
  await expect(saleForm.getByText("สร้างการขายสำเร็จ", { exact: true })).toBeVisible();

  const draftSale = page.getByRole("button", { name: new RegExp(`${customerName}.*${birdName}.*แบบร่าง`) });
  await expect(draftSale).toBeVisible();
  await draftSale.click();
  await page.getByRole("button", { name: "ยืนยันการขาย", exact: true }).click();
  await expect(page.locator(".sale-detail-hero").getByText("ยืนยันแล้ว", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "รับชำระเงิน", exact: true }).click();
  const paymentForm = formByHeading(page, "รับชำระเงิน");
  await paymentForm.getByLabel("จำนวนเงิน").fill(agreedPrice);
  await paymentForm.getByLabel("วิธีชำระเงิน").selectOption("transfer");
  await paymentForm.getByRole("textbox", { name: "วันที่รับเงิน", exact: true }).fill(today);
  await paymentForm.getByRole("button", { name: "บันทึกการชำระเงิน", exact: true }).click();
  await expect(page.getByText("ชำระครบแล้ว", { exact: true })).toBeVisible();
  await expect(page.getByText("คงเหลือ: 0 THB", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "ยกเลิกการขาย", exact: true }).click();
  const cancellation = formByHeading(page, "จัดการเงินก่อนยกเลิกการขาย");
  await expect(cancellation).toContainText("รับเงินทั้งหมด: 5000 THB · คืนแล้ว: 0 THB · ยอดที่ต้องจัดการ: 5000 THB");
  await expect(page.locator('.sale-detail-hero')).toContainText("ยืนยันแล้ว");
  await cancellation.getByLabel("การจัดการเงินก่อนยกเลิกการขาย").selectOption("partial_refund");
  await cancellation.getByLabel("จำนวนเงินคืนเมื่อยกเลิกการขาย").fill("4500");
  await cancellation.getByLabel("เหตุผลยกเลิกการขาย").fill("ลูกค้าไม่รับนก ตกลงเก็บค่าชดเชย 500 บาท");
  await cancellation.getByRole("textbox",{name:"วันที่มีผล / คืนเงิน",exact:true}).fill(today);
  await cancellation.getByRole("button",{name:"ยืนยันยกเลิกการขาย",exact:true}).click();
  await expect(page.locator('.sale-detail-hero')).toContainText("ยกเลิก");
  await expect(page.getByRole('region',{name:'ประวัติการคืนเงิน'})).toContainText("4500 THB");
  await expect(page.locator('.commercial-ledger')).toContainText("ยอดที่คงไว้: 500 THB");
  await expect(page.getByRole('region',{name:'ประวัติการขาย'})).toContainText("ยกเลิกการขาย");
  await expect(page.getByRole('button',{name:'รับชำระเงิน',exact:true})).toHaveCount(0);
  // Read-only callable assertions complement the visible audit history.
  const facts=await page.evaluate(async({birdName,customerName})=>{
    const {invoke}=await import('/src/functions.ts');
    const birds=await invoke('listBirds',{limit:50}) as any[];
    const customers=await invoke('listCustomers',{limit:50}) as any[];
    const bird=birds.find(row=>row.displayName===birdName),customer=customers.find(row=>row.displayName===customerName);
    const sales=await invoke('listSales',{limit:50}) as any[];
    const sale=sales.find(row=>row.birdId===bird.birdId&&row.customerId===customer.customerId);
    const summary=await invoke('listSales',{saleId:sale.saleId,cancellationSummary:true}) as any[];
    const handovers=await invoke('listHandovers',{limit:50}) as any[];
    return {status:sale.status,birdStatus:bird.status,money:summary[0].cancellationSummary,handovers:handovers.filter(row=>row.saleId===sale.saleId&&row.status==='completed').length};
  },{birdName,customerName});
  expect(facts).toEqual({status:'cancelled',birdStatus:'active',money:{grossReceived:5000,refundTotal:4500,netRetained:500},handovers:0});
  await page.getByRole("button",{name:"ข้อมูลนก",exact:true}).click();
  await expect(page.getByRole("button",{name:new RegExp(`Ring ID: ${ringId}.*Status: อยู่ในฟาร์ม`)})).toBeVisible();
});
