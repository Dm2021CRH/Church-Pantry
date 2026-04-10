import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "../lib/supabase";
/* ═══════════════════════════════════════════
   CHURCH PANTRY — Supabase Connected + Editable Categories + Export
   ═══════════════════════════════════════════ */

const DEFAULT_CATEGORIES = ["Canned Goods","Grains & Pasta","Dairy","Produce","Meat & Protein","Snacks","Beverages","Baby & Infant","Hygiene","Condiments","Baking","Frozen"];

const today = new Date();
const daysUntil = (d) => Math.ceil((new Date(d) - today) / 86400000);
const fmt = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtCurrency = (v) => "$" + Number(v).toFixed(2);

const BAG_RULES = {
  1:{canned:4,grains:2,protein:2,dairy:1,beverage:1,snack:1,hygiene:1},
  2:{canned:6,grains:3,protein:3,dairy:2,beverage:2,snack:2,hygiene:1},
  3:{canned:8,grains:4,protein:4,dairy:2,beverage:2,snack:3,hygiene:2},
  4:{canned:10,grains:5,protein:4,dairy:3,beverage:3,snack:3,hygiene:2},
  5:{canned:12,grains:6,protein:5,dairy:3,beverage:3,snack:4,hygiene:2},
  6:{canned:14,grains:7,protein:6,dairy:4,beverage:4,snack:4,hygiene:3},
  7:{canned:16,grains:8,protein:7,dairy:4,beverage:4,snack:5,hygiene:3},
};
const catToRule = {"Canned Goods":"canned","Grains & Pasta":"grains","Meat & Protein":"protein","Dairy":"dairy","Beverages":"beverage","Snacks":"snack","Hygiene":"hygiene","Baby & Infant":"baby","Condiments":"canned","Baking":"grains","Frozen":"protein","Produce":"produce","Sauce":"canned","Breakfast items":"grains","Condiment":"canned","Salad toppings":"canned","Meal in Can":"protein","Pasta":"grains","Seafood":"protein","Meat":"protein","Side dish":"canned","Pasta Dish":"grains","Baking goods":"grains","Cookies-sweets":"snack","Cooking oils":"canned","Other":"canned","Baking mix":"grains","Soup":"canned"};

function buildBag(inventory, familySize, dietaryNotes = "") {
  const rules = BAG_RULES[Math.min(familySize, 7)] || BAG_RULES[7];
  const scaled = {};
  Object.keys(rules).forEach(k => { scaled[k] = Math.ceil(rules[k] * (familySize > 7 ? familySize / 7 : 1)); });
  const sorted = [...inventory].filter(i => i.qty > 0 && daysUntil(i.expiry) > 0).sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
  const bag = [];
  const needs = { ...scaled };
  const isVeg = dietaryNotes.toLowerCase().includes("vegetarian");
  const nutAllergy = dietaryNotes.toLowerCase().includes("nut");
  sorted.forEach(item => {
    const rule = catToRule[item.category];
    if (!rule || !needs[rule] || needs[rule] <= 0) return;
    if (isVeg && item.category === "Meat & Protein") return;
    if (nutAllergy && item.name.toLowerCase().includes("peanut")) return;
    const take = Math.min(needs[rule], item.qty);
    bag.push({ ...item, bagQty: take, fifo: daysUntil(item.expiry) <= 30 });
    needs[rule] -= take;
  });
  if (familySize >= 3) {
    const formula = sorted.find(i => i.category === "Baby & Infant" && i.qty > 0);
    if (formula && !bag.find(b => b.id === formula.id)) bag.push({ ...formula, bagQty: 1, fifo: false, optional: true });
  }
  return { bag, unmet: Object.entries(needs).filter(([, v]) => v > 0).map(([k, v]) => ({ category: k, needed: v })) };
}

// ── Export Helpers ──
function exportCSV(inv) {
  const hdr = "UPC,Name,Category,Qty,Price,Expiry,Location,Added By,Added Date";
  const rows = inv.map(i => [i.upc,`"${(i.name||"").replace(/"/g,'""')}"`,`"${i.category}"`,i.qty,i.price,i.expiry,`"${i.location||""}"`,`"${i.added_by||""}"`,i.added_date].join(","));
  const blob = new Blob([hdr + "\n" + rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `inventory_${new Date().toISOString().slice(0,10)}.csv`; a.click();
}
function exportPDF(inv) {
  const totalQty = inv.reduce((s,i) => s + i.qty, 0);
  const totalVal = inv.reduce((s,i) => s + i.qty * i.price, 0);
  const cats = [...new Set(inv.map(i => i.category))].sort();
  const html = `<html><head><title>Inventory Report</title><style>
    body{font-family:system-ui;padding:40px;color:#1a1a1a}
    h1{font-size:22px;margin-bottom:4px} .sub{color:#666;font-size:13px;margin-bottom:24px}
    .stats{display:flex;gap:20px;margin-bottom:24px} .stat{background:#f5f5f5;padding:14px 20px;border-radius:8px;min-width:120px}
    .stat .n{font-size:22px;font-weight:700} .stat .l{font-size:11px;color:#888;text-transform:uppercase}
    table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}
    th{background:#f0f0f0;text-align:left;padding:8px 10px;font-weight:600;border-bottom:2px solid #ddd}
    td{padding:7px 10px;border-bottom:1px solid #eee} tr:nth-child(even){background:#fafafa}
    .cat{margin-top:24px;font-size:15px;font-weight:700;border-bottom:2px solid #333;padding-bottom:4px}
    .pbtn{position:fixed;top:20px;right:20px;padding:10px 20px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600}
    @media print{.pbtn{display:none} body{padding:20px}}
  </style></head><body>
  <h1>Church Pantry — Inventory Report</h1>
  <div class="sub">Generated ${new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})} · <span style="color:#999">Confidential — For internal use only</span></div>
  <div class="stats"><div class="stat"><div class="n">${inv.length}</div><div class="l">Unique Items</div></div><div class="stat"><div class="n">${totalQty}</div><div class="l">Total Units</div></div><div class="stat"><div class="n">$${totalVal.toFixed(2)}</div><div class="l">Total Value</div></div></div>
  ${cats.map(c => { const items = inv.filter(i => i.category === c); return `<div class="cat">${c} (${items.length})</div><table><tr><th>Item</th><th>UPC</th><th>Qty</th><th>Price</th><th>Expiry</th><th>Location</th></tr>${items.map(i => `<tr><td>${i.name}</td><td>${i.upc||""}</td><td>${i.qty}</td><td>$${Number(i.price).toFixed(2)}</td><td>${i.expiry||""}</td><td>${i.location||""}</td></tr>`).join("")}</table>`; }).join("")}
  <button class="pbtn no-print" onclick="window.print()">Print / Save as PDF</button></body></html>`;
  const w = window.open("","_blank"); w.document.write(html); w.document.close();
}

// ── Icons ──
const I = {
  Home: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Pkg: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Scan: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>,
  Bag: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  Heart: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Chat: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Bell: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Chart: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Gear: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Cloud: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>,
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Trash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  Edit: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Down: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>,
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Menu: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
};

// ── CSS ──
const CSS = `
:root{--bg:#F8F7F4;--sf:#FFFFFF;--tx:#1A1A1A;--tx2:#6B7280;--tx3:#9CA3AF;--acc:#2563EB;--acc-h:#1D4ED8;--acc-s:#EFF6FF;--gn:#16A34A;--gn-s:#F0FDF4;--rd:#DC2626;--rd-s:#FEF2F2;--yl:#CA8A04;--yl-s:#FEFCE8;--bd:#E5E7EB;--hd:"Inter",system-ui,sans-serif;--bd-r:10px}
*{margin:0;padding:0;box-sizing:border-box}
html,body,#root{height:100%;font-family:var(--hd);background:var(--bg);color:var(--tx);font-size:14px;-webkit-font-smoothing:antialiased}
.app{display:flex;height:100vh;overflow:hidden}
.sb{width:240px;background:var(--sf);border-right:1px solid var(--bd);display:flex;flex-direction:column;flex-shrink:0;transition:transform .2s}
.sb-hd{padding:20px;border-bottom:1px solid var(--bd)}
.sb-hd h1{font-size:18px;font-weight:800;color:var(--acc);letter-spacing:-.3px}
.sb-hd p{font-size:11px;color:var(--tx3);margin-top:2px}
.sb-nav{flex:1;overflow-y:auto;padding:12px}
.sb-sec{font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;padding:12px 10px 6px}
.sb-it{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;color:var(--tx2);transition:all .15s}
.sb-it:hover{background:var(--acc-s);color:var(--acc)}
.sb-it.ac{background:var(--acc-s);color:var(--acc);font-weight:600}
.sb-ft{padding:14px 20px;border-top:1px solid var(--bd);font-size:11px;color:var(--tx3);display:flex;align-items:center;gap:6px}
.mn{flex:1;overflow-y:auto;padding:24px;max-width:1100px;margin:0 auto}
.tp{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
.tp h2{font-size:22px;font-weight:800;letter-spacing:-.3px}
.tp .sync{font-size:11px;color:var(--gn);display:flex;align-items:center;gap:4px;background:var(--gn-s);padding:4px 10px;border-radius:20px;font-weight:600}
.sg{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:28px}
.cd{background:var(--sf);border-radius:var(--bd-r);padding:18px;border:1px solid var(--bd)}
.cd .lb{font-size:11px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:.3px}
.cd .vl{font-size:28px;font-weight:800;margin-top:4px;letter-spacing:-.5px}
.cd .sm{font-size:11px;color:var(--tx2);margin-top:2px}
.al-it{display:flex;align-items:start;gap:10px;padding:12px;border-radius:8px;background:var(--yl-s);margin-bottom:8px}
.al-it .al-dot{width:8px;height:8px;border-radius:50%;background:var(--yl);margin-top:4px;flex-shrink:0}
.al-it .al-tx{font-size:13px;font-weight:500}
.al-it .al-sm{font-size:11px;color:var(--tx3);margin-top:2px}
.tb{width:100%;border-collapse:collapse}
.tb th{text-align:left;padding:10px 12px;font-size:11px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.3px;border-bottom:2px solid var(--bd);background:var(--sf)}
.tb td{padding:10px 12px;border-bottom:1px solid var(--bd);font-size:13px}
.tb tr:hover{background:var(--acc-s)}
.bt{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;border:none;cursor:pointer;font-weight:600;font-size:13px;transition:all .15s}
.bt-p{background:var(--acc);color:#fff}.bt-p:hover{background:var(--acc-h)}
.bt-s{background:var(--sf);color:var(--tx);border:1px solid var(--bd)}.bt-s:hover{background:var(--bg)}
.bt-d{background:var(--rd);color:#fff}.bt-d:hover{background:#B91C1C}
.bt-sm{padding:5px 10px;font-size:12px;border-radius:6px}
.fi{width:100%;padding:9px 12px;border:1px solid var(--bd);border-radius:8px;font-size:13px;outline:none;transition:border .15s;background:var(--sf);color:var(--tx)}
.fi:focus{border-color:var(--acc);box-shadow:0 0 0 3px var(--acc-s)}
.fl{display:block;font-size:11px;font-weight:600;color:var(--tx2);margin-bottom:4px;text-transform:uppercase;letter-spacing:.3px}
.fg{margin-bottom:14px}
.tg{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.tg button{padding:6px 14px;border-radius:20px;border:1px solid var(--bd);background:var(--sf);font-size:12px;cursor:pointer;font-weight:500;transition:all .15s}
.tg button.ac{background:var(--acc);color:#fff;border-color:var(--acc)}
.modal-ov{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px}
.modal{background:var(--sf);border-radius:14px;padding:28px;max-width:480px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.15)}
.modal h3{font-size:18px;font-weight:700;margin-bottom:18px}
.bh{background:linear-gradient(135deg,var(--acc),var(--acc-h));color:#fff;border-radius:var(--bd-r);padding:24px;margin-bottom:20px}
.bh h2{font-size:20px;font-weight:800;margin-bottom:4px}
.bh p{font-size:13px;opacity:.85}
.bh .bc{display:flex;gap:12px;margin-top:16px;flex-wrap:wrap;align-items:end}
.ch{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.ch .ci{flex:1;min-width:200px;background:var(--sf);border-radius:var(--bd-r);padding:16px;border:1px solid var(--bd)}
.ch .ci h4{font-size:11px;color:var(--tx3);text-transform:uppercase;font-weight:700;margin-bottom:8px}
.badge{display:inline-flex;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600}
.badge-gn{background:var(--gn-s);color:var(--gn)}
.badge-yl{background:var(--yl-s);color:var(--yl)}
.badge-rd{background:var(--rd-s);color:var(--rd)}
.bi{display:flex;align-items:center;gap:12px;padding:12px;border-radius:8px;border:1px solid var(--bd);margin-bottom:8px;background:var(--sf);transition:all .15s}
.bi:hover{border-color:var(--acc);box-shadow:0 2px 8px rgba(37,99,235,.08)}
.si{animation:slideIn .3s ease both}
@keyframes slideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.fu{animation:fadeUp .4s ease both}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.empty{text-align:center;padding:60px 20px;color:var(--tx3)}
.empty svg{margin-bottom:12px;opacity:.4}
.qg{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
.qa{display:flex;align-items:center;gap:10px;padding:14px 16px;border-radius:10px;border:1px solid var(--bd);background:var(--sf);cursor:pointer;font-size:13px;font-weight:600;transition:all .15s}
.qa:hover{border-color:var(--acc);color:var(--acc);background:var(--acc-s)}
.dn-cd{background:var(--sf);border:1px solid var(--bd);border-radius:var(--bd-r);padding:16px;margin-bottom:10px}
.dn-cd h4{font-size:14px;font-weight:700}
.dn-cd .dn-sm{font-size:12px;color:var(--tx2)}
.dn-cd .dn-amt{font-size:18px;font-weight:800;color:var(--gn);margin-top:4px}
.msg{background:var(--sf);border:1px solid var(--bd);border-radius:var(--bd-r);padding:16px;margin-bottom:12px}
.msg .msg-hd{display:flex;justify-content:space-between;margin-bottom:6px}
.msg .msg-au{font-weight:700;font-size:13px}
.msg .msg-dt{font-size:11px;color:var(--tx3)}
.msg .msg-bd{font-size:13px;line-height:1.5}
.msg .msg-rp{margin-top:10px;padding-top:10px;border-top:1px solid var(--bd)}
.exp-dd{position:relative;display:inline-block}
.exp-mn{position:absolute;top:100%;right:0;margin-top:4px;background:var(--sf);border:1px solid var(--bd);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:100;min-width:160px;padding:4px}
.exp-mn button{display:block;width:100%;text-align:left;padding:8px 14px;border:none;background:none;cursor:pointer;font-size:13px;border-radius:4px;font-weight:500}
.exp-mn button:hover{background:var(--acc-s);color:var(--acc)}
.cat-ed{display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--bd);border-radius:8px;margin-bottom:6px;background:var(--sf)}
.cat-ed .cat-nm{flex:1;font-size:13px;font-weight:500}
.cat-ed .cat-ct{font-size:11px;color:var(--tx3);margin-right:8px}
.cat-ed button{background:none;border:none;cursor:pointer;padding:4px;border-radius:4px;display:flex;align-items:center;color:var(--tx3);transition:all .15s}
.cat-ed button:hover{background:var(--rd-s);color:var(--rd)}
.cat-ed .cat-eb:hover{background:var(--acc-s);color:var(--acc)}
.mob-hd{display:none;align-items:center;justify-content:space-between;padding:14px 20px;background:var(--sf);border-bottom:1px solid var(--bd);position:sticky;top:0;z-index:50}
.mob-hd h1{font-size:16px;font-weight:800;color:var(--acc)}
.mob-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:var(--sf);border-top:1px solid var(--bd);padding:6px 0 env(safe-area-inset-bottom,6px);z-index:50;justify-content:space-around}
.mob-nav button{display:flex;flex-direction:column;align-items:center;gap:2px;background:none;border:none;padding:6px 12px;font-size:10px;color:var(--tx3);cursor:pointer}
.mob-nav button.ac{color:var(--acc)}
@media(max-width:768px){
  .sb{position:fixed;left:0;top:0;bottom:0;z-index:100;transform:translateX(-100%)}.sb.open{transform:translateX(0)}
  .sb-ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:99}.sb-ov.open{display:block}
  .mob-hd{display:flex}.mob-nav{display:flex}
  .mn{padding:16px;padding-bottom:80px}
  .sg{grid-template-columns:repeat(2,1fr);gap:10px}
  .cd .vl{font-size:22px}
}
`;

// ── Page Components ──

function Dashboard({ inv, donors, alerts, setPage }) {
  const totalQty = inv.reduce((s, i) => s + i.qty, 0);
  const uniqueItems = inv.length;
  const totalVal = inv.reduce((s, i) => s + i.qty * i.price, 0);
  const expSoon = inv.filter(i => { const d = daysUntil(i.expiry); return d > 0 && d <= 30; }).length;
  const lowStock = inv.filter(i => i.qty <= 5 && i.qty > 0).length;

  return (
    <div className="fu">
      <div className="tp">
        <h2>Dashboard</h2>
        <div className="sync"><I.Cloud /> Synced</div>
      </div>
      <div className="sg">
        <div className="cd"><div className="lb">Total Items</div><div className="vl">{totalQty}</div><div className="sm">{uniqueItems} unique products</div></div>
        <div className="cd"><div className="lb">Inventory Value</div><div className="vl">{fmtCurrency(totalVal)}</div><div className="sm">Based on local pricing</div></div>
        <div className="cd" style={{borderLeft: expSoon > 0 ? "4px solid var(--yl)" : undefined}}><div className="lb">Expiring Soon</div><div className="vl">{expSoon}</div><div className="sm">Within 30 days</div></div>
        <div className="cd" style={{borderLeft: lowStock > 0 ? "4px solid var(--rd)" : undefined}}><div className="lb">Low Stock</div><div className="vl">{lowStock}</div><div className="sm">5 or fewer units</div></div>
      </div>

      {alerts.length > 0 && (<div className="cd" style={{ marginBottom: 20 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><h3 style={{ fontSize: 15, fontWeight: 700 }}>Recent Alerts</h3><button className="bt bt-sm bt-s" onClick={() => setPage("alerts")}>View All</button></div>
        {alerts.slice(0, 3).map((a, i) => (<div key={i} className="al-it"><div className="al-dot" /><div><div className="al-tx">{a.title}</div><div className="al-sm">{a.detail}</div></div></div>))}
      </div>)}

      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Quick Actions</h3>
      <div className="qg">
        <div className="qa" onClick={() => setPage("scan")}><I.Scan /> Scan & Add Items</div>
        <div className="qa" onClick={() => setPage("bag")}><I.Bag /> Build a Bag & Go</div>
        <div className="qa" onClick={() => setPage("discussion")}><I.Chat /> Discussion Board</div>
        <div className="qa" onClick={() => setPage("donors")}><I.Heart /> Manage Donors</div>
      </div>

      {donors.length > 0 && (<div style={{ marginTop: 24 }}><h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Top Donors</h3>
        {donors.slice(0, 3).map(d => (<div key={d.id} className="dn-cd"><h4>{d.name}</h4><div className="dn-sm">{d.donations} donations</div><div className="dn-amt">{fmtCurrency(d.total)}</div></div>))}
      </div>)}
    </div>
  );
}

function Inventory({ inv, categories, srch, setSrch, sel, selAll, togSel, delItem, setModal }) {
  const [catF, setCatF] = useState("All");
  const [showExp, setShowExp] = useState(false);
  const expRef = useRef(null);

  useEffect(() => {
    function handleClick(e) { if (expRef.current && !expRef.current.contains(e.target)) setShowExp(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = catF === "All" ? inv : inv.filter(i => i.category === catF);
  const allSel = filtered.length > 0 && filtered.every(i => sel.includes(i.id));

  return (
    <div className="fu">
      <div className="tp">
        <h2>Inventory</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="exp-dd" ref={expRef}>
            <button className="bt bt-s bt-sm" onClick={() => setShowExp(!showExp)}>Export <I.Down /></button>
            {showExp && (<div className="exp-mn"><button onClick={() => { exportCSV(filtered); setShowExp(false); }}>Download CSV</button><button onClick={() => { exportPDF(filtered); setShowExp(false); }}>Print / PDF</button></div>)}
          </div>
          {sel.length > 0 && <button className="bt bt-d bt-sm" onClick={() => sel.forEach(id => delItem(id))}>Delete ({sel.length})</button>}
          <button className="bt bt-p bt-sm" onClick={() => setModal("add")}><I.Plus /> Add Item</button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <I.Search />
          <input className="fi" style={{ paddingLeft: 36 }} placeholder="Search inventory..." value={srch} onChange={e => setSrch(e.target.value)} />
        </div>
      </div>
      <div className="tg">
        <button className={catF === "All" ? "ac" : ""} onClick={() => setCatF("All")}>All ({inv.length})</button>
        {categories.map(c => { const count = inv.filter(i => i.category === c).length; return count > 0 ? <button key={c} className={catF === c ? "ac" : ""} onClick={() => setCatF(c)}>{c} ({count})</button> : null; })}
      </div>
      {filtered.length === 0 ? (<div className="empty"><I.Pkg /><p>No items found</p></div>) : (
        <div style={{ overflowX: "auto" }}>
          <table className="tb">
            <thead><tr><th><input type="checkbox" checked={allSel} onChange={() => selAll(filtered.map(i => i.id))} /></th><th>Item</th><th>Category</th><th>Qty</th><th>Price</th><th>Expiry</th><th>Location</th></tr></thead>
            <tbody>{filtered.map(i => {
              const d = daysUntil(i.expiry);
              return (<tr key={i.id} className="si" style={{ animationDelay: "0ms" }}>
                <td><input type="checkbox" checked={sel.includes(i.id)} onChange={() => togSel(i.id)} /></td>
                <td><div style={{ fontWeight: 600 }}>{i.name}</div><div style={{ fontSize: 11, color: "var(--tx3)" }}>{i.upc}</div></td>
                <td><span className="badge badge-gn">{i.category}</span></td>
                <td style={{ fontWeight: 700, color: i.qty <= 5 ? "var(--rd)" : "var(--tx)" }}>{i.qty}</td>
                <td>{fmtCurrency(i.price)}</td>
                <td><span className={`badge ${d <= 7 ? "badge-rd" : d <= 30 ? "badge-yl" : "badge-gn"}`}>{fmt(i.expiry)}</span></td>
                <td>{i.location || "—"}</td>
              </tr>);
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ScanAdd({ onAdd, categories }) {
  const [upc, setUpc] = useState("");
  const [name, setName] = useState("");
  const [cat, setCat] = useState(categories[0] || "");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState("");
  const [expiry, setExpiry] = useState("");
  const [loc, setLoc] = useState("");
  const [msg, setMsg] = useState("");

  const handleAdd = async () => {
    if (!name) { setMsg("Name is required"); return; }
    await onAdd({ upc, name, category: cat, qty: Number(qty), price: Number(price) || 0, expiry: expiry || "2027-01-01", location: loc, added_by: "Manager", added_date: new Date().toISOString().slice(0, 10) });
    setMsg("Item added!");
    setUpc(""); setName(""); setQty(1); setPrice(""); setExpiry(""); setLoc("");
    setTimeout(() => setMsg(""), 2000);
  };

  return (
    <div className="fu">
      <div className="bh"><h2>Scan & Add Items</h2><p>Add new items to your inventory manually or by UPC</p></div>
      <div className="cd" style={{ maxWidth: 500 }}>
        <div className="fg"><label className="fl">UPC Code</label><input className="fi" value={upc} onChange={e => setUpc(e.target.value)} placeholder="Scan or enter UPC" /></div>
        <div className="fg"><label className="fl">Item Name</label><input className="fi" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Green Beans (canned)" /></div>
        <div className="fg"><label className="fl">Category</label><select className="fi" value={cat} onChange={e => setCat(e.target.value)}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div style={{ display: "flex", gap: 12 }}>
          <div className="fg" style={{ flex: 1 }}><label className="fl">Quantity</label><input className="fi" type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} /></div>
          <div className="fg" style={{ flex: 1 }}><label className="fl">Price ($)</label><input className="fi" type="number" step=".01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" /></div>
        </div>
        <div className="fg"><label className="fl">Expiration Date</label><input className="fi" type="date" value={expiry} onChange={e => setExpiry(e.target.value)} /></div>
        <div className="fg"><label className="fl">Location</label><input className="fi" value={loc} onChange={e => setLoc(e.target.value)} placeholder="e.g. Shelf A2" /></div>
        <button className="bt bt-p" style={{ width: "100%" }} onClick={handleAdd}><I.Plus /> Add to Inventory</button>
        {msg && <div style={{ marginTop: 10, padding: 10, background: "var(--gn-s)", borderRadius: 8, color: "var(--gn)", fontWeight: 600, textAlign: "center", fontSize: 13 }}>{msg}</div>}
      </div>
    </div>
  );
}

function BagAndGo({ inv, recip }) {
  const [fSize, setFSize] = useState(3);
  const [diet, setDiet] = useState("");
  const [selR, setSelR] = useState("");
  const [bag, setBag] = useState(null);
  const [packed, setPacked] = useState(false);

  const gen = () => {
    if (selR) { const r = recip.find(rc => rc.id === selR); if (r) { setFSize(r.size); setDiet(r.dietary || ""); } }
    setBag(buildBag(inv, fSize, diet));
    setPacked(false);
  };

  const tBI = bag ? bag.bag.reduce((s, i) => s + i.bagQty, 0) : 0;
  const tBV = bag ? bag.bag.reduce((s, i) => s + i.bagQty * i.price, 0) : 0;

  return (
    <div className="fu">
      <div className="bh">
        <h2>Bag & Go</h2>
        <p>Smart packing based on family size, dietary needs & FIFO rotation</p>
        <div className="bc">
          <div className="fg" style={{ minWidth: 170 }}><label className="fl" style={{ color: "#fff" }}>Recipient (optional)</label><select className="fi" value={selR} onChange={e => setSelR(e.target.value)}><option value="">— Custom —</option>{recip.map(r => <option key={r.id} value={r.id}>{r.name} ({r.size})</option>)}</select></div>
          <div className="fg" style={{ minWidth: 90 }}><label className="fl" style={{ color: "#fff" }}>Family Size</label><input className="fi" type="number" min="1" max="15" value={fSize} onChange={e => setFSize(Number(e.target.value))} /></div>
          <div className="fg" style={{ minWidth: 180 }}><label className="fl" style={{ color: "#fff" }}>Dietary Notes</label><input className="fi" value={diet} onChange={e => setDiet(e.target.value)} placeholder="Vegetarian, Nut allergy..." /></div>
          <button className="bt" style={{ background: "#fff", color: "var(--acc)", fontWeight: 700, height: 40 }} onClick={gen}>Generate Bag</button>
        </div>
      </div>
      {bag && (
        <div className="fu">
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
            <div className="cd" style={{ flex: 1, borderLeft: "4px solid var(--acc)", minWidth: 140, textAlign: "center" }}><div className="lb">Items</div><div className="vl">{tBI}</div></div>
            <div className="cd" style={{ flex: 1, borderLeft: "4px solid var(--gn)", minWidth: 140, textAlign: "center" }}><div className="lb">Value</div><div className="vl">{fmtCurrency(tBV)}</div></div>
            <div className="cd" style={{ flex: 1, borderLeft: "4px solid var(--yl)", minWidth: 140, textAlign: "center" }}><div className="lb">FIFO Priority</div><div className="vl">{bag.bag.filter(i => i.fifo).length}</div></div>
          </div>
          {bag.unmet.length > 0 && <div style={{ padding: 12, background: "var(--yl-s)", borderRadius: 8, border: "1px solid #F5E6A3", marginBottom: 16, fontSize: 13 }}><strong>Shortages: </strong>{bag.unmet.map(u => `${u.category} (need ${u.needed} more)`).join(", ")}</div>}
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Suggested Contents</h3>
          {bag.bag.map((item, i) => (
            <div key={i} className="bi si" style={{ animationDelay: `${i * 40}ms`, ...(packed ? { borderColor: "var(--gn)", background: "var(--gn-s)" } : {}) }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                <div style={{ fontSize: 11, color: "var(--tx3)" }}>{item.category} · Qty: {item.bagQty} · {fmtCurrency(item.price * item.bagQty)}</div>
              </div>
              {item.fifo && <span className="badge badge-yl">FIFO</span>}
              {item.optional && <span className="badge badge-gn">Optional</span>}
            </div>
          ))}
          <button className="bt bt-p" style={{ marginTop: 16 }} onClick={() => setPacked(!packed)}>{packed ? "✓ Packed" : "Mark as Packed"}</button>
        </div>
      )}
    </div>
  );
}

function Donors({ donors, setModal }) {
  return (
    <div className="fu">
      <div className="tp"><h2>Donors</h2><button className="bt bt-p bt-sm" onClick={() => setModal("donor")}><I.Plus /> Add Donor</button></div>
      {donors.length === 0 ? <div className="empty"><I.Heart /><p>No donors yet</p></div> :
        donors.map(d => (<div key={d.id} className="dn-cd"><h4>{d.name}</h4><div className="dn-sm">{d.donations} donations</div><div className="dn-amt">{fmtCurrency(d.total)}</div></div>))
      }
    </div>
  );
}

function Recipients({ recip, setModal }) {
  return (
    <div className="fu">
      <div className="tp"><h2>Recipients</h2><button className="bt bt-p bt-sm" onClick={() => setModal("recip")}><I.Plus /> Add Recipient</button></div>
      {recip.length === 0 ? <div className="empty"><I.Users /><p>No recipients yet</p></div> :
        recip.map(r => (<div key={r.id} className="dn-cd"><h4>{r.name}</h4><div className="dn-sm">Family of {r.size}{r.dietary ? ` · ${r.dietary}` : ""}</div></div>))
      }
    </div>
  );
}

function Discussion({ messages, setModal }) {
  return (
    <div className="fu">
      <div className="tp"><h2>Discussion Board</h2><button className="bt bt-p bt-sm" onClick={() => setModal("msg")}><I.Plus /> New Post</button></div>
      {messages.length === 0 ? <div className="empty"><I.Chat /><p>No discussions yet</p></div> :
        messages.map(m => (
          <div key={m.id} className="msg">
            <div className="msg-hd"><span className="msg-au">{m.author}</span><span className="msg-dt">{fmt(m.date)}</span></div>
            <div className="msg-bd">{m.body}</div>
            {m.replies && m.replies.length > 0 && m.replies.map((r, ri) => (
              <div key={ri} className="msg-rp"><span className="msg-au" style={{ fontSize: 12 }}>{r.author}</span> <span className="msg-dt">{fmt(r.date)}</span><div className="msg-bd" style={{ marginTop: 4 }}>{r.body}</div></div>
            ))}
          </div>
        ))
      }
    </div>
  );
}

function Alerts({ inv }) {
  const alerts = [];
  inv.forEach(i => {
    const d = daysUntil(i.expiry);
    if (d > 0 && d <= 30) alerts.push({ title: `Expiring soon: ${i.name}`, detail: `${i.qty} units expire ${fmt(i.expiry)}.`, type: "exp" });
    if (i.qty <= 5 && i.qty > 0) alerts.push({ title: `Low stock: ${i.name}`, detail: `Only ${i.qty} units remaining.`, type: "low" });
  });
  if (alerts.length === 0) alerts.push({ title: "All clear!", detail: "No urgent alerts right now.", type: "ok" });
  return (
    <div className="fu">
      <div className="tp"><h2>Alerts</h2></div>
      {alerts.map((a, i) => (<div key={i} className="al-it" style={a.type === "ok" ? { background: "var(--gn-s)" } : {}}><div className="al-dot" style={a.type === "ok" ? { background: "var(--gn)" } : a.type === "low" ? { background: "var(--rd)" } : {}} /><div><div className="al-tx">{a.title}</div><div className="al-sm">{a.detail}</div></div></div>))}
    </div>
  );
}

function Analytics({ inv }) {
  const cats = [...new Set(inv.map(i => i.category))].sort();
  const totalVal = inv.reduce((s, i) => s + i.qty * i.price, 0);
  return (
    <div className="fu">
      <div className="tp"><h2>Analytics</h2></div>
      <div className="sg">
        <div className="cd"><div className="lb">Total Value</div><div className="vl">{fmtCurrency(totalVal)}</div></div>
        <div className="cd"><div className="lb">Categories</div><div className="vl">{cats.length}</div></div>
        <div className="cd"><div className="lb">Avg Price</div><div className="vl">{fmtCurrency(inv.length ? totalVal / inv.reduce((s,i)=>s+i.qty,0) : 0)}</div></div>
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: "20px 0 12px" }}>By Category</h3>
      {cats.map(c => { const items = inv.filter(i => i.category === c); const val = items.reduce((s, i) => s + i.qty * i.price, 0); const qty = items.reduce((s, i) => s + i.qty, 0); return (
        <div key={c} className="bi"><div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{c}</div><div style={{ fontSize: 11, color: "var(--tx3)" }}>{items.length} items · {qty} units</div></div><div style={{ fontWeight: 700 }}>{fmtCurrency(val)}</div></div>
      ); })}
    </div>
  );
}

function CategoryManager({ categories, onAdd, onRename, onDelete, inv }) {
  const [newCat, setNewCat] = useState("");
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState("");

  const catCounts = useMemo(() => {
    const counts = {};
    categories.forEach(c => { counts[c] = inv.filter(i => i.category === c).length; });
    return counts;
  }, [categories, inv]);

  const handleAdd = () => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) { alert("Category already exists"); return; }
    onAdd(trimmed);
    setNewCat("");
  };

  const handleRename = (oldName) => {
    const trimmed = editVal.trim();
    if (!trimmed || trimmed === oldName) { setEditing(null); return; }
    if (categories.includes(trimmed)) { alert("Category already exists"); setEditing(null); return; }
    onRename(oldName, trimmed);
    setEditing(null);
  };

  const handleDelete = (catName) => {
    if (catCounts[catName] > 0) { alert(`Cannot delete "${catName}" — ${catCounts[catName]} items still use this category. Reassign them first.`); return; }
    if (window.confirm(`Delete category "${catName}"?`)) onDelete(catName);
  };

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Manage Categories</h3>
      <p style={{ fontSize: 12, color: "var(--tx2)", marginBottom: 14 }}>Add, rename, or remove categories. Categories with items cannot be deleted.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input className="fi" value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="New category name..." onKeyDown={e => e.key === "Enter" && handleAdd()} style={{ maxWidth: 280 }} />
        <button className="bt bt-p bt-sm" onClick={handleAdd}><I.Plus /> Add</button>
      </div>
      {categories.map(c => (
        <div key={c} className="cat-ed">
          {editing === c ? (
            <>
              <input className="fi" value={editVal} onChange={e => setEditVal(e.target.value)} onKeyDown={e => e.key === "Enter" && handleRename(c)} style={{ flex: 1, padding: "5px 10px" }} autoFocus />
              <button className="cat-eb" onClick={() => handleRename(c)} title="Save"><I.Check /></button>
              <button onClick={() => setEditing(null)} title="Cancel"><I.X /></button>
            </>
          ) : (
            <>
              <div className="cat-nm">{c}</div>
              <div className="cat-ct">{catCounts[c] || 0} items</div>
              <button className="cat-eb" onClick={() => { setEditing(c); setEditVal(c); }} title="Rename"><I.Edit /></button>
              <button onClick={() => handleDelete(c)} title="Delete"><I.Trash /></button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function Settings({ categories, onAddCat, onRenameCat, onDeleteCat, inv }) {
  return (
    <div className="fu">
      <div className="tp"><h2>Settings</h2></div>
      <div className="cd">
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Organization</h3>
        <p style={{ fontSize: 13, color: "var(--tx2)" }}>Church Pantry Management System</p>
      </div>
      <div className="cd" style={{ marginTop: 16 }}>
        <CategoryManager categories={categories} onAdd={onAddCat} onRename={onRenameCat} onDelete={onDeleteCat} inv={inv} />
      </div>
    </div>
  );
}

// ── Modal ──
function Modal({ type, onClose, onSave, categories }) {
  const [form, setForm] = useState({});
  const up = (k, v) => setForm(p => ({ ...p, [k]: v }));
  if (!type) return null;
  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {type === "add" && (<>
          <h3>Add Inventory Item</h3>
          <div className="fg"><label className="fl">UPC</label><input className="fi" onChange={e => up("upc", e.target.value)} /></div>
          <div className="fg"><label className="fl">Name *</label><input className="fi" onChange={e => up("name", e.target.value)} /></div>
          <div className="fg"><label className="fl">Category</label><select className="fi" onChange={e => up("category", e.target.value)} defaultValue={categories[0]}>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="fg" style={{ flex: 1 }}><label className="fl">Qty</label><input className="fi" type="number" defaultValue={1} onChange={e => up("qty", Number(e.target.value))} /></div>
            <div className="fg" style={{ flex: 1 }}><label className="fl">Price</label><input className="fi" type="number" step=".01" onChange={e => up("price", Number(e.target.value))} /></div>
          </div>
          <div className="fg"><label className="fl">Expiry</label><input className="fi" type="date" onChange={e => up("expiry", e.target.value)} /></div>
          <div className="fg"><label className="fl">Location</label><input className="fi" onChange={e => up("location", e.target.value)} /></div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}><button className="bt bt-s" onClick={onClose}>Cancel</button><button className="bt bt-p" onClick={() => onSave({ ...form, category: form.category || categories[0], qty: form.qty || 1, price: form.price || 0, expiry: form.expiry || "2027-01-01", added_by: "Manager", added_date: new Date().toISOString().slice(0, 10) })}>Add Item</button></div>
        </>)}
        {type === "donor" && (<>
          <h3>Add Donor</h3>
          <div className="fg"><label className="fl">Name *</label><input className="fi" onChange={e => up("name", e.target.value)} /></div>
          <div className="fg"><label className="fl">Contact</label><input className="fi" onChange={e => up("contact", e.target.value)} /></div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}><button className="bt bt-s" onClick={onClose}>Cancel</button><button className="bt bt-p" onClick={() => onSave(form)}>Add Donor</button></div>
        </>)}
        {type === "recip" && (<>
          <h3>Add Recipient</h3>
          <div className="fg"><label className="fl">Name *</label><input className="fi" onChange={e => up("name", e.target.value)} /></div>
          <div className="fg"><label className="fl">Family Size</label><input className="fi" type="number" defaultValue={1} onChange={e => up("size", Number(e.target.value))} /></div>
          <div className="fg"><label className="fl">Dietary Restrictions</label><input className="fi" onChange={e => up("dietary", e.target.value)} /></div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}><button className="bt bt-s" onClick={onClose}>Cancel</button><button className="bt bt-p" onClick={() => onSave(form)}>Add Recipient</button></div>
        </>)}
        {type === "msg" && (<>
          <h3>New Discussion Post</h3>
          <div className="fg"><label className="fl">Your Name</label><input className="fi" onChange={e => up("author", e.target.value)} /></div>
          <div className="fg"><label className="fl">Message</label><textarea className="fi" rows={4} onChange={e => up("body", e.target.value)} /></div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}><button className="bt bt-s" onClick={onClose}>Cancel</button><button className="bt bt-p" onClick={() => onSave(form)}>Post</button></div>
        </>)}
      </div>
    </div>
  );
}

// ── Main App ──
export default function ChurchPantry() {
  const [pg, setPg] = useState("dash");
  const [inv, setInv] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [donors, setDonors] = useState([]);
  const [recip, setRecip] = useState([]);
  const [messages, setMessages] = useState([]);
  const [srch, setSrch] = useState("");
  const [sel, setSel] = useState([]);
  const [modal, setModal] = useState(null);
  const [sbOpen, setSbOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Load data from Supabase ──
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data: invData } = await supabase.from("inventory").select("*");
        if (invData) setInv(invData);

        const { data: catData } = await supabase.from("categories").select("*");
        if (catData && catData.length > 0) setCategories(catData.map(c => c.name).sort());

        const { data: donorData } = await supabase.from("donors").select("*");
        if (donorData) setDonors(donorData);

        const { data: recipData } = await supabase.from("recipients").select("*");
        if (recipData) setRecip(recipData);

        const { data: msgData } = await supabase.from("messages").select("*");
        if (msgData) setMessages(msgData);
      } catch (err) { console.error("Load error:", err); }
      setLoading(false);
    }
    load();
  }, []);

  // ── Filtered inventory for search ──
  const filteredInv = useMemo(() => {
    if (!srch) return inv;
    const s = srch.toLowerCase();
    return inv.filter(i => i.name.toLowerCase().includes(s) || (i.upc && i.upc.includes(s)) || i.category.toLowerCase().includes(s));
  }, [inv, srch]);

  // ── Alerts ──
  const alerts = useMemo(() => {
    const a = [];
    inv.forEach(i => {
      const d = daysUntil(i.expiry);
      if (d > 0 && d <= 30) a.push({ title: `Expiring soon: ${i.name}`, detail: `${i.qty} units expire ${fmt(i.expiry)}.` });
      if (i.qty <= 5 && i.qty > 0) a.push({ title: `Low stock: ${i.name}`, detail: `Only ${i.qty} units remaining.` });
    });
    return a;
  }, [inv]);

  // ── CRUD functions ──
  const addItem = useCallback(async (item) => {
    const { data, error } = await supabase.from("inventory").insert([item]).select();
    if (data) setInv(p => [...p, ...data]);
    if (error) console.error("Add error:", error);
    setModal(null);
  }, []);

  const delItem = useCallback(async (id) => {
    await supabase.from("inventory").delete().eq("id", id);
    setInv(p => p.filter(i => i.id !== id));
    setSel(p => p.filter(s => s !== id));
  }, []);

  const addDonor = useCallback(async (d) => {
    const donor = { name: d.name, contact: d.contact || "", donations: 0, total: 0 };
    const { data } = await supabase.from("donors").insert([donor]).select();
    if (data) setDonors(p => [...p, ...data]);
    setModal(null);
  }, []);

  const addRecip = useCallback(async (r) => {
    const rec = { name: r.name, size: r.size || 1, dietary: r.dietary || "" };
    const { data } = await supabase.from("recipients").insert([rec]).select();
    if (data) setRecip(p => [...p, ...data]);
    setModal(null);
  }, []);

  const addMsg = useCallback(async (m) => {
    const msg = { author: m.author || "Anonymous", body: m.body, date: new Date().toISOString().slice(0, 10), replies: [] };
    const { data } = await supabase.from("messages").insert([msg]).select();
    if (data) setMessages(p => [...p, ...data]);
    setModal(null);
  }, []);

  // ── Category CRUD ──
  const addCategory = useCallback(async (name) => {
    const { data } = await supabase.from("categories").insert([{ name }]).select();
    if (data) setCategories(p => [...p, name].sort());
  }, []);

  const renameCategory = useCallback(async (oldName, newName) => {
    await supabase.from("categories").update({ name: newName }).eq("name", oldName);
    await supabase.from("inventory").update({ category: newName }).eq("category", oldName);
    setCategories(p => p.map(c => c === oldName ? newName : c).sort());
    setInv(p => p.map(i => i.category === oldName ? { ...i, category: newName } : i));
  }, []);

  const deleteCategory = useCallback(async (name) => {
    await supabase.from("categories").delete().eq("name", name);
    setCategories(p => p.filter(c => c !== name));
  }, []);

  const togSel = useCallback((id) => setSel(p => p.includes(id) ? p.filter(s => s !== id) : [...p, id]), []);
  const selAll = useCallback((ids) => setSel(p => { const allIn = ids.every(id => p.includes(id)); return allIn ? p.filter(id => !ids.includes(id)) : [...new Set([...p, ...ids])]; }), []);

  const handleSave = (data) => {
    if (modal === "add") addItem(data);
    else if (modal === "donor") addDonor(data);
    else if (modal === "recip") addRecip(data);
    else if (modal === "msg") addMsg(data);
  };

  const setPage = (p) => { setPg(p); setSbOpen(false); };

  const NAV = [
    { id: "dash", label: "Dashboard", icon: I.Home, sec: "Main" },
    { id: "inv", label: "Inventory", icon: I.Pkg, sec: "Main" },
    { id: "scan", label: "Scan & Add", icon: I.Scan, sec: "Main" },
    { id: "bag", label: "Bag & Go", icon: I.Bag, sec: "Main" },
    { id: "donors", label: "Donors", icon: I.Heart, sec: "Community" },
    { id: "recip", label: "Recipients", icon: I.Users, sec: "Community" },
    { id: "discussion", label: "Discussion", icon: I.Chat, sec: "Community" },
    { id: "alerts", label: "Alerts", icon: I.Bell, sec: "Alerts", badge: alerts.length },
    { id: "analytics", label: "Analytics", icon: I.Chart, sec: "System" },
    { id: "settings", label: "Settings", icon: I.Gear, sec: "System" },
  ];

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "var(--hd)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--acc)", marginBottom: 8 }}>Church Pantry</div>
        <div style={{ color: "var(--tx3)" }}>Loading inventory...</div>
      </div>
    </div>
  );

  let curSec = "";
  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <div className={`sb-ov ${sbOpen ? "open" : ""}`} onClick={() => setSbOpen(false)} />
        <aside className={`sb ${sbOpen ? "open" : ""}`}>
          <div className="sb-hd"><h1>Church Pantry</h1><p>Inventory Management</p></div>
          <nav className="sb-nav">
            {NAV.map(n => {
              let sec = null;
              if (n.sec !== curSec) { curSec = n.sec; sec = <div key={`s-${n.sec}`} className="sb-sec">{n.sec}</div>; }
              return (<div key={n.id}>{sec}<div className={`sb-it ${pg === n.id ? "ac" : ""}`} onClick={() => setPage(n.id)}><n.icon />{n.label}{n.badge > 0 && <span className="badge badge-rd" style={{ marginLeft: "auto", fontSize: 10 }}>{n.badge}</span>}</div></div>);
            })}
          </nav>
          <div className="sb-ft"><I.Cloud /> Cloud synced</div>
        </aside>

        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div className="mob-hd">
            <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setSbOpen(true)}><I.Menu /></button>
            <h1>Church Pantry</h1>
            <div style={{ width: 22 }} />
          </div>

          <div className="mn">
            {pg === "dash" && <Dashboard inv={inv} donors={donors} alerts={alerts} setPage={setPage} />}
            {pg === "inv" && <Inventory inv={filteredInv} categories={categories} srch={srch} setSrch={setSrch} sel={sel} selAll={selAll} togSel={togSel} delItem={delItem} setModal={setModal} />}
            {pg === "scan" && <ScanAdd onAdd={addItem} categories={categories} />}
            {pg === "bag" && <BagAndGo inv={inv} recip={recip} />}
            {pg === "donors" && <Donors donors={donors} setModal={setModal} />}
            {pg === "recip" && <Recipients recip={recip} setModal={setModal} />}
            {pg === "discussion" && <Discussion messages={messages} setModal={setModal} />}
            {pg === "alerts" && <Alerts inv={inv} />}
            {pg === "analytics" && <Analytics inv={inv} />}
            {pg === "settings" && <Settings categories={categories} onAddCat={addCategory} onRenameCat={renameCategory} onDeleteCat={deleteCategory} inv={inv} />}
          </div>

          <div className="mob-nav">
            {[{ id: "dash", icon: I.Home, label: "Dashboard" }, { id: "inv", icon: I.Pkg, label: "Inventory" }, { id: "bag", icon: I.Bag, label: "Bag & Go" }, { id: "discussion", icon: I.Chat, label: "Discussion" }, { id: "alerts", icon: I.Bell, label: "Alerts" }].map(n => (
              <button key={n.id} className={pg === n.id ? "ac" : ""} onClick={() => setPage(n.id)}><n.icon />{n.label}</button>
            ))}
          </div>
        </main>

        <Modal type={modal} onClose={() => setModal(null)} onSave={handleSave} categories={categories} />
      </div>
    </>
  );
}
