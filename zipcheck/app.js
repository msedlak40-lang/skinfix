// Use a real base origin (phone can reach). On local dev, set to your PC's IP + port.
const BASE_ORIGIN = "https://dazzling-lebkuchen-254602.netlify.app/"; 
const PAGE_PATH   = "/"; 
function buildLink(cust_id){ return `${BASE_ORIGIN}${PAGE_PATH}?cust_id=${cust_id}`; }

// ---- CONFIG: Stage for now ----
const SUPABASE_URL = "https://eufsagjogrwlgarbrsmy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1ZnNhZ2pvZ3J3bGdhcmJyc215Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgwMDcsImV4cCI6MjA3MzA3NDAwN30.h7tuaF3UjwlC0JuEc9OXz025K6CqDyHKZWnSn7PQvIw";

// For dev, replace with:
// const SUPABASE_URL = "https://wbykdswgvfgcfcumcbvn.supabase.co";
// const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndieWtkc3dndmZnY2ZjdW1jYnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTc2NjAsImV4cCI6MjA3MzA3MzY2MH0.-e1D79iX4Sb-wEU-Six0QZ3_QYe4MIzh5uyoBQMUAyc";

// --- Theme / Logo toggle ---
const logoDark  = document.getElementById('logoDark');
const logoLight = document.getElementById('logoLight');
const themeToggle = document.getElementById('themeToggle');
let light = false;
themeToggle?.addEventListener('click', () => {
  light = !light;
  document.documentElement.classList.toggle('light', light);
  logoDark?.classList.toggle('hidden', light);
  logoLight?.classList.toggle('hidden', !light);
});

// --- Toast helper ---
function toast(msg, ms=2200){
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=> t.remove(), ms);
}

// --- Functions base + helpers ---
const FUNC_BASE = `${SUPABASE_URL}/functions/v1`;

async function fPost(path, body){
  const res = await fetch(`${FUNC_BASE}/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(()=> ({}));
  if (!res.ok) throw (data?.error || data);
  return data;
}

async function fGet(path){
  const res = await fetch(`${FUNC_BASE}/${path}`, {
    headers: { 'authorization': `Bearer ${SUPABASE_ANON_KEY}` }
  });
  const data = await res.json().catch(()=> ({}));
  if (!res.ok) throw (data?.error || data);
  return data;
}

function normPhone(p){
  const d = (p||'').replace(/\D/g,'');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d[0]==='1') return `+${d}`;
  return p?.startsWith('+') ? p : `+${d}`;
}

// --- Front Desk elements ---
const fdPhone       = document.getElementById('fdPhone');
const fdCheckinBtn  = document.getElementById('fdCheckinBtn');
const fdBalancesBtn = document.getElementById('fdBalancesBtn');
const fdRedeemBtn   = document.getElementById('fdRedeemBtn');
const fdPerk        = document.getElementById('fdPerk');
const fdOut         = document.getElementById('fdOut');
const fdErr         = document.getElementById('fdErr');
const fdCopyQRBtn = document.getElementById('fdCopyQRBtn');
const fdQR        = document.getElementById('fdQR');
const fdShowQRBtn  = document.getElementById('fdShowQRBtn');
const fdQRImg      = document.getElementById('fdQRImg');
const fdQRDownload = document.getElementById('fdQRDownload');
const fdNote = document.getElementById('fdNote');
const dupRow  = document.getElementById('dupRow');
const dupWarn = document.getElementById('dupWarn');
const mergeBtn = document.getElementById('mergeBtn');
// --- Simple lock + debounce for buttons ---
const CLICK_COOLDOWN_MS = 2000; // 2s between redeems
const _lastClickAt = new Map(); // btn -> timestamp

async function withLock(btn, work) {
  if (!btn) return work();

  const now = Date.now();
  const last = _lastClickAt.get(btn) || 0;
  if (now - last < CLICK_COOLDOWN_MS) {
    toast(`Please wait ${(Math.ceil((CLICK_COOLDOWN_MS - (now - last))/1000))}s…`);
    return;
  }
  _lastClickAt.set(btn, now);

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = 'Working…';
  try {
    return await work();
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
    // keep timestamp so rapid clicks still respect cooldown
  }
}

// --- QR / cust_id elements ---
const qrCustId    = document.getElementById('qrCustId');
const qrRedeemBtn = document.getElementById('qrRedeemBtn');

// --- Audit elements ---
const auditOut     = document.getElementById('auditOut');
const auditRefresh = document.getElementById('auditRefresh');

// Prefill QR cust_id from URL (?cust_id=...)
(() => {
  const u = new URL(location.href);
  const v = u.searchParams.get('cust_id');
  if (v && qrCustId) qrCustId.value = v;
})();

// Load perks into dropdown (from perks function if present, else fallback)
(async () => {
  try {
    const res = await fGet('perks'); // requires the tiny 'perks' function deployed
    if (fdPerk && res?.data?.length) {
      fdPerk.innerHTML = res.data.map(p => `<option value="${p.perk_code}">${p.perk_code}</option>`).join('');
    } else if (fdPerk) {
      fdPerk.innerHTML = `<option value="FACIAL_CREDIT">FACIAL_CREDIT</option>`;
    }
  } catch {
    if (fdPerk) fdPerk.innerHTML = `<option value="FACIAL_CREDIT">FACIAL_CREDIT</option>`;
  }
})();

// --- Button handlers ---
fdCheckinBtn?.addEventListener('click', async () => {
  fdErr.textContent=''; fdOut.textContent='{}';
  try{
    const phone = normPhone(fdPhone.value);
    const res = await fPost('checkin', { phone });
    fdOut.textContent = JSON.stringify(res, null, 2);
    toast('Checked in.');
  }catch(e){
    const msg = e?.message || JSON.stringify(e);
    fdErr.textContent = msg;
    toast('Check-in failed');
  }
});

fdBalancesBtn?.addEventListener('click', async () => {
  fdErr.textContent=''; fdOut.textContent='{}';
  try{
    const phone = encodeURIComponent(normPhone(fdPhone.value));
    const res = await fGet(`balances?phone=${phone}`);
    fdOut.textContent = JSON.stringify(res, null, 2);
    toast('Balances loaded.');
  }catch(e){
    const msg = e?.message || JSON.stringify(e);
    fdErr.textContent = msg;
    toast('Could not load balances');
  }
});

fdBalancesBtn?.addEventListener('click', async () => {
  fdErr.textContent=''; fdOut.textContent='{}';
  try{
    const phoneNorm = normPhone(fdPhone.value);
    const phone = encodeURIComponent(phoneNorm);
    const res = await fGet(`balances?phone=${phone}`);
    fdOut.textContent = JSON.stringify(res, null, 2);
    toast('Balances loaded.');

    // Detect duplicates (more than one distinct cust_id for this phone)
    const rows = Array.isArray(res?.data) ? res.data : [];
    const distinct = [...new Set(rows.map(r => r.cust_id))];
    if (distinct.length > 1) {
      dupRow.style.display = 'flex';
      dupWarn.textContent = `Duplicate contacts detected for ${phoneNorm}. Merge to the primary (highest balance) to clean up.`;
      mergeBtn.onclick = async () => {
        try {
          const dupRes = await fPost('merge-duplicates', { phone: phoneNorm });
          toast(`Merged ${dupRes?.merged ?? 0}.`);
          // Re-fetch balances to reflect the cleanup
          const after = await fGet(`balances?phone=${phone}`);
          fdOut.textContent = JSON.stringify(after, null, 2);
          dupRow.style.display = 'none';
        } catch (e) {
          const msg = e?.message || JSON.stringify(e);
          fdErr.textContent = msg;
          toast('Merge failed');
        }
      };
    } else {
      dupRow.style.display = 'none';
    }
  }catch(e){
    const msg = e?.message || JSON.stringify(e);
    fdErr.textContent = msg;
    toast('Could not load balances');
  }
});

fdRedeemBtn?.addEventListener('click', () => withLock(fdRedeemBtn, async () => {
  fdErr.textContent=''; fdOut.textContent='{}';
  try{
    const phone = normPhone(fdPhone.value);
    const perk  = fdPerk?.value || 'FACIAL_CREDIT';
    const idem  = `idem-${Date.now()}`;
    const note  = (fdNote?.value || '').trim();

    const res = await fPost('redeem', {
      phone, perk_code: perk, qty: 1, idempotency_key: idem, actor: 'frontdesk', note
    });

    fdOut.textContent = JSON.stringify(res, null, 2);
    toast('Redeemed!');
  }catch(e){
    const msg = e?.message || JSON.stringify(e);
    fdErr.textContent = msg;
    if (msg.includes('daily_cap_reached')) toast('Daily cap reached for this perk.');
    else if (msg.includes('insufficient_balance')) toast('No remaining credits for this perk.');
    else toast('Redeem failed');
  }
}));

fdCopyQRBtn?.addEventListener('click', async () => {
  fdErr.textContent = '';
  try {
    const phoneRaw = fdPhone.value || '';
    const phone = encodeURIComponent(normPhone(phoneRaw));
    if (!phone || phone === '+') throw new Error('Enter a valid phone first');

    // Reuse balances endpoint to find a cust_id for that phone
    const res = await fGet(`balances?phone=${phone}`);
    const rows = Array.isArray(res?.data) ? res.data : [];
    if (!rows.length) throw new Error('No contact found for that phone');

    // Pick the first row’s cust_id (same across rows for that phone)
    const cust_id = rows[0]?.cust_id;
    if (!cust_id) throw new Error('Could not resolve cust_id');

    // Build page link with ?cust_id=
    const url = buildLink(cust_id);
    if (fdQR) fdQR.value = url;

    // Copy to clipboard
    await navigator.clipboard?.writeText(url).catch(() => {});
    toast('QR link copied to clipboard.');
  } catch (e) {
    const msg = e?.message || JSON.stringify(e);
    fdErr.textContent = msg;
    toast('Could not make QR link');
  }
});
fdShowQRBtn?.addEventListener('click', async () => {
  fdErr.textContent = '';
  try {
    const phoneRaw = fdPhone.value || '';
    const phone = encodeURIComponent(normPhone(phoneRaw));
    if (!phone || phone === '+') throw new Error('Enter a valid phone first');

    // Reuse balances to resolve cust_id for this phone
    const res = await fGet(`balances?phone=${phone}`);
    const rows = Array.isArray(res?.data) ? res.data : [];
    if (!rows.length) throw new Error('No contact found for that phone');
    const cust_id = rows[0]?.cust_id;
    if (!cust_id) throw new Error('Could not resolve cust_id');

    // Build page link with ?cust_id=
    const link = buildLink(cust_id);

    // Generate a QR image via a simple image API (non-PHI: only cust_id in URL)
    const qrURL = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}`;

    // Show the QR and a download link
    if (fdQRImg) {
      fdQRImg.src = qrURL;
      fdQRImg.style.display = 'inline-block';
    }
    if (fdQRDownload) {
      fdQRDownload.href = qrURL;
      fdQRDownload.style.display = 'inline-block';
    }

    // Also populate the text field if present (from the “Copy QR Link” row)
    if (typeof fdQR !== 'undefined' && fdQR) fdQR.value = link;

    toast('QR ready.');
  } catch (e) {
    const msg = e?.message || JSON.stringify(e);
    fdErr.textContent = msg;
    toast('Could not render QR');
  }
});

qrRedeemBtn?.addEventListener('click', () => withLock(qrRedeemBtn, async () => {
  fdErr.textContent=''; fdOut.textContent='{}';
  try{
    const cust_id = (qrCustId?.value || '').trim();
    if (!cust_id) throw new Error('cust_id required (scan/QR)');
    const perk  = fdPerk?.value || 'FACIAL_CREDIT';
    const idem  = `idem-${Date.now()}`;
    const note  = (fdNote?.value || '').trim();

    const res = await fPost('redeem', {
      cust_id, perk_code: perk, qty: 1, idempotency_key: idem, actor: 'frontdesk-scan', note
    });

    fdOut.textContent = JSON.stringify(res, null, 2);
    toast('Redeemed!');
  }catch(e){
    const msg = e?.message || JSON.stringify(e);
    fdErr.textContent = msg;
    if (msg.includes('daily_cap_reached')) toast('Daily cap reached for this perk.');
    else if (msg.includes('insufficient_balance')) toast('No remaining credits for this perk.');
    else toast('Redeem failed');
  }
}));

// Audit placeholder (wire to an endpoint later)
auditRefresh?.addEventListener('click', async () => {
  try {
    const res = await fGet('audit?limit=10'); // or &phone=%2B15555550123 to filter
    auditOut.textContent = JSON.stringify(res, null, 2);
    toast('Audit loaded.');
  } catch (e) {
    const msg = e?.message || JSON.stringify(e);
    auditOut.textContent = '{}';
    fdErr.textContent = msg;
    toast('Audit failed');
  }
});

// Register service worker (PWA)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
