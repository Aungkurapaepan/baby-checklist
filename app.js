/* ลิสต์ของใช้ลูกน้อย — หน้าเว็บคุยกับ Google Sheets ผ่าน Apps Script */
const CATS = ["ดูแลสุขภาพ","อาบน้ำ","ของใช้คุณแม่","การเดินทาง","ให้นม","เสริมพัฒนาการ","ของใช้เด็ก","เสื้อผ้า","การนอน"];
const API = (window.SHEET_API_URL || "").trim();
const POLL_MS = 15000;

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const baht = n => "฿" + Number(n).toLocaleString("th-TH", {maximumFractionDigits: 2});
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString("th-TH", {day:"numeric",month:"short",year:"2-digit"}) : "";
const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString("th-TH", {hour:"2-digit",minute:"2-digit"}) : "";
const safeUrl = u => /^https?:\/\//i.test(u || "") ? u : "";
const store = {
  get(k){ try { return localStorage.getItem(k) || ""; } catch { return ""; } },
  set(k,v){ try { localStorage.setItem(k, v); } catch {} }
};

let me = store.get("bc-name");
let items = new Map(), prices = [], logs = [], loaded = false, busy = 0;
const open = new Set(), armed = new Set();
let editingPrice = null, filter = "all", query = "", pending = false, lastSync = null;

$("#newCat").innerHTML = CATS.map(c => `<option>${esc(c)}</option>`).join("");

function toast(t){ const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 2600); }
function setWho(){
  $("#who").textContent = me ? `สวัสดี ${me} · เตรียมของรอเจ้าตัวเล็กด้วยกัน` : "เตรียมของรอเจ้าตัวเล็กด้วยกัน";
  $("#changeName").hidden = !me;
}
function setSync(){
  $("#sync").textContent = busy ? "กำลังบันทึก…" : lastSync ? `อัปเดตล่าสุด ${fmtTime(lastSync.toISOString())} · รีเฟรชเองทุก 15 วินาที` : "";
}

/* ---------- server ---------- */
function apply(data){
  if (!data || data.error) throw new Error(data && data.error || "ไม่มีข้อมูล");
  items = new Map(data.items.map(i => [String(i.id), {...i, id: String(i.id)}]));
  prices = data.prices.filter(p => p.shop && !isNaN(p.price)).map(p => ({...p, id: String(p.id), itemId: String(p.itemId)}));
  logs = data.log || [];
  loaded = true; lastSync = new Date();
  render(); if (!$("#view-log").hidden) renderLog(); setSync();
}
async function load(){
  if (!API || busy) return;
  try { const r = await fetch(API, {cache: "no-store"}); apply(await r.json()); }
  catch (e) { console.warn(e); if (!loaded) { $("#list").innerHTML = `<div class="empty">โหลดข้อมูลไม่ได้ ตรวจลิงก์ใน config.js ว่าถูกต้อง และ Deploy เป็น “Anyone” แล้ว</div>`; } }
}
async function act(action, payload){
  if (!me) { askName(); return false; }
  busy++; setSync();
  let data;
  try {
    const r = await fetch(API, {method: "POST", headers: {"Content-Type": "text/plain;charset=utf-8"}, body: JSON.stringify({action, by: me, ...payload})});
    data = await r.json();
  } catch (e) { console.warn(e); data = {error: "บันทึกไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง"}; }
  finally { busy--; setSync(); }
  if (data.error) { toast(data.error); render(); return false; }
  apply(data); return true;
}

/* ---------- derived ---------- */
function priceInfo(id){
  const all = prices.filter(p => p.itemId === id).sort((a,b) => String(b.at).localeCompare(String(a.at)));
  const latest = new Map(), older = [];
  for (const p of all) { const k = String(p.shop).trim().toLowerCase(); if (!latest.has(k)) latest.set(k, p); else older.push(p); }
  const cmp = [...latest.values()].sort((a,b) => a.price - b.price);
  return {cmp, older, best: cmp[0] || null};
}
function sortedItems(){
  return [...items.values()].sort((a,b) => {
    const ca = CATS.indexOf(a.cat), cb = CATS.indexOf(b.cat);
    return (ca < 0 ? 99 : ca) - (cb < 0 ? 99 : cb) || (Number(a.order) || 0) - (Number(b.order) || 0);
  });
}

/* ---------- render ---------- */
function stats(){
  const all = [...items.values()], done = all.filter(i => i.done);
  const paid = done.reduce((s,i) => s + (Number(i.paid) || 0), 0);
  let left = 0, n = 0; for (const i of all) if (!i.done) { const b = priceInfo(i.id).best; if (b) { left += b.price; n++; } }
  $("#sDone").textContent = all.length ? `${done.length}/${all.length}` : "–";
  $("#sPaid").textContent = baht(paid);
  $("#sLeft").textContent = baht(left);
  $("#sLeftL").textContent = n ? `ที่เหลือ (ถูกสุด ${n} รายการ)` : "ประมาณที่เหลือ";
  $("#pbar").style.width = all.length ? (done.length / all.length * 100) + "%" : "0";
}

function render(){
  const ae = document.activeElement;
  if (ae && ae.closest && ae.closest("#list .detail")) { pending = true; return; }
  pending = false;
  const box = $("#list");
  if (!API) { box.innerHTML = setupHTML(); return; }
  stats();
  const shops = [...new Set(prices.map(p => String(p.shop).trim()))].sort();
  $("#shops").innerHTML = shops.map(s => `<option value="${esc(s)}">`).join("");
  if (!loaded) { box.innerHTML = `<div class="empty">กำลังโหลดรายการ…</div>`; return; }
  if (!items.size) { box.innerHTML = `<div class="empty">ยังไม่มีรายการ กด “＋ เพิ่มรายการ” เพื่อเริ่มลิสต์แรก</div>`; return; }
  const q = query.trim().toLowerCase(), groups = new Map();
  for (const it of sortedItems()) {
    const pi = priceInfo(it.id);
    if (filter === "todo" && it.done) continue;
    if (filter === "done" && !it.done) continue;
    if (filter === "noprice" && pi.best) continue;
    if (q && !(it.name + " " + (it.note || "") + " " + it.cat).toLowerCase().includes(q)) continue;
    if (!groups.has(it.cat)) groups.set(it.cat, []);
    groups.get(it.cat).push([it, pi]);
  }
  if (!groups.size) { box.innerHTML = `<div class="empty">ไม่มีรายการที่ตรงกับตัวกรองนี้</div>`; return; }
  let h = "";
  for (const [cat, rows] of groups) {
    const all = [...items.values()].filter(i => i.cat === cat), d = all.filter(i => i.done).length;
    h += `<section class="cat"><h2><span><span class="dot"></span>${esc(cat)}</span><small class="num">${d}/${all.length}</small></h2><ul class="items">`;
    for (const [it, pi] of rows) h += itemHTML(it, pi);
    h += `</ul></section>`;
  }
  box.innerHTML = h;
}

function priceRow(p, i, best){
  const u = safeUrl(p.url);
  if (editingPrice === p.id) {
    return `<tr><td colspan="4"><form class="row" data-form="editprice" data-pid="${esc(p.id)}">
      <input class="field grow" id="eshop-${esc(p.id)}" list="shops" value="${esc(p.shop)}" required aria-label="ร้าน">
      <input class="field" id="eprice-${esc(p.id)}" inputmode="decimal" value="${esc(p.price)}" required aria-label="ราคา" style="flex:0 1 110px">
      <button class="btn small" type="submit">บันทึก</button>
      <button class="btn small ghost" type="button" data-act="canceledit">ยกเลิก</button></form></td></tr>`;
  }
  const diff = i > 0 ? `<span class="diff">+${baht(p.price - best.price)}</span>` : `<span class="diff">ถูกสุด</span>`;
  return `<tr class="${i === 0 ? "cheap" : ""}"><td>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(p.shop)}</a>` : esc(p.shop)}</td>
    <td class="meta">${fmtDate(p.at)} · ${esc(p.by)}</td>
    <td class="p">${baht(p.price)}${diff}</td>
    <td style="white-space:nowrap"><button class="btn small ghost" data-act="buy" data-pid="${esc(p.id)}">ซื้อที่นี่</button><button class="iconx" data-act="editprice" data-pid="${esc(p.id)}" aria-label="แก้ราคา ${esc(p.shop)}">✎</button><button class="iconx" data-act="delprice" data-pid="${esc(p.id)}" aria-label="ลบราคา ${esc(p.shop)}">✕</button></td></tr>`;
}

function itemHTML(it, pi){
  const isOpen = open.has(it.id);
  let tag;
  if (it.done && it.paid) tag = `<span class="tag paid num">จ่าย ${baht(it.paid)}</span>`;
  else if (pi.best) tag = `<span class="tag best num">${baht(pi.best.price)} · ${esc(pi.best.shop)}</span>`;
  else tag = `<span class="tag none">ยังไม่มีราคา</span>`;
  let h = `<li class="item${it.done ? " done" : ""}" data-id="${esc(it.id)}"><div class="line">
    <input type="checkbox" id="chk-${esc(it.id)}" data-act="toggle" ${it.done ? "checked" : ""} aria-label="ซื้อแล้ว: ${esc(it.name)}">
    <button class="name" data-act="expand" aria-expanded="${isOpen}"><span class="t">${esc(it.name)}</span>${it.qty ? `<span class="qty">${esc(it.qty)}</span>` : ""}</button>
    ${tag}</div>`;
  if (isOpen) {
    h += `<div class="detail">`;
    if (it.done) h += `<div class="note">ซื้อแล้ว${it.paidShop ? ` ที่ ${esc(it.paidShop)}` : ""}${it.paid ? ` ราคา ${baht(it.paid)}` : ""}${it.doneBy ? ` · โดย ${esc(it.doneBy)}` : ""}${it.doneAt ? ` · ${fmtDate(it.doneAt)}` : ""}</div>`;
    if (it.note) h += `<div class="note">โน้ต: ${esc(it.note)}</div>`;
    h += `<div><h3>เปรียบเทียบราคา</h3>`;
    if (pi.cmp.length) h += `<div class="tbl"><table>${pi.cmp.map((p,i) => priceRow(p, i, pi.best)).join("")}</table></div>`;
    else h += `<p class="note" style="margin:4px 0">ยังไม่มีราคา เพิ่มราคาจากร้านแรกด้านล่าง</p>`;
    if (pi.older.length) {
      h += `<details class="old"><summary>ราคาที่บันทึกก่อนหน้า (${pi.older.length})</summary><ul>`;
      for (const p of pi.older) h += `<li class="num">${fmtDate(p.at)} · ${esc(p.shop)} · ${baht(p.price)} <button class="iconx" data-act="delprice" data-pid="${esc(p.id)}" aria-label="ลบราคาเก่า">✕</button></li>`;
      h += `</ul></details>`;
    }
    h += `</div>
      <form class="row" data-form="price">
        <input class="field grow" id="shop-${esc(it.id)}" list="shops" required placeholder="ร้าน เช่น Shopee, Lazada, Big C">
        <input class="field" id="price-${esc(it.id)}" inputmode="decimal" required placeholder="ราคา ฿" style="flex:0 1 110px">
        <input class="field grow" id="url-${esc(it.id)}" placeholder="ลิงก์ (ถ้ามี)">
        <button class="btn small" type="submit">บันทึกราคา</button></form>
      <form class="row" data-form="edit">
        <input class="field" id="qty-${esc(it.id)}" value="${esc(it.qty || "")}" placeholder="จำนวน" style="flex:0 1 130px">
        <input class="field grow" id="note-${esc(it.id)}" value="${esc(it.note || "")}" placeholder="โน้ต เช่น ขนาด/สี/รุ่นที่อยากได้">
        <button class="btn small ghost" type="submit">บันทึก</button>
        <button class="btn small danger${armed.has(it.id) ? " arm" : ""}" type="button" data-act="delitem">${armed.has(it.id) ? "กดอีกครั้งเพื่อลบ" : "ลบรายการ"}</button></form>
    </div>`;
  }
  return h + `</li>`;
}

function renderLog(){
  const box = $("#logList");
  if (!API) { box.innerHTML = setupHTML(); return; }
  if (!loaded) { box.innerHTML = `<div class="empty">กำลังโหลดประวัติ…</div>`; return; }
  if (!logs.length) { box.innerHTML = `<div class="empty">ยังไม่มีประวัติ ทุกครั้งที่ติ๊ก บันทึกราคา หรือเพิ่มของ จะขึ้นที่นี่</div>`; return; }
  let h = `<ul class="log">`, day = "";
  for (const l of logs) {
    const d = fmtDate(l.at); if (d !== day) { day = d; h += `<h4>${d}</h4>`; }
    h += `<li class="ent"><div class="tx"><b>${esc(l.by)}</b> ${esc(l.text)}</div><time class="num">${fmtTime(l.at)}</time></li>`;
  }
  box.innerHTML = h + `</ul>`;
}

function setupHTML(){
  return `<div class="setup"><h2 style="font:700 1.1rem var(--f-display);margin:0">ยังไม่ได้เชื่อม Google Sheet</h2>
    <ol><li>สร้าง Google Sheet ใหม่ แล้ววางโค้ดจากไฟล์ <b>Code.gs</b> ใน Extensions → Apps Script</li>
    <li>กด Run ฟังก์ชัน <b>setup</b> หนึ่งครั้ง</li>
    <li>Deploy → New deployment → Web app → Who has access: <b>Anyone</b></li>
    <li>คัดลอกลิงก์ที่ได้ ไปวางใน <b>config.js</b> แล้ว commit</li></ol>
    <p class="note" style="margin:0">รายละเอียดทีละขั้นอยู่ใน README.md ของ repo</p></div>`;
}

/* ---------- name ---------- */
function askName(){ $("#nameModal").hidden = false; $("#nameInput").value = me; $("#nameInput").focus(); }
$("#nameForm").addEventListener("submit", e => {
  e.preventDefault(); const v = $("#nameInput").value.trim().slice(0, 40); if (!v) return;
  me = v; store.set("bc-name", v); $("#nameModal").hidden = true; setWho();
});
$("#changeName").addEventListener("click", askName);

/* ---------- actions ---------- */
document.addEventListener("click", async e => {
  const t = e.target.closest("[data-act],[data-tab],[data-f]"); if (!t) return;
  if (t.dataset.tab) {
    const v = t.dataset.tab;
    document.querySelectorAll("[data-tab]").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === v));
    $("#view-list").hidden = v !== "list"; $("#view-log").hidden = v !== "log";
    if (v === "log") renderLog(); return;
  }
  if (t.dataset.f) { filter = t.dataset.f; document.querySelectorAll("[data-f]").forEach(b => b.setAttribute("aria-pressed", b === t)); render(); return; }
  const li = t.closest("li.item"), id = li && li.dataset.id, it = items.get(id), act_ = t.dataset.act;
  if (act_ === "expand") { open.has(id) ? open.delete(id) : open.add(id); armed.delete(id); editingPrice = null; render(); return; }
  if (act_ === "editprice") { editingPrice = t.dataset.pid; render(); const f = document.getElementById("eprice-" + editingPrice); if (f) { f.focus(); f.select(); } return; }
  if (act_ === "canceledit") { editingPrice = null; t.blur(); document.activeElement.blur(); render(); return; }
  if (!it) return;
  if (act_ === "buy") { t.disabled = true; if (await act("buy", {id, priceId: t.dataset.pid})) toast(`ติ๊ก “${it.name}” แล้ว`); }
  if (act_ === "delprice") { t.disabled = true; if (await act("delPrice", {priceId: t.dataset.pid})) toast("ลบราคาแล้ว"); }
  if (act_ === "delitem") {
    if (!armed.has(id)) { armed.add(id); render(); setTimeout(() => { if (armed.delete(id)) render(); }, 4000); return; }
    armed.delete(id); open.delete(id);
    if (await act("delItem", {id})) toast("ลบแล้ว");
  }
});
document.addEventListener("change", async e => {
  const t = e.target; if (t.dataset.act !== "toggle") return;
  const id = t.closest("li.item").dataset.id, done = t.checked;
  t.disabled = true;
  if (!(await act("toggle", {id, done}))) { t.checked = !done; t.disabled = false; }
});
document.addEventListener("submit", async e => {
  e.preventDefault(); const f = e.target;
  if (f.id === "nameForm") return;
  if (f.id === "addForm") {
    const name = $("#newName").value.trim(); if (!name) return;
    if (await act("addItem", {name, cat: $("#newCat").value, qty: $("#newQty").value.trim()})) { $("#newName").value = ""; $("#newQty").value = ""; toast("เพิ่มแล้ว"); }
    return;
  }
  const li = f.closest("li.item"); if (!li) return; const id = li.dataset.id;
  const val = s => (document.getElementById(s) || {}).value || "";
  const num = s => parseFloat(val(s).replace(/[,฿\s]/g, ""));
  if (f.dataset.form === "price") {
    const shop = val("shop-" + id).trim(), price = num("price-" + id), url = val("url-" + id).trim();
    if (!shop || !(price >= 0)) { toast("ใส่ชื่อร้านและราคาเป็นตัวเลข"); return; }
    document.activeElement.blur();
    if (await act("addPrice", {itemId: id, shop, price, url: safeUrl(url)})) toast("บันทึกราคาแล้ว");
  }
  if (f.dataset.form === "editprice") {
    const pid = f.dataset.pid, shop = val("eshop-" + pid).trim(), price = num("eprice-" + pid);
    if (!shop || !(price >= 0)) { toast("ใส่ชื่อร้านและราคาเป็นตัวเลข"); return; }
    editingPrice = null; document.activeElement.blur();
    if (await act("editPrice", {priceId: pid, shop, price})) toast("แก้ราคาแล้ว");
  }
  if (f.dataset.form === "edit") {
    const it = items.get(id), qty = val("qty-" + id).trim(), note = val("note-" + id).trim();
    document.activeElement.blur();
    if (qty === (it.qty || "") && note === (it.note || "")) return;
    if (await act("editItem", {id, qty, note})) toast("บันทึกแล้ว");
  }
});
document.addEventListener("focusout", () => setTimeout(() => { if (pending) render(); }, 0));
$("#q").addEventListener("input", e => { query = e.target.value; render(); });
$("#addToggle").addEventListener("click", () => { const f = $("#addForm"); f.hidden = !f.hidden; if (!f.hidden) $("#newName").focus(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });

/* ---------- boot ---------- */
setWho(); render();
if (API) {
  if (!me) askName();
  load();
  setInterval(() => { if (!document.hidden && !pending && !editingPrice) load(); }, POLL_MS);
}
