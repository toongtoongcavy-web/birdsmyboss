import { expect, test, type Page } from "@playwright/test";

// Deterministic read-only fixture through the real shell/App/Commercial components.
// Journey tests separately exercise the real callable contracts against emulators.
const birdName="น้องมะลิสีเขียวอ่อนชื่อยาวสำหรับทดสอบการแสดงผลบนแท็บเล็ต";
const customerName="คุณสมชายและครอบครัวผู้รับนกชื่อยาวสำหรับทดสอบ";
const ringId="BMB-TH-2026-LONG-RING-IDENTITY-000001";
const records={
  listBirds:[{birdId:"bird-fixture",displayName:birdName,ringId,status:"active",currentSex:"male",origin:"external"},{birdId:"reserved-bird",displayName:"น้องใบเตย",ringId:"BMB-TH-002",status:"active"},{birdId:"available-bird",displayName:"น้องฟ้า",ringId:"BMB-TH-003",status:"active"}],
  listCustomers:[{customerId:"customer-fixture",displayName:customerName,phone:"0812345678",email:"long.customer@example.test",status:"active"}],
  listSales:[{saleId:"sale-fixture",birdId:"bird-fixture",customerId:"customer-fixture",agreedPrice:2000,currency:"THB",status:"confirmed",createdOn:"2026-10-03"}],
  listReservations:[{reservationId:"reservation-fixture",birdId:"reserved-bird",customerId:"customer-fixture",agreedPrice:1500,currency:"THB",status:"active",reservedOn:"2026-10-03",expiresOn:"2026-10-10"}],
  listPayments:[{paymentId:"payment-fixture",saleId:"sale-fixture",amount:500,currency:"THB",paymentMethod:"transfer",status:"received",receivedOn:"2026-10-03"},{paymentId:"deposit-fixture",reservationId:"reservation-fixture",amount:300,currency:"THB",paymentMethod:"transfer",status:"received",receivedOn:"2026-10-03"}],
  listRefunds:[],listSaleTimeline:[{saleTimelineId:"event-fixture",eventType:"sale_created",occurredAt:"2026-10-03"}],
};

async function noOverflow(page:Page){
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('.sales-workspace').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
}
async function touchTargets(page:Page){
  const small=await page.locator('.sales-workspace button, .sales-workspace input:not(.native-date), .sales-workspace select').evaluateAll(elements=>elements.filter(el=>el.getClientRects().length).filter(el=>el.getBoundingClientRect().height<43).map(el=>({text:el.textContent,height:el.getBoundingClientRect().height})));
  expect(small).toEqual([]);
}

for(const [width,height] of [[1194,834],[834,1194],[768,1024]]){
  test(`Sales workspace ${width}x${height}: registry, create modes, details and collapsed actions`,async({page},testInfo)=>{
    await page.setViewportSize({width,height});
    const pageErrors:string[]=[];
    page.on('pageerror',error=>pageErrors.push(error.message));
    await page.route(/\/src\/main\.tsx(?:\?|$)/,async route=>{
      const response=await route.fetch();
      const body=(await response.text()).replace(/import \{ Root \} from "\/src\/Root\.tsx[^"]*";/,'import { MvpShell as Root } from "/src/MvpShell.tsx";');
      expect(body).toContain('MvpShell as Root');
      await route.fulfill({response,body});
    });
    await page.route(/\/src\/functions\.ts(?:\?|$)/,route=>route.fulfill({contentType:"application/javascript",body:`const records=${JSON.stringify(records)}; export async function invoke(name){if(name==='getDashboardSummary')return {}; if(!name.startsWith('list'))throw new Error('Read-only fixture'); return records[name]||[];} export function thaiError(){return 'ไม่สามารถโหลดข้อมูล';}`}));
    // BirdAssets imports storage, but uploads/auth are outside this read-only layout fixture.
    await page.route(/\/src\/firebase\.ts(?:\?|$)/,route=>route.fulfill({contentType:"application/javascript",body:'export const storage={};'}));
    await page.goto('/');
    if(width<=840) await page.getByRole('button',{name:'เปิดเมนูหลัก'}).click();
    await page.getByRole('button',{name:'การขาย',exact:true}).click();
    await expect(page.locator('.sale-registry-row')).toHaveCount(1);
    await expect(page.locator('.sales-workspace form:visible')).toHaveCount(0);
    await expect(page.locator('.sale-registry-row')).toContainText(birdName);
    await expect(page.locator('.sale-registry-row')).toContainText(ringId);
    await expect(page.locator('.reservation-row')).toContainText(customerName);
    for(const selector of ['.sale-registry-row','.reservation-row'])expect((await page.locator(selector).boundingBox())!.height).toBeGreaterThanOrEqual(64);
    const identity=await page.locator('.sale-registry-row .sales-bird-identity strong').evaluate(el=>({whiteSpace:getComputedStyle(el).whiteSpace,overflow:getComputedStyle(el).overflow}));
    expect(identity.whiteSpace).toBe('normal');expect(identity.overflow).toBe('visible');
    await noOverflow(page);await touchTargets(page);
    await page.screenshot({path:testInfo.outputPath('registry.png'),fullPage:true});
    const modes=page.getByRole('group',{name:'เลือกสร้างรายการ'});
    await modes.getByRole('button',{name:'สร้างการจอง',exact:true}).click();
    await expect(page.locator('.sales-workspace form:visible')).toHaveCount(1);
    if(width<=840)expect(await page.locator('#create-reservation>form').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(1);
    await noOverflow(page);await touchTargets(page);
    await modes.getByRole('button',{name:'ขายโดยตรง',exact:true}).click();
    await expect(page.locator('#create-reservation')).toBeHidden();
    await expect(page.locator('#create-sale')).toBeVisible();
    await page.screenshot({path:testInfo.outputPath('create.png'),fullPage:true});
    await page.locator('.sale-registry-row').click();
    await expect(page.locator('.sale-detail')).toBeVisible();
    await expect(page.locator('.sales-workspace form:visible')).toHaveCount(0);
    await expect(page.getByRole('region',{name:'ประวัติการขาย'})).toContainText('สร้างรายการขาย');
    await expect(page.locator('.commercial-ledger')).toContainText('คงเหลือ: 1500 THB');
    if(width<=840)expect(await page.locator('.sale-detail-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(1);
    await noOverflow(page);await touchTargets(page);
    await page.screenshot({path:testInfo.outputPath('sale-detail.png'),fullPage:true});
    await page.getByRole('button',{name:'รับชำระเงิน',exact:true}).click();
    await expect(page.getByRole('textbox',{name:'วันที่รับเงิน',exact:true})).toBeVisible();
    await noOverflow(page);await touchTargets(page);
    await page.locator('.commercial-ledger-row').click();
    await expect(page.getByRole('heading',{name:'รับชำระเงิน',exact:true})).toBeHidden();
    await page.getByRole('button',{name:'คืนเงิน',exact:true}).click();
    await expect(page.getByLabel('รูปแบบคืนเงิน')).toBeVisible();
    await noOverflow(page);await touchTargets(page);
    await page.getByRole('button',{name:'← กลับไปรายการขาย',exact:true}).click();
    await page.locator('.reservation-row').click();
    await expect(page.getByRole('heading',{name:'รายละเอียดการจอง'})).toBeVisible();
    await expect(page.locator('.sales-workspace form:visible')).toHaveCount(0);
    await expect(page.getByRole('button',{name:'สร้างการขายจากการจอง',exact:true})).toHaveAttribute('aria-expanded','false');
    await noOverflow(page);await touchTargets(page);
    await page.screenshot({path:testInfo.outputPath('reservation-detail.png'),fullPage:true});
    await page.getByRole('button',{name:'ยกเลิกการจอง',exact:true}).click();
    await expect(page.getByText('เงินที่ยังถืออยู่: 300 THB',{exact:false})).toBeVisible();
    await page.getByLabel('การจัดการเงิน').selectOption('partial_refund');
    await expect(page.getByLabel('จำนวนเงินคืนเมื่อยกเลิก')).toBeVisible();
    await noOverflow(page);await touchTargets(page);
    expect(pageErrors).toEqual([]);
  });
}
