import { useState, useEffect, useCallback, useRef, useMemo } from "react";

/* ═══════════════════════════════════════════
   CHURCH PANTRY — Full App (with Export)
   ═══════════════════════════════════════════ */

// ── Seed Data ──
const CATEGORIES = ["Canned Goods","Grains & Pasta","Dairy","Produce","Meat & Protein","Snacks","Beverages","Baby & Infant","Hygiene","Condiments","Baking","Frozen"];
const SAMPLE_INVENTORY = [
  {id:"i1",upc:"041000000001",name:"Green Beans (canned)",category:"Canned Goods",qty:48,price:1.29,expiry:"2026-06-15",addedBy:"Sarah M.",addedDate:"2026-03-20",location:"Shelf A2"},
  {id:"i2",upc:"041000000002",name:"Peanut Butter 16oz",category:"Snacks",qty:24,price:3.49,expiry:"2027-01-10",addedBy:"James R.",addedDate:"2026-03-18",location:"Shelf B1"},
  {id:"i3",upc:"041000000003",name:"White Rice 2lb",category:"Grains & Pasta",qty:36,price:2.99,expiry:"2027-08-01",addedBy:"Sarah M.",addedDate:"2026-03-15",location:"Shelf C3"},
  {id:"i4",upc:"041000000004",name:"Chicken Broth 32oz",category:"Canned Goods",qty:18,price:2.49,expiry:"2026-04-20",addedBy:"Tom K.",addedDate:"2026-02-10",location:"Shelf A1"},
  {id:"i5",upc:"041000000005",name:"Whole Wheat Pasta",category:"Grains & Pasta",qty:30,price:1.79,expiry:"2027-03-15",addedBy:"Maria L.",addedDate:"2026-03-22",location:"Shelf C2"},
  {id:"i6",upc:"041000000006",name:"Baby Formula 12oz",category:"Baby & Infant",qty:8,price:18.99,expiry:"2026-05-30",addedBy:"Sarah M.",addedDate:"2026-03-25",location:"Shelf D1"},
  {id:"i7",upc:"041000000007",name:"Canned Tuna",category:"Meat & Protein",qty:42,price:1.59,expiry:"2028-01-01",addedBy:"James R.",addedDate:"2026-03-10",location:"Shelf A3"},
  {id:"i8",upc:"041000000008",name:"Instant Oatmeal Box",category:"Grains & Pasta",qty:15,price:3.99,expiry:"2026-09-15",addedBy:"Tom K.",addedDate:"2026-03-28",location:"Shelf C1"},
  {id:"i9",upc:"041000000009",name:"Toothpaste",category:"Hygiene",qty:20,price:2.49,expiry:"2027-12-01",addedBy:"Maria L.",addedDate:"2026-03-30",location:"Shelf E1"},
  {id:"i10",upc:"041000000010",name:"Apple Juice 64oz",category:"Beverages",qty:12,price:3.29,expiry:"2026-07-20",addedBy:"Sarah M.",addedDate:"2026-04-01",location:"Shelf B3"},
  {id:"i11",upc:"041000000011",name:"Mac & Cheese Box",category:"Grains & Pasta",qty:55,price:1.09,expiry:"2027-04-10",addedBy:"James R.",addedDate:"2026-04-02",location:"Shelf C4"},
  {id:"i12",upc:"041000000012",name:"Evaporated Milk",category:"Dairy",qty:22,price:1.89,expiry:"2026-08-18",addedBy:"Tom K.",addedDate:"2026-04-03",location:"Shelf A4"},
];
const SAMPLE_DONORS = [
  {id:"d1",name:"Grace Baptist Women's Group",type:"Organization",totalDonations:12,lastDonation:"2026-03-28",totalValue:847.50,email:"grace.womens@email.com"},
  {id:"d2",name:"Johnson Family",type:"Family",totalDonations:6,lastDonation:"2026-04-01",totalValue:324.00,email:"johnson.fam@email.com"},
  {id:"d3",name:"Walmart Community Grant",type:"Corporate",totalDonations:3,lastDonation:"2026-03-15",totalValue:2500.00,email:"community@walmart.com"},
  {id:"d4",name:"Mike Torres",type:"Individual",totalDonations:18,lastDonation:"2026-04-05",totalValue:1120.00,email:"mike.t@email.com"},
];
const SAMPLE_RECIPIENTS = [
  {id:"r1",name:"Williams Family",size:5,dietaryNotes:"Nut allergy (child)",visits:8,lastVisit:"2026-04-03"},
  {id:"r2",name:"Maria Gonzalez",size:2,dietaryNotes:"Diabetic",visits:12,lastVisit:"2026-04-06"},
  {id:"r3",name:"Anderson Household",size:7,dietaryNotes:"",visits:4,lastVisit:"2026-03-28"},
  {id:"r4",name:"James Cooper",size:1,dietaryNotes:"Vegetarian",visits:15,lastVisit:"2026-04-05"},
];
const SAMPLE_MESSAGES = [
  {id:"m1",author:"Sarah M.",role:"Manager",text:"We're running very low on baby formula. If anyone has connections to suppliers, please reach out!",time:"2026-04-06T14:30:00",replies:[{id:"m1r1",author:"Tom K.",text:"I'll check with the Walmart grant contact — they've donated formula before.",time:"2026-04-06T15:10:00"}]},
  {id:"m2",author:"James R.",role:"Volunteer",text:"Huge shoutout to the Johnson family for their donation this week! 6 bags of rice and canned goods.",time:"2026-04-05T09:00:00",replies:[]},
  {id:"m3",author:"Maria L.",role:"Manager",text:"Easter food drive is April 12th. We need volunteers for sorting from 8am-12pm. Who's in?",time:"2026-04-04T11:20:00",replies:[{id:"m3r1",author:"James R.",text:"Count me in!",time:"2026-04-04T12:00:00"},{id:"m3r2",author:"Tom K.",text:"I can do 8-10am",time:"2026-04-04T13:45:00"}]},
];

// ── Helpers ──
const today = new Date("2026-04-07");
const daysUntil = (d) => Math.ceil((new Date(d) - today) / 86400000);
const fmt = (d) => new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
const fmtCurrency = (v) => "$" + Number(v).toFixed(2);
const uid = () => Math.random().toString(36).slice(2,9);

// ── BAG & GO logic ──
const BAG_RULES = {
  1: {canned:4,grains:2,protein:2,dairy:1,beverage:1,snack:1,hygiene:1},
  2: {canned:6,grains:3,protein:3,dairy:2,beverage:2,snack:2,hygiene:1},
  3: {canned:8,grains:4,protein:4,dairy:2,beverage:2,snack:3,hygiene:2},
  4: {canned:10,grains:5,protein:4,dairy:3,beverage:3,snack:3,hygiene:2},
  5: {canned:12,grains:6,protein:5,dairy:3,beverage:3,snack:4,hygiene:2},
  6: {canned:14,grains:7,protein:6,dairy:4,beverage:4,snack:4,hygiene:3},
  7: {canned:16,grains:8,protein:7,dairy:4,beverage:4,snack:5,hygiene:3},
};
const catToRule = {"Canned Goods":"canned","Grains & Pasta":"grains","Meat & Protein":"protein","Dairy":"dairy","Beverages":"beverage","Snacks":"snack","Hygiene":"hygiene","Baby & Infant":"baby","Produce":"produce","Condiments":"canned","Baking":"grains","Frozen":"protein"};

function buildBag(inventory, familySize, dietaryNotes = "") {
  const rules = BAG_RULES[Math.min(familySize, 7)] || BAG_RULES[7];
  const scaled = {};
  Object.keys(rules).forEach(k => { scaled[k] = Math.ceil(rules[k] * (familySize > 7 ? familySize / 7 : 1)); });
  const sorted = [...inventory].filter(i => i.qty > 0 && daysUntil(i.expiry) > 0).sort((a,b) => new Date(a.expiry) - new Date(b.expiry));
  const bag = [];
  const needs = {...scaled};
  const isVeg = dietaryNotes.toLowerCase().includes("vegetarian");
  const nutAllergy = dietaryNotes.toLowerCase().includes("nut");
  sorted.forEach(item => {
    const rule = catToRule[item.category];
    if (!rule || !needs[rule] || needs[rule] <= 0) return;
    if (isVeg && item.category === "Meat & Protein") return;
    if (nutAllergy && item.name.toLowerCase().includes("peanut")) return;
    const take = Math.min(needs[rule], item.qty);
    bag.push({...item, bagQty: take, fifo: daysUntil(item.expiry) <= 30});
    needs[rule] -= take;
  });
  if (familySize >= 3) {
    const formula = sorted.find(i => i.category === "Baby & Infant" && i.qty > 0);
    if (formula) bag.push({...formula, bagQty: 1, fifo: false, optional: true});
  }
  return { bag, unmet: Object.entries(needs).filter(([,v]) => v > 0).map(([k,v]) => ({category:k,needed:v})) };
}

// ══════════════════════════════════════
//  EXPORT HELPERS (NEW)
// ══════════════════════════════════════

function exportCSV(items, filename = "church-pantry-inventory") {
  const headers = ["Item Name","UPC","Category","Quantity","Unit Price","Total Value","Expiry Date","Days Until Expiry","Location","Added By","Date Added","Status"];
  const rows = items.map(item => {
    const d = daysUntil(item.expiry);
    const status = d <= 0 ? "Expired" : d <= 7 ? "Expiring (Critical)" : d <= 30 ? "Expiring Soon" : "Good";
    return [
      `"${item.name}"`,item.upc,`"${item.category}"`,item.qty,item.price.toFixed(2),
      (item.qty * item.price).toFixed(2),item.expiry,d,`"${item.location || ""}"`,
      `"${item.addedBy || ""}"`,item.addedDate || "",status
    ].join(",");
  });
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const totalVal = items.reduce((s, i) => s + i.qty * i.price, 0);
  rows.push("");
  rows.push(`"TOTAL","","",${totalQty},"",${totalVal.toFixed(2)},"","","","","",""`);
  rows.push(`"Export Date","${new Date().toLocaleDateString()}","","","","","","","","","",""`);
  rows.push(`"Items Exported","${items.length}","","","","","","","","","",""`);
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(items, filterLabel = "All Categories") {
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const totalVal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const expiringSoon = items.filter(i => { const d = daysUntil(i.expiry); return d > 0 && d <= 30; }).length;
  const expired = items.filter(i => daysUntil(i.expiry) <= 0).length;
  const byCategory = {};
  items.forEach(i => { if (!byCategory[i.category]) byCategory[i.category] = []; byCategory[i.category].push(i); });
  const catSections = Object.entries(byCategory).sort((a,b) => a[0].localeCompare(b[0])).map(([cat, catItems]) => {
    const catQty = catItems.reduce((s, i) => s + i.qty, 0);
    const catVal = catItems.reduce((s, i) => s + i.qty * i.price, 0);
    const rows = catItems.sort((a,b) => new Date(a.expiry) - new Date(b.expiry)).map(item => {
      const d = daysUntil(item.expiry);
      const sc = d <= 0 ? "expired" : d <= 7 ? "critical" : d <= 30 ? "warning" : "";
      const st = d <= 0 ? "EXPIRED" : d <= 7 ? `${d}d left` : d <= 30 ? `${d}d left` : `${d}d`;
      return `<tr class="${sc}"><td>${item.name}</td><td class="mono">${item.upc}</td><td class="num">${item.qty}</td><td class="num">$${item.price.toFixed(2)}</td><td class="num">$${(item.qty*item.price).toFixed(2)}</td><td>${item.expiry}</td><td class="status">${st}</td><td>${item.location||"—"}</td></tr>`;
    }).join("");
    return `<div class="cat-section"><div class="cat-header"><h3>${cat}</h3><span class="cat-summary">${catItems.length} items · ${catQty} units · $${catVal.toFixed(2)}</span></div><table><thead><tr><th>Item</th><th>UPC</th><th>Qty</th><th>Price</th><th>Value</th><th>Expires</th><th>Status</th><th>Location</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Church Pantry — Inventory Report</title><style>
@media print{body{margin:0}.no-print{display:none!important}.cat-section{break-inside:avoid}}
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2C1810;background:#fff;padding:32px;font-size:12px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #C4582A}
.header h1{font-size:22px;color:#C4582A}.header h2{font-size:14px;color:#6B5344;font-weight:400;margin-top:4px}
.meta{text-align:right;font-size:11px;color:#6B5344}.meta strong{color:#2C1810}
.summary-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px}
.summary-card{background:#FAF6F1;border:1px solid #E4D9CF;border-radius:8px;padding:12px;text-align:center}
.summary-card .label{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#9C8578;margin-bottom:4px}
.summary-card .value{font-size:20px;font-weight:700;color:#2C1810}
.summary-card.alert .value{color:#C42A2A}.summary-card.warn .value{color:#C49B2A}
.cat-section{margin-bottom:20px}.cat-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;padding:6px 0;border-bottom:1px solid #E4D9CF}
.cat-header h3{font-size:14px;color:#C4582A}.cat-summary{font-size:11px;color:#9C8578}
table{width:100%;border-collapse:collapse;font-size:11px}
th{background:#FAF6F1;padding:6px 8px;text-align:left;font-weight:600;border-bottom:1px solid #E4D9CF;font-size:10px;text-transform:uppercase;letter-spacing:.3px;color:#6B5344}
td{padding:5px 8px;border-bottom:1px solid #f0ebe5}
tr.expired{background:#FFEBEE}tr.expired td{color:#C42A2A}tr.critical{background:#FFF3E0}tr.warning{background:#FFFDE7}
.mono{font-family:monospace;font-size:10px;color:#9C8578}.num{text-align:right}
.status{font-weight:600;font-size:10px}tr.expired .status{color:#C42A2A}tr.critical .status{color:#E65100}tr.warning .status{color:#C49B2A}
.footer{margin-top:24px;padding-top:12px;border-top:1px solid #E4D9CF;font-size:10px;color:#9C8578;display:flex;justify-content:space-between}
.print-btn{position:fixed;bottom:24px;right:24px;padding:12px 24px;background:#C4582A;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.2)}
.print-btn:hover{background:#A3451F}</style></head><body>
<div class="header"><div><h1>Church Pantry</h1><h2>Inventory Report — ${filterLabel}</h2></div>
<div class="meta"><div><strong>Generated:</strong> ${new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>
<div><strong>Time:</strong> ${new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}</div>
<div><strong>Items:</strong> ${items.length} unique · ${totalQty} total units</div></div></div>
<div class="summary-grid">
<div class="summary-card"><div class="label">Unique Items</div><div class="value">${items.length}</div></div>
<div class="summary-card"><div class="label">Total Units</div><div class="value">${totalQty.toLocaleString()}</div></div>
<div class="summary-card"><div class="label">Total Value</div><div class="value">$${totalVal.toFixed(2)}</div></div>
<div class="summary-card ${expired>0?'alert':''}"><div class="label">Expired</div><div class="value">${expired}</div></div>
<div class="summary-card ${expiringSoon>0?'warn':''}"><div class="label">Expiring ≤30d</div><div class="value">${expiringSoon}</div></div>
</div>${catSections}
<div class="footer"><span>Church Pantry Inventory Management System</span><span>Confidential — For internal use only</span></div>
<button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
</body></html>`;
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
}

// ── Icons ──
const Icons = {
  Home: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Package: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Scan: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>,
  Heart: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Chat: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Bell: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Chart: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  AlertTriangle: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Trash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  Edit: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Share: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  Mail: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  Download: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
};

const SyncIcon = ({spinning}) => (
  <svg className={spinning?"spinning":""} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/><path d="M2.5 11.5a10 10 0 0 1 16.5-5.7L21.5 8"/><path d="M21.5 12.5a10 10 0 0 1-16.5 5.7L2.5 16"/>
  </svg>
);
const BagIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
);
const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

// ── Styles ──
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
:root {
  --bg: #FAF6F1; --bg2: #F2EBE3; --bg3: #FFFFFF;
  --text: #2C1810; --text2: #6B5344; --text3: #9C8578;
  --accent: #C4582A; --accent2: #D4763E; --accent-soft: #FFF0E8;
  --green: #3D7A4A; --green-soft: #E8F5E9;
  --yellow: #C49B2A; --yellow-soft: #FFF8E1;
  --red: #C42A2A; --red-soft: #FFEBEE;
  --blue: #2A6BC4; --blue-soft: #E3F2FD;
  --border: #E4D9CF;
  --shadow: 0 2px 12px rgba(44,24,16,0.06);
  --shadow-lg: 0 8px 32px rgba(44,24,16,0.1);
  --radius: 12px; --radius-sm: 8px;
  --font-display: 'DM Serif Display', serif;
  --font-body: 'IBM Plex Sans', sans-serif;
  --sync-color: #3D7A4A;
}
* { margin:0; padding:0; box-sizing:border-box; }
body { background:var(--bg); color:var(--text); font-family:var(--font-body); }
@keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
@keyframes slideIn { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:translateX(0)} }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
@keyframes spin { to{transform:rotate(360deg)} }
@keyframes bagBounce { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
.fade-up { animation:fadeUp .4s ease-out both; }
.slide-in { animation:slideIn .3s ease-out both; }

.app { display:flex; min-height:100vh; background:var(--bg); }
.sidebar { width:260px; background:var(--text); color:#fff; display:flex; flex-direction:column; position:fixed; top:0; left:0; height:100vh; z-index:100; }
.sidebar-header { padding:28px 24px 20px; border-bottom:1px solid rgba(255,255,255,.08); }
.sidebar-header h1 { font-family:var(--font-display); font-size:22px; letter-spacing:-.3px; }
.sidebar-header p { font-size:11px; color:rgba(255,255,255,.45); margin-top:4px; letter-spacing:.5px; text-transform:uppercase; }
.sidebar-nav { flex:1; padding:16px 12px; overflow-y:auto; }
.nav-item { display:flex; align-items:center; gap:12px; padding:11px 14px; border-radius:var(--radius-sm); cursor:pointer; font-size:13.5px; font-weight:500; color:rgba(255,255,255,.55); transition:all .2s; margin-bottom:2px; }
.nav-item:hover { color:rgba(255,255,255,.85); background:rgba(255,255,255,.06); }
.nav-item.active { color:#fff; background:var(--accent); }
.nav-item .badge { margin-left:auto; background:var(--red); color:#fff; font-size:10px; font-weight:700; padding:2px 7px; border-radius:10px; }
.nav-section { font-size:10px; text-transform:uppercase; letter-spacing:1.2px; color:rgba(255,255,255,.25); padding:20px 14px 8px; }
.sidebar-footer { padding:16px 12px; border-top:1px solid rgba(255,255,255,.08); }
.sync-bar { display:flex; align-items:center; gap:8px; padding:8px 14px; border-radius:var(--radius-sm); background:rgba(255,255,255,.05); font-size:12px; color:rgba(255,255,255,.5); }
.sync-dot { width:8px; height:8px; border-radius:50%; background:var(--sync-color); }
.sync-dot.syncing { animation:pulse 1.5s infinite; background:var(--yellow); }
.sync-dot.offline { background:var(--red); }

.main { flex:1; margin-left:260px; min-height:100vh; }
.topbar { position:sticky; top:0; z-index:50; background:rgba(250,246,241,.92); backdrop-filter:blur(12px); padding:18px 32px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--border); }
.topbar h2 { font-family:var(--font-display); font-size:22px; letter-spacing:-.3px; }
.topbar-actions { display:flex; align-items:center; gap:10px; }
.content { padding:28px 32px 120px; }

.stats-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:24px; }
.stat-card { background:var(--bg3); border:1px solid var(--border); border-radius:var(--radius); padding:20px; }
.stat-card .label { font-size:11px; text-transform:uppercase; letter-spacing:.8px; color:var(--text3); font-weight:600; }
.stat-card .value { font-size:28px; font-weight:700; margin-top:6px; }
.stat-card .sub { font-size:12px; color:var(--text3); margin-top:4px; }
.stat-card.good .value { color:var(--green); }
.stat-card.alert .value { color:var(--red); }
.stat-card.warning .value { color:var(--yellow); }

.card { background:var(--bg3); border:1px solid var(--border); border-radius:var(--radius); padding:20px; }
.card-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
.card-title { font-size:16px; font-weight:600; }

.btn { display:inline-flex; align-items:center; gap:6px; padding:9px 16px; border-radius:var(--radius-sm); font-size:13px; font-weight:600; border:none; cursor:pointer; transition:all .2s; font-family:var(--font-body); }
.btn-primary { background:var(--accent); color:#fff; }
.btn-primary:hover { background:#A3451F; }
.btn-secondary { background:var(--bg2); color:var(--text); border:1px solid var(--border); }
.btn-secondary:hover { background:var(--border); }
.btn-green { background:var(--green); color:#fff; }
.btn-green:hover { background:#2D5C38; }
.btn-danger { background:var(--red); color:#fff; }
.btn-ghost { background:none; color:var(--text2); }
.btn-ghost:hover { background:var(--bg2); }
.btn-sm { padding:6px 12px; font-size:12px; }

.form-group { margin-bottom:14px; }
.form-label { display:block; font-size:12px; font-weight:600; color:var(--text2); margin-bottom:5px; }
.form-input { width:100%; padding:10px 14px; border:1.5px solid var(--border); border-radius:var(--radius-sm); font-size:13px; font-family:var(--font-body); background:var(--bg3); color:var(--text); transition:border-color .2s; }
.form-input:focus { outline:none; border-color:var(--accent); }

.search-bar { display:flex; align-items:center; gap:8px; padding:0 14px; background:var(--bg3); border:1.5px solid var(--border); border-radius:var(--radius-sm); }
.search-bar input { border:none; background:none; outline:none; padding:10px 0; flex:1; font-size:13px; font-family:var(--font-body); }
.search-bar svg { color:var(--text3); flex-shrink:0; }

.table-wrap { background:var(--bg3); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; }
table { width:100%; border-collapse:collapse; }
th { background:var(--bg2); padding:10px 14px; text-align:left; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.5px; color:var(--text3); border-bottom:1px solid var(--border); }
td { padding:10px 14px; border-bottom:1px solid var(--bg2); font-size:13px; }
tr:hover td { background:var(--bg); }
.check-col { width:40px; }

.tag { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; }
.tag-green { background:var(--green-soft); color:var(--green); }
.tag-yellow { background:var(--yellow-soft); color:var(--yellow); }
.tag-red { background:var(--red-soft); color:var(--red); }
.tag-blue { background:var(--blue-soft); color:var(--blue); }

.modal-overlay { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(44,24,16,.4); backdrop-filter:blur(4px); z-index:200; display:flex; align-items:center; justify-content:center; animation:fadeUp .2s ease-out; }
.modal { background:var(--bg3); border-radius:var(--radius); width:90%; max-width:500px; max-height:85vh; overflow-y:auto; box-shadow:var(--shadow-lg); }
.modal-header { display:flex; justify-content:space-between; align-items:center; padding:20px 24px; border-bottom:1px solid var(--border); }
.modal-header h3 { font-size:18px; font-weight:600; }
.modal-close { background:none; border:none; font-size:24px; color:var(--text3); cursor:pointer; padding:0 4px; }
.modal-body { padding:24px; }

.bag-hero { background:linear-gradient(135deg,var(--accent),var(--accent2)); color:#fff; border-radius:var(--radius); padding:32px; margin-bottom:24px; }
.bag-hero h2 { font-family:var(--font-display); font-size:24px; }
.bag-hero p { font-size:14px; opacity:.85; margin-top:6px; }
.bag-config { display:flex; gap:14px; margin-top:20px; flex-wrap:wrap; align-items:flex-end; }
.bag-config .form-label { color:rgba(255,255,255,.8); }
.bag-config .form-input { background:rgba(255,255,255,.15); border-color:rgba(255,255,255,.25); color:#fff; }
.bag-summary { display:flex; gap:14px; flex-wrap:wrap; margin-top:16px; }
.bag-summary .card { flex:1; min-width:150px; text-align:center; }

.message-card { background:var(--bg3); border:1px solid var(--border); border-radius:var(--radius); padding:20px; margin-bottom:12px; }
.message-header { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.avatar { width:36px; height:36px; border-radius:50%; background:var(--accent); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; }
.message-author { font-weight:600; font-size:14px; }
.message-role { font-size:11px; color:var(--text3); }
.message-time { font-size:11px; color:var(--text3); margin-left:auto; }
.message-text { font-size:14px; line-height:1.6; }
.replies { margin-top:14px; padding-top:14px; border-top:1px solid var(--border); }
.reply { display:flex; gap:10px; padding:10px 0; }
.reply .avatar { width:28px; height:28px; font-size:10px; }
.reply-author { font-weight:600; font-size:12px; }
.reply-text { font-size:13px; color:var(--text2); margin-top:2px; }
.reply-time { font-size:10px; color:var(--text3); margin-top:2px; }

.notif-item { display:flex; gap:14px; padding:14px 18px; border-radius:var(--radius-sm); margin-bottom:8px; align-items:flex-start; }
.notif-item.urgent { background:var(--red-soft); border:1px solid #F5C6C6; }
.notif-item.warning { background:var(--yellow-soft); border:1px solid #F5E6A3; }
.notif-icon { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.notif-item.urgent .notif-icon { background:var(--red); color:#fff; }
.notif-item.warning .notif-icon { background:var(--yellow); color:#fff; }
.notif-title { font-weight:600; font-size:14px; }
.notif-desc { font-size:12px; color:var(--text2); margin-top:3px; }

.bulk-bar { position:sticky; bottom:0; left:0; right:0; background:var(--text); color:#fff; padding:14px 28px; display:flex; align-items:center; gap:16px; border-radius:12px 12px 0 0; box-shadow:0 -4px 20px rgba(0,0,0,.15); z-index:80; animation:fadeUp .3s ease-out; }
.bulk-textarea { width:100%; min-height:160px; padding:14px; font-family:'IBM Plex Sans Mono',monospace; font-size:12px; border:2px dashed var(--border); border-radius:var(--radius-sm); background:var(--bg); resize:vertical; }
.bulk-textarea:focus { outline:none; border-color:var(--accent); background:var(--bg3); }

.cloud-sync { display:flex; align-items:center; gap:6px; font-size:11px; color:var(--text3); padding:8px 14px; border-radius:var(--radius-sm); background:var(--bg2); }
.cloud-sync.active { color:var(--green); background:var(--green-soft); }
.cloud-sync svg.spinning { animation:spin 1.5s linear infinite; }

.email-config { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.email-freq-option { padding:14px; border:2px solid var(--border); border-radius:var(--radius-sm); cursor:pointer; text-align:center; transition:all .2s; }
.email-freq-option:hover { border-color:var(--accent); }
.email-freq-option.selected { border-color:var(--accent); background:var(--accent-soft); }
.freq-label { font-weight:700; font-size:14px; }
.freq-desc { font-size:11px; color:var(--text3); margin-top:4px; }

@media (max-width:768px) {
  .sidebar { display:none; }
  .main { margin-left:0; }
  .topbar { padding:14px 18px; }
  .topbar h2 { font-size:18px; }
  .content { padding:16px 18px 120px; }
  .stats-grid { grid-template-columns:1fr 1fr; }
  .bag-config { flex-direction:column; }
  .mobile-nav { display:flex !important; }
}
.mobile-nav { display:none; position:fixed; bottom:0; left:0; right:0; background:var(--text); z-index:150; padding:8px 0 max(8px,env(safe-area-inset-bottom)); justify-content:space-around; }
.mobile-nav-item { display:flex; flex-direction:column; align-items:center; gap:3px; padding:6px 12px; color:rgba(255,255,255,.4); font-size:10px; font-weight:600; cursor:pointer; border:none; background:none; }
.mobile-nav-item.active { color:var(--accent2); }
`;

// ═══════════════════════════════════════════
//  MAIN APP COMPONENT
// ═══════════════════════════════════════════
export default function ChurchPantry() {
  const [page, setPage] = useState("dashboard");
  const [inventory, setInventory] = useState(SAMPLE_INVENTORY);
  const [donors, setDonors] = useState(SAMPLE_DONORS);
  const [recipients, setRecipients] = useState(SAMPLE_RECIPIENTS);
  const [messages, setMessages] = useState(SAMPLE_MESSAGES);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [syncStatus, setSyncStatus] = useState("synced");
  const [emailFreq, setEmailFreq] = useState("monthly");

  useEffect(() => {
    const interval = setInterval(() => { setSyncStatus("syncing"); setTimeout(() => setSyncStatus("synced"), 2000); }, 30000);
    return () => clearInterval(interval);
  }, []);
  const triggerSync = () => { setSyncStatus("syncing"); setTimeout(() => setSyncStatus("synced"), 2500); };

  const notifications = useMemo(() => {
    const notifs = [];
    inventory.forEach(item => {
      const d = daysUntil(item.expiry);
      if (d <= 0) notifs.push({type:"urgent",title:`EXPIRED: ${item.name}`,desc:`Expired ${Math.abs(d)} days ago. Remove immediately.`,item});
      else if (d <= 7) notifs.push({type:"urgent",title:`Expiring in ${d} days: ${item.name}`,desc:`${item.qty} units expire ${fmt(item.expiry)}. Prioritize distribution.`,item});
      else if (d <= 30) notifs.push({type:"warning",title:`Expiring soon: ${item.name}`,desc:`${item.qty} units expire ${fmt(item.expiry)}.`,item});
    });
    inventory.forEach(item => { if (item.qty <= 5) notifs.push({type:"warning",title:`Low stock: ${item.name}`,desc:`Only ${item.qty} units remaining.`,item}); });
    return notifs;
  }, [inventory]);

  const expiringCount = notifications.filter(n => n.type === "urgent").length;
  const filteredInventory = inventory.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.upc.includes(search) || i.category.toLowerCase().includes(search.toLowerCase()));
  const totalValue = inventory.reduce((s,i) => s + i.qty * i.price, 0);
  const totalItems = inventory.reduce((s,i) => s + i.qty, 0);

  const handleSelectAll = (e) => { if(e.target.checked) setSelected(new Set(filteredInventory.map(i=>i.id))); else setSelected(new Set()); };
  const toggleSelect = (id) => { const next = new Set(selected); next.has(id)?next.delete(id):next.add(id); setSelected(next); };
  const bulkDelete = () => { setInventory(prev => prev.filter(i => !selected.has(i.id))); setSelected(new Set()); };
  const addItem = (item) => { setInventory(prev => [...prev, {...item, id: uid()}]); triggerSync(); };
  const bulkAdd = (items) => { setInventory(prev => [...prev, ...items.map(i => ({...i, id: uid()}))]); triggerSync(); };
  const deleteItem = (id) => { setInventory(prev => prev.filter(i => i.id !== id)); triggerSync(); };
  const addMessage = (text) => { setMessages(prev => [{id:uid(),author:"You",role:"Manager",text,time:new Date().toISOString(),replies:[]}, ...prev]); };
  const addReply = (msgId, text) => { setMessages(prev => prev.map(m => m.id === msgId ? {...m, replies:[...m.replies, {id:uid(),author:"You",text,time:new Date().toISOString()}]} : m)); };

  const navItems = [
    {key:"dashboard",label:"Dashboard",icon:<Icons.Home/>},
    {key:"inventory",label:"Inventory",icon:<Icons.Package/>},
    {key:"scan",label:"Scan & Add",icon:<Icons.Scan/>},
    {key:"baggo",label:"Bag & Go",icon:<BagIcon/>},
    {key:"donors",label:"Donors",icon:<Icons.Heart/>},
    {key:"recipients",label:"Recipients",icon:<Icons.Users/>},
    {key:"discussion",label:"Discussion",icon:<Icons.Chat/>},
    {key:"notifications",label:"Alerts",icon:<Icons.Bell/>,badge:expiringCount||null},
    {key:"analytics",label:"Analytics",icon:<Icons.Chart/>},
    {key:"settings",label:"Settings",icon:<SettingsIcon/>},
  ];
  const pageTitle = navItems.find(n=>n.key===page)?.label || "Dashboard";

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-header"><h1>Church Pantry</h1><p>Inventory Management</p></div>
          <nav className="sidebar-nav">
            <div className="nav-section">Main</div>
            {navItems.slice(0,4).map(n=>(<div key={n.key} className={`nav-item ${page===n.key?"active":""}`} onClick={()=>{setPage(n.key);setSelected(new Set())}}>{n.icon}<span>{n.label}</span>{n.badge&&<span className="badge">{n.badge}</span>}</div>))}
            <div className="nav-section">Community</div>
            {navItems.slice(4,8).map(n=>(<div key={n.key} className={`nav-item ${page===n.key?"active":""}`} onClick={()=>{setPage(n.key);setSelected(new Set())}}>{n.icon}<span>{n.label}</span>{n.badge&&<span className="badge">{n.badge}</span>}</div>))}
            <div className="nav-section">System</div>
            {navItems.slice(8).map(n=>(<div key={n.key} className={`nav-item ${page===n.key?"active":""}`} onClick={()=>{setPage(n.key);setSelected(new Set())}}>{n.icon}<span>{n.label}</span></div>))}
          </nav>
          <div className="sidebar-footer">
            <div className="sync-bar" onClick={triggerSync} style={{cursor:"pointer"}}>
              <span className={`sync-dot ${syncStatus}`}/><SyncIcon spinning={syncStatus==="syncing"}/>{syncStatus==="synced"?"Cloud synced":syncStatus==="syncing"?"Syncing...":"Offline"}
            </div>
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <h2>{pageTitle}</h2>
            <div className="topbar-actions">
              <div className={`cloud-sync ${syncStatus==="synced"?"active":""}`} onClick={triggerSync} style={{cursor:"pointer"}}>
                <SyncIcon spinning={syncStatus==="syncing"}/>{syncStatus==="synced"?"Synced":syncStatus==="syncing"?"Syncing...":"Offline"}
              </div>
              {page==="inventory" && <>
                <button className="btn btn-secondary btn-sm" onClick={()=>setModal("bulkAdd")}>Bulk Add</button>
                <button className="btn btn-primary btn-sm" onClick={()=>setModal("addItem")}><Icons.Plus/> Add Item</button>
              </>}
              {page==="donors" && <button className="btn btn-primary btn-sm" onClick={()=>setModal("addDonor")}><Icons.Plus/> Add Donor</button>}
              {page==="recipients" && <button className="btn btn-primary btn-sm" onClick={()=>setModal("addRecipient")}><Icons.Plus/> Add Recipient</button>}
            </div>
          </div>
          <div className="content">
            {page==="dashboard" && <DashboardPage inventory={inventory} donors={donors} recipients={recipients} notifications={notifications} totalValue={totalValue} totalItems={totalItems} setPage={setPage}/>}
            {page==="inventory" && <InventoryPage inventory={filteredInventory} search={search} setSearch={setSearch} selected={selected} handleSelectAll={handleSelectAll} toggleSelect={toggleSelect} deleteItem={deleteItem} setModal={setModal}/>}
            {page==="scan" && <ScanPage addItem={addItem} triggerSync={triggerSync}/>}
            {page==="baggo" && <BagGoPage inventory={inventory} recipients={recipients} setInventory={setInventory} triggerSync={triggerSync}/>}
            {page==="donors" && <DonorsPage donors={donors}/>}
            {page==="recipients" && <RecipientsPage recipients={recipients}/>}
            {page==="discussion" && <DiscussionPage messages={messages} addMessage={addMessage} addReply={addReply}/>}
            {page==="notifications" && <NotificationsPage notifications={notifications}/>}
            {page==="analytics" && <AnalyticsPage inventory={inventory} donors={donors} recipients={recipients}/>}
            {page==="settings" && <SettingsPage emailFreq={emailFreq} setEmailFreq={setEmailFreq} syncStatus={syncStatus} triggerSync={triggerSync}/>}
          </div>
          {selected.size > 0 && (
            <div className="bulk-bar">
              <span>{selected.size} item{selected.size>1?"s":""} selected</span>
              <button className="btn btn-secondary btn-sm" onClick={()=>setModal("bulkEdit")}><Icons.Edit/> Bulk Edit</button>
              <button className="btn btn-danger btn-sm" onClick={bulkDelete}><Icons.Trash/> Delete Selected</button>
              <div style={{flex:1}}/>
              <button className="btn btn-ghost btn-sm" style={{color:"#fff"}} onClick={()=>setSelected(new Set())}>Cancel</button>
            </div>
          )}
        </main>
        <nav className="mobile-nav">
          {[navItems[0],navItems[1],navItems[3],navItems[6],navItems[7]].map(n=>(<button key={n.key} className={`mobile-nav-item ${page===n.key?"active":""}`} onClick={()=>setPage(n.key)}>{n.icon}<span>{n.label}</span></button>))}
        </nav>
      </div>

      {modal==="addItem" && <AddItemModal onClose={()=>setModal(null)} onAdd={addItem}/>}
      {modal==="bulkAdd" && <BulkAddModal onClose={()=>setModal(null)} onBulkAdd={bulkAdd}/>}
      {modal==="bulkEdit" && <BulkEditModal onClose={()=>setModal(null)} selected={selected} inventory={inventory} setInventory={setInventory} setSelected={setSelected} triggerSync={triggerSync}/>}
      {modal==="addDonor" && <AddDonorModal onClose={()=>setModal(null)} onAdd={(d)=>{setDonors(p=>[...p,{...d,id:uid()}]);}}/>}
      {modal==="addRecipient" && <AddRecipientModal onClose={()=>setModal(null)} onAdd={(r)=>{setRecipients(p=>[...p,{...r,id:uid()}]);}}/>}
      {modal==="shareAccess" && <ShareModal onClose={()=>setModal(null)}/>}
      {modal==="emailConfig" && <EmailConfigModal onClose={()=>setModal(null)} freq={emailFreq} setFreq={setEmailFreq}/>}
    </>
  );
}

// ═══════════════════════════════════════════
//  PAGES
// ═══════════════════════════════════════════

function DashboardPage({inventory, donors, recipients, notifications, totalValue, totalItems, setPage}) {
  const expiringSoon = inventory.filter(i => daysUntil(i.expiry) <= 30 && daysUntil(i.expiry) > 0).length;
  const lowStock = inventory.filter(i => i.qty <= 5).length;
  return (
    <div className="fade-up">
      <div className="stats-grid">
        <div className="stat-card good"><div className="label">Total Items</div><div className="value">{totalItems.toLocaleString()}</div><div className="sub">{inventory.length} unique products</div></div>
        <div className="stat-card"><div className="label">Inventory Value</div><div className="value">{fmtCurrency(totalValue)}</div><div className="sub">Based on local pricing</div></div>
        <div className={`stat-card ${expiringSoon>0?"warning":""}`}><div className="label">Expiring Soon</div><div className="value">{expiringSoon}</div><div className="sub">Within 30 days</div></div>
        <div className={`stat-card ${lowStock>0?"alert":""}`}><div className="label">Low Stock</div><div className="value">{lowStock}</div><div className="sub">5 or fewer units</div></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div className="card">
          <div className="card-header"><h3 className="card-title">Recent Alerts</h3><button className="btn btn-ghost btn-sm" onClick={()=>setPage("notifications")}>View All</button></div>
          {notifications.slice(0,4).map((n,i) => (<div key={i} className={`notif-item ${n.type}`} style={{marginBottom:8}}><div className="notif-icon"><Icons.AlertTriangle/></div><div className="notif-text"><div className="notif-title">{n.title}</div><div className="notif-desc">{n.desc}</div></div></div>))}
          {notifications.length===0 && <p style={{color:"var(--text3)",fontSize:14,padding:20,textAlign:"center"}}>No alerts right now!</p>}
        </div>
        <div className="card">
          <div className="card-header"><h3 className="card-title">Quick Actions</h3></div>
          <div style={{display:"grid",gap:10}}>
            <button className="btn btn-primary" style={{width:"100%",justifyContent:"center"}} onClick={()=>setPage("scan")}><Icons.Scan/> Scan & Add Items</button>
            <button className="btn btn-green" style={{width:"100%",justifyContent:"center"}} onClick={()=>setPage("baggo")}><BagIcon/> Build a Bag & Go</button>
            <button className="btn btn-secondary" style={{width:"100%",justifyContent:"center"}} onClick={()=>setPage("discussion")}><Icons.Chat/> Discussion Board</button>
            <button className="btn btn-secondary" style={{width:"100%",justifyContent:"center"}} onClick={()=>setPage("donors")}><Icons.Heart/> Manage Donors</button>
          </div>
          <div style={{marginTop:20}}>
            <div className="card-header"><h3 className="card-title" style={{fontSize:15}}>Top Donors</h3></div>
            {donors.slice(0,3).map(d=>(<div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--border)"}}><div><div style={{fontWeight:600,fontSize:13}}>{d.name}</div><div style={{fontSize:11,color:"var(--text3)"}}>{d.totalDonations} donations</div></div><div style={{fontWeight:700,color:"var(--green)",fontSize:14}}>{fmtCurrency(d.totalValue)}</div></div>))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── INVENTORY PAGE (WITH EXPORT) ──
function InventoryPage({inventory, search, setSearch, selected, handleSelectAll, toggleSelect, deleteItem, setModal}) {
  const [catFilter, setCatFilter] = useState("All");
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if(exportRef.current && !exportRef.current.contains(e.target)) setShowExport(false); };
    if(showExport) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showExport]);

  const filtered = catFilter==="All" ? inventory : inventory.filter(i => i.category === catFilter);
  const filterLabel = catFilter==="All" ? "All Categories" : catFilter;

  const handleExportCSV = () => { exportCSV(filtered, `church-pantry-${catFilter==="All"?"all":catFilter.toLowerCase().replace(/\s+/g,"-")}`); setShowExport(false); };
  const handleExportPDF = () => { exportPDF(filtered, filterLabel); setShowExport(false); };

  return (
    <div className="fade-up">
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        <div className="search-bar" style={{flex:1,minWidth:200}}>
          <Icons.Search/><input className="form-input" placeholder="Search by name, UPC, or category..." value={search} onChange={e=>setSearch(e.target.value)} style={{border:"none",padding:"10px 0"}}/>
        </div>
        <select className="form-input" style={{width:"auto",minWidth:160}} value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
          <option value="All">All Categories</option>
          {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        {/* ── EXPORT DROPDOWN ── */}
        <div ref={exportRef} style={{position:"relative"}}>
          <button className="btn btn-secondary btn-sm" onClick={()=>setShowExport(!showExport)} style={{display:"flex",alignItems:"center",gap:6}}>
            <Icons.Download/> Export
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginLeft:2,transform:showExport?"rotate(180deg)":"rotate(0)",transition:"transform .2s"}}><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {showExport && (
            <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",boxShadow:"var(--shadow-lg)",minWidth:220,zIndex:100,overflow:"hidden",animation:"fadeUp .15s ease-out"}}>
              <div style={{padding:"8px 12px",borderBottom:"1px solid var(--border)",fontSize:11,fontWeight:600,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".5px"}}>
                Export {filtered.length} items · {filterLabel}
              </div>
              <button onClick={handleExportCSV} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 12px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:"var(--text)",textAlign:"left"}} onMouseEnter={e=>e.currentTarget.style.background="var(--bg2)"} onMouseLeave={e=>e.currentTarget.style.background="none"}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                <div><div style={{fontWeight:600}}>Download CSV</div><div style={{fontSize:11,color:"var(--text3)",marginTop:1}}>Spreadsheet-ready, all fields</div></div>
              </button>
              <button onClick={handleExportPDF} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 12px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:"var(--text)",textAlign:"left"}} onMouseEnter={e=>e.currentTarget.style.background="var(--bg2)"} onMouseLeave={e=>e.currentTarget.style.background="none"}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <div><div style={{fontWeight:600}}>Print / PDF Report</div><div style={{fontSize:11,color:"var(--text3)",marginTop:1}}>Formatted report with summaries</div></div>
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr>
            <th className="check-col"><input type="checkbox" onChange={handleSelectAll} checked={selected.size===filtered.length && filtered.length>0}/></th>
            <th>Item Name</th><th>UPC</th><th>Category</th><th>Qty</th><th>Price</th><th>Expiry</th><th>Location</th><th>Status</th><th style={{width:60}}></th>
          </tr></thead>
          <tbody>
            {filtered.map((item,idx) => {
              const d = daysUntil(item.expiry);
              const status = d<=0?"expired":d<=7?"urgent":d<=30?"warning":"good";
              const qtyStatus = item.qty<=5?"low":item.qty<=15?"medium":"good";
              return (
                <tr key={item.id} className="slide-in" style={{animationDelay:`${idx*30}ms`}}>
                  <td><input type="checkbox" checked={selected.has(item.id)} onChange={()=>toggleSelect(item.id)}/></td>
                  <td style={{fontWeight:600}}>{item.name}</td>
                  <td style={{fontFamily:"monospace",fontSize:12,color:"var(--text3)"}}>{item.upc}</td>
                  <td><span className="tag tag-blue">{item.category}</span></td>
                  <td><span className={`tag ${qtyStatus==="low"?"tag-red":qtyStatus==="medium"?"tag-yellow":"tag-green"}`}>{item.qty}</span></td>
                  <td>{fmtCurrency(item.price)}</td>
                  <td style={{fontSize:12}}>{fmt(item.expiry)}</td>
                  <td style={{fontSize:12,color:"var(--text3)"}}>{item.location}</td>
                  <td>{status==="expired"?<span className="tag tag-red">Expired</span>:status==="urgent"?<span className="tag tag-red">{d}d left</span>:status==="warning"?<span className="tag tag-yellow">{d}d left</span>:<span className="tag tag-green">OK</span>}</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={()=>deleteItem(item.id)} title="Delete"><Icons.Trash/></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length===0 && <p style={{textAlign:"center",padding:40,color:"var(--text3)"}}>No items found.</p>}
      </div>
    </div>
  );
}

// ── SCAN PAGE ──
function ScanPage({addItem, triggerSync}) {
  const [upc, setUpc] = useState("");
  const [form, setForm] = useState({name:"",category:"Canned Goods",qty:1,price:"",expiry:"",location:""});
  const [scanned, setScanned] = useState(false);
  const videoRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);

  const simulateScan = () => { setScanned(true); setUpc("041000"+String(Math.floor(Math.random()*999999)).padStart(6,"0")); setForm(f=>({...f,name:"Scanned Item — "+["Corn","Beans","Soup","Rice","Pasta"][Math.floor(Math.random()*5)],price:(Math.random()*5+.99).toFixed(2)})); };
  const startCamera = async () => { try { const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}}); if(videoRef.current){videoRef.current.srcObject=stream;setCameraActive(true);} } catch(e) { simulateScan(); } };
  const handleSubmit = () => { if(!form.name)return; addItem({upc:upc||"000000000000",...form,qty:Number(form.qty),price:Number(form.price),addedBy:"You",addedDate:new Date().toISOString().slice(0,10)}); setForm({name:"",category:"Canned Goods",qty:1,price:"",expiry:"",location:""}); setUpc(""); setScanned(false); };

  return (
    <div className="fade-up" style={{maxWidth:600}}>
      <div className="card" style={{marginBottom:20}}>
        <h3 className="card-title" style={{marginBottom:16}}>Barcode Scanner</h3>
        <div style={{background:"var(--bg)",borderRadius:"var(--radius)",padding:40,textAlign:"center",border:"2px dashed var(--border)",marginBottom:16,position:"relative",overflow:"hidden",minHeight:200,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
          {cameraActive ? <video ref={videoRef} autoPlay playsInline style={{width:"100%",borderRadius:8}}/> : <>
            <Icons.Scan/><p style={{color:"var(--text3)",fontSize:14,margin:"12px 0"}}>Point camera at barcode or enter UPC manually</p>
            <div style={{display:"flex",gap:10}}><button className="btn btn-primary" onClick={startCamera}><Icons.Scan/> Open Camera</button><button className="btn btn-secondary" onClick={simulateScan}>Simulate Scan</button></div>
          </>}
        </div>
        {scanned && <div style={{background:"var(--green-soft)",padding:12,borderRadius:8,marginBottom:12,fontSize:13,color:"var(--green)",fontWeight:600}}>Scanned: {upc}</div>}
        <div className="form-group"><label className="form-label">UPC Code</label><input className="form-input" value={upc} onChange={e=>setUpc(e.target.value)} placeholder="Enter or scan UPC"/></div>
      </div>
      <div className="card">
        <h3 className="card-title" style={{marginBottom:16}}>Item Details</h3>
        <div className="form-group"><label className="form-label">Item Name *</label><input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div className="form-group"><label className="form-label">Category</label><select className="form-input" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Quantity</label><input className="form-input" type="number" min="1" value={form.qty} onChange={e=>setForm(f=>({...f,qty:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Price ($)</label><input className="form-input" type="number" step="0.01" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Expiry Date</label><input className="form-input" type="date" value={form.expiry} onChange={e=>setForm(f=>({...f,expiry:e.target.value}))}/></div>
        </div>
        <div className="form-group"><label className="form-label">Location</label><input className="form-input" value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} placeholder="e.g. Shelf A2"/></div>
        <button className="btn btn-primary" style={{width:"100%",justifyContent:"center",marginTop:8}} onClick={handleSubmit}><Icons.Plus/> Add to Inventory</button>
      </div>
    </div>
  );
}

// ── BAG & GO PAGE ──
function BagGoPage({inventory, recipients, setInventory, triggerSync}) {
  const [familySize, setFamilySize] = useState(4);
  const [dietary, setDietary] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [bag, setBag] = useState(null);
  const [packed, setPacked] = useState(false);

  useEffect(() => { if(selectedRecipient){const r=recipients.find(r=>r.id===selectedRecipient); if(r){setFamilySize(r.size);setDietary(r.dietaryNotes);}} }, [selectedRecipient, recipients]);

  const generate = () => { setBag(buildBag(inventory, familySize, dietary)); setPacked(false); };
  const confirmPack = () => {
    if(!bag) return;
    setInventory(prev => { const next=[...prev]; bag.bag.forEach(b=>{const idx=next.findIndex(i=>i.id===b.id); if(idx>=0) next[idx]={...next[idx],qty:next[idx].qty-b.bagQty};}); return next.filter(i=>i.qty>0); });
    setPacked(true); triggerSync();
  };
  const totalBagItems = bag ? bag.bag.reduce((s,i)=>s+i.bagQty,0) : 0;
  const totalBagValue = bag ? bag.bag.reduce((s,i)=>s+i.bagQty*i.price,0) : 0;

  return (
    <div className="fade-up">
      <div className="bag-hero">
        <h2>Bag & Go</h2><p>Smart packing suggestions based on family size, dietary needs, and FIFO rotation</p>
        <div className="bag-config">
          <div className="form-group" style={{minWidth:180}}><label className="form-label">Select Recipient (optional)</label><select className="form-input" value={selectedRecipient} onChange={e=>setSelectedRecipient(e.target.value)}><option value="">— Custom —</option>{recipients.map(r=><option key={r.id} value={r.id}>{r.name} (family of {r.size})</option>)}</select></div>
          <div className="form-group" style={{minWidth:100}}><label className="form-label">Family Size</label><input className="form-input" type="number" min="1" max="15" value={familySize} onChange={e=>setFamilySize(Number(e.target.value))}/></div>
          <div className="form-group" style={{minWidth:200}}><label className="form-label">Dietary Notes</label><input className="form-input" value={dietary} onChange={e=>setDietary(e.target.value)} placeholder="e.g. Vegetarian, Nut allergy"/></div>
          <button className="btn btn-primary" onClick={generate} style={{height:42,marginBottom:14}}>Generate Bag</button>
        </div>
      </div>
      {bag && (
        <div className="fade-up">
          <div className="bag-summary">
            <div className="card"><div className="label">Items</div><div className="value" style={{fontSize:24,fontWeight:700}}>{totalBagItems}</div></div>
            <div className="card"><div className="label">Value</div><div className="value" style={{fontSize:24,fontWeight:700,color:"var(--green)"}}>{fmtCurrency(totalBagValue)}</div></div>
            <div className="card"><div className="label">FIFO Items</div><div className="value" style={{fontSize:24,fontWeight:700,color:"var(--yellow)"}}>{bag.bag.filter(i=>i.fifo).length}</div></div>
            {bag.unmet.length>0 && <div className="card" style={{borderColor:"var(--red)"}}><div className="label">Gaps</div><div className="value" style={{fontSize:24,fontWeight:700,color:"var(--red)"}}>{bag.unmet.length}</div></div>}
          </div>
          <div className="table-wrap" style={{marginTop:16}}>
            <table><thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>FIFO</th></tr></thead>
              <tbody>{bag.bag.map((item,i)=>(<tr key={i} style={item.fifo?{background:"var(--yellow-soft)"}:{}}><td style={{fontWeight:600}}>{item.name}{item.optional?" (optional)":""}</td><td><span className="tag tag-blue">{item.category}</span></td><td>{item.bagQty}</td><td>{item.fifo?<span className="tag tag-yellow">Use First</span>:<span className="tag tag-green">OK</span>}</td></tr>))}</tbody>
            </table>
          </div>
          {bag.unmet.length>0 && <div style={{marginTop:12,padding:14,background:"var(--red-soft)",borderRadius:8,fontSize:13,color:"var(--red)"}}><strong>Gaps:</strong> {bag.unmet.map(u=>`${u.category} (need ${u.needed} more)`).join(", ")}</div>}
          {!packed ? <button className="btn btn-green" style={{width:"100%",justifyContent:"center",marginTop:16,padding:"14px 24px",fontSize:15}} onClick={confirmPack}><BagIcon/> Confirm & Pack Bag</button>
          : <div style={{marginTop:16,padding:20,background:"var(--green-soft)",borderRadius:12,textAlign:"center",color:"var(--green)",fontWeight:600,fontSize:16,animation:"bagBounce .5s ease-out"}}>Bag packed! Inventory updated.</div>}
        </div>
      )}
    </div>
  );
}

// ── DONORS PAGE ──
function DonorsPage({donors}) {
  return (
    <div className="fade-up">
      <div className="stats-grid">
        <div className="stat-card good"><div className="label">Total Donors</div><div className="value">{donors.length}</div></div>
        <div className="stat-card"><div className="label">Total Donations</div><div className="value">{donors.reduce((s,d)=>s+d.totalDonations,0)}</div></div>
        <div className="stat-card"><div className="label">Total Value</div><div className="value">{fmtCurrency(donors.reduce((s,d)=>s+d.totalValue,0))}</div></div>
      </div>
      <div className="table-wrap">
        <table><thead><tr><th>Donor Name</th><th>Type</th><th>Donations</th><th>Last Donation</th><th>Total Value</th><th>Email</th></tr></thead>
          <tbody>{donors.map(d=>(<tr key={d.id}><td style={{fontWeight:600}}>{d.name}</td><td><span className={`tag ${d.type==="Corporate"?"tag-blue":d.type==="Organization"?"tag-green":"tag-yellow"}`}>{d.type}</span></td><td>{d.totalDonations}</td><td>{fmt(d.lastDonation)}</td><td style={{fontWeight:700,color:"var(--green)"}}>{fmtCurrency(d.totalValue)}</td><td style={{fontSize:12,color:"var(--text3)"}}>{d.email}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ── RECIPIENTS PAGE ──
function RecipientsPage({recipients}) {
  return (
    <div className="fade-up">
      <div className="stats-grid">
        <div className="stat-card good"><div className="label">Families Served</div><div className="value">{recipients.length}</div></div>
        <div className="stat-card"><div className="label">People Served</div><div className="value">{recipients.reduce((s,r)=>s+r.size,0)}</div></div>
        <div className="stat-card"><div className="label">Total Visits</div><div className="value">{recipients.reduce((s,r)=>s+r.visits,0)}</div></div>
      </div>
      <div className="table-wrap">
        <table><thead><tr><th>Recipient</th><th>Family Size</th><th>Dietary Notes</th><th>Total Visits</th><th>Last Visit</th></tr></thead>
          <tbody>{recipients.map(r=>(<tr key={r.id}><td style={{fontWeight:600}}>{r.name}</td><td>{r.size}</td><td>{r.dietaryNotes||<span style={{color:"var(--text3)"}}>None</span>}</td><td>{r.visits}</td><td>{fmt(r.lastVisit)}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ── DISCUSSION PAGE ──
function DiscussionPage({messages, addMessage, addReply}) {
  const [newMsg, setNewMsg] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const submit = () => { if(newMsg.trim()){addMessage(newMsg.trim());setNewMsg("");} };
  const submitReply = (id) => { if(replyText.trim()){addReply(id,replyText.trim());setReplyText("");setReplyTo(null);} };

  return (
    <div className="fade-up" style={{maxWidth:700}}>
      <div className="card" style={{marginBottom:24}}>
        <textarea className="form-input" placeholder="Share an update, need, or note with the team..." value={newMsg} onChange={e=>setNewMsg(e.target.value)} style={{marginBottom:12}}/>
        <button className="btn btn-primary" onClick={submit}><Icons.Chat/> Post Message</button>
      </div>
      {messages.map(msg => (
        <div key={msg.id} className="message-card slide-in">
          <div className="message-header">
            <div className="avatar">{msg.author.split(" ").map(n=>n[0]).join("")}</div>
            <div><div className="message-author">{msg.author}</div><div className="message-role">{msg.role}</div></div>
            <div className="message-time">{fmt(msg.time)}</div>
          </div>
          <div className="message-text">{msg.text}</div>
          {msg.replies.length>0 && (<div className="replies">{msg.replies.map(r=>(<div key={r.id} className="reply"><div className="avatar">{r.author.split(" ").map(n=>n[0]).join("")}</div><div className="reply-content"><div className="reply-author">{r.author}</div><div className="reply-text">{r.text}</div><div className="reply-time">{fmt(r.time)}</div></div></div>))}</div>)}
          <div style={{marginTop:12}}>
            {replyTo===msg.id ? (<div style={{display:"flex",gap:8}}><input className="form-input" placeholder="Write a reply..." value={replyText} onChange={e=>setReplyText(e.target.value)} style={{fontSize:13}} onKeyDown={e=>{if(e.key==="Enter")submitReply(msg.id)}}/><button className="btn btn-primary btn-sm" onClick={()=>submitReply(msg.id)}>Reply</button><button className="btn btn-ghost btn-sm" onClick={()=>{setReplyTo(null);setReplyText("")}}>Cancel</button></div>)
            : (<button className="btn btn-ghost btn-sm" onClick={()=>setReplyTo(msg.id)}>Reply</button>)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── NOTIFICATIONS PAGE ──
function NotificationsPage({notifications}) {
  return (
    <div className="fade-up" style={{maxWidth:700}}>
      {notifications.length===0 && <div className="card" style={{textAlign:"center",padding:40,color:"var(--text3)"}}><p>No alerts — everything looks great!</p></div>}
      {notifications.map((n,i) => (<div key={i} className={`notif-item ${n.type}`}><div className="notif-icon"><Icons.AlertTriangle/></div><div className="notif-text"><div className="notif-title">{n.title}</div><div className="notif-desc">{n.desc}</div></div></div>))}
    </div>
  );
}

// ── ANALYTICS PAGE ──
function AnalyticsPage({inventory, donors, recipients}) {
  const byCat = {};
  inventory.forEach(i => { byCat[i.category] = (byCat[i.category]||0) + i.qty; });
  const catEntries = Object.entries(byCat).sort((a,b) => b[1]-a[1]);
  const maxQty = catEntries[0]?.[1] || 1;
  return (
    <div className="fade-up">
      <div className="stats-grid">
        <div className="stat-card good"><div className="label">Products</div><div className="value">{inventory.length}</div></div>
        <div className="stat-card"><div className="label">Donors</div><div className="value">{donors.length}</div></div>
        <div className="stat-card"><div className="label">Families</div><div className="value">{recipients.length}</div></div>
        <div className="stat-card"><div className="label">Categories</div><div className="value">{Object.keys(byCat).length}</div></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div className="card">
          <h3 className="card-title" style={{marginBottom:14}}>Inventory by Category</h3>
          {catEntries.map(([cat,qty]) => (<div key={cat} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:600,marginBottom:3}}><span>{cat}</span><span>{qty}</span></div><div style={{height:8,background:"var(--bg2)",borderRadius:4,overflow:"hidden"}}><div style={{width:`${(qty/maxQty)*100}%`,height:"100%",background:"var(--accent)",borderRadius:4,transition:"width .5s ease"}}/></div></div>))}
        </div>
        <div className="card">
          <h3 className="card-title" style={{marginBottom:14}}>Expiration Timeline</h3>
          {[{l:"Expired",c:inventory.filter(i=>daysUntil(i.expiry)<=0).length,cl:"var(--red)"},
            {l:"Within 7 Days",c:inventory.filter(i=>{const d=daysUntil(i.expiry);return d>0&&d<=7;}).length,cl:"var(--red)"},
            {l:"Within 30 Days",c:inventory.filter(i=>{const d=daysUntil(i.expiry);return d>7&&d<=30;}).length,cl:"var(--yellow)"},
            {l:"30+ Days",c:inventory.filter(i=>daysUntil(i.expiry)>30).length,cl:"var(--green)"}
          ].map(row => (<div key={row.l} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid var(--border)"}}><div style={{width:10,height:10,borderRadius:3,background:row.cl,flexShrink:0}}/><span style={{flex:1,fontSize:13,fontWeight:500}}>{row.l}</span><span style={{fontWeight:700,fontSize:16}}>{row.c}</span></div>))}
          <div style={{marginTop:16}}><h4 style={{fontSize:13,fontWeight:600,color:"var(--text3)",marginBottom:8}}>Donor Breakdown</h4>
            {["Individual","Family","Organization","Corporate"].map(type => (<div key={type} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:13}}><span>{type}</span><span style={{fontWeight:600}}>{donors.filter(d=>d.type===type).length}</span></div>))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SETTINGS PAGE ──
function SettingsPage({emailFreq, setEmailFreq, syncStatus, triggerSync}) {
  return (
    <div className="fade-up" style={{maxWidth:600}}>
      <div className="card" style={{marginBottom:20}}>
        <h3 className="card-title" style={{marginBottom:4}}>Cloud Sync</h3>
        <p style={{fontSize:13,color:"var(--text3)",marginBottom:16}}>Data syncs automatically between web and mobile apps</p>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          <div className={`cloud-sync ${syncStatus==="synced"?"active":""}`}><SyncIcon spinning={syncStatus==="syncing"}/>{syncStatus==="synced"?"All data synced":syncStatus==="syncing"?"Syncing...":"Offline — changes saved locally"}</div>
          <button className="btn btn-secondary btn-sm" onClick={triggerSync}>Force Sync</button>
        </div>
      </div>
      <div className="card" style={{marginBottom:20}}>
        <h3 className="card-title" style={{marginBottom:4}}>Email Reports</h3>
        <p style={{fontSize:13,color:"var(--text3)",marginBottom:16}}>Receive pantry summary reports by email</p>
        <div className="email-config">
          {[{key:"biweekly",label:"Bi-Weekly",desc:"Every 2 weeks on Monday"},{key:"monthly",label:"Monthly",desc:"1st of each month"}].map(opt => (
            <div key={opt.key} className={`email-freq-option ${emailFreq===opt.key?"selected":""}`} onClick={()=>setEmailFreq(opt.key)}><div className="freq-label">{opt.label}</div><div className="freq-desc">{opt.desc}</div></div>
          ))}
        </div>
      </div>
      <div className="card" style={{marginBottom:20}}>
        <h3 className="card-title" style={{marginBottom:4}}>Shared Access</h3>
        <p style={{fontSize:13,color:"var(--text3)",marginBottom:16}}>Invite team members to manage the pantry</p>
        <div className="form-group"><label className="form-label">Email Address</label><input className="form-input" placeholder="volunteer@email.com"/></div>
        <div className="form-group"><label className="form-label">Role</label><select className="form-input"><option>Manager</option><option>Volunteer</option><option>Viewer</option></select></div>
        <button className="btn btn-primary" style={{width:"100%",justifyContent:"center"}}><Icons.Share/> Send Invitation</button>
      </div>
      <div className="card">
        <h3 className="card-title" style={{marginBottom:4}}>Notifications</h3>
        <p style={{fontSize:13,color:"var(--text3)",marginBottom:16}}>Choose which alerts you receive</p>
        {[{label:"Items expiring within 7 days",def:true},{label:"Low stock alerts (5 or fewer)",def:true},{label:"New donations received",def:true},{label:"Discussion board replies",def:false}].map((opt,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid var(--border)"}}><input type="checkbox" defaultChecked={opt.def}/><span style={{fontSize:13}}>{opt.label}</span></div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  MODALS
// ═══════════════════════════════════════════

function AddItemModal({onClose, onAdd}) {
  const [form, setForm] = useState({upc:"",name:"",category:"Canned Goods",qty:1,price:"",expiry:"",location:""});
  const submit = () => { if(!form.name)return; onAdd({...form,qty:Number(form.qty),price:Number(form.price),addedBy:"You",addedDate:new Date().toISOString().slice(0,10)}); onClose(); };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-header"><h3>Add Item</h3><button className="modal-close" onClick={onClose}>×</button></div>
      <div className="modal-body">
        <div className="form-group"><label className="form-label">UPC Code</label><input className="form-input" value={form.upc} onChange={e=>setForm(f=>({...f,upc:e.target.value}))}/></div>
        <div className="form-group"><label className="form-label">Item Name *</label><input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div className="form-group"><label className="form-label">Category</label><select className="form-input" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Quantity</label><input className="form-input" type="number" min="1" value={form.qty} onChange={e=>setForm(f=>({...f,qty:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Price ($)</label><input className="form-input" type="number" step="0.01" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Expiry Date</label><input className="form-input" type="date" value={form.expiry} onChange={e=>setForm(f=>({...f,expiry:e.target.value}))}/></div>
        </div>
        <div className="form-group"><label className="form-label">Location</label><input className="form-input" value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} placeholder="e.g. Shelf A2"/></div>
        <button className="btn btn-primary" style={{width:"100%",justifyContent:"center"}} onClick={submit}><Icons.Plus/> Add Item</button>
      </div>
    </div></div>
  );
}

function BulkAddModal({onClose, onBulkAdd}) {
  const [raw, setRaw] = useState("Green Beans, Canned Goods, 24, 1.29, 2026-12-01, Shelf A2\nChicken Soup, Canned Goods, 18, 2.49, 2026-11-15, Shelf A1\nSpaghetti, Grains & Pasta, 30, 1.49, 2027-06-01, Shelf C2");
  const [preview, setPreview] = useState([]);
  const parse = () => {
    const items = raw.trim().split("\n").filter(l=>l.trim()).map(line => {
      const parts = line.split(",").map(s=>s.trim());
      return {upc:"000000"+String(Math.floor(Math.random()*999999)).padStart(6,"0"),name:parts[0]||"Unknown",category:parts[1]||"Canned Goods",qty:Number(parts[2])||1,price:Number(parts[3])||0,expiry:parts[4]||"2027-01-01",location:parts[5]||"",addedBy:"You (Bulk)",addedDate:new Date().toISOString().slice(0,10)};
    });
    setPreview(items);
  };
  const submit = () => { if(preview.length){onBulkAdd(preview);onClose();} };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:640}}>
      <div className="modal-header"><h3>Bulk Add Items</h3><button className="modal-close" onClick={onClose}>×</button></div>
      <div className="modal-body">
        <p style={{fontSize:13,color:"var(--text2)",marginBottom:12}}>Enter one item per line: <strong>Name, Category, Qty, Price, Expiry, Location</strong></p>
        <textarea className="bulk-textarea" value={raw} onChange={e=>setRaw(e.target.value)}/>
        <div style={{display:"flex",gap:10,marginTop:12}}>
          <button className="btn btn-secondary" onClick={parse}>Preview ({raw.trim().split("\n").filter(l=>l.trim()).length} lines)</button>
          {preview.length>0 && <button className="btn btn-primary" onClick={submit}><Icons.Plus/> Add {preview.length} Items</button>}
        </div>
        {preview.length>0 && (<div style={{marginTop:16,maxHeight:200,overflow:"auto"}}><table style={{fontSize:12}}><thead><tr><th>Name</th><th>Category</th><th>Qty</th><th>Price</th><th>Expiry</th></tr></thead><tbody>{preview.map((p,i)=>(<tr key={i}><td>{p.name}</td><td>{p.category}</td><td>{p.qty}</td><td>{fmtCurrency(p.price)}</td><td>{p.expiry}</td></tr>))}</tbody></table></div>)}
      </div>
    </div></div>
  );
}

function BulkEditModal({onClose, selected, inventory, setInventory, setSelected, triggerSync}) {
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const apply = () => {
    setInventory(prev => prev.map(i => {
      if(!selected.has(i.id)) return i;
      const updated = {...i};
      if(category) updated.category = category;
      if(location) updated.location = location;
      return updated;
    }));
    setSelected(new Set()); triggerSync(); onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-header"><h3>Bulk Edit ({selected.size} items)</h3><button className="modal-close" onClick={onClose}>×</button></div>
      <div className="modal-body">
        <p style={{fontSize:13,color:"var(--text2)",marginBottom:16}}>Leave a field empty to keep existing values.</p>
        <div className="form-group"><label className="form-label">Change Category</label><select className="form-input" value={category} onChange={e=>setCategory(e.target.value)}><option value="">— Keep Existing —</option>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
        <div className="form-group"><label className="form-label">Change Location</label><input className="form-input" value={location} onChange={e=>setLocation(e.target.value)} placeholder="e.g. Shelf B2"/></div>
        <button className="btn btn-primary" style={{width:"100%",justifyContent:"center"}} onClick={apply}><Icons.Edit/> Apply Changes</button>
      </div>
    </div></div>
  );
}

function AddDonorModal({onClose, onAdd}) {
  const [form, setForm] = useState({name:"",type:"Individual",email:"",totalDonations:0,lastDonation:new Date().toISOString().slice(0,10),totalValue:0});
  const submit = () => { if(!form.name)return; onAdd(form); onClose(); };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-header"><h3>Add Donor</h3><button className="modal-close" onClick={onClose}>×</button></div>
      <div className="modal-body">
        <div className="form-group"><label className="form-label">Donor Name *</label><input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
        <div className="form-group"><label className="form-label">Type</label><select className="form-input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}><option>Individual</option><option>Family</option><option>Organization</option><option>Corporate</option></select></div>
        <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
        <button className="btn btn-primary" style={{width:"100%",justifyContent:"center"}} onClick={submit}><Icons.Plus/> Add Donor</button>
      </div>
    </div></div>
  );
}

function AddRecipientModal({onClose, onAdd}) {
  const [form, setForm] = useState({name:"",size:1,dietaryNotes:"",visits:0,lastVisit:new Date().toISOString().slice(0,10)});
  const submit = () => { if(!form.name)return; onAdd({...form,size:Number(form.size)}); onClose(); };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-header"><h3>Add Recipient</h3><button className="modal-close" onClick={onClose}>×</button></div>
      <div className="modal-body">
        <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
        <div className="form-group"><label className="form-label">Family Size</label><input className="form-input" type="number" min="1" value={form.size} onChange={e=>setForm(f=>({...f,size:e.target.value}))}/></div>
        <div className="form-group"><label className="form-label">Dietary Notes</label><input className="form-input" value={form.dietaryNotes} onChange={e=>setForm(f=>({...f,dietaryNotes:e.target.value}))} placeholder="e.g. Nut allergy, Vegetarian"/></div>
        <button className="btn btn-primary" style={{width:"100%",justifyContent:"center"}} onClick={submit}><Icons.Plus/> Add Recipient</button>
      </div>
    </div></div>
  );
}

function ShareModal({onClose}) {
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-header"><h3>Share Access</h3><button className="modal-close" onClick={onClose}>×</button></div>
      <div className="modal-body">
        <p style={{fontSize:13,color:"var(--text2)",marginBottom:16}}>Invite team members. They'll get a link to join your pantry.</p>
        <div className="form-group"><label className="form-label">Email Address</label><input className="form-input" placeholder="volunteer@email.com"/></div>
        <div className="form-group"><label className="form-label">Role</label><select className="form-input"><option>Manager</option><option>Volunteer</option><option>Viewer</option></select></div>
        <button className="btn btn-primary" style={{width:"100%",justifyContent:"center"}}><Icons.Share/> Send Invitation</button>
      </div>
    </div></div>
  );
}

function EmailConfigModal({onClose, freq, setFreq}) {
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-header"><h3>Email Reports</h3><button className="modal-close" onClick={onClose}>×</button></div>
      <div className="modal-body">
        <p style={{fontSize:13,color:"var(--text2)",marginBottom:16}}>Choose how often you'd like to receive pantry summary emails.</p>
        <div className="email-config">
          {[{key:"biweekly",label:"Bi-Weekly",desc:"Every 2 weeks"},{key:"monthly",label:"Monthly",desc:"1st of each month"}].map(opt=>(
            <div key={opt.key} className={`email-freq-option ${freq===opt.key?"selected":""}`} onClick={()=>setFreq(opt.key)}><div className="freq-label">{opt.label}</div><div className="freq-desc">{opt.desc}</div></div>
          ))}
        </div>
        <button className="btn btn-primary" style={{width:"100%",justifyContent:"center",marginTop:16}} onClick={onClose}>Save Preferences</button>
      </div>
    </div></div>
  );
}
