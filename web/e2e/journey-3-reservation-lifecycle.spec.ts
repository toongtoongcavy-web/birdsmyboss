import { expect, test, type Locator, type Page } from "@playwright/test";

const reservedOn = "03/10/2026";
const expiresOn = "10/10/2026";
const agreedPrice = "2000";
const deposit = "500";
const remainingPayment = "1500";

const formByHeading = (page: Page, name: string) => page.getByRole("heading", { name, exact: true }).locator("xpath=ancestor::form[1]");

async function chooseSearchResult(form: Locator, kind: "นก" | "ลูกค้า", query: string, result: RegExp) {
  await form.getByLabel(`ค้นหา${kind}`, { exact: true }).fill(query);
  await form.getByRole("option", { name: result }).click();
}

test("JOURNEY-3 Reservation deposit rolls into a confirmed Sale and only the remaining balance is paid", async ({ page }) => {
  test.setTimeout(300_000);
  const unique = `QA-E2E-J3-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const ringId = unique.toUpperCase();
  const birdName = `${unique}-Bird`;
  const customerName = `${unique}-Customer`;

  await page.goto("/");
  await page.evaluate(async () => {
    const auth = await import("/e2e/support/browser-auth.ts");
    await auth.signInPlaywrightOperator();
  });
  await expect(page.getByRole("navigation")).toContainText("การขาย");

  await page.getByRole("button", { name: "ข้อมูลนก", exact: true }).click();
  const birdForm = formByHeading(page, "เพิ่มนกจากภายนอก");
  await birdForm.getByLabel("รหัสห่วงขา *").fill(ringId);
  await birdForm.getByLabel("ชื่อ *").fill(birdName);
  await birdForm.getByLabel("แหล่งที่มา *").selectOption("external");
  await birdForm.getByRole("textbox", { name: "วันฟัก/วันเกิด", exact: true }).fill("01092026");
  await birdForm.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByRole("button", { name: new RegExp(`Ring ID: ${ringId}.*Status: อยู่ในฟาร์ม`) })).toBeVisible();

  await page.getByRole("button", { name: "ข้อมูลลูกค้า", exact: true }).click();
  const customerForm = formByHeading(page, "เพิ่มลูกค้า");
  await customerForm.getByLabel("ชื่อผู้ติดต่อ *").fill(customerName);
  await customerForm.getByLabel("โทรศัพท์").fill("0893330003");
  await customerForm.getByLabel("อีเมล").fill(`${unique.toLowerCase()}@example.test`);
  await customerForm.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByRole("button", { name: new RegExp(`Display Name: ${customerName}`) })).toBeVisible();

  await page.getByRole("button", { name: "การขาย", exact: true }).click();
  const reservationForm = formByHeading(page, "สร้างการจอง");
  await chooseSearchResult(reservationForm, "นก", ringId, new RegExp(ringId));
  await chooseSearchResult(reservationForm, "ลูกค้า", customerName, new RegExp(customerName));
  await reservationForm.getByRole("textbox", { name: "วันที่จอง", exact: true }).fill(reservedOn);
  await reservationForm.getByRole("textbox", { name: "วันหมดอายุ", exact: true }).fill(expiresOn);
  await reservationForm.getByLabel("ราคาที่ตกลงสำหรับการจอง").fill(agreedPrice);
  await reservationForm.getByRole("button", { name: "สร้างการจอง", exact: true }).click();

  const activeQueue = page.getByRole("heading", { name: "การจอง", exact: true }).locator("xpath=ancestor::section[1]");
  const reservationRow = activeQueue.getByRole("button", { name: new RegExp(`${birdName}.*${customerName}.*กำลังจอง.*03/10/2026.*10/10/2026`) });
  await expect(reservationRow).toBeVisible();
  await reservationRow.click();

  const reservationDetail = page.getByRole("heading", { name: "Reservation Detail", exact: true }).locator("xpath=ancestor::section[1]");
  await expect(reservationDetail).toContainText(birdName);
  await expect(reservationDetail).toContainText(customerName);
  await expect(reservationDetail).toContainText("วันที่จอง: 03/10/2026");
  await expect(reservationDetail).toContainText("วันหมดอายุ: 10/10/2026");
  await expect(reservationDetail).toContainText("สถานะ: กำลังจอง");

  const depositForm = formByHeading(page, "รับชำระเงิน");
  await depositForm.getByLabel("จำนวนเงิน").fill(deposit);
  await depositForm.getByLabel("วิธีชำระเงิน").selectOption("transfer");
  await depositForm.getByRole("textbox", { name: "วันที่รับเงิน", exact: true }).fill(reservedOn);
  await depositForm.getByRole("button", { name: "บันทึกการชำระเงิน", exact: true }).click();
  await expect(reservationDetail.getByRole("button", { name: /500 THB.*03\/10\/2026.*โอนเงิน \/ พร้อมเพย์.*รับเงินแล้ว/ })).toBeVisible();
  await expect(reservationDetail).toContainText("รับชำระสุทธิ: 500 THB");
  await expect(reservationDetail).toContainText("คงเหลือ: 1500 THB");

  const conversionForm = formByHeading(page, "สร้างการขายจากการจอง");
  await expect(conversionForm).toContainText("ราคาที่ตกลง: 2000 THB");
  await conversionForm.getByRole("textbox", { name: "วันที่สร้างการขาย", exact: true }).fill(reservedOn);
  await conversionForm.getByRole("button", { name: "สร้างการขาย", exact: true }).click();
  await reservationDetail.getByRole("button", { name: "กลับไปรายการจอง", exact: true }).click();

  await expect(activeQueue.getByRole("button", { name: new RegExp(`${birdName}.*${customerName}`) })).toHaveCount(0);
  await expect(activeQueue).toContainText("ไม่มีการจองที่กำลังดำเนินการ");

  const confirmedSale = page.getByRole("button", { name: new RegExp(`${customerName}.*${birdName}.*ยืนยันแล้ว.*03/10/2026`) });
  await expect(confirmedSale).toBeVisible();
  await confirmedSale.click();

  const saleHeading = page.getByRole("heading", { name: `${customerName} → ${birdName}`, exact: true });
  const saleDetail = saleHeading.locator("xpath=ancestor::section[1]");
  const saleHeader = saleHeading.locator("xpath=ancestor::header[1]");
  await expect(saleHeader.getByText("ยืนยันแล้ว", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "ยืนยันการขาย", exact: true })).toHaveCount(0);
  await expect(saleDetail).toContainText("สร้างจากการจองวันที่ 03/10/2026");
  await expect(saleDetail).toContainText("วันหมดอายุเดิม 10/10/2026");
  await expect(saleDetail).toContainText("รับชำระสุทธิ: 500 THB");
  await expect(saleDetail).toContainText("คงเหลือ: 1500 THB");
  await expect(saleDetail.getByRole("button", { name: /500 THB.*03\/10\/2026.*โอนเงิน \/ พร้อมเพย์.*รับเงินแล้ว/ })).toBeVisible();

  const remainingForm = formByHeading(page, "รับชำระเงิน");
  await remainingForm.getByLabel("จำนวนเงิน").fill(remainingPayment);
  await remainingForm.getByLabel("วิธีชำระเงิน").selectOption("cash");
  await remainingForm.getByRole("textbox", { name: "วันที่รับเงิน", exact: true }).fill(reservedOn);
  await remainingForm.getByRole("button", { name: "บันทึกการชำระเงิน", exact: true }).click();
  await expect(saleDetail.getByRole("button", { name: /1500 THB.*03\/10\/2026.*เงินสด.*รับเงินแล้ว/ })).toBeVisible();
  await expect(saleDetail).toContainText("รับชำระสุทธิ: 2000 THB");
  await expect(saleDetail).toContainText("คงเหลือ: 0 THB");
  await expect(saleDetail.getByText("ชำระครบแล้ว", { exact: true })).toBeVisible();

  const completeForm = formByHeading(page, "ปิดการขาย");
  await completeForm.getByRole("textbox", { name: "วันที่ปิดการขาย", exact: true }).fill(reservedOn);
  await completeForm.getByRole("button", { name: "ปิดการขาย", exact: true }).click();
  await expect(saleHeader.getByText("ขายเสร็จสิ้น", { exact: true })).toBeVisible();
  await expect(saleDetail).toContainText("สร้างจากการจองวันที่ 03/10/2026");
  await expect(saleDetail).toContainText("วันหมดอายุเดิม 10/10/2026");

  await page.getByRole("button", { name: "ข้อมูลนก", exact: true }).click();
  await expect(page.getByRole("button", { name: new RegExp(`Ring ID: ${ringId}.*Status: อยู่ในฟาร์ม`) })).toBeVisible();

  await page.getByRole("button", { name: "การขาย", exact: true }).click();
  const completedSale = page.getByRole("button", { name: new RegExp(`${customerName}.*${birdName}.*ขายเสร็จสิ้น`) });
  await expect(completedSale).toBeVisible();
  await completedSale.click();
  await expect(page.getByRole("heading", { name: `${customerName} → ${birdName}`, exact: true }).locator("xpath=ancestor::section[1]")).toContainText("สร้างจากการจองวันที่ 03/10/2026");
});
