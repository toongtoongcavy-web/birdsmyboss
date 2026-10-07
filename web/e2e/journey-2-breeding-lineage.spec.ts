import { expect, test, type Locator, type Page } from "@playwright/test";

const parentHatchDate = "01/09/2026";
const sexDate = "02/09/2026";
const pairDate = "03/09/2026";
const cycleDate = "04/09/2026";
const eggDate = "05/09/2026";
const chickHatchDate = "25/09/2026";

const formByHeading = (page: Page, name: string) => page.getByRole("heading", { name, exact: true }).locator("xpath=ancestor::form[1]");

async function signInOperator(page: Page) {
  await page.goto("/");
  await page.evaluate(async () => {
    const auth = await import("/e2e/support/browser-auth.ts");
    await auth.signInPlaywrightOperator();
  });
  await expect(page.getByRole("navigation")).toContainText("การเพาะพันธุ์");
}

async function createParent(page: Page, input: { ringId: string; name: string; sex: "male" | "female"; sexLabel: string }) {
  await page.getByRole("button", { name: "ข้อมูลนก", exact: true }).click();
  const intake = formByHeading(page, "เพิ่มนกจากภายนอก");
  await intake.getByLabel("รหัสห่วงขา *").fill(input.ringId);
  await intake.getByLabel("ชื่อ *").fill(input.name);
  await intake.getByLabel("แหล่งที่มา *").selectOption("external");
  await intake.getByRole("textbox", { name: "วันฟัก/วันเกิด", exact: true }).fill(parentHatchDate);
  await intake.getByRole("button", { name: "บันทึก", exact: true }).click();

  const row = page.getByRole("button", { name: new RegExp(`Ring ID: ${input.ringId}.*Status: อยู่ในฟาร์ม`) });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByRole("heading", { name: input.name, exact: true })).toBeVisible();

  const sexForm = formByHeading(page, "บันทึกเพศ");
  await sexForm.getByLabel("เพศ *").selectOption(input.sex);
  await sexForm.getByLabel("วิธี *").selectOption("visual");
  await sexForm.getByRole("textbox", { name: "วันที่", exact: true }).fill(sexDate);
  await sexForm.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByLabel("ข้อมูลประจำตัวนก")).toContainText(input.sexLabel);
}

test("JOURNEY-2 active Pair produces a farm-hatched Bird with authoritative lineage", async ({ page }) => {
  test.setTimeout(300_000);
  const unique = `QA-E2E-J2-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const cageCode = `${unique}-CAGE`.toUpperCase();
  const cageName = `${unique}-Breeding-Cage`;
  const fatherRing = `${unique}-M`.toUpperCase();
  const fatherName = `${unique}-Father`;
  const motherRing = `${unique}-F`.toUpperCase();
  const motherName = `${unique}-Mother`;
  const chickRing = `${unique}-CHICK`.toUpperCase();
  const chickName = `${unique}-Chick`;
  const pairName = `${unique}-Pair`;

  await signInOperator(page);

  await page.getByRole("button", { name: "ข้อมูลกรง", exact: true }).click();
  const cageForm = formByHeading(page, "สร้างกรง");
  await cageForm.getByLabel("รหัสกรง *").fill(cageCode);
  await cageForm.getByLabel("ชื่อกรง *").fill(cageName);
  await cageForm.getByLabel("ประเภทกรง *").selectOption("breeding");
  await cageForm.getByLabel("สถานะกรง *").selectOption("active");
  await cageForm.getByLabel("ความจุ (จำนวนตัว)").fill("2");
  await cageForm.getByRole("button", { name: "สร้างกรง", exact: true }).click();
  const cageRegistry = page.getByRole("heading", { name: "รายการกรง", exact: true }).locator("xpath=ancestor::section[1]");
  const cageRow = cageRegistry.getByRole("row").filter({ hasText: cageCode });
  await expect(cageRow).toContainText(cageName);

  await createParent(page, { ringId: fatherRing, name: fatherName, sex: "male", sexLabel: "ตัวผู้" });
  await createParent(page, { ringId: motherRing, name: motherName, sex: "female", sexLabel: "ตัวเมีย" });

  await page.getByRole("button", { name: "ข้อมูลกรง", exact: true }).click();
  const pairWorkspace = page.getByRole("heading", { name: "จับคู่ผสมพันธุ์ + กรงคู่ผสมพันธุ์", exact: true }).locator("xpath=ancestor::section[1]");
  const pairForm = pairWorkspace.locator("form");
  const fatherSelect = pairForm.getByLabel("พ่อ / ตัวผู้ *");
  const motherSelect = pairForm.getByLabel("แม่ / ตัวเมีย *");
  const cageSelect = pairForm.getByLabel("กรงคู่ผสมพันธุ์ *");
  for (const select of [fatherSelect, motherSelect, cageSelect]) {
    await expect(select.locator("option")).toHaveCount(2);
    await select.focus();
    await select.press("ArrowDown");
    await select.press("Enter");
  }
  await expect(fatherSelect.locator("option:checked")).toContainText(fatherRing);
  await expect(motherSelect.locator("option:checked")).toContainText(motherRing);
  await expect(cageSelect.locator("option:checked")).toContainText(cageCode);
  await pairForm.getByLabel("ชื่อคู่").fill(pairName);
  await pairForm.getByRole("textbox", { name: "วันที่เริ่มจับคู่", exact: true }).fill(pairDate);
  await pairForm.getByRole("button", { name: "บันทึกการจับคู่", exact: true }).click();
  await expect(pairForm.getByRole("status")).toHaveText("สร้างคู่และจัดเข้ากรงเรียบร้อย");

  await page.getByRole("button", { name: "การเพาะพันธุ์", exact: true }).click();
  const activePair = page.getByRole("button", { name: new RegExp(`พ่อนก: ${fatherName}.*${fatherRing}.*แม่นก: ${motherName}.*${motherRing}.*Status: อยู่ในฟาร์ม`) });
  await expect(activePair).toBeVisible();
  await activePair.click();
  const pairHeader = page.getByRole("heading", { name: `${fatherName} × ${motherName}`, exact: true }).locator("xpath=ancestor::header[1]");
  await expect(pairHeader.getByText("อยู่ในฟาร์ม", { exact: true })).toBeVisible();

  const pairDetail = pairHeader.locator("xpath=ancestor::section[1]");
  await expect(pairDetail).toContainText(fatherName);
  await expect(pairDetail).toContainText(motherName);
  const currentCage = pairDetail.getByRole("heading", { name: "กรงปัจจุบัน", exact: true }).locator("xpath=ancestor::section[1]");
  await expect(currentCage).toContainText(cageCode);
  await expect(currentCage).toContainText(cageName);

  const cycleForm = formByHeading(page, "สร้างรอบเพาะ");
  await expect(cycleForm).toContainText(fatherRing);
  await expect(cycleForm).toContainText(motherRing);
  await expect(cycleForm).toContainText(cageCode);
  await cycleForm.getByRole("textbox", { name: "วันเริ่มรอบเพาะ", exact: true }).fill(cycleDate);
  await cycleForm.getByRole("button", { name: "สร้างรอบเพาะ", exact: true }).click();

  const selectedCycle = pairDetail.getByRole("heading", { name: "รอบเพาะที่เลือก", exact: true }).locator("xpath=ancestor::section[1]");
  await expect(selectedCycle).toContainText("04/09/2026");
  await expect(selectedCycle).toContainText("เปิดรอบแล้ว");
  const eggForm = formByHeading(page, "เพิ่มไข่");
  await expect(eggForm).toContainText("ลำดับ: 1");
  await eggForm.getByRole("textbox", { name: "วันที่ไข่", exact: true }).fill(eggDate);
  await eggForm.getByRole("button", { name: "เพิ่มไข่", exact: true }).click();

  const eggRow = pairDetail.getByRole("button", { name: /ไข่ลำดับ 1.*05\/09\/2026.*ออกไข่แล้ว/ });
  await expect(eggRow).toBeVisible();
  await eggRow.click();
  const eggDetail = pairDetail.getByRole("heading", { name: "Egg Detail", exact: true }).locator("xpath=ancestor::section[1]");
  await expect(eggDetail).toContainText(`พ่อ: ${fatherName} · Ring ID: ${fatherRing}`);
  await expect(eggDetail).toContainText(`แม่: ${motherName} · Ring ID: ${motherRing}`);
  await expect(eggDetail).toContainText(`กรง: ${cageCode} / ${cageName}`);

  const hatchForm = formByHeading(page, "บันทึกการฟักและสร้างนก");
  await hatchForm.getByLabel("Ring ID ของลูกนก", { exact: true }).fill(chickRing);
  await hatchForm.getByLabel("ชื่อลูกนก", { exact: true }).fill(chickName);
  await hatchForm.getByLabel("Mutation ของลูกนก", { exact: true }).fill("QA Green");
  await hatchForm.getByRole("textbox", { name: "วันฟัก", exact: true }).fill(chickHatchDate);
  await hatchForm.getByRole("button", { name: "สร้างนกจากไข่", exact: true }).click();
  await expect(eggDetail).toContainText("Status: ฟักแล้ว");
  await expect(eggDetail).toContainText("ไข่ฟักแล้ว");

  await page.getByRole("button", { name: "ข้อมูลนก", exact: true }).click();
  const chickRow = page.getByRole("button", { name: new RegExp(`Ring ID: ${chickRing}.*Origin: ฟักในฟาร์ม.*Status: อยู่ในฟาร์ม`) });
  await expect(chickRow).toBeVisible();
  await expect(chickRow).toHaveClass(/bird-visual-current/);
  await chickRow.click();

  const profile = page.getByLabel("ข้อมูลประจำตัวนก");
  await expect(profile).toContainText(chickName);
  await expect(profile).toContainText("ฟักในฟาร์ม");
  await expect(profile).toContainText("อยู่ในฟาร์ม");
  await expect(profile).toContainText("25/09/2026");
  const lineage = page.getByRole("heading", { name: `ครอบครัวของ ${chickName}`, exact: true }).locator("xpath=ancestor::section[1]");
  await expect(lineage).toContainText(fatherName);
  await expect(lineage).toContainText(fatherRing);
  await expect(lineage).toContainText(motherName);
  await expect(lineage).toContainText(motherRing);

  await page.getByRole("button", { name: "การขาย", exact: true }).click();
  const directSale = formByHeading(page, "สร้างการขายโดยตรง");
  await directSale.getByLabel("ค้นหานก", { exact: true }).fill(chickRing);
  await expect(directSale.getByRole("option", { name: new RegExp(`${chickName}.*${chickRing}|${chickRing}.*${chickName}`) })).toBeVisible();

  await page.getByRole("button", { name: "การเพาะพันธุ์", exact: true }).click();
  const historicalPair = page.getByRole("button", { name: new RegExp(`พ่อนก: ${fatherName}.*แม่นก: ${motherName}.*Status: อยู่ในฟาร์ม`) });
  await historicalPair.click();
  await page.getByRole("button", { name: /รอบเพาะ.*04\/09\/2026.*เปิดรอบแล้ว.*ไข่: 1/ }).click();
  await page.getByRole("button", { name: /ไข่ลำดับ 1.*05\/09\/2026.*ฟักแล้ว/ }).click();
  await expect(page.getByRole("heading", { name: "Egg Detail", exact: true }).locator("xpath=ancestor::section[1]")).toContainText("ไข่ฟักแล้ว");
});
