import { ReactNode, useEffect } from "react";

// Display-only Thai labels approved in the owner's mapping workbook.
// Internal route names, stored values and callable payload values remain unchanged.
const exactLabels: Record<string, string> = {
  Dashboard: "ภาพรวม",
  Birds: "ข้อมูลนก",
  Cages: "ข้อมูลกรง",
  Breeding: "การเพาะพันธุ์",
  Sales: "การขาย",
  Giveaways: "มอบให้ฟรี",
  Customers: "ข้อมูลลูกค้า",
  "Delivery & Handover": "การจัดการส่งมอบ",
  Passport: "พาสปอร์ตนก",
  Pairs: "คู่ผสมพันธุ์",
  "Breeding Cycles": "รอบเพาะพันธุ์",
  Eggs: "บันทึกไข่",
  "Cage Assignment": "การจัดนกเข้ากรง",
  "Ring ID": "รหัสห่วงขา",
  Mutation: "มิวเทชัน / สี",
  Origin: "แหล่งที่มา",
  Status: "สถานะ",
  Add: "เพิ่ม",
  Save: "บันทึก",
  Cancel: "ยกเลิก",
  Edit: "แก้ไข",
  View: "ดูรายละเอียด",
  Close: "ปิด",
  Confirm: "ยืนยัน",
  Archive: "เก็บถาวร",
  Publish: "เผยแพร่",
  Disable: "ปิดการเผยแพร่",
};

function applyApprovedLabels(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const original = node.nodeValue ?? "";
    const trimmed = original.trim();
    const translated = exactLabels[trimmed];
    if (!translated) continue;
    const leading = original.match(/^\s*/)?.[0] ?? "";
    const trailing = original.match(/\s*$/)?.[0] ?? "";
    node.nodeValue = `${leading}${translated}${trailing}`;
  }
}

export function ThaiUiLabels({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyApprovedLabels(document.body);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        for (const added of Array.from(record.addedNodes)) {
          if (added.nodeType === Node.TEXT_NODE) {
            const text = added as Text;
            const trimmed = (text.nodeValue ?? "").trim();
            if (exactLabels[trimmed]) text.nodeValue = (text.nodeValue ?? "").replace(trimmed, exactLabels[trimmed]);
          } else if (added.nodeType === Node.ELEMENT_NODE) {
            applyApprovedLabels(added as Element);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return <>{children}</>;
}
