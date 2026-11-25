// ==UserScript==
// @name         ALFA SMART ANSWER - KINDLY LEARNING SYNC
// @namespace    https://kindly-learning2.vercel.app
// @version      2.0
// @description  Deteksi otomatis soal Alfa Learning terhubung ke MongoDB KINDLY LEARNING
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
  if (document.getElementById('kindly-alfa-panel')) return;

  const API_URL = 'https://kindly-learning2.vercel.app/api/index';
  let dbSoal = [];

  const panel = document.createElement('div');
  panel.id = 'kindly-alfa-panel';
  panel.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:999999;background:#fff;border-top:4px solid #166534;box-shadow:0 -4px 16px rgba(0,0,0,0.25);font-family:system-ui,sans-serif;';
  panel.innerHTML = `
    <div style="background:#166534;color:#fff;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-weight:800;font-size:13px;">ALFA SMART ANSWER • KINDLY</div>
        <div id="ka-stat" style="font-size:11px;opacity:0.9;">Memuat database MongoDB...</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <button id="ka-scan" style="background:#22c55e;color:#052e16;border:none;padding:6px 10px;border-radius:6px;font-weight:700;font-size:12px;">Scan Soal</button>
        <button id="ka-toggle" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.4);padding:4px 8px;border-radius:6px;font-size:12px;">▼</button>
      </div>
    </div>
    <div id="ka-body" style="padding:12px;max-height:210px;overflow-y:auto;font-size:13px;color:#1e293b;">
      <div id="ka-result">Menunggu halaman kuis...</div>
      <div style="margin-top:10px;display:flex;gap:6px;">
        <input id="ka-manual" placeholder="Cari manual kata kunci soal..." style="flex:1;padding:7px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;" />
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  let minimized = false;
  document.getElementById('ka-toggle').onclick = () => {
    minimized = !minimized;
    document.getElementById('ka-body').style.display = minimized ? 'none' : 'block';
    document.getElementById('ka-toggle').textContent = minimized ? '▲' : '▼';
  };

  async function syncDatabase() {
    try {
      const res = await fetch(API_URL);
      const json = await res.json();
      if (json.ok) {
        dbSoal = json.data;
        document.getElementById('ka-stat').textContent = `MongoDB Aktif • Total Kisi: ${dbSoal.length}`;
        scanPage();
      }
    } catch (e) {
      document.getElementById('ka-stat').textContent = 'Gagal koneksi server Vercel';
    }
  }

  function findMatch(text) {
    const clean = text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (clean.length < 6) return null;
    return dbSoal.find(item => {
      const s = item.soal.toLowerCase().replace(/\s+/g, ' ').trim();
      return s.includes(clean) || clean.includes(s);
    });
  }

  function scanPage() {
    const resBox = document.getElementById('ka-result');
    // Deteksi elemen soal Moodle / Alfa Learning (.qtext)
    const qNodes = document.querySelectorAll('.qtext, .que .content, h3, p');
    let found = [];

    qNodes.forEach(el => {
      const txt = el.innerText || '';
      const match = findMatch(txt);
      if (match && !found.some(f => f._id === match._id)) {
        found.push(match);
      }
    });

    if (found.length > 0) {
      resBox.innerHTML = found.map(f => `
        <div style="background:#f0fdf4;border:1px solid #86efac;padding:8px 10px;border-radius:8px;margin-bottom:6px;">
          <div style="font-size:11px;color:#166534;font-weight:700;">Soal Terdeteksi:</div>
          <div style="font-size:12px;margin:2px 0;">${f.soal}</div>
          <div style="font-weight:800;color:#15803d;font-size:13px;">✓ Jawaban: ${f.jawaban}</div>
        </div>
      `).join('');
    } else {
      resBox.innerHTML = '<span style="color:#64748b;">Belum ada soal kuis terdeteksi di halaman ini. Buka halaman kuis atau ketik kata kunci di bawah.</span>';
    }
  }

  document.getElementById('ka-scan').onclick = scanPage;
  document.getElementById('ka-manual').oninput = (e) => {
    const q = e.target.value.toLowerCase().trim();
    const resBox = document.getElementById('ka-result');
    if (!q) return scanPage();
    const matches = dbSoal.filter(x => x.soal.toLowerCase().includes(q) || x.jawaban.toLowerCase().includes(q)).slice(0, 5);
    resBox.innerHTML = matches.length
      ? matches.map(m => `<div style="padding:6px;border-bottom:1px solid #e2e8f0;"><b>${m.soal}</b><br><span style="color:#15803d;font-weight:700;">✓ ${m.jawaban}</span></div>`).join('')
      : '<span style="color:#94a3b8;">Tidak ditemukan di database.</span>';
  };

  syncDatabase();
})();
