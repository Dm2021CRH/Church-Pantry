import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { Html5Qrcode } from "html5-qrcode";
/* ═══════════════════════════════════════════
   CHURCH PANTRY — Supabase + Blue Theme + Editable Categories + Export
   ═══════════════════════════════════════════
   TODO (Future): Multi-location support
   - Each church logs in and sees their own dashboard/inventory
   - Location stored in Supabase with each inventory item
   - Church logo stored per-location in a "locations" table
   - Auth will scope data by location_id
   ═══════════════════════════════════════════ */

const today = new Date();
const daysUntil = (d) => Math.ceil((new Date(d) - today) / 86400000);
const fmt = (d) => new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
const fmtCurrency = (v) => "$" + Number(v).toFixed(2);
const uid = () => Math.random().toString(36).slice(2,9);

const BAG_RULES = {
  1:{canned:4,grains:2,protein:2,dairy:1,beverage:1,snack:1,hygiene:1},
  2:{canned:6,grains:3,protein:3,dairy:2,beverage:2,snack:2,hygiene:1},
  3:{canned:8,grains:4,protein:4,dairy:2,beverage:2,snack:3,hygiene:2},
  4:{canned:10,grains:5,protein:4,dairy:3,beverage:3,snack:3,hygiene:2},
  5:{canned:12,grains:6,protein:5,dairy:3,beverage:3,snack:4,hygiene:2},
  6:{canned:14,grains:7,protein:6,dairy:4,beverage:4,snack:4,hygiene:3},
  7:{canned:16,grains:8,protein:7,dairy:4,beverage:4,snack:5,hygiene:3},
};
const catToRule = {"Canned Goods":"canned","Grains & Pasta":"grains","Meat & Protein":"protein","Dairy":"dairy","Beverages":"beverage","Snacks":"snack","Hygiene":"hygiene","Baby & Infant":"baby","Produce":"produce","Condiments":"canned","Baking":"grains","Frozen":"protein","Sauce":"canned","Breakfast items":"grains","Condiment":"canned","Salad toppings":"canned","Meal in Can":"protein","Pasta":"grains","Seafood":"protein","Meat":"protein","Side dish":"canned","Pasta Dish":"grains","Baking goods":"grains","Cookies-sweets":"snack","Cooking oils":"canned","Other":"canned","Baking mix":"grains","Soup":"canned"};

function buildBag(inv, familySize, dietaryNotes = "") {
  const rules = BAG_RULES[Math.min(familySize, 7)] || BAG_RULES[7];
  const scaled = {}; Object.keys(rules).forEach(k => { scaled[k] = Math.ceil(rules[k] * (familySize > 7 ? familySize / 7 : 1)); });
  const sorted = [...inv].filter(i => i.qty > 0 && daysUntil(i.expiry) > 0).sort((a,b) => new Date(a.expiry) - new Date(b.expiry));
  const bag = [], needs = {...scaled};
  const isVeg = dietaryNotes.toLowerCase().includes("vegetarian");
  const nutAllergy = dietaryNotes.toLowerCase().includes("nut");
  sorted.forEach(item => { const rule = catToRule[item.category]; if (!rule || !needs[rule] || needs[rule] <= 0) return; if (isVeg && item.category === "Meat & Protein") return; if (nutAllergy && item.name.toLowerCase().includes("peanut")) return; const take = Math.min(needs[rule], item.qty); bag.push({...item, bagQty: take, fifo: daysUntil(item.expiry) <= 30}); needs[rule] -= take; });
  if (familySize >= 3) { const formula = sorted.find(i => i.category === "Baby & Infant" && i.qty > 0); if (formula && !bag.find(b=>b.id===formula.id)) bag.push({...formula, bagQty: 1, fifo: false, optional: true}); }
  return { bag, unmet: Object.entries(needs).filter(([,v]) => v > 0).map(([k,v]) => ({category:k,needed:v})) };
}

function exportCSV(items, filename = "church-pantry-inventory") {
  const headers = ["Item Name","UPC","Category","Quantity","Unit Price","Total Value","Expiry Date","Days Until Expiry","Location","Added By","Date Added","Status"];
  const rows = items.map(item => { const d = daysUntil(item.expiry); const status = d <= 0 ? "Expired" : d <= 7 ? "Expiring (Critical)" : d <= 30 ? "Expiring Soon" : "Good"; return [`"${item.name}"`,item.upc,`"${item.category}"`,item.qty,(item.price||0).toFixed(2),(item.qty*(item.price||0)).toFixed(2),item.expiry,d,`"${item.location||""}"`,`"${item.added_by||""}"`,item.added_date||"",status].join(","); });
  const totalQty = items.reduce((s,i) => s + i.qty, 0); const totalVal = items.reduce((s,i) => s + i.qty*(i.price||0), 0);
  rows.push(""); rows.push(`"TOTAL","","",${totalQty},"",${totalVal.toFixed(2)},"","","","","",""`);
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${filename}-${new Date().toISOString().slice(0,10)}.csv`; a.click();
}

function exportPDF(items, filterLabel = "All Categories") {
  const totalQty = items.reduce((s,i) => s + i.qty, 0); const totalVal = items.reduce((s,i) => s + i.qty*(i.price||0), 0);
  const expSoon = items.filter(i => { const d = daysUntil(i.expiry); return d > 0 && d <= 30; }).length;
  const expired = items.filter(i => daysUntil(i.expiry) <= 0).length;
  const byCategory = {}; items.forEach(i => { if (!byCategory[i.category]) byCategory[i.category] = []; byCategory[i.category].push(i); });
  const catSections = Object.entries(byCategory).sort((a,b) => a[0].localeCompare(b[0])).map(([cat, ci]) => {
    const cq = ci.reduce((s,i) => s + i.qty, 0); const cv = ci.reduce((s,i) => s + i.qty*(i.price||0), 0);
    const rows = ci.sort((a,b) => new Date(a.expiry) - new Date(b.expiry)).map(item => { const d = daysUntil(item.expiry); const sc = d<=0?"expired":d<=7?"critical":d<=30?"warning":""; const st = d<=0?"EXPIRED":d<=30?`${d}d left`:`${d}d`; return `<tr class="${sc}"><td>${item.name}</td><td class="mono">${item.upc||""}</td><td class="num">${item.qty}</td><td class="num">$${(item.price||0).toFixed(2)}</td><td class="num">$${(item.qty*(item.price||0)).toFixed(2)}</td><td>${item.expiry}</td><td class="status">${st}</td><td>${item.location||"—"}</td></tr>`; }).join("");
    return `<div class="cat-section"><div class="cat-header"><h3>${cat}</h3><span>${ci.length} items · ${cq} units · $${cv.toFixed(2)}</span></div><table><thead><tr><th>Item</th><th>UPC</th><th>Qty</th><th>Price</th><th>Value</th><th>Expires</th><th>Status</th><th>Location</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join("");
  const html = `<!DOCTYPE html><html><head><title>Inventory Report</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;color:#1E3A5F;background:#fff;padding:32px;font-size:12px}.header{display:flex;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #1E3A5F}.header h1{font-size:22px;color:#1E3A5F}.header h2{font-size:14px;color:#64748B;font-weight:400;margin-top:4px}.meta{text-align:right;font-size:11px;color:#64748B}.summary-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px}.summary-card{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:12px;text-align:center}.summary-card .label{font-size:10px;text-transform:uppercase;color:#94A3B8;margin-bottom:4px}.summary-card .value{font-size:20px;font-weight:700}.summary-card.alert .value{color:#DC2626}.summary-card.warn .value{color:#D97706}.cat-section{margin-bottom:20px}.cat-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;padding:6px 0;border-bottom:1px solid #E2E8F0}.cat-header h3{font-size:14px;color:#1E3A5F}.cat-header span{font-size:11px;color:#94A3B8}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#F8FAFC;padding:6px 8px;text-align:left;font-weight:600;border-bottom:1px solid #E2E8F0;font-size:10px;text-transform:uppercase;color:#64748B}td{padding:5px 8px;border-bottom:1px solid #F1F5F9}tr.expired{background:#FEF2F2}tr.expired td{color:#DC2626}tr.critical{background:#FFF7ED}tr.warning{background:#FFFBEB}.mono{font-family:monospace;font-size:10px;color:#94A3B8}.num{text-align:right}.status{font-weight:600;font-size:10px}tr.expired .status{color:#DC2626}tr.critical .status{color:#EA580C}tr.warning .status{color:#D97706}.footer{margin-top:24px;padding-top:12px;border-top:1px solid #E2E8F0;font-size:10px;color:#94A3B8;display:flex;justify-content:space-between}.print-btn{position:fixed;bottom:24px;right:24px;padding:12px 24px;background:#1E3A5F;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer}@media print{.print-btn{display:none}}</style></head><body><div class="header"><div><h1>Church Pantry</h1><h2>Inventory Report — ${filterLabel}</h2></div><div class="meta"><div><strong>Generated:</strong> ${new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div><div><strong>Items:</strong> ${items.length} unique · ${totalQty} units</div></div></div><div class="summary-grid"><div class="summary-card"><div class="label">Unique Items</div><div class="value">${items.length}</div></div><div class="summary-card"><div class="label">Total Units</div><div class="value">${totalQty}</div></div><div class="summary-card"><div class="label">Total Value</div><div class="value">$${totalVal.toFixed(2)}</div></div><div class="summary-card ${expired>0?'alert':''}"><div class="label">Expired</div><div class="value">${expired}</div></div><div class="summary-card ${expSoon>0?'warn':''}"><div class="label">Expiring ≤30d</div><div class="value">${expSoon}</div></div></div>${catSections}<div class="footer"><span>Church Pantry Inventory Management</span><span>Confidential</span></div><button class="print-btn" onclick="window.print()">Print / Save as PDF</button></body></html>`;
  const w = window.open("","_blank"); w.document.write(html); w.document.close();
}

const Icons = {
  Home: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Package: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Scan: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>,
  Heart: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Chat: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Bell: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Chart: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Gear: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Bag: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Trash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  Edit: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Alert: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Share: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  Download: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Sync: ({spinning}) => <svg className={spinning?"spin":""} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/><path d="M2.5 11.5a10 10 0 0 1 16.5-5.7L21.5 8"/><path d="M21.5 12.5a10 10 0 0 1-16.5 5.7L2.5 16"/></svg>,
  Menu: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
};
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
:root{--bg:#F8FAFC;--bg2:#EFF6FF;--bg3:#FFFFFF;--tx:#1E293B;--tx2:#64748B;--tx3:#94A3B8;--acc:#1E3A5F;--acc2:#2563EB;--acc-s:#DBEAFE;--gn:#16A34A;--gn-s:#F0FDF4;--rd:#DC2626;--rd-s:#FEF2F2;--yl:#D97706;--yl-s:#FFFBEB;--bl:#2563EB;--bl-s:#EFF6FF;--bd:#E2E8F0;--shadow:0 2px 12px rgba(30,58,95,0.06);--shadow-lg:0 8px 32px rgba(30,58,95,0.1);--r:12px;--rs:8px;--hd:'DM Serif Display',serif;--ft:'IBM Plex Sans',sans-serif}
*{margin:0;padding:0;box-sizing:border-box}body{background:var(--bg);color:var(--tx);font-family:var(--ft)}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes slideIn{from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:none}}
@keyframes spin{to{transform:rotate(360deg)}}
.fu{animation:fadeUp .4s ease-out both}.si{animation:slideIn .3s ease-out both}.spin{animation:spin 1.5s linear infinite}
.app{display:flex;min-height:100vh}
.sb{width:260px;background:var(--acc);color:#fff;display:flex;flex-direction:column;position:fixed;top:0;left:0;height:100vh;z-index:100}
.sb-hd{padding:24px 20px 16px;border-bottom:1px solid rgba(255,255,255,.1)}
.sb-logo{width:48px;height:48px;border-radius:10px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;margin-bottom:10px;font-size:20px;font-weight:700;color:#fff;border:2px dashed rgba(255,255,255,.3)}
.sb-hd h1{font-family:var(--hd);font-size:20px;letter-spacing:-.3px}
.sb-hd p{font-size:11px;color:rgba(255,255,255,.45);margin-top:3px;letter-spacing:.5px;text-transform:uppercase}
.sb-nav{flex:1;padding:14px 10px;overflow-y:auto}
.sb-sec{font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:rgba(255,255,255,.25);padding:18px 14px 6px}
.ni{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:var(--rs);cursor:pointer;font-size:13.5px;font-weight:500;color:rgba(255,255,255,.55);transition:all .2s;margin-bottom:2px}
.ni:hover{color:rgba(255,255,255,.85);background:rgba(255,255,255,.08)}
.ni.ac{color:#fff;background:var(--acc2)}
.ni .badge{margin-left:auto;background:var(--rd);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px}
.sb-ft{padding:14px 12px;border-top:1px solid rgba(255,255,255,.08)}
.sync-bar{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:var(--rs);background:rgba(255,255,255,.05);font-size:12px;color:rgba(255,255,255,.5);cursor:pointer}
.sync-dot{width:8px;height:8px;border-radius:50%;background:var(--gn)}
.mn{flex:1;margin-left:260px;min-height:100vh}
.topbar{position:sticky;top:0;z-index:50;background:rgba(248,250,252,.92);backdrop-filter:blur(12px);padding:18px 32px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--bd)}
.topbar h2{font-family:var(--hd);font-size:22px;letter-spacing:-.3px}
.topbar-act{display:flex;align-items:center;gap:10px}
.content{padding:28px 32px 120px}
.sg{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
.sc{background:var(--bg3);border:1px solid var(--bd);border-radius:var(--r);padding:20px}
.sc .lb{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--tx3);font-weight:600}
.sc .vl{font-size:28px;font-weight:700;margin-top:6px}
.sc .sm{font-size:12px;color:var(--tx3);margin-top:4px}
.sc.good .vl{color:var(--gn)}.sc.alert .vl{color:var(--rd)}.sc.warn .vl{color:var(--yl)}
.cd{background:var(--bg3);border:1px solid var(--bd);border-radius:var(--r);padding:20px}
.cd-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.cd-tt{font-size:16px;font-weight:600}
.bt{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:var(--rs);font-size:13px;font-weight:600;border:none;cursor:pointer;transition:all .2s;font-family:var(--ft)}
.bt-p{background:var(--acc2);color:#fff}.bt-p:hover{background:#1D4ED8}
.bt-s{background:var(--bg2);color:var(--tx);border:1px solid var(--bd)}.bt-s:hover{background:var(--bd)}
.bt-gn{background:var(--gn);color:#fff}.bt-gn:hover{background:#15803D}
.bt-d{background:var(--rd);color:#fff}.bt-d:hover{background:#B91C1C}
.bt-gh{background:none;color:var(--tx2)}.bt-gh:hover{background:var(--bg2)}
.bt-sm{padding:6px 12px;font-size:12px}
.fi{width:100%;padding:10px 14px;border:1.5px solid var(--bd);border-radius:var(--rs);font-size:13px;font-family:var(--ft);background:var(--bg3);color:var(--tx);transition:border .2s}
.fi:focus{outline:none;border-color:var(--acc2);box-shadow:0 0 0 3px var(--acc-s)}
.fl{display:block;font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:5px}
.fg{margin-bottom:14px}
.sb-wrap{background:var(--bg3);border:1px solid var(--bd);border-radius:var(--rs);display:flex;align-items:center;gap:8px;padding:0 14px}
.sb-wrap input{border:none;background:none;outline:none;padding:10px 0;flex:1;font-size:13px;font-family:var(--ft)}
.sb-wrap svg{color:var(--tx3);flex-shrink:0}
.tw{background:var(--bg3);border:1px solid var(--bd);border-radius:var(--r);overflow:hidden}
table{width:100%;border-collapse:collapse}
th{background:var(--bg2);padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--tx3);border-bottom:1px solid var(--bd)}
td{padding:10px 14px;border-bottom:1px solid var(--bg2);font-size:13px}
tr:hover td{background:var(--bg)}
.tag{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
.tag-gn{background:var(--gn-s);color:var(--gn)}.tag-yl{background:var(--yl-s);color:var(--yl)}.tag-rd{background:var(--rd-s);color:var(--rd)}.tag-bl{background:var(--bl-s);color:var(--bl)}
.mo{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(30,58,95,.35);backdrop-filter:blur(4px);z-index:200;display:flex;align-items:center;justify-content:center}
.modal{background:var(--bg3);border-radius:var(--r);width:90%;max-width:500px;max-height:85vh;overflow-y:auto;box-shadow:var(--shadow-lg)}
.modal-hd{display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid var(--bd)}
.modal-hd h3{font-size:18px;font-weight:600}
.modal-cl{background:none;border:none;font-size:24px;color:var(--tx3);cursor:pointer}
.modal-bd{padding:24px}
.bag-hero{background:linear-gradient(135deg,var(--acc),var(--acc2));color:#fff;border-radius:var(--r);padding:32px;margin-bottom:24px}
.bag-hero h2{font-family:var(--hd);font-size:24px}.bag-hero p{font-size:14px;opacity:.85;margin-top:6px}
.bag-cfg{display:flex;gap:14px;margin-top:20px;flex-wrap:wrap;align-items:flex-end}
.bag-cfg .fl{color:rgba(255,255,255,.8)}.bag-cfg .fi{background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.25);color:#fff}
.msg-cd{background:var(--bg3);border:1px solid var(--bd);border-radius:var(--r);padding:20px;margin-bottom:12px}
.msg-hd{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.avatar{width:36px;height:36px;border-radius:50%;background:var(--acc2);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}
.msg-au{font-weight:600;font-size:14px}.msg-rl{font-size:11px;color:var(--tx3)}.msg-tm{font-size:11px;color:var(--tx3);margin-left:auto}
.msg-tx{font-size:14px;line-height:1.6}
.replies{margin-top:14px;padding-top:14px;border-top:1px solid var(--bd)}
.reply{display:flex;gap:10px;padding:10px 0}.reply .avatar{width:28px;height:28px;font-size:10px}
.nf{display:flex;gap:14px;padding:14px 18px;border-radius:var(--rs);margin-bottom:8px;align-items:flex-start}
.nf.urgent{background:var(--rd-s);border:1px solid #FECACA}.nf.warning{background:var(--yl-s);border:1px solid #FDE68A}
.nf-icon{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.nf.urgent .nf-icon{background:var(--rd);color:#fff}.nf.warning .nf-icon{background:var(--yl);color:#fff}
.nf-tt{font-weight:600;font-size:14px}.nf-ds{font-size:12px;color:var(--tx2);margin-top:3px}
.bulk-bar{position:sticky;bottom:0;left:0;right:0;background:var(--acc);color:#fff;padding:14px 28px;display:flex;align-items:center;gap:16px;border-radius:12px 12px 0 0;box-shadow:0 -4px 20px rgba(0,0,0,.15);z-index:80}
.exp-dd{position:relative}.exp-mn{position:absolute;top:calc(100% + 6px);right:0;background:var(--bg3);border:1px solid var(--bd);border-radius:var(--rs);box-shadow:var(--shadow-lg);min-width:220;z-index:100;overflow:hidden}
.exp-mn .exp-hd{padding:8px 12px;border-bottom:1px solid var(--bd);font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px}
.exp-mn button{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;background:none;border:none;cursor:pointer;font-size:13px;color:var(--tx);text-align:left;font-family:var(--ft)}
.exp-mn button:hover{background:var(--bg2)}
@media(max-width:768px){.sb{display:none}.mn{margin-left:0}.topbar{padding:14px 18px}.topbar h2{font-size:18px}.content{padding:16px 18px 120px}.sg{grid-template-columns:1fr 1fr}.mob-nav{display:flex !important}.mob-hd{display:flex !important}}
.mob-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:var(--acc);z-index:150;padding:8px 0 max(8px,env(safe-area-inset-bottom));justify-content:space-around}
.mob-nav button{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 12px;color:rgba(255,255,255,.4);font-size:10px;font-weight:600;cursor:pointer;border:none;background:none}
.mob-nav button.ac{color:#fff}
.mob-hd{display:none;align-items:center;justify-content:space-between;padding:14px 20px;background:var(--bg3);border-bottom:1px solid var(--bd);position:sticky;top:0;z-index:50}
.mob-hd h1{font-size:16px;font-weight:800;color:var(--acc)}
`;

// ── Pages ──
function Dashboard({inv, donors, notifs, totalVal, totalItems, setPage}) {
  const expSoon = inv.filter(i => { const d = daysUntil(i.expiry); return d > 0 && d <= 30; }).length;
  const lowStock = inv.filter(i => i.qty <= 5 && i.qty > 0).length;
  return (<div className="fu">
    <div className="sg">
      <div className="sc good"><div className="lb">Total Items</div><div className="vl">{totalItems.toLocaleString()}</div><div className="sm">{inv.length} unique products</div></div>
      <div className="sc"><div className="lb">Inventory Value</div><div className="vl">{fmtCurrency(totalVal)}</div><div className="sm">Based on local pricing</div></div>
      <div className={`sc ${expSoon>0?"warn":""}`}><div className="lb">Expiring Soon</div><div className="vl">{expSoon}</div><div className="sm">Within 30 days</div></div>
      <div className={`sc ${lowStock>0?"alert":""}`}><div className="lb">Low Stock</div><div className="vl">{lowStock}</div><div className="sm">5 or fewer units</div></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
      <div className="cd"><div className="cd-hd"><h3 className="cd-tt">Recent Alerts</h3><button className="bt bt-gh bt-sm" onClick={()=>setPage("alerts")}>View All</button></div>
        {notifs.slice(0,4).map((n,i)=>(<div key={i} className={`nf ${n.type}`}><div className="nf-icon"><Icons.Alert/></div><div><div className="nf-tt">{n.title}</div><div className="nf-ds">{n.desc}</div></div></div>))}
        {notifs.length===0&&<p style={{color:"var(--tx3)",textAlign:"center",padding:20}}>No alerts right now!</p>}
      </div>
      <div className="cd"><div className="cd-hd"><h3 className="cd-tt">Quick Actions</h3></div>
        <div style={{display:"grid",gap:10}}>
          <button className="bt bt-p" style={{width:"100%",justifyContent:"center"}} onClick={()=>setPage("scan")}><Icons.Scan/> Scan & Add Items</button>
          <button className="bt bt-gn" style={{width:"100%",justifyContent:"center"}} onClick={()=>setPage("bag")}><Icons.Bag/> Build a Bag & Go</button>
          <button className="bt bt-s" style={{width:"100%",justifyContent:"center"}} onClick={()=>setPage("discussion")}><Icons.Chat/> Discussion Board</button>
          <button className="bt bt-s" style={{width:"100%",justifyContent:"center"}} onClick={()=>setPage("donors")}><Icons.Heart/> Manage Donors</button>
        </div>
        {donors.length>0&&<div style={{marginTop:20}}><h3 className="cd-tt" style={{fontSize:15,marginBottom:10}}>Top Donors</h3>
          {donors.slice(0,3).map(d=>(<div key={d.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--bd)"}}><div><div style={{fontWeight:600,fontSize:13}}>{d.name}</div><div style={{fontSize:11,color:"var(--tx3)"}}>{d.donations||d.totalDonations||0} donations</div></div><div style={{fontWeight:700,color:"var(--gn)",fontSize:14}}>{fmtCurrency(d.total||d.totalValue||0)}</div></div>))}
        </div>}
      </div>
    </div>
  </div>);
}

function InventoryPage({inv, cats, search, setSearch, selected, handleSelectAll, toggleSelect, deleteItem, setModal}) {
  const [catF, setCatF] = useState("All");
  const [showExp, setShowExp] = useState(false);
  const expRef = useRef(null);
  useEffect(()=>{const h=e=>{if(expRef.current&&!expRef.current.contains(e.target))setShowExp(false)};if(showExp)document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h)},[showExp]);
  const filtered = catF==="All"?inv:inv.filter(i=>i.category===catF);
  return (<div className="fu">
    <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
      <div className="sb-wrap" style={{flex:1,minWidth:200}}><Icons.Search/><input placeholder="Search by name, UPC, or category..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <select className="fi" style={{width:"auto",minWidth:160}} value={catF} onChange={e=>setCatF(e.target.value)}><option value="All">All Categories</option>{cats.map(c=><option key={c} value={c}>{c}</option>)}</select>
      <div className="exp-dd" ref={expRef}>
        <button className="bt bt-s bt-sm" onClick={()=>setShowExp(!showExp)}><Icons.Download/> Export</button>
        {showExp&&<div className="exp-mn"><div className="exp-hd">Export {filtered.length} items</div><button onClick={()=>{exportCSV(filtered);setShowExp(false)}}><div><div style={{fontWeight:600}}>Download CSV</div><div style={{fontSize:11,color:"var(--tx3)"}}>Spreadsheet-ready</div></div></button><button onClick={()=>{exportPDF(filtered,catF==="All"?"All Categories":catF);setShowExp(false)}}><div><div style={{fontWeight:600}}>Print / PDF Report</div><div style={{fontSize:11,color:"var(--tx3)"}}>Formatted report</div></div></button></div>}
      </div>
    </div>
    <div className="tw"><table>
      <thead><tr><th style={{width:40}}><input type="checkbox" onChange={handleSelectAll} checked={selected.size===filtered.length&&filtered.length>0}/></th><th>Item</th><th>UPC</th><th>Category</th><th>Qty</th><th>Price</th><th>Expiry</th><th>Location</th><th>Status</th><th style={{width:50}}></th></tr></thead>
      <tbody>{filtered.map((item,idx)=>{const d=daysUntil(item.expiry);const st=d<=0?"expired":d<=7?"urgent":d<=30?"warning":"good";const qs=item.qty<=5?"low":item.qty<=15?"med":"good";return(
        <tr key={item.id} className="si" style={{animationDelay:`${idx*30}ms`}}><td><input type="checkbox" checked={selected.has(item.id)} onChange={()=>toggleSelect(item.id)}/></td><td style={{fontWeight:600}}>{item.name}</td><td style={{fontFamily:"monospace",fontSize:12,color:"var(--tx3)"}}>{item.upc}</td><td><span className="tag tag-bl">{item.category}</span></td><td><span className={`tag ${qs==="low"?"tag-rd":qs==="med"?"tag-yl":"tag-gn"}`}>{item.qty}</span></td><td>{fmtCurrency(item.price||0)}</td><td style={{fontSize:12}}>{fmt(item.expiry)}</td><td style={{fontSize:12,color:"var(--tx3)"}}>{item.location||"—"}</td><td>{st==="expired"?<span className="tag tag-rd">Expired</span>:st==="urgent"?<span className="tag tag-rd">{d}d</span>:st==="warning"?<span className="tag tag-yl">{d}d</span>:<span className="tag tag-gn">OK</span>}</td><td><button className="bt bt-gh bt-sm" onClick={()=>deleteItem(item.id)}><Icons.Trash/></button></td></tr>
      )})}</tbody>
    </table>{filtered.length===0&&<p style={{textAlign:"center",padding:40,color:"var(--tx3)"}}>No items found.</p>}</div>
  </div>);
}

function ScanPage({addItem, cats}) {
  const [upc,setUpc]=useState("");
  const [form,setForm]=useState({name:"",category:cats[0]||"",qty:1,price:"",expiry:"",location:""});
  const [msg,setMsg]=useState("");
  const [scanning,setScanning]=useState(false);
  const [scanError,setScanError]=useState("");
  const scannerRef=useRef(null);
  const scanRegionId="scan-region";

  const startScanner=async()=>{
    setScanError("");
    try {
      const html5Qr=new Html5Qrcode(scanRegionId);
      scannerRef.current=html5Qr;
      await html5Qr.start(
        {facingMode:"environment"},
        {fps:10,qrbox:{width:280,height:160},aspectRatio:1.5,formatsToSupport:["UPC_A","UPC_E","EAN_13","EAN_8","CODE_128","CODE_39","QR_CODE"]},
        (decodedText)=>{
          setUpc(decodedText);
          setMsg("Barcode scanned: "+decodedText);
          setTimeout(()=>setMsg(""),3000);
          html5Qr.stop().then(()=>{scannerRef.current=null;setScanning(false)}).catch(()=>{});
        },
        ()=>{}
      );
      setScanning(true);
    } catch(err) {
      console.error("Scanner error:",err);
      if(String(err).includes("NotAllowedError")){
        setScanError("Camera permission denied. Please allow camera access in your browser settings, or enter the UPC manually below.");
      } else if(String(err).includes("NotFoundError")){
        setScanError("No camera found on this device. Please enter the UPC manually below.");
      } else {
        setScanError("Could not start camera. Try entering the UPC manually below.");
      }
    }
  };

  const stopScanner=async()=>{
    if(scannerRef.current){
      try{await scannerRef.current.stop();scannerRef.current=null}catch(e){}
    }
    setScanning(false);
  };

  useEffect(()=>{return()=>{if(scannerRef.current){scannerRef.current.stop().catch(()=>{})}}},[]);

  const submit=()=>{
    if(!form.name){setMsg("Name is required");return;}
    addItem({upc:upc||"",name:form.name,category:form.category,qty:Number(form.qty),price:Number(form.price)||0,expiry:form.expiry||"2027-01-01",location:form.location,added_by:"Manager",added_date:new Date().toISOString().slice(0,10)});
    setMsg("Item added!");setUpc("");setForm({name:"",category:cats[0]||"",qty:1,price:"",expiry:"",location:""});
    setTimeout(()=>setMsg(""),2000);
  };

  return(<div className="fu" style={{maxWidth:600}}>
    <div className="cd" style={{marginBottom:20}}>
      <h3 className="cd-tt" style={{marginBottom:16}}>Barcode Scanner</h3>

      {!scanning ? (
        <div style={{background:"var(--bg)",borderRadius:"var(--r)",padding:30,textAlign:"center",border:"2px dashed var(--bd)"}}>
          <Icons.Scan/>
          <p style={{color:"var(--tx3)",fontSize:14,margin:"12px 0"}}>Scan a barcode with your camera or type the UPC below</p>
          <button className="bt bt-p" onClick={startScanner} style={{marginTop:8}}><Icons.Scan/> Open Camera Scanner</button>
          <div id={scanRegionId} style={{display:"none"}}></div>
        </div>
      ) : (
        <div>
          <div id={scanRegionId} style={{borderRadius:"var(--rs)",overflow:"hidden",marginBottom:12}}></div>
          <div style={{display:"flex",gap:8,justifyContent:"center"}}>
            <button className="bt bt-s bt-sm" onClick={stopScanner}>Stop Scanner</button>
          </div>
          <p style={{fontSize:12,color:"var(--tx3)",textAlign:"center",marginTop:8}}>Point your camera at a barcode. It will scan automatically.</p>
        </div>
      )}

      {scanError&&<div style={{marginTop:12,padding:12,background:"var(--yl-s)",borderRadius:8,fontSize:13,color:"var(--yl)"}}>{scanError}</div>}

      <div className="fg" style={{marginTop:16}}>
        <label className="fl">UPC Code</label>
        <input className="fi" value={upc} onChange={e=>setUpc(e.target.value)} placeholder="Scanned automatically or type manually"/>
      </div>
      {upc&&<div style={{padding:8,background:"var(--gn-s)",borderRadius:6,fontSize:13,color:"var(--gn)",fontWeight:600,textAlign:"center"}}>UPC: {upc}</div>}
    </div>

    <div className="cd"><h3 className="cd-tt" style={{marginBottom:16}}>Item Details</h3>
      <div className="fg"><label className="fl">Item Name *</label><input className="fi" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div className="fg"><label className="fl">Category</label><select className="fi" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{cats.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
        <div className="fg"><label className="fl">Quantity</label><input className="fi" type="number" min="1" value={form.qty} onChange={e=>setForm(f=>({...f,qty:e.target.value}))}/></div>
        <div className="fg"><label className="fl">Price ($)</label><input className="fi" type="number" step="0.01" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))}/></div>
        <div className="fg"><label className="fl">Expiry Date</label><input className="fi" type="date" value={form.expiry} onChange={e=>setForm(f=>({...f,expiry:e.target.value}))}/></div>
      </div>
      <div className="fg"><label className="fl">Location</label><input className="fi" value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} placeholder="e.g. Shelf A2"/></div>
      <button className="bt bt-p" style={{width:"100%",justifyContent:"center"}} onClick={submit}><Icons.Plus/> Add to Inventory</button>
      {msg&&<div style={{marginTop:10,padding:10,background:"var(--gn-s)",borderRadius:8,color:"var(--gn)",fontWeight:600,textAlign:"center",fontSize:13}}>{msg}</div>}
    </div>
  </div>);
}


function BagGoPage({inv, recip, setInv, triggerSync}) {
  const [fSize,setFSize]=useState(4);const [diet,setDiet]=useState("");const [selR,setSelR]=useState("");const [bag,setBag]=useState(null);const [packed,setPacked]=useState(false);
  useEffect(()=>{if(selR){const r=recip.find(r=>r.id===selR);if(r){setFSize(r.size||r.familySize||4);setDiet(r.dietary||r.dietaryNotes||"");}}},[selR,recip]);
  const gen=()=>{setBag(buildBag(inv,fSize,diet));setPacked(false)};
  const confirmPack=()=>{if(!bag)return;setInv(prev=>{const next=[...prev];bag.bag.forEach(b=>{const idx=next.findIndex(i=>i.id===b.id);if(idx>=0)next[idx]={...next[idx],qty:next[idx].qty-b.bagQty};});return next.filter(i=>i.qty>0);});setPacked(true);triggerSync()};
  const tBI=bag?bag.bag.reduce((s,i)=>s+i.bagQty,0):0;const tBV=bag?bag.bag.reduce((s,i)=>s+i.bagQty*(i.price||0),0):0;
  return(<div className="fu">
    <div className="bag-hero"><h2>Bag & Go</h2><p>Smart packing based on family size, dietary needs & FIFO rotation</p>
      <div className="bag-cfg"><div className="fg" style={{minWidth:180}}><label className="fl">Recipient (optional)</label><select className="fi" value={selR} onChange={e=>setSelR(e.target.value)}><option value="">— Custom —</option>{recip.map(r=><option key={r.id} value={r.id}>{r.name} ({r.size||r.familySize||"?"})</option>)}</select></div><div className="fg" style={{minWidth:100}}><label className="fl">Family Size</label><input className="fi" type="number" min="1" max="15" value={fSize} onChange={e=>setFSize(Number(e.target.value))}/></div><div className="fg" style={{minWidth:200}}><label className="fl">Dietary Notes</label><input className="fi" value={diet} onChange={e=>setDiet(e.target.value)} placeholder="Vegetarian, Nut allergy..."/></div><button className="bt" style={{background:"#fff",color:"var(--acc2)",fontWeight:700,height:42,marginBottom:14}} onClick={gen}>Generate Bag</button></div>
    </div>
    {bag&&<div className="fu"><div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:16}}>
      <div className="cd" style={{flex:1,minWidth:150,textAlign:"center"}}><div className="lb">Items</div><div className="vl">{tBI}</div></div>
      <div className="cd" style={{flex:1,minWidth:150,textAlign:"center"}}><div className="lb">Value</div><div className="vl" style={{color:"var(--gn)"}}>{fmtCurrency(tBV)}</div></div>
      <div className="cd" style={{flex:1,minWidth:150,textAlign:"center"}}><div className="lb">FIFO Items</div><div className="vl" style={{color:"var(--yl)"}}>{bag.bag.filter(i=>i.fifo).length}</div></div>
    </div>
    <div className="tw" style={{marginTop:16}}><table><thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>FIFO</th></tr></thead><tbody>{bag.bag.map((item,i)=>(<tr key={i} style={item.fifo?{background:"var(--yl-s)"}:{}}><td style={{fontWeight:600}}>{item.name}{item.optional?" (optional)":""}</td><td><span className="tag tag-bl">{item.category}</span></td><td>{item.bagQty}</td><td>{item.fifo?<span className="tag tag-yl">Use First</span>:<span className="tag tag-gn">OK</span>}</td></tr>))}</tbody></table></div>
    {bag.unmet.length>0&&<div style={{marginTop:12,padding:14,background:"var(--rd-s)",borderRadius:8,fontSize:13,color:"var(--rd)"}}><strong>Gaps:</strong> {bag.unmet.map(u=>`${u.category} (need ${u.needed} more)`).join(", ")}</div>}
    {!packed?<button className="bt bt-gn" style={{width:"100%",justifyContent:"center",marginTop:16,padding:"14px 24px",fontSize:15}} onClick={confirmPack}><Icons.Bag/> Confirm & Pack Bag</button>:<div style={{marginTop:16,padding:20,background:"var(--gn-s)",borderRadius:12,textAlign:"center",color:"var(--gn)",fontWeight:600,fontSize:16}}>Bag packed! Inventory updated.</div>}
    </div>}
  </div>);
}

function DonorsPage({donors}){return(<div className="fu"><div className="sg"><div className="sc good"><div className="lb">Total Donors</div><div className="vl">{donors.length}</div></div><div className="sc"><div className="lb">Total Donations</div><div className="vl">{donors.reduce((s,d)=>s+(d.donations||d.totalDonations||0),0)}</div></div><div className="sc"><div className="lb">Total Value</div><div className="vl">{fmtCurrency(donors.reduce((s,d)=>s+(d.total||d.totalValue||0),0))}</div></div></div><div className="tw"><table><thead><tr><th>Donor</th><th>Donations</th><th>Total Value</th></tr></thead><tbody>{donors.map(d=>(<tr key={d.id}><td style={{fontWeight:600}}>{d.name}</td><td>{d.donations||d.totalDonations||0}</td><td style={{fontWeight:700,color:"var(--gn)"}}>{fmtCurrency(d.total||d.totalValue||0)}</td></tr>))}</tbody></table>{donors.length===0&&<p style={{textAlign:"center",padding:40,color:"var(--tx3)"}}>No donors yet.</p>}</div></div>);}

function RecipientsPage({recip}){return(<div className="fu"><div className="sg"><div className="sc good"><div className="lb">Families Served</div><div className="vl">{recip.length}</div></div><div className="sc"><div className="lb">People Served</div><div className="vl">{recip.reduce((s,r)=>s+(r.size||1),0)}</div></div></div><div className="tw"><table><thead><tr><th>Recipient</th><th>Family Size</th><th>Dietary Notes</th></tr></thead><tbody>{recip.map(r=>(<tr key={r.id}><td style={{fontWeight:600}}>{r.name}</td><td>{r.size||1}</td><td>{r.dietary||r.dietaryNotes||<span style={{color:"var(--tx3)"}}>None</span>}</td></tr>))}</tbody></table>{recip.length===0&&<p style={{textAlign:"center",padding:40,color:"var(--tx3)"}}>No recipients yet.</p>}</div></div>);}

function DiscussionPage({messages, addMessage, addReply}) {
  const [newMsg,setNewMsg]=useState("");const [replyTo,setReplyTo]=useState(null);const [replyTx,setReplyTx]=useState("");
  const submit=()=>{if(newMsg.trim()){addMessage(newMsg.trim());setNewMsg("");}};
  const submitReply=(id)=>{if(replyTx.trim()){addReply(id,replyTx.trim());setReplyTx("");setReplyTo(null);}};
  return(<div className="fu" style={{maxWidth:700}}>
    <div className="cd" style={{marginBottom:24}}><textarea className="fi" placeholder="Share an update, need, or note..." value={newMsg} onChange={e=>setNewMsg(e.target.value)} style={{marginBottom:12}}/><button className="bt bt-p" onClick={submit}><Icons.Chat/> Post Message</button></div>
    {messages.map(m=>(<div key={m.id} className="msg-cd si"><div className="msg-hd"><div className="avatar">{(m.author||"?").split(" ").map(n=>n[0]).join("")}</div><div><div className="msg-au">{m.author}</div><div className="msg-rl">{m.role||""}</div></div><div className="msg-tm">{fmt(m.date||m.time)}</div></div><div className="msg-tx">{m.body||m.text}</div>
      {(m.replies||[]).length>0&&<div className="replies">{m.replies.map((r,ri)=>(<div key={ri} className="reply"><div className="avatar">{(r.author||"?").split(" ").map(n=>n[0]).join("")}</div><div><div style={{fontWeight:600,fontSize:12}}>{r.author}</div><div style={{fontSize:13,color:"var(--tx2)",marginTop:2}}>{r.body||r.text}</div><div style={{fontSize:10,color:"var(--tx3)",marginTop:2}}>{fmt(r.date||r.time)}</div></div></div>))}</div>}
      <div style={{marginTop:12}}>{replyTo===m.id?<div style={{display:"flex",gap:8}}><input className="fi" placeholder="Reply..." value={replyTx} onChange={e=>setReplyTx(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")submitReply(m.id)}}/><button className="bt bt-p bt-sm" onClick={()=>submitReply(m.id)}>Reply</button><button className="bt bt-gh bt-sm" onClick={()=>{setReplyTo(null);setReplyTx("")}}>Cancel</button></div>:<button className="bt bt-gh bt-sm" onClick={()=>setReplyTo(m.id)}>Reply</button>}</div>
    </div>))}
    {messages.length===0&&<div className="cd" style={{textAlign:"center",padding:40,color:"var(--tx3)"}}>No discussions yet. Start the conversation!</div>}
  </div>);
}

function AlertsPage({notifs}){return(<div className="fu" style={{maxWidth:700}}>{notifs.length===0&&<div className="cd" style={{textAlign:"center",padding:40,color:"var(--tx3)"}}>No alerts — everything looks great!</div>}{notifs.map((n,i)=>(<div key={i} className={`nf ${n.type}`}><div className="nf-icon"><Icons.Alert/></div><div><div className="nf-tt">{n.title}</div><div className="nf-ds">{n.desc}</div></div></div>))}</div>);}

function AnalyticsPage({inv, donors}) {
  const byCat={};inv.forEach(i=>{byCat[i.category]=(byCat[i.category]||0)+i.qty});const catEntries=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);const maxQty=catEntries[0]?.[1]||1;const totalVal=inv.reduce((s,i)=>s+i.qty*(i.price||0),0);
  return(<div className="fu"><div className="sg"><div className="sc good"><div className="lb">Products</div><div className="vl">{inv.length}</div></div><div className="sc"><div className="lb">Donors</div><div className="vl">{donors.length}</div></div><div className="sc"><div className="lb">Total Value</div><div className="vl">{fmtCurrency(totalVal)}</div></div><div className="sc"><div className="lb">Categories</div><div className="vl">{Object.keys(byCat).length}</div></div></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
      <div className="cd"><h3 className="cd-tt" style={{marginBottom:14}}>Inventory by Category</h3>{catEntries.map(([cat,qty])=>(<div key={cat} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:600,marginBottom:3}}><span>{cat}</span><span>{qty}</span></div><div style={{height:8,background:"var(--bg2)",borderRadius:4,overflow:"hidden"}}><div style={{width:`${(qty/maxQty)*100}%`,height:"100%",background:"var(--acc2)",borderRadius:4,transition:"width .5s"}}/></div></div>))}</div>
      <div className="cd"><h3 className="cd-tt" style={{marginBottom:14}}>Expiration Timeline</h3>{[{l:"Expired",c:inv.filter(i=>daysUntil(i.expiry)<=0).length,cl:"var(--rd)"},{l:"Within 7 Days",c:inv.filter(i=>{const d=daysUntil(i.expiry);return d>0&&d<=7}).length,cl:"var(--rd)"},{l:"Within 30 Days",c:inv.filter(i=>{const d=daysUntil(i.expiry);return d>7&&d<=30}).length,cl:"var(--yl)"},{l:"30+ Days",c:inv.filter(i=>daysUntil(i.expiry)>30).length,cl:"var(--gn)"}].map(row=>(<div key={row.l} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid var(--bd)"}}><div style={{width:10,height:10,borderRadius:3,background:row.cl,flexShrink:0}}/><span style={{flex:1,fontSize:13,fontWeight:500}}>{row.l}</span><span style={{fontWeight:700,fontSize:16}}>{row.c}</span></div>))}</div>
    </div>
  </div>);
}

function SettingsPage({emailFreq, setEmailFreq, syncStatus, triggerSync, cats, addCat, renameCat, deleteCat, inv}) {
  const [newCat,setNewCat]=useState("");const [editCat,setEditCat]=useState(null);const [editVal,setEditVal]=useState("");
  return(<div className="fu" style={{maxWidth:600}}>
    <div className="cd" style={{marginBottom:20}}><h3 className="cd-tt" style={{marginBottom:4}}>Cloud Sync</h3><p style={{fontSize:13,color:"var(--tx3)",marginBottom:16}}>Data syncs with Supabase cloud database</p>
      <div style={{display:"flex",gap:12,alignItems:"center"}}><div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:syncStatus==="synced"?"var(--gn)":"var(--tx3)",padding:"8px 14px",borderRadius:"var(--rs)",background:syncStatus==="synced"?"var(--gn-s)":"var(--bg2)"}}><Icons.Sync spinning={syncStatus==="syncing"}/>{syncStatus==="synced"?"All data synced":"Syncing..."}</div><button className="bt bt-s bt-sm" onClick={triggerSync}>Force Sync</button></div>
    </div>
    <div className="cd" style={{marginBottom:20}}>
      <h3 className="cd-tt" style={{marginBottom:4}}>Manage Categories</h3><p style={{fontSize:13,color:"var(--tx3)",marginBottom:16}}>Add, rename, or remove inventory categories</p>
      <div style={{display:"flex",gap:8,marginBottom:16}}><input className="fi" value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="New category name..." onKeyDown={e=>e.key==="Enter"&&newCat.trim()&&(addCat(newCat.trim()),setNewCat(""))} style={{maxWidth:280}}/><button className="bt bt-p bt-sm" onClick={()=>{if(newCat.trim()){addCat(newCat.trim());setNewCat("");}}}><Icons.Plus/> Add</button></div>
      {cats.map(c=>{const count=inv.filter(i=>i.category===c).length;return(<div key={c} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",border:"1px solid var(--bd)",borderRadius:8,marginBottom:6,background:"var(--bg3)"}}>
        {editCat===c?(<><input className="fi" value={editVal} onChange={e=>setEditVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&editVal.trim()&&(renameCat(c,editVal.trim()),setEditCat(null))} style={{flex:1,padding:"5px 10px"}} autoFocus/><button className="bt bt-gh bt-sm" onClick={()=>{if(editVal.trim()){renameCat(c,editVal.trim());setEditCat(null)}}}>Save</button><button className="bt bt-gh bt-sm" onClick={()=>setEditCat(null)}>Cancel</button></>):(<><span style={{flex:1,fontSize:13,fontWeight:500}}>{c}</span><span style={{fontSize:11,color:"var(--tx3)"}}>{count} items</span><button className="bt bt-gh bt-sm" onClick={()=>{setEditCat(c);setEditVal(c)}}><Icons.Edit/></button><button className="bt bt-gh bt-sm" style={{color:"var(--rd)"}} onClick={()=>deleteCat(c)}><Icons.Trash/></button></>)}
      </div>)})}
    </div>
    <div className="cd" style={{marginBottom:20}}><h3 className="cd-tt" style={{marginBottom:4}}>Email Reports</h3><p style={{fontSize:13,color:"var(--tx3)",marginBottom:16}}>Receive pantry summary reports by email</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{[{key:"biweekly",label:"Bi-Weekly",desc:"Every 2 weeks"},{key:"monthly",label:"Monthly",desc:"1st of each month"}].map(opt=>(<div key={opt.key} style={{padding:14,border:`2px solid ${emailFreq===opt.key?"var(--acc2)":"var(--bd)"}`,borderRadius:"var(--rs)",cursor:"pointer",textAlign:"center",background:emailFreq===opt.key?"var(--acc-s)":"transparent"}} onClick={()=>setEmailFreq(opt.key)}><div style={{fontWeight:700,fontSize:14}}>{opt.label}</div><div style={{fontSize:11,color:"var(--tx3)",marginTop:4}}>{opt.desc}</div></div>))}</div>
    </div>
    <div className="cd" style={{marginBottom:20}}><h3 className="cd-tt" style={{marginBottom:4}}>Shared Access</h3><p style={{fontSize:13,color:"var(--tx3)",marginBottom:16}}>Invite team members to manage the pantry</p>
      <div className="fg"><label className="fl">Email Address</label><input className="fi" placeholder="volunteer@email.com"/></div>
      <div className="fg"><label className="fl">Role</label><select className="fi"><option>Manager</option><option>Volunteer</option><option>Viewer</option></select></div>
      <button className="bt bt-p" style={{width:"100%",justifyContent:"center"}}><Icons.Share/> Send Invitation</button>
    </div>
  </div>);
}

// ── Modals ──
function AddItemModal({onClose, onAdd, cats}) {
  const [form,setForm]=useState({upc:"",name:"",category:cats[0]||"",qty:1,price:"",expiry:"",location:""});
  const submit=()=>{if(!form.name)return;onAdd({upc:form.upc,name:form.name,category:form.category||cats[0],qty:Number(form.qty),price:Number(form.price)||0,expiry:form.expiry||"2027-01-01",location:form.location,added_by:"Manager",added_date:new Date().toISOString().slice(0,10)});onClose()};
  return(<div className="mo" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-hd"><h3>Add Item</h3><button className="modal-cl" onClick={onClose}>×</button></div><div className="modal-bd">
    <div className="fg"><label className="fl">UPC Code</label><input className="fi" value={form.upc} onChange={e=>setForm(f=>({...f,upc:e.target.value}))}/></div>
    <div className="fg"><label className="fl">Item Name *</label><input className="fi" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div className="fg"><label className="fl">Category</label><select className="fi" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{cats.map(c=><option key={c} value={c}>{c}</option>)}</select></div><div className="fg"><label className="fl">Quantity</label><input className="fi" type="number" min="1" value={form.qty} onChange={e=>setForm(f=>({...f,qty:e.target.value}))}/></div><div className="fg"><label className="fl">Price ($)</label><input className="fi" type="number" step="0.01" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))}/></div><div className="fg"><label className="fl">Expiry Date</label><input className="fi" type="date" value={form.expiry} onChange={e=>setForm(f=>({...f,expiry:e.target.value}))}/></div></div>
    <div className="fg"><label className="fl">Location</label><input className="fi" value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} placeholder="e.g. Shelf A2"/></div>
    <button className="bt bt-p" style={{width:"100%",justifyContent:"center"}} onClick={submit}><Icons.Plus/> Add Item</button>
  </div></div></div>);
}

function AddDonorModal({onClose, onAdd}) {
  const [form,setForm]=useState({name:"",contact:""});
  return(<div className="mo" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-hd"><h3>Add Donor</h3><button className="modal-cl" onClick={onClose}>×</button></div><div className="modal-bd">
    <div className="fg"><label className="fl">Donor Name *</label><input className="fi" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
    <div className="fg"><label className="fl">Contact</label><input className="fi" value={form.contact} onChange={e=>setForm(f=>({...f,contact:e.target.value}))}/></div>
    <button className="bt bt-p" style={{width:"100%",justifyContent:"center"}} onClick={()=>{if(form.name){onAdd(form);onClose();}}}><Icons.Plus/> Add Donor</button>
  </div></div></div>);
}

function AddRecipientModal({onClose, onAdd}) {
  const [form,setForm]=useState({name:"",size:1,dietary:""});
  return(<div className="mo" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-hd"><h3>Add Recipient</h3><button className="modal-cl" onClick={onClose}>×</button></div><div className="modal-bd">
    <div className="fg"><label className="fl">Name *</label><input className="fi" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
    <div className="fg"><label className="fl">Family Size</label><input className="fi" type="number" min="1" value={form.size} onChange={e=>setForm(f=>({...f,size:e.target.value}))}/></div>
    <div className="fg"><label className="fl">Dietary Notes</label><input className="fi" value={form.dietary} onChange={e=>setForm(f=>({...f,dietary:e.target.value}))} placeholder="e.g. Nut allergy, Vegetarian"/></div>
    <button className="bt bt-p" style={{width:"100%",justifyContent:"center"}} onClick={()=>{if(form.name){onAdd({...form,size:Number(form.size)});onClose();}}}><Icons.Plus/> Add Recipient</button>
  </div></div></div>);
}

function BulkEditModal({onClose, selected, inv, setInv, setSelected, triggerSync, cats}) {
  const [cat,setCat]=useState("");const [loc,setLoc]=useState("");
  const apply=()=>{setInv(prev=>prev.map(i=>{if(!selected.has(i.id))return i;const u={...i};if(cat)u.category=cat;if(loc)u.location=loc;return u}));setSelected(new Set());triggerSync();onClose()};
  return(<div className="mo" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-hd"><h3>Bulk Edit ({selected.size} items)</h3><button className="modal-cl" onClick={onClose}>×</button></div><div className="modal-bd">
    <p style={{fontSize:13,color:"var(--tx2)",marginBottom:16}}>Leave a field empty to keep existing values.</p>
    <div className="fg"><label className="fl">Change Category</label><select className="fi" value={cat} onChange={e=>setCat(e.target.value)}><option value="">— Keep Existing —</option>{cats.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
    <div className="fg"><label className="fl">Change Location</label><input className="fi" value={loc} onChange={e=>setLoc(e.target.value)} placeholder="e.g. Shelf B2"/></div>
    <button className="bt bt-p" style={{width:"100%",justifyContent:"center"}} onClick={apply}><Icons.Edit/> Apply Changes</button>
  </div></div></div>);
}

// ═══════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════
export default function ChurchPantry() {
  const [page,setPage]=useState("dashboard");
  const [inv,setInv]=useState([]);
  const [cats,setCats]=useState(["Canned Goods","Grains & Pasta","Dairy","Produce","Meat & Protein","Snacks","Beverages","Baby & Infant","Hygiene","Condiments","Baking","Frozen"]);
  const [donors,setDonors]=useState([]);
  const [recip,setRecip]=useState([]);
  const [messages,setMessages]=useState([]);
  const [selected,setSelected]=useState(new Set());
  const [search,setSearch]=useState("");
  const [modal,setModal]=useState(null);
  const [syncStatus,setSyncStatus]=useState("synced");
  const [emailFreq,setEmailFreq]=useState("monthly");
  const [loading,setLoading]=useState(true);
  const [sbOpen,setSbOpen]=useState(false);

  useEffect(()=>{async function load(){setLoading(true);
    try{const{data}=await supabase.from("inventory").select("*");if(data)setInv(data)}catch(e){}
    try{const{data}=await supabase.from("categories").select("*");if(data&&data.length>0)setCats(data.map(c=>c.name).sort())}catch(e){}
    try{const{data}=await supabase.from("donors").select("*");if(data)setDonors(data)}catch(e){}
    try{const{data}=await supabase.from("recipients").select("*");if(data)setRecip(data)}catch(e){}
    try{const{data}=await supabase.from("messages").select("*");if(data)setMessages(data)}catch(e){}
    setLoading(false)}; load()},[]);

  const triggerSync=async()=>{setSyncStatus("syncing");try{const{data}=await supabase.from("inventory").select("*");if(data)setInv(data)}catch(e){}setSyncStatus("synced")};

  const notifs=useMemo(()=>{const n=[];inv.forEach(i=>{const d=daysUntil(i.expiry);if(d<=0)n.push({type:"urgent",title:`EXPIRED: ${i.name}`,desc:`Expired ${Math.abs(d)} days ago.`});else if(d<=7)n.push({type:"urgent",title:`Expiring in ${d} days: ${i.name}`,desc:`${i.qty} units expire ${fmt(i.expiry)}.`});else if(d<=30)n.push({type:"warning",title:`Expiring soon: ${i.name}`,desc:`${i.qty} units expire ${fmt(i.expiry)}.`})});inv.forEach(i=>{if(i.qty<=5&&i.qty>0)n.push({type:"warning",title:`Low stock: ${i.name}`,desc:`Only ${i.qty} units remaining.`})});return n},[inv]);

  const filteredInv=inv.filter(i=>i.name.toLowerCase().includes(search.toLowerCase())||(i.upc&&i.upc.includes(search))||i.category.toLowerCase().includes(search.toLowerCase()));
  const totalVal=inv.reduce((s,i)=>s+i.qty*(i.price||0),0);
  const totalItems=inv.reduce((s,i)=>s+i.qty,0);

  const handleSelectAll=(e)=>{if(e.target.checked)setSelected(new Set(filteredInv.map(i=>i.id)));else setSelected(new Set())};
  const toggleSelect=(id)=>{const next=new Set(selected);next.has(id)?next.delete(id):next.add(id);setSelected(next)};
  const bulkDelete=async()=>{const ids=[...selected];for(const id of ids){await supabase.from("inventory").delete().eq("id",id)}setInv(p=>p.filter(i=>!selected.has(i.id)));setSelected(new Set())};
  const addItem=async(item)=>{const{data}=await supabase.from("inventory").insert([item]).select();if(data)setInv(p=>[...p,...data]);setModal(null);triggerSync()};
  const deleteItem=async(id)=>{await supabase.from("inventory").delete().eq("id",id);setInv(p=>p.filter(i=>i.id!==id));triggerSync()};
  const addDonor=async(d)=>{const donor={name:d.name,contact:d.contact||"",donations:0,total:0};const{data}=await supabase.from("donors").insert([donor]).select();if(data)setDonors(p=>[...p,...data]);setModal(null)};
  const addRecip=async(r)=>{const rec={name:r.name,size:r.size||1,dietary:r.dietary||""};const{data}=await supabase.from("recipients").insert([rec]).select();if(data)setRecip(p=>[...p,...data]);setModal(null)};
  const addMessage=async(text)=>{const msg={author:"You",body:text,date:new Date().toISOString().slice(0,10),replies:[]};const{data}=await supabase.from("messages").insert([msg]).select();if(data)setMessages(p=>[...data,...p]);else setMessages(p=>[{id:uid(),author:"You",body:text,date:new Date().toISOString().slice(0,10),replies:[]},...p])};
  const addReply=(msgId,text)=>{setMessages(p=>p.map(m=>m.id===msgId?{...m,replies:[...(m.replies||[]),{id:uid(),author:"You",body:text,date:new Date().toISOString().slice(0,10)}]}:m))};
  const addCat=async(name)=>{const{data}=await supabase.from("categories").insert([{name}]).select();if(data)setCats(p=>[...p,name].sort())};
  const renameCat=async(old,nw)=>{await supabase.from("categories").update({name:nw}).eq("name",old);await supabase.from("inventory").update({category:nw}).eq("category",old);setCats(p=>p.map(c=>c===old?nw:c).sort());setInv(p=>p.map(i=>i.category===old?{...i,category:nw}:i))};
  const deleteCat=async(name)=>{const ct=inv.filter(i=>i.category===name).length;if(ct>0){alert(`Cannot delete "${name}" — ${ct} items still use this category.`);return}await supabase.from("categories").delete().eq("name",name);setCats(p=>p.filter(c=>c!==name))};

  const navItems=[
    {key:"dashboard",label:"Dashboard",icon:<Icons.Home/>,sec:"Main"},
    {key:"inv",label:"Inventory",icon:<Icons.Package/>,sec:"Main"},
    {key:"scan",label:"Scan & Add",icon:<Icons.Scan/>,sec:"Main"},
    {key:"bag",label:"Bag & Go",icon:<Icons.Bag/>,sec:"Main"},
    {key:"donors",label:"Donors",icon:<Icons.Heart/>,sec:"Community"},
    {key:"recip",label:"Recipients",icon:<Icons.Users/>,sec:"Community"},
    {key:"discussion",label:"Discussion",icon:<Icons.Chat/>,sec:"Community"},
    {key:"alerts",label:"Alerts",icon:<Icons.Bell/>,sec:"Alerts",badge:notifs.filter(n=>n.type==="urgent").length||null},
    {key:"analytics",label:"Analytics",icon:<Icons.Chart/>,sec:"System"},
    {key:"settings",label:"Settings",icon:<Icons.Gear/>,sec:"System"},
  ];
  const pageTitle=navItems.find(n=>n.key===page)?.label||"Dashboard";
  const goPage=(p)=>{setPage(p);setSelected(new Set());setSbOpen(false)};

  if(loading)return(<><style>{CSS}</style><div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"var(--bg)",fontFamily:"var(--ft)"}}><div style={{textAlign:"center"}}>
    <div className="sb-logo" style={{margin:"0 auto 16px",width:64,height:64,borderRadius:14,background:"var(--acc-s)",border:"2px dashed var(--acc2)",color:"var(--acc2)",fontSize:24}}>CP</div>
    <div style={{fontFamily:"var(--hd)",fontSize:28,color:"var(--acc)",marginBottom:8}}>Church Pantry</div><div style={{color:"var(--tx3)"}}>Loading inventory...</div></div></div></>);

  let curSec="";
  return(<>
    <style>{CSS}</style>
    <div className="app">
      {sbOpen&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.3)",zIndex:99}} onClick={()=>setSbOpen(false)}/>}
      <aside className="sb" style={sbOpen?{transform:"translateX(0)",position:"fixed",zIndex:100}:{}}>
        <div className="sb-hd">
          <div className="sb-logo">CP</div>
          <h1>Church Pantry</h1>
          <p>Inventory Management</p>
        </div>
        <nav className="sb-nav">
          {navItems.map(n=>{let sec=null;if(n.sec!==curSec){curSec=n.sec;sec=<div key={`s-${n.sec}`} className="sb-sec">{n.sec}</div>}return(<div key={n.key}>{sec}<div className={`ni ${page===n.key?"ac":""}`} onClick={()=>goPage(n.key)}>{n.icon}<span>{n.label}</span>{n.badge&&<span className="badge">{n.badge}</span>}</div></div>)})}
        </nav>
        <div className="sb-ft"><div className="sync-bar" onClick={triggerSync}><span className="sync-dot"/><Icons.Sync spinning={syncStatus==="syncing"}/>{syncStatus==="synced"?"Cloud synced":"Syncing..."}</div></div>
      </aside>

      <main className="mn">
        <div className="mob-hd"><button style={{background:"none",border:"none",cursor:"pointer"}} onClick={()=>setSbOpen(true)}><Icons.Menu/></button><h1>Church Pantry</h1><div style={{width:22}}/></div>
        <div className="topbar">
          <h2>{pageTitle}</h2>
          <div className="topbar-act">
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:syncStatus==="synced"?"var(--gn)":"var(--tx3)",padding:"6px 12px",borderRadius:"var(--rs)",background:syncStatus==="synced"?"var(--gn-s)":"var(--bg2)",cursor:"pointer"}} onClick={triggerSync}><Icons.Sync spinning={syncStatus==="syncing"}/>{syncStatus==="synced"?"Synced":"Syncing..."}</div>
            {page==="inv"&&<><button className="bt bt-s bt-sm" onClick={()=>setModal("bulkEdit")}>Bulk Edit</button><button className="bt bt-p bt-sm" onClick={()=>setModal("addItem")}><Icons.Plus/> Add Item</button></>}
            {page==="donors"&&<button className="bt bt-p bt-sm" onClick={()=>setModal("addDonor")}><Icons.Plus/> Add Donor</button>}
            {page==="recip"&&<button className="bt bt-p bt-sm" onClick={()=>setModal("addRecip")}><Icons.Plus/> Add Recipient</button>}
          </div>
        </div>
        <div className="content">
          {page==="dashboard"&&<Dashboard inv={inv} donors={donors} notifs={notifs} totalVal={totalVal} totalItems={totalItems} setPage={goPage}/>}
          {page==="inv"&&<InventoryPage inv={filteredInv} cats={cats} search={search} setSearch={setSearch} selected={selected} handleSelectAll={handleSelectAll} toggleSelect={toggleSelect} deleteItem={deleteItem} setModal={setModal}/>}
          {page==="scan"&&<ScanPage addItem={addItem} cats={cats}/>}
          {page==="bag"&&<BagGoPage inv={inv} recip={recip} setInv={setInv} triggerSync={triggerSync}/>}
          {page==="donors"&&<DonorsPage donors={donors}/>}
          {page==="recip"&&<RecipientsPage recip={recip}/>}
          {page==="discussion"&&<DiscussionPage messages={messages} addMessage={addMessage} addReply={addReply}/>}
          {page==="alerts"&&<AlertsPage notifs={notifs}/>}
          {page==="analytics"&&<AnalyticsPage inv={inv} donors={donors}/>}
          {page==="settings"&&<SettingsPage emailFreq={emailFreq} setEmailFreq={setEmailFreq} syncStatus={syncStatus} triggerSync={triggerSync} cats={cats} addCat={addCat} renameCat={renameCat} deleteCat={deleteCat} inv={inv}/>}
        </div>
        {selected.size>0&&<div className="bulk-bar"><span>{selected.size} item{selected.size>1?"s":""} selected</span><button className="bt bt-s bt-sm" onClick={()=>setModal("bulkEdit")}><Icons.Edit/> Bulk Edit</button><button className="bt bt-d bt-sm" onClick={bulkDelete}><Icons.Trash/> Delete</button><div style={{flex:1}}/><button className="bt bt-gh bt-sm" style={{color:"#fff"}} onClick={()=>setSelected(new Set())}>Cancel</button></div>}
      </main>
      <nav className="mob-nav">{[{k:"dashboard",i:<Icons.Home/>,l:"Dashboard"},{k:"inv",i:<Icons.Package/>,l:"Inventory"},{k:"bag",i:<Icons.Bag/>,l:"Bag & Go"},{k:"discussion",i:<Icons.Chat/>,l:"Discussion"},{k:"alerts",i:<Icons.Bell/>,l:"Alerts"}].map(n=>(<button key={n.k} className={page===n.k?"ac":""} onClick={()=>goPage(n.k)}>{n.i}<span>{n.l}</span></button>))}</nav>
    </div>

    {modal==="addItem"&&<AddItemModal onClose={()=>setModal(null)} onAdd={addItem} cats={cats}/>}
    {modal==="addDonor"&&<AddDonorModal onClose={()=>setModal(null)} onAdd={addDonor}/>}
    {modal==="addRecip"&&<AddRecipientModal onClose={()=>setModal(null)} onAdd={addRecip}/>}
    {modal==="bulkEdit"&&<BulkEditModal onClose={()=>setModal(null)} selected={selected} inv={inv} setInv={setInv} setSelected={setSelected} triggerSync={triggerSync} cats={cats}/>}
  </>);
}
