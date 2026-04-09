import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "../lib/supabase";

const CATEGORIES = ["Canned Goods","Grains & Pasta","Dairy","Produce","Meat & Protein","Snacks","Beverages","Baby & Infant","Hygiene","Condiments","Baking","Frozen"];

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

const I = {
  Home: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Pkg: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Scan: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>,
  Heart: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Chat: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Bell: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Chart: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Warn: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Trash: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  Edit: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Bag: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  Gear: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Sync: ({spin}) => <svg className={spin?"sp":""} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/><path d="M2.5 11.5a10 10 0 0 1 16.5-5.7L21.5 8"/><path d="M21.5 12.5a10 10 0 0 1-16.5 5.7L2.5 16"/></svg>,
  Share: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  Mail: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  Check: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Source+Sans+3:wght@400;500;600;700&display=swap');
:root{
  --bg:#F8F5F0;--bg2:#EDE8E0;--bg3:#FFFFFF;--tx:#1F1108;--tx2:#5E4B37;--tx3:#9A8A7B;
  --acc:#BF4E1F;--acc2:#D4682F;--acc-s:#FFF0E8;
  --gn:#3B7A3E;--gn-s:#E6F4E7;--yl:#B8932A;--yl-s:#FFF8E1;--rd:#C42C2C;--rd-s:#FFEBEE;--bl:#2A68BF;--bl-s:#E3F2FD;
  --bdr:#DDD3C6;--sh:0 2px 10px rgba(31,17,8,.06);--sh2:0 8px 30px rgba(31,17,8,.1);
  --r:12px;--rs:8px;--hd:'Playfair Display',serif;--bd:'Source Sans 3',sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box}
@keyframes fu{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes si{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
@keyframes sp{to{transform:rotate(360deg)}}
@keyframes pu{0%,100%{opacity:1}50%{opacity:.4}}
.fu{animation:fu .4s ease-out both}.si{animation:si .3s ease-out both}.sp{animation:sp 1.5s linear infinite}

.app{display:flex;min-height:100vh;font-family:var(--bd);color:var(--tx);background:var(--bg)}
.sb{width:256px;background:#1F1108;color:#fff;position:fixed;top:0;left:0;height:100vh;display:flex;flex-direction:column;z-index:100}
.sb-h{padding:26px 22px 18px;border-bottom:1px solid rgba(255,255,255,.07)}
.sb-h h1{font-family:var(--hd);font-size:21px;letter-spacing:-.3px}
.sb-h p{font-size:10px;color:rgba(255,255,255,.35);margin-top:3px;text-transform:uppercase;letter-spacing:1px}
.sb-n{flex:1;padding:14px 10px;overflow-y:auto}
.ni{display:flex;align-items:center;gap:11px;padding:10px 13px;border-radius:var(--rs);cursor:pointer;font-size:13px;font-weight:500;color:rgba(255,255,255,.5);transition:all .2s;margin-bottom:1px;border:none;background:none;width:100%;text-align:left}
.ni:hover{color:rgba(255,255,255,.85);background:rgba(255,255,255,.06)}
.ni.ac{color:#fff;background:var(--acc)}
.ni .bd{margin-left:auto;background:var(--rd);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px}
.ns{font-size:9px;text-transform:uppercase;letter-spacing:1.2px;color:rgba(255,255,255,.2);padding:18px 13px 6px}
.sb-f{padding:14px 10px;border-top:1px solid rgba(255,255,255,.07)}
.sy{display:flex;align-items:center;gap:7px;padding:8px 13px;border-radius:var(--rs);background:rgba(255,255,255,.04);font-size:11px;color:rgba(255,255,255,.45);cursor:pointer;border:none;width:100%}
.sy:hover{background:rgba(255,255,255,.08)}
.sd{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.sd.ok{background:var(--gn)}.sd.pg{background:var(--yl);animation:pu 1.5s infinite}.sd.off{background:var(--rd)}

.mn{flex:1;margin-left:256px;min-height:100vh}
.tb{position:sticky;top:0;z-index:50;background:rgba(248,245,240,.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--bdr);padding:14px 32px;display:flex;align-items:center;justify-content:space-between}
.tb h2{font-family:var(--hd);font-size:22px}
.ta{display:flex;gap:8px;align-items:center}
.ct{padding:24px 32px 100px}

.bt{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:var(--rs);font-family:var(--bd);font-size:13px;font-weight:600;cursor:pointer;border:none;transition:all .15s}
.bt-p{background:var(--acc);color:#fff}.bt-p:hover{background:var(--acc2);transform:translateY(-1px);box-shadow:var(--sh)}
.bt-s{background:var(--bg2);color:var(--tx);border:1px solid var(--bdr)}.bt-s:hover{border-color:var(--tx3)}
.bt-g{background:transparent;color:var(--tx2)}.bt-g:hover{background:var(--bg2)}
.bt-d{background:var(--rd-s);color:var(--rd)}.bt-d:hover{background:var(--rd);color:#fff}
.bt-gn{background:var(--gn);color:#fff}.bt-gn:hover{background:#2D6A32}
.bt-sm{padding:6px 11px;font-size:12px}

.cd{background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);padding:18px;box-shadow:var(--sh)}
.ch{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.ct2{font-family:var(--hd);font-size:17px}

.sg{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:24px}
.sc{background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);padding:16px 18px;box-shadow:var(--sh)}
.sc .lb{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--tx3);font-weight:600}
.sc .vl{font-family:var(--hd);font-size:30px;margin-top:3px}
.sc .su{font-size:11px;color:var(--tx2);margin-top:3px}
.sc.al{border-left:4px solid var(--rd)}.sc.wr{border-left:4px solid var(--yl)}.sc.gd{border-left:4px solid var(--gn)}

.tw{overflow-x:auto;border-radius:var(--r);border:1px solid var(--bdr)}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:var(--bg2);font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:var(--tx3);padding:11px 14px;text-align:left;border-bottom:1px solid var(--bdr)}
td{padding:11px 14px;border-bottom:1px solid var(--bdr);vertical-align:middle}
tr:last-child td{border-bottom:none}tr:hover td{background:var(--bg)}
input[type="checkbox"]{width:15px;height:15px;accent-color:var(--acc);cursor:pointer}

.tg{display:inline-flex;padding:2px 9px;border-radius:20px;font-size:10px;font-weight:700}
.tg-r{background:var(--rd-s);color:var(--rd)}.tg-y{background:var(--yl-s);color:var(--yl)}
.tg-g{background:var(--gn-s);color:var(--gn)}.tg-b{background:var(--bl-s);color:var(--bl)}

.fg{margin-bottom:14px}
.fl{display:block;font-size:11px;font-weight:600;color:var(--tx2);margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px}
.fi{width:100%;padding:9px 13px;border:1px solid var(--bdr);border-radius:var(--rs);font-family:var(--bd);font-size:14px;background:var(--bg3);color:var(--tx);transition:border .2s}
.fi:focus{outline:none;border-color:var(--acc);box-shadow:0 0 0 3px var(--acc-s)}
select.fi{cursor:pointer}textarea.fi{resize:vertical;min-height:80px}
.sb2{position:relative}.sb2 input{padding-left:36px}.sb2 svg{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--tx3)}

.mo{position:fixed;inset:0;background:rgba(31,17,8,.4);backdrop-filter:blur(4px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px}
.ml{background:var(--bg3);border-radius:16px;width:100%;max-width:540px;max-height:85vh;overflow-y:auto;box-shadow:var(--sh2)}
.mh{padding:22px 26px 0;display:flex;align-items:center;justify-content:space-between}
.mh h3{font-family:var(--hd);font-size:19px}
.mb{padding:18px 26px 26px}
.mx{width:30px;height:30px;border-radius:50%;border:none;background:var(--bg2);cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;color:var(--tx2)}.mx:hover{background:var(--bdr)}

.bh{background:linear-gradient(135deg,var(--acc) 0%,#8F3410 100%);border-radius:16px;padding:30px;color:#fff;margin-bottom:22px;position:relative;overflow:hidden}
.bh::after{content:'';position:absolute;right:-40px;top:-40px;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,.05)}
.bh h2{font-family:var(--hd);font-size:26px;margin-bottom:6px}
.bh p{font-size:13px;opacity:.8}
.bc{display:flex;gap:14px;margin-top:18px;flex-wrap:wrap;align-items:end}
.bc .fg{margin-bottom:0}
.bc .fl{color:rgba(255,255,255,.65)}
.bc .fi{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.18);color:#fff}
.bc .fi::placeholder{color:rgba(255,255,255,.35)}
.bc .fi:focus{border-color:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.15)}
.bi{display:flex;align-items:center;gap:13px;padding:13px 16px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--rs);margin-bottom:7px;transition:all .15s}
.bi:hover{box-shadow:var(--sh)}
.bi .q{font-weight:700;font-size:17px;color:var(--acc);min-width:30px}
.bi .inf{flex:1}.bi .inf .nm{font-weight:600;font-size:13px}.bi .inf .mt{font-size:11px;color:var(--tx3);margin-top:1px}
.ff{font-size:9px;background:var(--yl-s);color:var(--yl);padding:3px 7px;border-radius:4px;font-weight:700;white-space:nowrap}
.op{font-size:9px;background:var(--bl-s);color:var(--bl);padding:3px 7px;border-radius:4px;font-weight:700}

.mc{background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);padding:18px;margin-bottom:10px}
.mhd{display:flex;align-items:center;gap:9px;margin-bottom:9px}
.av{width:34px;height:34px;border-radius:50%;background:var(--acc);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0}
.mtx{font-size:14px;line-height:1.6}
.rp{margin-top:12px;padding-top:12px;border-top:1px solid var(--bdr)}
.ry{display:flex;gap:9px;padding:8px 0}
.ry .av{width:26px;height:26px;font-size:9px}

.nf{display:flex;gap:12px;padding:12px 16px;border-radius:var(--rs);margin-bottom:7px;align-items:flex-start}
.nf.ur{background:var(--rd-s);border:1px solid #F5C6C6}
.nf.wn{background:var(--yl-s);border:1px solid #F5E6A3}
.nf.in{background:var(--bl-s);border:1px solid #A3CDF5}
.nf-i{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.nf.ur .nf-i{background:var(--rd);color:#fff}.nf.wn .nf-i{background:var(--yl);color:#fff}.nf.in .nf-i{background:var(--bl);color:#fff}
.nf-t{font-weight:600;font-size:13px}.nf-d{font-size:11px;color:var(--tx2);margin-top:2px}

.bb{position:sticky;bottom:0;left:0;right:0;background:var(--tx);color:#fff;padding:12px 26px;display:flex;align-items:center;gap:14px;border-radius:12px 12px 0 0;box-shadow:0 -4px 20px rgba(0,0,0,.15);z-index:80;animation:fu .3s ease-out}

.bt2{width:100%;min-height:140px;padding:12px;font-family:'Source Code Pro',monospace;font-size:12px;border:2px dashed var(--bdr);border-radius:var(--rs);background:var(--bg);resize:vertical}
.bt2:focus{outline:none;border-color:var(--acc);background:var(--bg3)}

.ec{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.eo{padding:12px;border:2px solid var(--bdr);border-radius:var(--rs);cursor:pointer;text-align:center;transition:all .2s}
.eo:hover{border-color:var(--acc)}.eo.sel{border-color:var(--acc);background:var(--acc-s)}

.ld{display:flex;align-items:center;justify-content:center;padding:60px;color:var(--tx3);font-size:14px;gap:10px}

@media(max-width:768px){
  .sb{display:none}.mn{margin-left:0}.tb{padding:12px 16px}.tb h2{font-size:17px}
  .ct{padding:14px 16px 120px}.sg{grid-template-columns:1fr 1fr}.bc{flex-direction:column}
  .mbn{display:flex !important}
}
.mbn{display:none;position:fixed;bottom:0;left:0;right:0;background:#1F1108;z-index:150;padding:6px 0 max(6px,env(safe-area-inset-bottom));justify-content:space-around}
.mb-i{display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 10px;color:rgba(255,255,255,.35);font-size:9px;font-weight:600;cursor:pointer;border:none;background:none}
.mb-i.ac{color:var(--acc2)}
`;

export default function ChurchPantry() {
  const [pg, setPg] = useState("dashboard");
  const [inv, setInv] = useState([]);
  const [donors, setDonors] = useState([]);
  const [recip, setRecip] = useState([]);
  const [msgs, setMsgs] = useState([]);
  const [sel, setSel] = useState(new Set());
  const [srch, setSrch] = useState("");
  const [modal, setModal] = useState(null);
  const [sync, setSync] = useState("pg");
  const [eFreq, setEFreq] = useState("monthly");
  const [loading, setLoading] = useState(true);

  // Load all data from Supabase on mount
  useEffect(() => {
    async function loadData() {
      setSync("pg");
      try {
        const [invRes, donRes, recRes, msgRes] = await Promise.all([
          supabase.from("inventory").select("*").order("created_at", { ascending: false }),
          supabase.from("donors").select("*").order("created_at", { ascending: false }),
          supabase.from("recipients").select("*").order("created_at", { ascending: false }),
          supabase.from("messages").select("*, replies(*)").order("created_at", { ascending: false }),
        ]);

        if (invRes.data) setInv(invRes.data.map(i => ({
          id: i.id, upc: i.upc || "", name: i.name, category: i.category || "",
          qty: i.qty, price: Number(i.price), expiry: i.expiry,
          addedBy: i.added_by || "", addedDate: i.added_date || "", location: i.location || ""
        })));
        if (donRes.data) setDonors(donRes.data.map(d => ({
          id: d.id, name: d.name, type: d.type || "Individual",
          totalDonations: d.total_donations, lastDonation: d.last_donation,
          totalValue: Number(d.total_value), email: d.email || ""
        })));
        if (recRes.data) setRecip(recRes.data.map(r => ({
          id: r.id, name: r.name, size: r.size,
          dietaryNotes: r.dietary_notes || "", visits: r.visits,
          lastVisit: r.last_visit
        })));
        if (msgRes.data) setMsgs(msgRes.data.map(m => ({
          id: m.id, author: m.author, role: m.role || "",
          text: m.text, time: m.created_at,
          replies: (m.replies || []).map(r => ({
            id: r.id, author: r.author, text: r.text, time: r.created_at
          }))
        })));

        setSync("ok");
      } catch (err) {
        console.error("Failed to load data:", err);
        setSync("off");
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const doSync = async () => {
    setSync("pg");
    try {
      const [invRes, donRes, recRes, msgRes] = await Promise.all([
        supabase.from("inventory").select("*").order("created_at", { ascending: false }),
        supabase.from("donors").select("*").order("created_at", { ascending: false }),
        supabase.from("recipients").select("*").order("created_at", { ascending: false }),
        supabase.from("messages").select("*, replies(*)").order("created_at", { ascending: false }),
      ]);
      if (invRes.data) setInv(invRes.data.map(i => ({
        id: i.id, upc: i.upc || "", name: i.name, category: i.category || "",
        qty: i.qty, price: Number(i.price), expiry: i.expiry,
        addedBy: i.added_by || "", addedDate: i.added_date || "", location: i.location || ""
      })));
      if (donRes.data) setDonors(donRes.data.map(d => ({
        id: d.id, name: d.name, type: d.type || "Individual",
        totalDonations: d.total_donations, lastDonation: d.last_donation,
        totalValue: Number(d.total_value), email: d.email || ""
      })));
      if (recRes.data) setRecip(recRes.data.map(r => ({
        id: r.id, name: r.name, size: r.size,
        dietaryNotes: r.dietary_notes || "", visits: r.visits,
        lastVisit: r.last_visit
      })));
      if (msgRes.data) setMsgs(msgRes.data.map(m => ({
        id: m.id, author: m.author, role: m.role || "",
        text: m.text, time: m.created_at,
        replies: (m.replies || []).map(r => ({
          id: r.id, author: r.author, text: r.text, time: r.created_at
        }))
      })));
      setSync("ok");
    } catch (err) {
      console.error("Sync failed:", err);
      setSync("off");
    }
  };

  const notifs = useMemo(() => {
    const n = [];
    inv.forEach(item => {
      if (!item.expiry) return;
      const d = daysUntil(item.expiry);
      if (d <= 0) n.push({ type: "ur", title: `EXPIRED: ${item.name}`, desc: `Expired ${Math.abs(d)} days ago. Remove immediately.` });
      else if (d <= 7) n.push({ type: "ur", title: `Expiring in ${d} days: ${item.name}`, desc: `${item.qty} units expire ${fmt(item.expiry)}.` });
      else if (d <= 30) n.push({ type: "wn", title: `Expiring soon: ${item.name}`, desc: `${item.qty} units expire ${fmt(item.expiry)}.` });
    });
    inv.forEach(item => { if (item.qty <= 5) n.push({ type: "wn", title: `Low stock: ${item.name}`, desc: `Only ${item.qty} units left.` }); });
    return n;
  }, [inv]);

  const urgCt = notifs.filter(n => n.type === "ur").length;
  const fInv = inv.filter(i => i.name.toLowerCase().includes(srch.toLowerCase()) || (i.upc && i.upc.includes(srch)) || (i.category && i.category.toLowerCase().includes(srch.toLowerCase())));
  const tVal = inv.reduce((s, i) => s + i.qty * i.price, 0);
  const tItems = inv.reduce((s, i) => s + i.qty, 0);

  const selAll = (e) => { if (e.target.checked) setSel(new Set(fInv.map(i => i.id))); else setSel(new Set()); };
  const togSel = (id) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };

  const bulkDel = async () => {
    const ids = [...sel];
    await supabase.from("inventory").delete().in("id", ids);
    setInv(p => p.filter(i => !sel.has(i.id)));
    setSel(new Set());
  };

  const addItem = async (item) => {
    const { data, error } = await supabase.from("inventory").insert({
      upc: item.upc, name: item.name, category: item.category,
      qty: Number(item.qty), price: Number(item.price), expiry: item.expiry || null,
      added_by: item.addedBy, added_date: item.addedDate, location: item.location
    }).select();
    if (data && data[0]) {
      const i = data[0];
      setInv(p => [{ id: i.id, upc: i.upc || "", name: i.name, category: i.category || "", qty: i.qty, price: Number(i.price), expiry: i.expiry, addedBy: i.added_by || "", addedDate: i.added_date || "", location: i.location || "" }, ...p]);
    }
  };

  const bulkAdd = async (items) => {
    const rows = items.map(item => ({
      upc: item.upc, name: item.name, category: item.category,
      qty: Number(item.qty), price: Number(item.price), expiry: item.expiry || null,
      added_by: item.addedBy, added_date: item.addedDate, location: item.location
    }));
    const { data } = await supabase.from("inventory").insert(rows).select();
    if (data) {
      setInv(p => [...data.map(i => ({ id: i.id, upc: i.upc || "", name: i.name, category: i.category || "", qty: i.qty, price: Number(i.price), expiry: i.expiry, addedBy: i.added_by || "", addedDate: i.added_date || "", location: i.location || "" })), ...p]);
    }
  };

  const delItem = async (id) => {
    await supabase.from("inventory").delete().eq("id", id);
    setInv(p => p.filter(i => i.id !== id));
  };

  const addMsg = async (text) => {
    const { data } = await supabase.from("messages").insert({ author: "You", role: "Manager", text }).select();
    if (data && data[0]) {
      setMsgs(p => [{ id: data[0].id, author: "You", role: "Manager", text, time: data[0].created_at, replies: [] }, ...p]);
    }
  };

  const addReply = async (mid, text) => {
    const { data } = await supabase.from("replies").insert({ message_id: mid, author: "You", text }).select();
    if (data && data[0]) {
      setMsgs(p => p.map(m => m.id === mid ? { ...m, replies: [...m.replies, { id: data[0].id, author: "You", text, time: data[0].created_at }] } : m));
    }
  };

  const nav = [
    { k: "dashboard", l: "Dashboard", i: <I.Home /> },
    { k: "inventory", l: "Inventory", i: <I.Pkg /> },
    { k: "scan", l: "Scan & Add", i: <I.Scan /> },
    { k: "baggo", l: "Bag & Go", i: <I.Bag /> },
    { k: "donors", l: "Donors", i: <I.Heart /> },
    { k: "recipients", l: "Recipients", i: <I.Users /> },
    { k: "discussion", l: "Discussion", i: <I.Chat /> },
    { k: "notifications", l: "Alerts", i: <I.Bell />, badge: urgCt || null },
    { k: "analytics", l: "Analytics", i: <I.Chart /> },
    { k: "settings", l: "Settings", i: <I.Gear /> },
  ];
  const pgTitle = nav.find(n => n.k === pg)?.l || "Dashboard";

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <aside className="sb">
          <div className="sb-h"><h1>Church Pantry</h1><p>Inventory Manager</p></div>
          <nav className="sb-n">
            <div className="ns">Main</div>
            {nav.slice(0, 4).map(n => <button key={n.k} className={`ni${pg === n.k ? " ac" : ""}`} onClick={() => { setPg(n.k); setSel(new Set()); }}>{n.i}<span>{n.l}</span>{n.badge && <span className="bd">{n.badge}</span>}</button>)}
            <div className="ns">Community</div>
            {nav.slice(4, 8).map(n => <button key={n.k} className={`ni${pg === n.k ? " ac" : ""}`} onClick={() => { setPg(n.k); setSel(new Set()); }}>{n.i}<span>{n.l}</span>{n.badge && <span className="bd">{n.badge}</span>}</button>)}
            <div className="ns">System</div>
            {nav.slice(8).map(n => <button key={n.k} className={`ni${pg === n.k ? " ac" : ""}`} onClick={() => { setPg(n.k); setSel(new Set()); }}>{n.i}<span>{n.l}</span></button>)}
          </nav>
          <div className="sb-f">
            <button className="sy" onClick={doSync}><span className={`sd ${sync}`} /><I.Sync spin={sync === "pg"} />{sync === "ok" ? "Cloud synced" : sync === "pg" ? "Syncing..." : "Connection error"}</button>
          </div>
        </aside>

        <main className="mn">
          <div className="tb">
            <h2>{pgTitle}</h2>
            <div className="ta">
              <button className="bt bt-g bt-sm" onClick={doSync} style={{ gap: 5 }}><I.Sync spin={sync === "pg"} />{sync === "ok" ? "Synced" : sync === "pg" ? "Syncing..." : "Retry"}</button>
              {pg === "inventory" && <><button className="bt bt-s bt-sm" onClick={() => setModal("bulkAdd")}>Bulk Add</button><button className="bt bt-p bt-sm" onClick={() => setModal("addItem")}><I.Plus /> Add Item</button></>}
              {pg === "donors" && <button className="bt bt-p bt-sm" onClick={() => setModal("addDonor")}><I.Plus /> Add Donor</button>}
              {pg === "recipients" && <button className="bt bt-p bt-sm" onClick={() => setModal("addRecip")}><I.Plus /> Add Recipient</button>}
            </div>
          </div>
          <div className="ct">
            {loading ? <div className="ld"><I.Sync spin={true} /> Loading data from cloud...</div> : <>
              {pg === "dashboard" && <Dashboard inv={inv} donors={donors} recip={recip} notifs={notifs} tVal={tVal} tItems={tItems} go={setPg} />}
              {pg === "inventory" && <Inventory inv={fInv} srch={srch} setSrch={setSrch} sel={sel} selAll={selAll} togSel={togSel} delItem={delItem} setModal={setModal} />}
              {pg === "scan" && <ScanPage addItem={addItem} />}
              {pg === "baggo" && <BagGo inv={inv} recip={recip} setInv={setInv} doSync={doSync} />}
              {pg === "donors" && <Donors donors={donors} />}
              {pg === "recipients" && <Recipients recip={recip} />}
              {pg === "discussion" && <Discussion msgs={msgs} addMsg={addMsg} addReply={addReply} />}
              {pg === "notifications" && <Notifications notifs={notifs} />}
              {pg === "analytics" && <Analytics inv={inv} donors={donors} recip={recip} />}
              {pg === "settings" && <Settings eFreq={eFreq} setEFreq={setEFreq} sync={sync} doSync={doSync} />}
            </>}
          </div>
          {sel.size > 0 && <div className="bb"><span style={{ fontSize: 13, fontWeight: 600 }}>{sel.size} selected</span><button className="bt bt-s bt-sm" onClick={() => setModal("bulkEdit")}><I.Edit /> Bulk Edit</button><button className="bt bt-d bt-sm" onClick={bulkDel}><I.Trash /> Delete</button><div style={{ flex: 1 }} /><button className="bt bt-g bt-sm" style={{ color: "#fff" }} onClick={() => setSel(new Set())}>Cancel</button></div>}
        </main>

        <nav className="mbn">
          {[nav[0], nav[1], nav[3], nav[6], nav[7]].map(n => <button key={n.k} className={`mb-i${pg === n.k ? " ac" : ""}`} onClick={() => setPg(n.k)}>{n.i}<span>{n.l}</span></button>)}
        </nav>
      </div>

      {modal === "addItem" && <AddItemModal close={() => setModal(null)} onAdd={addItem} />}
      {modal === "bulkAdd" && <BulkAddModal close={() => setModal(null)} onAdd={bulkAdd} />}
      {modal === "bulkEdit" && <BulkEditModal close={() => setModal(null)} sel={sel} inv={inv} setInv={setInv} setSel={setSel} doSync={doSync} />}
      {modal === "addDonor" && <AddDonorModal close={() => setModal(null)} onAdd={async (d) => {
        const { data } = await supabase.from("donors").insert({
          name: d.name, type: d.type, email: d.email,
          total_donations: d.totalDonations || 0, total_value: d.totalValue || 0,
          last_donation: d.lastDonation || null
        }).select();
        if (data && data[0]) setDonors(p => [{ id: data[0].id, name: data[0].name, type: data[0].type, totalDonations: data[0].total_donations, lastDonation: data[0].last_donation, totalValue: Number(data[0].total_value), email: data[0].email || "" }, ...p]);
      }} />}
      {modal === "addRecip" && <AddRecipModal close={() => setModal(null)} onAdd={async (r) => {
        const { data } = await supabase.from("recipients").insert({
          name: r.name, size: Number(r.size), dietary_notes: r.dietaryNotes,
          visits: r.visits || 0, last_visit: r.lastVisit || null
        }).select();
        if (data && data[0]) setRecip(p => [{ id: data[0].id, name: data[0].name, size: data[0].size, dietaryNotes: data[0].dietary_notes || "", visits: data[0].visits, lastVisit: data[0].last_visit }, ...p]);
      }} />}
    </>
  );
}

/* ── PAGES ── */

function Dashboard({ inv, donors, recip, notifs, tVal, tItems, go }) {
  const expS = inv.filter(i => { if (!i.expiry) return false; const d = daysUntil(i.expiry); return d > 0 && d <= 30; }).length;
  const low = inv.filter(i => i.qty <= 5).length;
  return (
    <div className="fu">
      <div className="sg">
        <div className="sc gd"><div className="lb">Total Items</div><div className="vl">{tItems.toLocaleString()}</div><div className="su">{inv.length} unique products</div></div>
        <div className="sc"><div className="lb">Inventory Value</div><div className="vl">{fmtCurrency(tVal)}</div><div className="su">Based on local pricing</div></div>
        <div className={`sc${expS > 0 ? " wr" : ""}`}><div className="lb">Expiring Soon</div><div className="vl">{expS}</div><div className="su">Within 30 days</div></div>
        <div className={`sc${low > 0 ? " al" : ""}`}><div className="lb">Low Stock</div><div className="vl">{low}</div><div className="su">5 or fewer units</div></div>
      </div>
      {inv.length === 0 && (
        <div className="cd" style={{ textAlign: "center", padding: 40, marginBottom: 22 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📦</div>
          <h3 className="ct2" style={{ marginBottom: 6 }}>Your pantry is empty!</h3>
          <p style={{ color: "var(--tx3)", fontSize: 13, marginBottom: 16 }}>Get started by adding your first items to the inventory.</p>
          <button className="bt bt-p" onClick={() => go("scan")}><I.Scan /> Scan & Add Items</button>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div className="cd">
          <div className="ch"><h3 className="ct2">Recent Alerts</h3><button className="bt bt-g bt-sm" onClick={() => go("notifications")}>View All</button></div>
          {notifs.slice(0, 4).map((n, i) => <div key={i} className={`nf ${n.type}`}><div className="nf-i"><I.Warn /></div><div><div className="nf-t">{n.title}</div><div className="nf-d">{n.desc}</div></div></div>)}
          {notifs.length === 0 && <p style={{ color: "var(--tx3)", fontSize: 13, textAlign: "center", padding: 20 }}>No alerts right now!</p>}
        </div>
        <div className="cd">
          <div className="ch"><h3 className="ct2">Quick Actions</h3></div>
          <div style={{ display: "grid", gap: 9 }}>
            <button className="bt bt-p" style={{ width: "100%", justifyContent: "center" }} onClick={() => go("scan")}><I.Scan /> Scan & Add Items</button>
            <button className="bt bt-gn" style={{ width: "100%", justifyContent: "center" }} onClick={() => go("baggo")}><I.Bag /> Build a Bag & Go</button>
            <button className="bt bt-s" style={{ width: "100%", justifyContent: "center" }} onClick={() => go("discussion")}><I.Chat /> Discussion Board</button>
            <button className="bt bt-s" style={{ width: "100%", justifyContent: "center" }} onClick={() => go("donors")}><I.Heart /> Manage Donors</button>
          </div>
          {donors.length > 0 && <div style={{ marginTop: 18 }}>
            <h4 className="ct2" style={{ fontSize: 14, marginBottom: 8 }}>Top Donors</h4>
            {donors.slice(0, 3).map(d => <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--bdr)", fontSize: 13 }}><div><div style={{ fontWeight: 600 }}>{d.name}</div><div style={{ fontSize: 11, color: "var(--tx3)" }}>{d.totalDonations} donations</div></div><div style={{ fontWeight: 700, color: "var(--gn)" }}>{fmtCurrency(d.totalValue)}</div></div>)}
          </div>}
        </div>
      </div>
    </div>
  );
}

function Inventory({ inv, srch, setSrch, sel, selAll, togSel, delItem, setModal }) {
  const [cat, setCat] = useState("All");
  const f = cat === "All" ? inv : inv.filter(i => i.category === cat);
  return (
    <div className="fu">
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <div className="sb2" style={{ flex: 1, minWidth: 200 }}><I.Search /><input className="fi" placeholder="Search by name, UPC, or category..." value={srch} onChange={e => setSrch(e.target.value)} /></div>
        <select className="fi" style={{ width: "auto", minWidth: 150 }} value={cat} onChange={e => setCat(e.target.value)}><option value="All">All Categories</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
      </div>
      <div className="tw">
        <table>
          <thead><tr><th style={{ width: 38 }}><input type="checkbox" onChange={selAll} checked={sel.size === f.length && f.length > 0} /></th><th>Item</th><th>UPC</th><th>Category</th><th>Qty</th><th>Price</th><th>Expiry</th><th>Location</th><th>Status</th><th style={{ width: 50 }}></th></tr></thead>
          <tbody>
            {f.map((item, idx) => {
              const d = item.expiry ? daysUntil(item.expiry) : 999;
              const st = d <= 0 ? "ex" : d <= 7 ? "ur" : d <= 30 ? "wn" : "ok";
              const qs = item.qty <= 5 ? "low" : item.qty <= 15 ? "med" : "ok";
              return (
                <tr key={item.id} className="si" style={{ animationDelay: `${idx * 25}ms` }}>
                  <td><input type="checkbox" checked={sel.has(item.id)} onChange={() => togSel(item.id)} /></td>
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--tx3)" }}>{item.upc}</td>
                  <td><span className="tg tg-b">{item.category}</span></td>
                  <td><span className={`tg ${qs === "low" ? "tg-r" : qs === "med" ? "tg-y" : "tg-g"}`}>{item.qty}</span></td>
                  <td>{fmtCurrency(item.price)}</td>
                  <td style={{ fontSize: 12 }}>{item.expiry ? fmt(item.expiry) : "—"}</td>
                  <td style={{ fontSize: 12, color: "var(--tx3)" }}>{item.location}</td>
                  <td>{st === "ex" ? <span className="tg tg-r">Expired</span> : st === "ur" ? <span className="tg tg-r">{d}d</span> : st === "wn" ? <span className="tg tg-y">{d}d</span> : <span className="tg tg-g">OK</span>}</td>
                  <td><button className="bt bt-g bt-sm" onClick={() => delItem(item.id)} title="Delete"><I.Trash /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {f.length === 0 && <p style={{ textAlign: "center", padding: 36, color: "var(--tx3)" }}>No items found. Add your first item!</p>}
      </div>
    </div>
  );
}

function ScanPage({ addItem }) {
  const [upc, setUpc] = useState("");
  const [form, setForm] = useState({ name: "", category: "Canned Goods", qty: 1, price: "", expiry: "", location: "" });
  const [scanned, setScanned] = useState(false);
  const [saving, setSaving] = useState(false);
  const simulateScan = () => {
    setScanned(true);
    const u = "041000" + String(Math.floor(Math.random() * 999999)).padStart(6, "0");
    setUpc(u);
    const names = ["Corn (canned)", "Black Beans", "Tomato Soup", "Brown Rice", "Spaghetti Noodles"];
    setForm(f => ({ ...f, name: names[Math.floor(Math.random() * names.length)], price: (Math.random() * 5 + 0.99).toFixed(2) }));
  };
  const submit = async () => {
    if (!form.name || saving) return;
    setSaving(true);
    await addItem({ upc: upc || "000000000000", ...form, qty: Number(form.qty), price: Number(form.price), addedBy: "You", addedDate: new Date().toISOString().slice(0, 10) });
    setForm({ name: "", category: "Canned Goods", qty: 1, price: "", expiry: "", location: "" }); setUpc(""); setScanned(false);
    setSaving(false);
  };
  return (
    <div className="fu" style={{ maxWidth: 580 }}>
      <div className="cd" style={{ marginBottom: 18 }}>
        <h3 className="ct2" style={{ marginBottom: 14 }}>Barcode Scanner</h3>
        <div style={{ background: "var(--bg)", borderRadius: "var(--r)", padding: 36, textAlign: "center", border: "2px dashed var(--bdr)", marginBottom: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 160 }}>
          <I.Scan /><p style={{ marginTop: 10, color: "var(--tx3)", fontSize: 13 }}>Point camera at barcode or simulate</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="bt bt-p" style={{ flex: 1 }} onClick={simulateScan}><I.Scan /> Simulate Scan</button>
        </div>
        {scanned && <div style={{ marginTop: 14, padding: 10, background: "var(--gn-s)", borderRadius: 8, fontSize: 12, color: "var(--gn)", fontWeight: 600 }}>Barcode detected: {upc}</div>}
      </div>
      <div className="cd">
        <h3 className="ct2" style={{ marginBottom: 14 }}>Item Details</h3>
        <div className="fg"><label className="fl">UPC Code</label><input className="fi" value={upc} onChange={e => setUpc(e.target.value)} placeholder="Enter or scan UPC" /></div>
        <div className="fg"><label className="fl">Item Name</label><input className="fi" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Green Beans" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="fg"><label className="fl">Category</label><select className="fi" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
          <div className="fg"><label className="fl">Quantity</label><input className="fi" type="number" min="1" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="fg"><label className="fl">Price ($)</label><input className="fi" type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" /></div>
          <div className="fg"><label className="fl">Expiry Date</label><input className="fi" type="date" value={form.expiry} onChange={e => setForm(f => ({ ...f, expiry: e.target.value }))} /></div>
        </div>
        <div className="fg"><label className="fl">Location</label><input className="fi" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Shelf A2" /></div>
        <button className="bt bt-p" style={{ width: "100%", justifyContent: "center", marginTop: 6, opacity: saving ? 0.6 : 1 }} onClick={submit} disabled={saving}><I.Plus /> {saving ? "Saving..." : "Add to Inventory"}</button>
      </div>
    </div>
  );
}

function BagGo({ inv, recip, setInv, doSync }) {
  const [fSize, setFSize] = useState(4);
  const [diet, setDiet] = useState("");
  const [selR, setSelR] = useState("");
  const [bag, setBag] = useState(null);
  const [packed, setPacked] = useState(false);

  useEffect(() => { if (selR) { const r = recip.find(r => r.id === selR); if (r) { setFSize(r.size); setDiet(r.dietaryNotes); } } }, [selR, recip]);

  const gen = () => { setBag(buildBag(inv, fSize, diet)); setPacked(false); };
  const confirm = async () => {
    if (!bag) return;
    // Update each item's quantity in Supabase
    for (const bi of bag.bag) {
      const newQty = Math.max(0, (inv.find(i => i.id === bi.id)?.qty || 0) - bi.bagQty);
      if (newQty <= 0) {
        await supabase.from("inventory").delete().eq("id", bi.id);
      } else {
        await supabase.from("inventory").update({ qty: newQty }).eq("id", bi.id);
      }
    }
    setInv(prev => {
      const n = [...prev];
      bag.bag.forEach(bi => {
        const idx = n.findIndex(i => i.id === bi.id);
        if (idx >= 0) n[idx] = { ...n[idx], qty: n[idx].qty - bi.bagQty };
      });
      return n.filter(i => i.qty > 0);
    });
    setPacked(true);
    doSync();
  };

  const tBI = bag ? bag.bag.reduce((s, i) => s + i.bagQty, 0) : 0;
  const tBV = bag ? bag.bag.reduce((s, i) => s + i.bagQty * i.price, 0) : 0;

  return (
    <div className="fu">
      <div className="bh">
        <h2>Bag & Go</h2>
        <p>Smart packing based on family size, dietary needs & FIFO rotation</p>
        <div className="bc">
          <div className="fg" style={{ minWidth: 170 }}><label className="fl">Recipient (optional)</label><select className="fi" value={selR} onChange={e => setSelR(e.target.value)}><option value="">— Custom —</option>{recip.map(r => <option key={r.id} value={r.id}>{r.name} ({r.size})</option>)}</select></div>
          <div className="fg" style={{ minWidth: 90 }}><label className="fl">Family Size</label><input className="fi" type="number" min="1" max="15" value={fSize} onChange={e => setFSize(Number(e.target.value))} /></div>
          <div className="fg" style={{ minWidth: 180 }}><label className="fl">Dietary Notes</label><input className="fi" value={diet} onChange={e => setDiet(e.target.value)} placeholder="Vegetarian, Nut allergy..." /></div>
          <button className="bt" style={{ background: "#fff", color: "var(--acc)", fontWeight: 700, height: 40 }} onClick={gen}>Generate Bag</button>
        </div>
      </div>
      {bag && (
        <div className="fu">
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
            <div className="cd" style={{ flex: 1, borderLeft: "4px solid var(--acc)", minWidth: 140, textAlign: "center" }}><div className="lb" style={{ fontSize: 10, color: "var(--tx3)", fontWeight: 600, textTransform: "uppercase" }}>Items</div><div style={{ fontFamily: "var(--hd)", fontSize: 26, marginTop: 3 }}>{tBI}</div></div>
            <div className="cd" style={{ flex: 1, borderLeft: "4px solid var(--gn)", minWidth: 140, textAlign: "center" }}><div className="lb" style={{ fontSize: 10, color: "var(--tx3)", fontWeight: 600, textTransform: "uppercase" }}>Value</div><div style={{ fontFamily: "var(--hd)", fontSize: 26, marginTop: 3 }}>{fmtCurrency(tBV)}</div></div>
            <div className="cd" style={{ flex: 1, borderLeft: "4px solid var(--yl)", minWidth: 140, textAlign: "center" }}><div className="lb" style={{ fontSize: 10, color: "var(--tx3)", fontWeight: 600, textTransform: "uppercase" }}>FIFO Priority</div><div style={{ fontFamily: "var(--hd)", fontSize: 26, marginTop: 3 }}>{bag.bag.filter(i => i.fifo).length}</div></div>
          </div>
          {bag.unmet.length > 0 && <div style={{ padding: 12, background: "var(--yl-s)", borderRadius: 8, border: "1px solid #F5E6A3", marginBottom: 16, fontSize: 13 }}><strong>Shortages: </strong>{bag.unmet.map(u => `${u.category} (need ${u.needed} more)`).join(", ")}</div>}
          <h3 style={{ fontFamily: "var(--hd)", fontSize: 17, marginBottom: 10 }}>Suggested Contents</h3>
          {bag.bag.map((item, i) => (
            <div key={i} className="bi si" style={{ animationDelay: `${i * 40}ms`, ...(packed ? { opacity: .5 } : {}) }}>
              <div className="q">x{item.bagQty}</div>
              <div className="inf"><div className="nm">{item.name}</div><div className="mt">{item.category} · Exp {item.expiry ? fmt(item.expiry) : "N/A"} · {fmtCurrency(item.price)} ea</div></div>
              {item.fifo && <span className="ff">USE FIRST</span>}
              {item.optional && <span className="op">OPTIONAL</span>}
            </div>
          ))}
          {!packed ? <button className="bt bt-gn" style={{ width: "100%", justifyContent: "center", marginTop: 18, padding: "13px 22px", fontSize: 14 }} onClick={confirm}><I.Bag /> Confirm & Deduct from Inventory</button>
            : <div style={{ textAlign: "center", padding: 22, background: "var(--gn-s)", borderRadius: 12, marginTop: 18 }}><div style={{ fontSize: 26 }}>✓</div><div style={{ fontFamily: "var(--hd)", fontSize: 19, color: "var(--gn)", marginTop: 6 }}>Bag Packed!</div><div style={{ fontSize: 12, color: "var(--tx2)", marginTop: 3 }}>Inventory updated. Distribution logged.</div></div>}
        </div>
      )}
    </div>
  );
}

function Donors({ donors }) {
  return (
    <div className="fu">
      <div className="sg">
        <div className="sc gd"><div className="lb">Total Donors</div><div className="vl">{donors.length}</div></div>
        <div className="sc"><div className="lb">Total Donated</div><div className="vl">{fmtCurrency(donors.reduce((s, d) => s + d.totalValue, 0))}</div></div>
        <div className="sc"><div className="lb">All Donations</div><div className="vl">{donors.reduce((s, d) => s + d.totalDonations, 0)}</div></div>
      </div>
      {donors.length === 0 ? <div className="cd" style={{ textAlign: "center", padding: 36, color: "var(--tx3)" }}>No donors yet. Click "Add Donor" to get started!</div>
      : <div className="tw"><table><thead><tr><th>Donor</th><th>Type</th><th>Donations</th><th>Last</th><th>Total Value</th><th>Email</th></tr></thead><tbody>
        {donors.map(d => <tr key={d.id}><td style={{ fontWeight: 600 }}>{d.name}</td><td><span className={`tg ${d.type === "Corporate" ? "tg-b" : d.type === "Organization" ? "tg-g" : "tg-y"}`}>{d.type}</span></td><td>{d.totalDonations}</td><td style={{ fontSize: 12 }}>{d.lastDonation ? fmt(d.lastDonation) : "—"}</td><td style={{ fontWeight: 700, color: "var(--gn)" }}>{fmtCurrency(d.totalValue)}</td><td style={{ fontSize: 12, color: "var(--tx3)" }}>{d.email}</td></tr>)}
      </tbody></table></div>}
    </div>
  );
}

function Recipients({ recip }) {
  return (
    <div className="fu">
      <div className="sg">
        <div className="sc gd"><div className="lb">Families Served</div><div className="vl">{recip.length}</div></div>
        <div className="sc"><div className="lb">People Served</div><div className="vl">{recip.reduce((s, r) => s + r.size, 0)}</div></div>
        <div className="sc"><div className="lb">Total Visits</div><div className="vl">{recip.reduce((s, r) => s + r.visits, 0)}</div></div>
      </div>
      {recip.length === 0 ? <div className="cd" style={{ textAlign: "center", padding: 36, color: "var(--tx3)" }}>No recipients yet. Click "Add Recipient" to get started!</div>
      : <div className="tw"><table><thead><tr><th>Recipient</th><th>Family Size</th><th>Dietary Notes</th><th>Visits</th><th>Last Visit</th></tr></thead><tbody>
        {recip.map(r => <tr key={r.id}><td style={{ fontWeight: 600 }}>{r.name}</td><td>{r.size}</td><td>{r.dietaryNotes || <span style={{ color: "var(--tx3)" }}>None</span>}</td><td>{r.visits}</td><td style={{ fontSize: 12 }}>{r.lastVisit ? fmt(r.lastVisit) : "—"}</td></tr>)}
      </tbody></table></div>}
    </div>
  );
}

function Discussion({ msgs, addMsg, addReply }) {
  const [nw, setNw] = useState("");
  const [rTo, setRTo] = useState(null);
  const [rTx, setRTx] = useState("");
  const [posting, setPosting] = useState(false);
  return (
    <div className="fu" style={{ maxWidth: 680 }}>
      <div className="cd" style={{ marginBottom: 20 }}>
        <textarea className="fi" placeholder="Share an update, need, or note with the team..." value={nw} onChange={e => setNw(e.target.value)} style={{ minHeight: 70, marginBottom: 10 }} />
        <button className="bt bt-p" disabled={posting} onClick={async () => { if (nw.trim()) { setPosting(true); await addMsg(nw.trim()); setNw(""); setPosting(false); } }}><I.Chat /> {posting ? "Posting..." : "Post"}</button>
      </div>
      {msgs.length === 0 && <div className="cd" style={{ textAlign: "center", padding: 36, color: "var(--tx3)" }}>No discussions yet. Start the conversation!</div>}
      {msgs.map(m => (
        <div key={m.id} className="mc si">
          <div className="mhd"><div className="av">{m.author.split(" ").map(n => n[0]).join("")}</div><div><div style={{ fontWeight: 600, fontSize: 13 }}>{m.author}</div><div style={{ fontSize: 10, color: "var(--tx3)" }}>{m.role}</div></div><div style={{ fontSize: 10, color: "var(--tx3)", marginLeft: "auto" }}>{fmt(m.time)}</div></div>
          <div className="mtx">{m.text}</div>
          {m.replies.length > 0 && <div className="rp">{m.replies.map(r => <div key={r.id} className="ry"><div className="av">{r.author.split(" ").map(n => n[0]).join("")}</div><div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 11 }}>{r.author}</div><div style={{ fontSize: 12, color: "var(--tx2)", marginTop: 1 }}>{r.text}</div><div style={{ fontSize: 9, color: "var(--tx3)", marginTop: 1 }}>{fmt(r.time)}</div></div></div>)}</div>}
          <div style={{ marginTop: 10 }}>
            {rTo === m.id ? <div style={{ display: "flex", gap: 7 }}><input className="fi" placeholder="Reply..." value={rTx} onChange={e => setRTx(e.target.value)} style={{ fontSize: 12 }} onKeyDown={async e => { if (e.key === "Enter" && rTx.trim()) { await addReply(m.id, rTx.trim()); setRTx(""); setRTo(null); } }} /><button className="bt bt-p bt-sm" onClick={async () => { if (rTx.trim()) { await addReply(m.id, rTx.trim()); setRTx(""); setRTo(null); } }}>Reply</button><button className="bt bt-g bt-sm" onClick={() => { setRTo(null); setRTx(""); }}>Cancel</button></div>
              : <button className="bt bt-g bt-sm" onClick={() => setRTo(m.id)}>Reply</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Notifications({ notifs }) {
  return (
    <div className="fu" style={{ maxWidth: 680 }}>
      {notifs.length === 0 && <div className="cd" style={{ textAlign: "center", padding: 36, color: "var(--tx3)" }}>No alerts — everything looks great!</div>}
      {notifs.map((n, i) => <div key={i} className={`nf ${n.type}`}><div className="nf-i"><I.Warn /></div><div><div className="nf-t">{n.title}</div><div className="nf-d">{n.desc}</div></div></div>)}
    </div>
  );
}

function Analytics({ inv, donors, recip }) {
  const byCat = {};
  inv.forEach(i => { if (i.category) byCat[i.category] = (byCat[i.category] || 0) + i.qty; });
  const ce = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const mx = ce[0]?.[1] || 1;
  return (
    <div className="fu">
      <div className="sg">
        <div className="sc gd"><div className="lb">Products</div><div className="vl">{inv.length}</div></div>
        <div className="sc"><div className="lb">Donors</div><div className="vl">{donors.length}</div></div>
        <div className="sc"><div className="lb">Families</div><div className="vl">{recip.length}</div></div>
        <div className="sc"><div className="lb">Categories</div><div className="vl">{Object.keys(byCat).length}</div></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div className="cd">
          <h3 className="ct2" style={{ marginBottom: 14 }}>Inventory by Category</h3>
          {ce.length === 0 && <p style={{ color: "var(--tx3)", fontSize: 13, textAlign: "center", padding: 20 }}>Add items to see analytics</p>}
          {ce.map(([cat, qty]) => <div key={cat} style={{ marginBottom: 10 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, marginBottom: 3 }}><span>{cat}</span><span>{qty}</span></div><div style={{ height: 7, background: "var(--bg2)", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${(qty / mx) * 100}%`, height: "100%", background: "var(--acc)", borderRadius: 4, transition: "width .5s ease" }} /></div></div>)}
        </div>
        <div className="cd">
          <h3 className="ct2" style={{ marginBottom: 14 }}>Expiration Timeline</h3>
          {[{ l: "Expired", c: inv.filter(i => i.expiry && daysUntil(i.expiry) <= 0).length, cl: "var(--rd)" },
          { l: "Within 7 Days", c: inv.filter(i => { if (!i.expiry) return false; const d = daysUntil(i.expiry); return d > 0 && d <= 7; }).length, cl: "var(--rd)" },
          { l: "Within 30 Days", c: inv.filter(i => { if (!i.expiry) return false; const d = daysUntil(i.expiry); return d > 7 && d <= 30; }).length, cl: "var(--yl)" },
          { l: "30+ Days", c: inv.filter(i => !i.expiry || daysUntil(i.expiry) > 30).length, cl: "var(--gn)" }
          ].map(r => <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--bdr)" }}><div style={{ width: 10, height: 10, borderRadius: 3, background: r.cl, flexShrink: 0 }} /><span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{r.l}</span><span style={{ fontWeight: 700, fontSize: 15 }}>{r.c}</span></div>)}
          <div style={{ marginTop: 14 }}>
            <h4 style={{ fontSize: 12, fontWeight: 600, color: "var(--tx3)", marginBottom: 6 }}>Donor Types</h4>
            {["Individual", "Family", "Organization", "Corporate"].map(t => <div key={t} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12 }}><span>{t}</span><span style={{ fontWeight: 600 }}>{donors.filter(d => d.type === t).length}</span></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Settings({ eFreq, setEFreq, sync, doSync }) {
  const [testEmail, setTestEmail] = useState("");
  const [testStatus, setTestStatus] = useState(null);
  return (
    <div className="fu" style={{ maxWidth: 580 }}>
      <div className="cd" style={{ marginBottom: 18 }}>
        <h3 className="ct2" style={{ marginBottom: 3 }}>Cloud Sync</h3>
        <p style={{ fontSize: 12, color: "var(--tx3)", marginBottom: 14 }}>Data syncs automatically with Supabase cloud database</p>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: "var(--rs)", background: sync === "ok" ? "var(--gn-s)" : sync === "off" ? "var(--rd-s)" : "var(--yl-s)", fontSize: 12, fontWeight: 600, color: sync === "ok" ? "var(--gn)" : sync === "off" ? "var(--rd)" : "var(--yl)" }}><span className={`sd ${sync}`} /><I.Sync spin={sync === "pg"} />{sync === "ok" ? "All synced" : sync === "off" ? "Connection error" : "Syncing..."}</div>
          <button className="bt bt-s bt-sm" onClick={doSync}>Force Sync</button>
        </div>
      </div>
      <div className="cd" style={{ marginBottom: 18 }}>
        <h3 className="ct2" style={{ marginBottom: 3 }}>Email Reports</h3>
        <p style={{ fontSize: 12, color: "var(--tx3)", marginBottom: 14 }}>Receive pantry summary reports by email</p>
        <div className="ec">
          {[{ k: "biweekly", l: "Bi-Weekly", d: "Every 2 weeks on Monday" }, { k: "monthly", l: "Monthly", d: "1st of each month" }].map(o => <div key={o.k} className={`eo${eFreq === o.k ? " sel" : ""}`} onClick={() => setEFreq(o.k)}><div style={{ fontWeight: 700, fontSize: 13 }}>{o.l}</div><div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 3 }}>{o.d}</div></div>)}
        </div>
        <div className="fg" style={{ marginTop: 14 }}><label className="fl">Report Recipients</label><input className="fi" placeholder="email1@church.org, email2@church.org" value={testEmail} onChange={e => setTestEmail(e.target.value)} /></div>
        <button className="bt bt-p bt-sm" onClick={() => {
          if (!testEmail.trim()) { setTestStatus("enter"); return; }
          setTestStatus("coming");
        }}><I.Mail /> Send Test Report</button>
        {testStatus === "enter" && <div style={{ marginTop: 10, padding: 10, background: "var(--yl-s)", borderRadius: 8, fontSize: 12, color: "var(--yl)", fontWeight: 600 }}>Please enter an email address above first.</div>}
        {testStatus === "coming" && <div style={{ marginTop: 10, padding: 10, background: "var(--bl-s)", borderRadius: 8, fontSize: 12, color: "var(--bl)", fontWeight: 600 }}>Email reports require a Supabase Edge Function + email service (Resend/SendGrid). This will be set up in the next phase!</div>}
      </div>
      <div className="cd" style={{ marginBottom: 18 }}>
        <h3 className="ct2" style={{ marginBottom: 3 }}>Shared Access</h3>
        <p style={{ fontSize: 12, color: "var(--tx3)", marginBottom: 14 }}>Invite team members to manage the pantry</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input className="fi" placeholder="Enter email address" style={{ flex: 1 }} />
          <select className="fi" style={{ width: 130 }}><option>Manager</option><option>Volunteer</option><option>Viewer</option></select>
          <button className="bt bt-p bt-sm" onClick={() => alert("Shared access requires Supabase Auth — coming in the next phase!")}><I.Share /> Invite</button>
        </div>
        <div style={{ fontSize: 11, color: "var(--tx3)" }}><strong>Roles:</strong> Manager (full access) · Volunteer (add/edit, pack bags) · Viewer (read-only)</div>
      </div>
      <div className="cd">
        <h3 className="ct2" style={{ marginBottom: 3 }}>Notifications</h3>
        <p style={{ fontSize: 12, color: "var(--tx3)", marginBottom: 14 }}>Configure alert preferences</p>
        {[{ l: "Expiration alerts (7 days before)", d: true }, { l: "Low stock alerts (5 or fewer)", d: true }, { l: "New donations received", d: true }, { l: "Discussion board replies", d: false }].map((o, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0", borderBottom: "1px solid var(--bdr)" }}><input type="checkbox" defaultChecked={o.d} /><span style={{ fontSize: 12 }}>{o.l}</span></div>)}
      </div>
    </div>
  );
}

/* ── MODALS ── */

function AddItemModal({ close, onAdd }) {
  const [f, sF] = useState({ upc: "", name: "", category: "Canned Goods", qty: 1, price: "", expiry: "", location: "" });
  const [saving, setSaving] = useState(false);
  const sub = async () => {
    if (!f.name || saving) return;
    setSaving(true);
    await onAdd({ ...f, qty: Number(f.qty), price: Number(f.price), addedBy: "You", addedDate: new Date().toISOString().slice(0, 10) });
    setSaving(false);
    close();
  };
  return (
    <div className="mo" onClick={close}><div className="ml" onClick={e => e.stopPropagation()}>
      <div className="mh"><h3>Add Item</h3><button className="mx" onClick={close}>×</button></div>
      <div className="mb">
        <div className="fg"><label className="fl">UPC Code</label><input className="fi" value={f.upc} onChange={e => sF(p => ({ ...p, upc: e.target.value }))} /></div>
        <div className="fg"><label className="fl">Item Name *</label><input className="fi" value={f.name} onChange={e => sF(p => ({ ...p, name: e.target.value }))} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="fg"><label className="fl">Category</label><select className="fi" value={f.category} onChange={e => sF(p => ({ ...p, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
          <div className="fg"><label className="fl">Quantity</label><input className="fi" type="number" min="1" value={f.qty} onChange={e => sF(p => ({ ...p, qty: e.target.value }))} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="fg"><label className="fl">Price ($)</label><input className="fi" type="number" step="0.01" value={f.price} onChange={e => sF(p => ({ ...p, price: e.target.value }))} placeholder="0.00" /></div>
          <div className="fg"><label className="fl">Expiry Date</label><input className="fi" type="date" value={f.expiry} onChange={e => sF(p => ({ ...p, expiry: e.target.value }))} /></div>
        </div>
        <div className="fg"><label className="fl">Location</label><input className="fi" value={f.location} onChange={e => sF(p => ({ ...p, location: e.target.value }))} /></div>
        <button className="bt bt-p" style={{ width: "100%", justifyContent: "center", opacity: saving ? 0.6 : 1 }} onClick={sub} disabled={saving}><I.Plus /> {saving ? "Saving..." : "Add Item"}</button>
      </div>
    </div></div>
  );
}

function BulkAddModal({ close, onAdd }) {
  const [raw, setRaw] = useState("Green Beans, Canned Goods, 24, 1.29, 2026-12-01, Shelf A2\nChicken Soup, Canned Goods, 18, 2.49, 2026-11-15, Shelf A1\nSpaghetti, Grains & Pasta, 30, 1.49, 2027-06-01, Shelf C2");
  const [pv, setPv] = useState([]);
  const [saving, setSaving] = useState(false);
  const parse = () => {
    const items = raw.trim().split("\n").filter(l => l.trim()).map(line => {
      const p = line.split(",").map(s => s.trim());
      return { upc: "000000" + String(Math.floor(Math.random() * 999999)).padStart(6, "0"), name: p[0] || "Unknown", category: p[1] || "Canned Goods", qty: Number(p[2]) || 1, price: Number(p[3]) || 0, expiry: p[4] || "2027-01-01", location: p[5] || "", addedBy: "You (Bulk)", addedDate: new Date().toISOString().slice(0, 10) };
    });
    setPv(items);
  };
  return (
    <div className="mo" onClick={close}><div className="ml" onClick={e => e.stopPropagation()} style={{ maxWidth: 620 }}>
      <div className="mh"><h3>Bulk Add Items</h3><button className="mx" onClick={close}>×</button></div>
      <div className="mb">
        <p style={{ fontSize: 12, color: "var(--tx2)", marginBottom: 10 }}>One item per line: <strong>Name, Category, Qty, Price, Expiry, Location</strong></p>
        <textarea className="bt2" value={raw} onChange={e => setRaw(e.target.value)} />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button className="bt bt-s" onClick={parse}>Preview ({raw.trim().split("\n").filter(l => l.trim()).length} lines)</button>
          {pv.length > 0 && <button className="bt bt-p" disabled={saving} onClick={async () => { setSaving(true); await onAdd(pv); setSaving(false); close(); }}><I.Plus /> {saving ? "Saving..." : `Add ${pv.length} Items`}</button>}
        </div>
        {pv.length > 0 && <div style={{ marginTop: 14, maxHeight: 180, overflow: "auto" }}><table style={{ fontSize: 11 }}><thead><tr><th>Name</th><th>Category</th><th>Qty</th><th>Price</th><th>Expiry</th></tr></thead><tbody>{pv.map((p, i) => <tr key={i}><td>{p.name}</td><td>{p.category}</td><td>{p.qty}</td><td>{fmtCurrency(p.price)}</td><td>{p.expiry}</td></tr>)}</tbody></table></div>}
      </div>
    </div></div>
  );
}

function BulkEditModal({ close, sel, inv, setInv, setSel, doSync }) {
  const [fd, setFd] = useState("category");
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);
  const apply = async () => {
    setSaving(true);
    const ids = [...sel];
    const updateField = fd === "category" ? "category" : fd === "location" ? "location" : fd === "qty" ? "qty" : fd === "price" ? "price" : "expiry";
    const updateVal = fd === "qty" || fd === "price" ? Number(val) : val;

    for (const id of ids) {
      await supabase.from("inventory").update({ [updateField]: updateVal }).eq("id", id);
    }

    setInv(prev => prev.map(item => {
      if (!sel.has(item.id)) return item;
      if (fd === "category") return { ...item, category: val };
      if (fd === "location") return { ...item, location: val };
      if (fd === "qty") return { ...item, qty: Number(val) };
      if (fd === "price") return { ...item, price: Number(val) };
      if (fd === "expiry") return { ...item, expiry: val };
      return item;
    }));
    setSel(new Set());
    setSaving(false);
    doSync();
    close();
  };
  return (
    <div className="mo" onClick={close}><div className="ml" onClick={e => e.stopPropagation()}>
      <div className="mh"><h3>Bulk Edit — {sel.size} Items</h3><button className="mx" onClick={close}>×</button></div>
      <div className="mb">
        <div className="fg"><label className="fl">Field</label><select className="fi" value={fd} onChange={e => { setFd(e.target.value); setVal(""); }}><option value="category">Category</option><option value="location">Location</option><option value="qty">Quantity</option><option value="price">Price</option><option value="expiry">Expiry Date</option></select></div>
        <div className="fg"><label className="fl">New Value</label>
          {fd === "category" ? <select className="fi" value={val} onChange={e => setVal(e.target.value)}><option value="">Select...</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
            : fd === "expiry" ? <input className="fi" type="date" value={val} onChange={e => setVal(e.target.value)} />
              : fd === "qty" || fd === "price" ? <input className="fi" type="number" value={val} onChange={e => setVal(e.target.value)} />
                : <input className="fi" value={val} onChange={e => setVal(e.target.value)} />}
        </div>
        <p style={{ fontSize: 11, color: "var(--tx3)", marginBottom: 14 }}>Updates <strong>{sel.size} items</strong> at once.</p>
        <div style={{ display: "flex", gap: 8 }}><button className="bt bt-p" onClick={apply} disabled={!val || saving}><I.Edit /> {saving ? "Applying..." : "Apply"}</button><button className="bt bt-s" onClick={close}>Cancel</button></div>
      </div>
    </div></div>
  );
}

function AddDonorModal({ close, onAdd }) {
  const [f, sF] = useState({ name: "", type: "Individual", email: "", totalDonations: 0, totalValue: 0, lastDonation: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  return (
    <div className="mo" onClick={close}><div className="ml" onClick={e => e.stopPropagation()}>
      <div className="mh"><h3>Add Donor</h3><button className="mx" onClick={close}>×</button></div>
      <div className="mb">
        <div className="fg"><label className="fl">Name *</label><input className="fi" value={f.name} onChange={e => sF(p => ({ ...p, name: e.target.value }))} /></div>
        <div className="fg"><label className="fl">Type</label><select className="fi" value={f.type} onChange={e => sF(p => ({ ...p, type: e.target.value }))}><option>Individual</option><option>Family</option><option>Organization</option><option>Corporate</option></select></div>
        <div className="fg"><label className="fl">Email</label><input className="fi" value={f.email} onChange={e => sF(p => ({ ...p, email: e.target.value }))} /></div>
        <button className="bt bt-p" style={{ width: "100%", justifyContent: "center", opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={async () => { if (f.name) { setSaving(true); await onAdd(f); setSaving(false); close(); } }}><I.Plus /> {saving ? "Saving..." : "Add Donor"}</button>
      </div>
    </div></div>
  );
}

function AddRecipModal({ close, onAdd }) {
  const [f, sF] = useState({ name: "", size: 1, dietaryNotes: "", visits: 0, lastVisit: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  return (
    <div className="mo" onClick={close}><div className="ml" onClick={e => e.stopPropagation()}>
      <div className="mh"><h3>Add Recipient</h3><button className="mx" onClick={close}>×</button></div>
      <div className="mb">
        <div className="fg"><label className="fl">Name *</label><input className="fi" value={f.name} onChange={e => sF(p => ({ ...p, name: e.target.value }))} /></div>
        <div className="fg"><label className="fl">Family Size</label><input className="fi" type="number" min="1" value={f.size} onChange={e => sF(p => ({ ...p, size: e.target.value }))} /></div>
        <div className="fg"><label className="fl">Dietary Notes</label><input className="fi" value={f.dietaryNotes} onChange={e => sF(p => ({ ...p, dietaryNotes: e.target.value }))} placeholder="Nut allergy, Vegetarian, Diabetic..." /></div>
        <button className="bt bt-p" style={{ width: "100%", justifyContent: "center", opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={async () => { if (f.name) { setSaving(true); await onAdd({ ...f, size: Number(f.size) }); setSaving(false); close(); } }}><I.Plus /> {saving ? "Saving..." : "Add Recipient"}</button>
      </div>
    </div></div>
  );
}
