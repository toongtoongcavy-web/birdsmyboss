import { expect, test, type Locator, type Page } from "@playwright/test";

const today = "03/10/2026";

const formByHeading = (page: Page, name: string) => page.getByRole("heading", { name, exact: true }).locator("xpath=ancestor::form[1]");
const sectionByHeading = (page: Page, name: string) => page.getByRole("heading", { name, exact: true }).locator("xpath=ancestor::section[1]");

async function chooseSearchResult(form: Locator, kind: "นก" | "ลูกค้า", query: string, result: RegExp) {
  await form.getByLabel(`ค้นหา${kind}`, { exact: true }).fill(query);
  await form.getByRole("option", { name: result }).click();
}

test("JOURNEY-1 purchased Bird completes Direct Sale, full payment, and farm-pickup Handover", async ({ page }) => {
  const unique = `QA-E2E-J1-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const ringId = unique.toUpperCase();
  const birdName = `${unique}-Bird`;
  const customerName = `${unique}-Customer`;
  const recipientName = `${unique}-Recipient`;
  const agreedPrice = "1250";

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

  const paymentForm = formByHeading(page, "รับชำระเงิน");
  await paymentForm.getByLabel("จำนวนเงิน").fill(agreedPrice);
  await paymentForm.getByLabel("วิธีชำระเงิน").selectOption("transfer");
  await paymentForm.getByRole("textbox", { name: "วันที่รับเงิน", exact: true }).fill(today);
  await paymentForm.getByRole("button", { name: "บันทึกการชำระเงิน", exact: true }).click();
  await expect(page.getByText("ชำระครบแล้ว", { exact: true })).toBeVisible();
  await expect(page.getByText("คงเหลือ: 0 THB", { exact: false })).toBeVisible();

  const completeForm = formByHeading(page, "ปิดการขาย");
  await completeForm.getByRole("textbox", { name: "วันที่ปิดการขาย", exact: true }).fill(today);
  await completeForm.getByRole("button", { name: "ปิดการขาย", exact: true }).click();
  await expect(page.locator(".sale-detail-hero").getByText("ขายเสร็จสิ้น", { exact: true })).toBeVisible();
  await expect(page.locator(".sale-detail")).toContainText(birdName);

  await page.getByRole("button", { name: "ข้อมูลนก", exact: true }).click();
  const preHandoverBird = page.getByRole("button", { name: new RegExp(`Ring ID: ${ringId}.*Status: อยู่ในฟาร์ม`) });
  await expect(preHandoverBird).toBeVisible();

  await page.getByRole("button", { name: "การจัดการส่งมอบ", exact: true }).click();
  const handoverSelector = sectionByHeading(page, "เลือก Sale เพื่อส่งมอบ");
  await handoverSelector.getByRole("option", { name: new RegExp(`${birdName}.*${customerName}|${customerName}.*${birdName}`) }).click();
  const handoverForm = formByHeading(page, "ส่งมอบนก");
  await handoverForm.getByLabel("ชื่อผู้รับ").fill(recipientName);
  await handoverForm.getByRole("textbox", { name: "วันที่ส่งมอบ", exact: true }).fill(today);
  await handoverForm.getByRole("button", { name: "ตรวจสอบก่อนส่งมอบ", exact: true }).click();
  const review = page.getByRole("dialog", { name: "ยืนยันการส่งมอบ" });
  await expect(review).toContainText(recipientName);
  await review.getByRole("button", { name: "ยืนยันส่งมอบ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "การส่งมอบ", exact: true }).locator("xpath=ancestor::section[1]")).toContainText(recipientName);

  await page.getByRole("button", { name: "ข้อมูลนก", exact: true }).click();
  const soldBirdRow = page.getByRole("button", { name: new RegExp(`Ring ID: ${ringId}.*Status: ขายแล้ว`) });
  await expect(soldBirdRow).toBeVisible();
  await expect(soldBirdRow).toHaveClass(/bird-visual-terminal/);
  await soldBirdRow.click();
  await expect(page.getByRole("heading", { name: birdName, exact: true })).toBeVisible();
  const profileIdentity = page.getByLabel("ข้อมูลประจำตัวนก");
  await expect(profileIdentity).toHaveClass(/bird-visual-terminal/);
  await expect(profileIdentity.getByText("ขายแล้ว", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "การขาย", exact: true }).click();
  const directSaleForm = formByHeading(page, "สร้างการขายโดยตรง");
  await directSaleForm.getByLabel("ค้นหานก", { exact: true }).fill(ringId);
  await expect(directSaleForm.getByRole("option", { name: new RegExp(ringId) })).toHaveCount(0);
  const completedSale = page.getByRole("button", { name: new RegExp(`${customerName}.*${birdName}.*ขายเสร็จสิ้น`) });
  await expect(completedSale).toBeVisible();
  await completedSale.click();
  await expect(page.locator(".sale-detail-hero").getByText("ขายเสร็จสิ้น", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "การจัดการส่งมอบ", exact: true }).click();
  const handoverHistory = page.getByRole("heading", { name: "การส่งมอบ", exact: true }).locator("xpath=ancestor::section[1]");
  await expect(handoverHistory).toContainText(recipientName);
  await expect(handoverHistory).toContainText(ringId);
});
