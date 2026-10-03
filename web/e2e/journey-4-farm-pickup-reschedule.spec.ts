import { expect, test, type Locator, type Page } from "@playwright/test";

const saleOn = "03/10/2026";
const appointmentA = "10/10/2026";
const appointmentB = "12/10/2026";
const handoverOn = "13/10/2026";

const formByHeading = (page: Page, name: string) => page.getByRole("heading", { name, exact: true }).locator("xpath=ancestor::form[1]");
const sectionByHeading = (page: Page, name: string) => page.getByRole("heading", { name, exact: true }).locator("xpath=ancestor::section[1]");

async function chooseSearchResult(form: Locator, kind: "นก" | "ลูกค้า", query: string, result: RegExp) {
  await form.getByLabel(`ค้นหา${kind}`, { exact: true }).fill(query);
  await form.getByRole("option", { name: result }).click();
}

test("JOURNEY-4 completed Sale supports append-only farm-pickup appointment rescheduling before Handover", async ({ page }) => {
  test.setTimeout(300_000);
  const unique = `QA-E2E-J4-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const ringId = unique.toUpperCase();
  const birdName = `${unique}-Bird`;
  const customerName = `${unique}-Customer`;
  const recipientName = `${unique}-Recipient`;

  await page.goto("/");
  await page.evaluate(async () => {
    const auth = await import("/e2e/support/browser-auth.ts");
    await auth.signInPlaywrightOperator();
  });
  await expect(page.getByRole("navigation")).toContainText("การจัดการส่งมอบ");

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
  await customerForm.getByLabel("โทรศัพท์").fill("0894440004");
  await customerForm.getByLabel("อีเมล").fill(`${unique.toLowerCase()}@example.test`);
  await customerForm.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByRole("button", { name: new RegExp(`Display Name: ${customerName}`) })).toBeVisible();

  await page.getByRole("button", { name: "การขาย", exact: true }).click();
  const saleForm = formByHeading(page, "สร้างการขายโดยตรง");
  await chooseSearchResult(saleForm, "นก", ringId, new RegExp(ringId));
  await chooseSearchResult(saleForm, "ลูกค้า", customerName, new RegExp(customerName));
  await saleForm.getByLabel("ราคาที่ตกลงสำหรับการขาย").fill("1800");
  await saleForm.getByRole("textbox", { name: "วันที่สร้างการขาย", exact: true }).fill(saleOn);
  await saleForm.getByRole("button", { name: "สร้างการขาย", exact: true }).click();
  const draftSale = page.getByRole("button", { name: new RegExp(`${customerName}.*${birdName}.*แบบร่าง`) });
  await expect(draftSale).toBeVisible();
  await draftSale.click();
  await page.getByRole("button", { name: "ยืนยันการขาย", exact: true }).click();

  const paymentForm = formByHeading(page, "รับชำระเงิน");
  await paymentForm.getByLabel("จำนวนเงิน").fill("1800");
  await paymentForm.getByLabel("วิธีชำระเงิน").selectOption("transfer");
  await paymentForm.getByRole("textbox", { name: "วันที่รับเงิน", exact: true }).fill(saleOn);
  await paymentForm.getByRole("button", { name: "บันทึกการชำระเงิน", exact: true }).click();
  await expect(page.getByText("ชำระครบแล้ว", { exact: true })).toBeVisible();
  const completeForm = formByHeading(page, "ปิดการขาย");
  await completeForm.getByRole("textbox", { name: "วันที่ปิดการขาย", exact: true }).fill(saleOn);
  await completeForm.getByRole("button", { name: "ปิดการขาย", exact: true }).click();
  await expect(page.locator(".sale-detail-hero").getByText("ขายเสร็จสิ้น", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "ข้อมูลนก", exact: true }).click();
  await expect(page.getByRole("button", { name: new RegExp(`Ring ID: ${ringId}.*Status: อยู่ในฟาร์ม`) })).toBeVisible();

  await page.getByRole("button", { name: "การจัดการส่งมอบ", exact: true }).click();
  const deliverySelector = sectionByHeading(page, "เลือก Sale เพื่อบันทึก Delivery");
  await deliverySelector.getByRole("option", { name: new RegExp(`${birdName}.*${customerName}|${customerName}.*${birdName}`) }).click();
  const shippingForm = formByHeading(page, "บันทึกแผนการจัดส่ง");
  await shippingForm.getByRole("button", { name: "รับที่ฟาร์ม", exact: true }).click();
  const pickupForm = formByHeading(page, "เปลี่ยนเป็นรับที่ฟาร์ม");
  await expect(pickupForm.getByLabel("ระยะทาง (กม.)")).toHaveCount(0);
  await pickupForm.getByRole("textbox", { name: "วันที่นัดหมายรับที่ฟาร์ม", exact: true }).fill(appointmentA);
  await pickupForm.getByLabel("หมายเหตุแผนการจัดส่ง").fill("นัดรับครั้งแรก");
  await pickupForm.getByRole("button", { name: "ยืนยันรับที่ฟาร์ม", exact: true }).click();

  const deliveryHistory = sectionByHeading(page, "ประวัติแผนการจัดส่ง");
  await expect(deliveryHistory).toContainText(birdName);
  await expect(deliveryHistory).toContainText("วันที่นัดหมายรับที่ฟาร์ม: 10/10/2026");
  await expect(deliveryHistory).toContainText("นัดรับครั้งแรก");
  await expect(page.getByRole("heading", { name: "เลื่อนนัดหมายรับที่ฟาร์ม", exact: true })).toBeVisible();

  const rescheduleForm = formByHeading(page, "เลื่อนนัดหมายรับที่ฟาร์ม");
  await expect(rescheduleForm).toContainText("นัดหมายเดิม: 10/10/2026");
  await rescheduleForm.getByRole("textbox", { name: "วันที่นัดหมายรับที่ฟาร์มใหม่", exact: true }).fill(appointmentB);
  await rescheduleForm.getByLabel("หมายเหตุแผนการจัดส่ง").fill("เลื่อนนัดรับ");
  await rescheduleForm.getByRole("button", { name: "บันทึกการเลื่อนนัดหมาย", exact: true }).click();
  await expect(deliveryHistory).toContainText("วันที่นัดหมายรับที่ฟาร์ม: 10/10/2026");
  await expect(deliveryHistory).toContainText("วันที่นัดหมายรับที่ฟาร์ม: 12/10/2026");
  await expect(deliveryHistory).toContainText("นัดรับครั้งแรก");
  await expect(deliveryHistory).toContainText("เลื่อนนัดรับ");
  await expect(deliveryHistory.getByText("แผนปัจจุบัน", { exact: true })).toHaveCount(1);

  await page.getByRole("button", { name: "ข้อมูลนก", exact: true }).click();
  await expect(page.getByRole("button", { name: new RegExp(`Ring ID: ${ringId}.*Status: อยู่ในฟาร์ม`) })).toBeVisible();

  await page.getByRole("button", { name: "การจัดการส่งมอบ", exact: true }).click();
  const handoverSelector = sectionByHeading(page, "เลือก Sale เพื่อส่งมอบ");
  await handoverSelector.getByRole("option", { name: new RegExp(`${birdName}.*${customerName}|${customerName}.*${birdName}`) }).click();
  const handoverForm = formByHeading(page, "ส่งมอบนก");
  await handoverForm.getByLabel("ชื่อผู้รับ").fill(recipientName);
  await handoverForm.getByRole("textbox", { name: "วันที่ส่งมอบ", exact: true }).fill(handoverOn);
  await handoverForm.getByRole("button", { name: "ตรวจสอบก่อนส่งมอบ", exact: true }).click();
  const review = page.getByRole("dialog", { name: "ยืนยันการส่งมอบ" });
  await expect(review).toContainText("วันที่ส่งมอบ: 2026-10-13");
  await review.getByRole("button", { name: "ยืนยันส่งมอบ", exact: true }).click();

  const handoverHistory = sectionByHeading(page, "การส่งมอบ");
  await expect(handoverHistory).toContainText(recipientName);
  await expect(handoverHistory).toContainText("13/10/2026");
  await expect(sectionByHeading(page, "ประวัติแผนการจัดส่ง")).toContainText("12/10/2026");

  await page.getByRole("button", { name: "ข้อมูลนก", exact: true }).click();
  const soldBird = page.getByRole("button", { name: new RegExp(`Ring ID: ${ringId}.*Status: ขายแล้ว`) });
  await expect(soldBird).toBeVisible();
  await expect(soldBird).toHaveClass(/bird-visual-terminal/);
  await soldBird.click();
  await expect(page.getByRole("heading", { name: birdName, exact: true })).toBeVisible();
  await expect(page.getByLabel("ข้อมูลประจำตัวนก")).toHaveClass(/bird-visual-terminal/);

  await page.getByRole("button", { name: "การขาย", exact: true }).click();
  const completedSale = page.getByRole("button", { name: new RegExp(`${customerName}.*${birdName}.*ขายเสร็จสิ้น`) });
  await expect(completedSale).toBeVisible();
  await completedSale.click();
  await expect(page.locator(".sale-detail-hero").getByText("ขายเสร็จสิ้น", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "การจัดการส่งมอบ", exact: true }).click();
  await expect(sectionByHeading(page, "ประวัติแผนการจัดส่ง")).toContainText("10/10/2026");
  await expect(sectionByHeading(page, "ประวัติแผนการจัดส่ง")).toContainText("12/10/2026");
  await expect(sectionByHeading(page, "การส่งมอบ")).toContainText("13/10/2026");
});
