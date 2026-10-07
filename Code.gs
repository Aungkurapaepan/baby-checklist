/**
 * ลิสต์ของใช้ลูกน้อย — ตัวเก็บข้อมูลบน Google Sheets
 * วิธีติดตั้งดูใน README.md
 * 1) วางโค้ดนี้ใน Extensions > Apps Script ของ Google Sheet
 * 2) กด Run ฟังก์ชัน setup ครั้งเดียว (สร้างแท็บ + ใส่รายการเริ่มต้น 102 รายการ)
 * 3) Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone)
 */

const SHEETS = {
  items: ['id', 'name', 'cat', 'qty', 'note', 'done', 'doneBy', 'doneAt', 'paid', 'paidShop', 'order', 'createdBy', 'createdAt'],
  prices: ['id', 'itemId', 'shop', 'price', 'url', 'by', 'at'],
  log: ['at', 'by', 'type', 'itemId', 'itemName', 'text'],
};

const SEED = {
  'ดูแลสุขภาพ': 'ปรอทวัดไข้|ที่ดูดน้ำมูก|มหาหิงค์|ครีมทากันผดผื่นแดง|ยาทากันยุง|เครื่องฟอกอากาศ|เครื่องพ่นละอองยา|น้ำเกลือ|ครีมทาผื่นผ้าอ้อม',
  'อาบน้ำ': 'ผ้าอาบน้ำ|อ่างอาบน้ำ|ที่รองอาบน้ำ|ฟองน้ำ|ผ้าเช็ดตัว|ที่เปลี่ยนผ้าอ้อม|สำลีขนาดต่าง ๆ|ผ้าก๊อซเช็ดลิ้น|คอตตอนบัด|เบบี้ออยล์|เบบี้โลชั่น|ตะไบตัดเล็บทารก|หวีขนอ่อน|ฝักบัวกรองน้ำ|ถุงมืออาบน้ำ|ถุงตาข่ายตากฟองน้ำ|อ่างแบบพกพา|น้ำยาทำความสะอาด|ฟองน้ำโฟม-เจล อาบน้ำสระผม สำหรับทารก',
  'ของใช้คุณแม่': 'เข็มขัดพยุงครรภ์|แผ่นซับน้ำนม|ครีมทาหน้าท้อง|ครีมทาหัวนม|เครื่องดื่มเพิ่มน้ำนม|ชุดให้นม|ถุงซิปล็อค|แผ่นประคบหน้าอก|ชุดชั้นในให้นม|ผ้าพาดบ่า|กล้องเบบี้มอนิเตอร์|ซิลิโคนครอบหัวนม|ผ้าอนามัยสำหรับหลังคลอด|ผ้ารัดหน้าท้องหลังคลอด|เข็มขัดรัดสะโพกหลังคลอด',
  'การเดินทาง': 'คาร์ซีท|รถเข็นเด็ก|เป้อุ้ม|ทิชชู่เปียก|สเปรย์แอลกอฮอล์|กระเป๋าสำหรับใส่ของลูก|ผ้าคลุมรถเข็นเด็ก|พลาสติกคลุมกันฝน/ละอองน้ำ|ถุงขยะใส่แพมเพิส|กระเป๋าเปลี่ยนผ้าอ้อมแบบพกพา|ม่านกันแดดติดกระจกรถยนต์|ตาข่ายกันยุงสำหรับรถเข็น',
  'ให้นม': 'ผ้าคลุมให้นม|เครื่องปั๊มนม|กรวยปั๊มนมซิลิโคน|ถุงเก็บน้ำนม|แปรงล้างขวดนม|ขวดนม|เครื่องอุ่นนม|เครื่องอบ|หมอนให้นม|ที่ตากขวดนม|กระปุกใส่นมผง|น้ำยาล้างขวดนม|กระเป๋าเก็บอุณหภูมิ + เจล',
  'เสริมพัฒนาการ': 'หนังสือนิทาน|หนังสือผ้า|เพลย์ยิม|โมบาย|ของเล่นมีเสียง|ตุ๊กตาแขวนเสริมพัฒนาการ',
  'ของใช้เด็ก': 'ตุ๊กตากันสะดุ้ง|เบาะอุ้มเด็ก|จุกหลอก|ที่แขวนจุกหลอก|ผ้าเช็ดหน้า / เช็ดปาก|กิ๊ฟและที่คาดผมเด็ก',
  'เสื้อผ้า': 'ผ้าห่อตัว|ผ้าอ้อม|ผ้าอ้อมสำเร็จรูป|ผ้ากันน้ำลาย|ชุดและผ้ากันสะดุ้ง|ถุงมือ-ถุงเท้า|ถุงนอน|เสื้อผ้าเด็กอ่อน|หมวก|เบาะเปลี่ยนผ้าอ้อม|เบาะเปลี่ยนผ้าอ้อมพร้อมขาตั้ง',
  'การนอน': 'ผ้าห่ม|เตียงนอน|คอกกั้น|เปลนอนทารก|เบาะนอนทารก|หมอนข้าง หรือ หมอนดันหลัง|โคมไฟ แบบปรับความสว่างได้|ตุ๊กตากล่อมนอน แบบมีเสียง|แผ่นรองซับปัสสาวะทารก|หมอนกันกรดไหลย้อน|หมอนหนุน หรือ หมอนหัวทุย',
};

/** รันครั้งเดียวจากหน้า Apps Script */
function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(SHEETS[name]);
    sh.setFrozenRows(1);
  });
  const items = ss.getSheetByName('items');
  if (items.getLastRow() <= 1) {
    const now = new Date().toISOString();
    const rows = [];
    let n = 0;
    Object.keys(SEED).forEach(function (cat, ci) {
      SEED[cat].split('|').forEach(function (name, j) {
        n++;
        rows.push(['c' + (ci + 1) + '-' + ('0' + (j + 1)).slice(-2), name, cat, '', '', false, '', '', '', '', n, '', now]);
      });
    });
    items.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
}

function doGet() {
  return json_(state_());
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const b = JSON.parse(e.postData.contents || '{}');
    const by = clean_(b.by, 40) || 'ไม่ระบุชื่อ';
    const now = new Date().toISOString();
    const items = rows_('items');
    const item = b.id ? items.find(function (r) { return r.id === b.id; }) : null;

    switch (b.action) {
      case 'toggle': {
        if (!item) throw new Error('ไม่พบรายการ');
        if (b.done) {
          update_('items', item.id, { done: true, doneBy: by, doneAt: now });
          log_(by, 'check', item, 'ติ๊ก “' + item.name + '” ว่าซื้อแล้ว');
        } else {
          update_('items', item.id, { done: false, doneBy: '', doneAt: '', paid: '', paidShop: '' });
          log_(by, 'uncheck', item, 'เอาติ๊ก “' + item.name + '” ออก');
        }
        break;
      }
      case 'buy': {
        const p = rows_('prices').find(function (r) { return r.id === b.priceId; });
        if (!item || !p) throw new Error('ไม่พบรายการหรือราคา');
        update_('items', item.id, { done: true, doneBy: by, doneAt: now, paid: Number(p.price), paidShop: p.shop });
        log_(by, 'bought', item, 'ซื้อ “' + item.name + '” ที่ ' + p.shop + ' ราคา ฿' + p.price);
        break;
      }
      case 'addPrice': {
        const it = items.find(function (r) { return r.id === b.itemId; });
        const price = Number(b.price);
        const shop = clean_(b.shop, 60);
        if (!it || !shop || !(price >= 0)) throw new Error('ข้อมูลราคาไม่ครบ');
        const url = /^https?:\/\//i.test(b.url || '') ? String(b.url).slice(0, 500) : '';
        append_('prices', { id: 'p' + Date.now().toString(36) + rand_(), itemId: it.id, shop: shop, price: price, url: url, by: by, at: now });
        log_(by, 'price', it, 'บันทึกราคา “' + it.name + '” ที่ ' + shop + ' ฿' + price);
        break;
      }
      case 'editPrice': {
        const p = rows_('prices').find(function (r) { return r.id === b.priceId; });
        const price = Number(b.price);
        const shop = clean_(b.shop, 60);
        if (!p || !shop || !(price >= 0)) throw new Error('ข้อมูลราคาไม่ครบ');
        const it = items.find(function (r) { return r.id === p.itemId; });
        update_('prices', p.id, { shop: shop, price: price });
        log_(by, 'price-edit', it, 'แก้ราคา “' + (it ? it.name : '') + '” ' + p.shop + ' ฿' + p.price + ' → ' + shop + ' ฿' + price);
        break;
      }
      case 'delPrice': {
        const p = rows_('prices').find(function (r) { return r.id === b.priceId; });
        if (!p) break;
        const it = items.find(function (r) { return r.id === p.itemId; });
        remove_('prices', p.id);
        log_(by, 'price-del', it, 'ลบราคา ' + p.shop + ' ฿' + p.price + ' ของ “' + (it ? it.name : '') + '”');
        break;
      }
      case 'addItem': {
        const name = clean_(b.name, 120);
        if (!name) throw new Error('ใส่ชื่อของก่อน');
        const it = { id: 'u' + Date.now().toString(36) + rand_(), name: name, cat: clean_(b.cat, 40) || 'อื่น ๆ', qty: clean_(b.qty, 40), note: '', done: false, doneBy: '', doneAt: '', paid: '', paidShop: '', order: Date.now(), createdBy: by, createdAt: now };
        append_('items', it);
        log_(by, 'add', it, 'เพิ่มรายการ “' + name + '” ในหมวด' + it.cat);
        break;
      }
      case 'editItem': {
        if (!item) throw new Error('ไม่พบรายการ');
        update_('items', item.id, { qty: clean_(b.qty, 40), note: clean_(b.note, 300) });
        log_(by, 'edit', item, 'แก้จำนวน/โน้ตของ “' + item.name + '”');
        break;
      }
      case 'delItem': {
        if (!item) break;
        remove_('items', item.id);
        log_(by, 'del', item, 'ลบรายการ “' + item.name + '”');
        break;
      }
      default:
        throw new Error('ไม่รู้จักคำสั่งนี้');
    }
    return json_(state_());
  } catch (err) {
    return json_({ error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- helpers ---------- */
function sheet_(name) { return SpreadsheetApp.getActive().getSheetByName(name); }

function rows_(name) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const head = SHEETS[name];
  return sh.getRange(2, 1, last - 1, head.length).getValues().map(function (v) {
    const o = {};
    head.forEach(function (h, i) { o[h] = v[i] instanceof Date ? v[i].toISOString() : v[i]; });
    return o;
  });
}

function rowIndex_(name, id) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function safe_(v) {
  return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
}

function append_(name, obj) {
  sheet_(name).appendRow(SHEETS[name].map(function (h) { return safe_(obj[h] === undefined ? '' : obj[h]); }));
}

function update_(name, id, patch) {
  const r = rowIndex_(name, id);
  if (r < 0) return;
  const head = SHEETS[name];
  const sh = sheet_(name);
  Object.keys(patch).forEach(function (k) {
    const c = head.indexOf(k);
    if (c >= 0) sh.getRange(r, c + 1).setValue(safe_(patch[k]));
  });
}

function remove_(name, id) {
  const r = rowIndex_(name, id);
  if (r > 0) sheet_(name).deleteRow(r);
}

function log_(by, type, item, text) {
  append_('log', { at: new Date().toISOString(), by: by, type: type, itemId: item ? item.id : '', itemName: item ? item.name : '', text: text });
}

function clean_(v, max) { return String(v == null ? '' : v).trim().slice(0, max); }
function rand_() { return Math.random().toString(36).slice(2, 6); }

function state_() {
  const log = rows_('log');
  return {
    items: rows_('items').map(function (r) {
      r.done = r.done === true || r.done === 'TRUE';
      r.paid = r.paid === '' ? null : Number(r.paid);
      return r;
    }),
    prices: rows_('prices').map(function (r) { r.price = Number(r.price); return r; }),
    log: log.slice(-300).reverse(),
  };
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
