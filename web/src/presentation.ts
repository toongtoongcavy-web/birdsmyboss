const valueLabels: Record<string, string> = {
  active: "อยู่ในฟาร์ม",
  archived: "เก็บถาวร",
  cancelled: "ยกเลิก",
  card: "บัตรเครดิต/เดบิต",
  cash: "เงินสด",
  closed: "ปิดรอบแล้ว",
  completed: "ขายเสร็จสิ้น",
  confirmed: "ยืนยันแล้ว",
  deceased: "เสียชีวิต",
  delivered: "จัดส่งแล้ว",
  disabled: "ปิดการเผยแพร่",
  draft: "แบบร่าง",
  expired: "การจองหมดอายุ",
  external: "รับเข้าจากภายนอก",
  female: "ตัวเมีย",
  fertile: "มีเชื้อ",
  farm_hatched: "ฟักในฟาร์ม",
  full_refund: "คืนเงินเต็มจำนวน",
  hatched: "ฟักแล้ว",
  inactive: "พัก / แยกคู่",
  infertile: "ไม่มีเชื้อ",
  in_transit: "กำลังจัดส่ง",
  laid: "ออกไข่แล้ว",
  maintenance: "ปิดปรับปรุง",
  male: "ตัวผู้",
  no_refund: "ไม่คืนเงิน",
  other: "อื่น ๆ",
  partial_refund: "คืนเงินบางส่วน",
  planned: "วางแผนรอบเพาะ",
  published: "เผยแพร่แล้ว",
  received: "รับเงินแล้ว",
  sale: "การขาย",
  sold: "ขายแล้ว",
  superseded: "ถูกแทนที่",
  transfer: "โอนเงิน / พร้อมเพย์",
  unknown: "ไม่ทราบเพศ",

  // Values without an approved Thai mapping remain in their current English form.
  deposit: "Deposit",
  discarded: "Discarded",
  dna: "DNA",
  final: "ราคาสุดท้าย",
  given_away: "Given Away",
  list: "ราคาตั้งขาย",
  lost: "Lost",
  offer: "ราคาที่เสนอ",
  purchase: "ราคาซื้อเข้า",
  purchased: "ซื้อเข้าฟาร์ม",
  rescued: "รับเข้าจากภายนอก",
  reserved: "Reserved",
  retired: "Retired",
  sale_payment: "Sale Payment",
  sex_linked: "Sex Linked",
  visual: "Visual",
  voided: "Voided",
};

const fieldLabels: Record<string, string> = {
  activeOn: "Active On",
  birdId: "Bird ID",
  breedingCycleId: "Breeding Cycle ID",
  cageId: "Cage ID",
  customerId: "Customer ID",
  cycleId: "Cycle ID",
  deliveryId: "Delivery ID",
  displayName: "Display Name",
  eggId: "Egg ID",
  handoverId: "Handover ID",
  hatchedOn: "Hatched On",
  laidOn: "Laid On",
  pairId: "Pair ID",
  passportStatus: "Passport Status",
  paymentId: "Payment ID",
  publicToken: "Public Token",
  reservationId: "Reservation ID",
  ringId: "รหัสห่วงขา",
  saleId: "Sale ID",
  sequenceNo: "Sequence No.",
  startedOn: "Started On",
  status: "สถานะ",
};

export const displayValue = (value: unknown) => valueLabels[String(value)] ?? String(value ?? "-");
const originLabels: Record<string, string> = {
  farm_hatched: "ฟักในฟาร์ม",
  purchased: "ซื้อเข้าฟาร์ม",
  external: "รับเข้าจากภายนอก",
  unknown: "ไม่ทราบแหล่งที่มา",
  rescued: "รับเข้าจากภายนอก",
};
export const displayOrigin = (value: unknown) => originLabels[String(value)] ?? displayValue(value);
const breedingCycleStatusLabels: Record<string, string> = {
  active: "เปิดรอบแล้ว",
  closed: valueLabels.closed,
  cancelled: valueLabels.cancelled,
};
export const displayBreedingCycleStatus = (value: unknown) => breedingCycleStatusLabels[String(value)] ?? displayValue(value);
const customerStatusLabels: Record<string, string> = {
  active: "ใช้งานอยู่",
  inactive: "ไม่ใช้งาน",
};
export const displayCustomerStatus = (value: unknown) => customerStatusLabels[String(value)] ?? displayValue(value);
const reservationStatusLabels: Record<string, string> = {
  active: "กำลังจอง",
  cancelled: "ยกเลิกการจอง",
  expired: "การจองหมดอายุ",
};
export const displayReservationStatus = (value: unknown) => reservationStatusLabels[String(value)] ?? displayValue(value);
export const displayFieldName = (value: string) => fieldLabels[value] ?? value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, letter => letter.toUpperCase());
