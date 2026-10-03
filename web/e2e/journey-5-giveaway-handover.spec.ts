import { expect, test, type Page } from "@playwright/test";

const givenOn = "03/10/2026";
const handoverOn = "05/10/2026";
const formByHeading = (page: Page, name: string) => page.getByRole("heading", { name, exact: true }).locator("xpath=ancestor::form[1]");

test("JOURNEY-5 active Bird completes Giveaway Handover and becomes historically readable given-away Bird", async ({ page }) => {
  test.setTimeout(300_000);
  const unique = `QA-E2E-J5-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const ringId = unique.toUpperCase();
  const birdName = `${unique}-Bird`;
  const agreementRecipient = `${unique}-Agreement-Recipient`;
  const actualRecipient = `${unique}-Actual-Recipient`;

  await page.goto("/");
  await page.evaluate(async () => {
    const auth = await import("/e2e/support/browser-auth.ts");
    await auth.signInPlaywrightOperator();
  });
  await expect(page.getByRole("navigation")).toContainText("มอบให้ฟรี");

  await page.getByRole("button", { name: "ข้อมูลนก", exact: true }).click();
  const birdForm = formByHeading(page, "เพิ่มนกจากภายนอก");
  await birdForm.getByLabel("รหัสห่วงขา *").fill(ringId);
  await birdForm.getByLabel("ชื่อ *").fill(birdName);
  await birdForm.getByLabel("แหล่งที่มา *").selectOption("external");
  await birdForm.getByRole("textbox", { name: "วันฟัก/วันเกิด", exact: true }).fill("01092026");
  await birdForm.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByRole("button", { name: new RegExp(`Ring ID: ${ringId}.*Status: อยู่ในฟาร์ม`) })).toBeVisible();

  await page.getByRole("button", { name: "มอบให้ฟรี", exact: true }).click();
  const giveawayForm = formByHeading(page, "สร้างรายการให้");
  await giveawayForm.getByLabel("นกสำหรับ Giveaway").selectOption({ label: `${birdName} · Ring ID: ${ringId}` });
  await giveawayForm.getByLabel("ผู้รับตามข้อตกลง").fill(agreementRecipient);
  await giveawayForm.getByRole("textbox", { name: "วันที่บันทึกข้อตกลง", exact: true }).fill(givenOn);
  await giveawayForm.getByRole("button", { name: "สร้างรายการให้", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("สร้างรายการให้สำเร็จ");

  const giveawayRow = page.getByRole("button", { name: new RegExp(`${birdName}.*${ringId}.*${agreementRecipient}.*03/10/2026`) });
  await expect(giveawayRow).toBeVisible();
  await giveawayRow.click();
  await expect(page.getByRole("heading", { name: "การให้โดยไม่ผ่านการขาย", exact: true })).toBeVisible();
  await expect(page.getByText(`วันที่บันทึกข้อตกลง: 03/10/2026`, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ยืนยันข้อตกลงให้", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ส่งมอบจริง", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "ข้อมูลนก", exact: true }).click();
  await expect(page.getByRole("button", { name: new RegExp(`Ring ID: ${ringId}.*Status: อยู่ในฟาร์ม`) })).toBeVisible();

  // A Bird already committed to a non-cancelled Giveaway must not be offered again.
  await page.getByRole("button", { name: "มอบให้ฟรี", exact: true }).click();
  await expect(page.getByLabel("นกสำหรับ Giveaway").getByRole("option", { name: new RegExp(ringId) })).toHaveCount(0);

  await page.getByRole("button", { name: "การขาย", exact: true }).click();
  const reservationForm = formByHeading(page, "สร้างการจอง");
  await reservationForm.getByLabel("ค้นหานก", { exact: true }).fill(ringId);
  await expect(reservationForm.getByRole("option", { name: new RegExp(ringId) })).toHaveCount(0);
  const directSaleForm = formByHeading(page, "สร้างการขายโดยตรง");
  await directSaleForm.getByLabel("ค้นหานก", { exact: true }).fill(ringId);
  await expect(directSaleForm.getByRole("option", { name: new RegExp(ringId) })).toHaveCount(0);

  await page.getByRole("button", { name: "มอบให้ฟรี", exact: true }).click();
  const completedGiveawayRow = page.getByRole("button", { name: new RegExp(`${birdName}.*${agreementRecipient}.*03/10/2026`) });
  await expect(completedGiveawayRow).toBeVisible();
  await completedGiveawayRow.click();
  const handoverForm = formByHeading(page, "ส่งมอบจริง");
  await handoverForm.getByLabel("ชื่อผู้รับจริง").fill(actualRecipient);
  await handoverForm.getByLabel("โทรศัพท์ผู้รับ giveaway").fill("0895550005");
  await handoverForm.getByRole("textbox", { name: "วันที่ส่งมอบ giveaway", exact: true }).fill(handoverOn);
  await handoverForm.getByRole("button", { name: "ยืนยันการส่งมอบ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "หลักฐานการส่งมอบ", exact: true }).locator("xpath=ancestor::section[1]")).toContainText(actualRecipient);
  await expect(page.getByText("วันที่ส่งมอบ: 05/10/2026", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "ข้อมูลนก", exact: true }).click();
  const givenAwayBird = page.getByRole("button", { name: new RegExp(`Ring ID: ${ringId}.*Status: Given Away`) });
  await expect(givenAwayBird).toBeVisible();
  await expect(givenAwayBird).toHaveClass(/bird-visual-terminal/);
  await givenAwayBird.click();
  await expect(page.getByRole("heading", { name: birdName, exact: true })).toBeVisible();
  const profileIdentity = page.getByLabel("ข้อมูลประจำตัวนก");
  await expect(profileIdentity).toHaveClass(/bird-visual-terminal/);
  await expect(profileIdentity).toContainText("Given Away");

  await page.getByRole("button", { name: "มอบให้ฟรี", exact: true }).click();
  await expect(page.getByLabel("นกสำหรับ Giveaway").getByRole("option", { name: new RegExp(ringId) })).toHaveCount(0);
  const historicalGiveaway = page.getByRole("button", { name: new RegExp(`${birdName}.*${agreementRecipient}.*03/10/2026`) });
  await expect(historicalGiveaway).toBeVisible();
  await historicalGiveaway.click();
  await expect(page.getByText(`วันที่บันทึกข้อตกลง: 03/10/2026`, { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "หลักฐานการส่งมอบ", exact: true }).locator("xpath=ancestor::section[1]")).toContainText(actualRecipient);
  await expect(page.getByText("วันที่ส่งมอบ: 05/10/2026", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "การขาย", exact: true }).click();
  const terminalReservationForm = formByHeading(page, "สร้างการจอง");
  await terminalReservationForm.getByLabel("ค้นหานก", { exact: true }).fill(ringId);
  await expect(terminalReservationForm.getByRole("option", { name: new RegExp(ringId) })).toHaveCount(0);
  const terminalDirectSaleForm = formByHeading(page, "สร้างการขายโดยตรง");
  await terminalDirectSaleForm.getByLabel("ค้นหานก", { exact: true }).fill(ringId);
  await expect(terminalDirectSaleForm.getByRole("option", { name: new RegExp(ringId) })).toHaveCount(0);
});
