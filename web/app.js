// ============================
// Skin Fix PWA - app.js (scan-enabled)
// ============================

// ---- CONFIG (Stage today) ----
const SUPABASE_URL = "https://eufsagjogrwlgarbrsmy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1ZnNhZ2pvZ3J3bGdhcmJyc215Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgwMDcsImV4cCI6MjA3MzA3NDAwN30.h7tuaF3UjwlC0JuEc9OXz025K6CqDyHKZWnSn7PQvIw"; // keep your current anon
const API_BASE = "https://ku3gfs7548.execute-api.us-east-2.amazonaws.com"; // API Gateway (HTTP API)
const BASE_ORIGIN = "https://dazzling-lebkuchen-254602.netlify.app/";      // for magic-link redirect

console.log("app.js ready", new Date().toISOString());

// ---- Supabase client (single, persistent) ----
window.supa = window.supa || (typeof supabase !== "undefined"
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "implicit",
      },
    })
  : null);
const supa = window.supa;

// ---- Small DOM helper ----
const $ = (id) => document.getElementById(id);

// ---- Auth header UI ----
async function refreshAuthUI() {
  try {
    const { data: { session} } = await supa.auth.getSession();
    const authed = !!session?.access_token;
    const s = $("authStatus");
    const bSignOut = $("btnSignOut");
    const bMagic = $("btnMagic");
    if (s) s.textContent = authed ? "Signed in" : "Not signed in";
    if (bSignOut) bSignOut.style.display = authed ? "" : "none";
    if (bMagic) bMagic.style.display = authed ? "none" : "";
  } catch (e) {
    console.warn("refreshAuthUI error", e);
  }
}

// Debug + keep UI in sync
supa?.auth.onAuthStateChange((event, session) => {
  console.log("[auth] event:", event, "hasToken:", !!session?.access_token);
  refreshAuthUI();
});

// Process magic-link return, then clean URL and refresh UI
(async () => {
  await refreshAuthUI();
  await new Promise((r) => setTimeout(r, 200)); // let SDK parse hash
  const { data: { session } } = await supa.auth.getSession();
  if (location.hash && (location.hash.includes("access_token") || location.hash.includes("refresh_token"))) {
    if (session?.access_token) history.replaceState({}, "", BASE_ORIGIN);
  }
  await refreshAuthUI();
})();

// Magic link sender
$("btnMagic")?.addEventListener("click", async () => {
  const email = ($("authEmail")?.value || "").trim();
  if (!email) return alert("Enter your staff email");
  const { error } = await supa.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: BASE_ORIGIN },
  });
  if (error) return alert(error.message);
  alert("Magic link sent. Open it in the same browser as this page.");
});

// Sign out
$("btnSignOut")?.addEventListener("click", async () => {
  await supa.auth.signOut();
  await refreshAuthUI();
});

// ---- Patient context: read ?cust_id= from URL and prefill ----
(function prefillCustIdFromQuery() {
  try {
    const u = new URL(location.href);
    const v = u.searchParams.get("cust_id");
    if (v && $("upCust")) $("upCust").value = v;
  } catch {}
})();

// ---- Upload helpers ----
function toast(msg) {
  try {
    if (window?.Toastify) window.Toastify({ text: msg, duration: 2000 }).showToast();
    else console.log("[toast]", msg);
  } catch { console.log("[toast]", msg); }
}

async function withLock(btn, fn) {
  if (!btn) return fn();
  btn.disabled = true;
  try { return await fn(); }
  finally { btn.disabled = false; }
}

// ---- Presign: returns { url, key, headers } ----
async function presign(cust_id, name, type) {
  const body = JSON.stringify({
    cust_id,
    object_name: name,
    content_type: type || "application/octet-stream",
  });

  // Add staff bearer token from Supabase
  let authHeader = {};
  try {
    const { data: { session } } = await supa.auth.getSession();
    if (session?.access_token) {
      authHeader = { authorization: `Bearer ${session.access_token}` };
    }
  } catch {}

  const res = await fetch(`${API_BASE}/media/presign`, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeader },
    body,
  });

  const txt = await res.text();
  console.log("presign status", res.status, res.statusText, txt);
  if (!res.ok) throw new Error(`presign ${res.status}: ${txt}`);
  return JSON.parse(txt);
}

// ---- Upload via returned presigned URL ----
async function uploadWithPresign(file, cust_id) {
  if (!file) throw new Error("No file selected");
  if (!cust_id) throw new Error("cust_id required (QR/check-in)");

  const p = await presign(cust_id, file.name, file.type || "application/octet-stream");

  // The Lambda returns headers to enforce SSE-KMS and include non-PHI metadata
  const putRes = await fetch(p.url, {
    method: "PUT",
    headers: p.headers || { "content-type": file.type || "application/octet-stream" },
    body: file,
  });

  if (!putRes.ok) {
    const txt = await putRes.text();
    throw new Error(`S3 PUT ${putRes.status}: ${txt}`);
  }

  if ($("upOut")) $("upOut").textContent = JSON.stringify({ key: p.key }, null, 2);
  return { key: p.key, bucket: p.bucket };
}

// ---- Wire the Upload button: #upBtn uses #upFile and #upCust ----
(function wireUpload() {
  const btn = $("upBtn");
  const fileIn = $("upFile");
  const custIn = $("upCust");
  console.log("upBtn present?", !!btn);

  btn?.addEventListener("click", () =>
    withLock(btn, async () => {
      console.log("upload click: starting");
      try {
        const file = fileIn?.files?.[0];
        const cust = (custIn?.value || "").trim();
        const res = await uploadWithPresign(file, cust);
        toast(`Uploaded ✓ ${res.key}`);
      } catch (e) {
        console.error("upload failed", e);
        toast(e?.message || "Upload failed");
        if ($("upOut")) $("upOut").textContent = e?.message || String(e);
      }
    })
  );
})();

// ---- Handle /share route uploads (Web Share Target) ----
(async function handleShareTarget(){
  if (location.pathname !== '/share') return;

  let cust = new URLSearchParams(location.search).get('cust_id')
           || ($("upCust")?.value || '').trim()
           || prompt('Patient ID to tag these photos?');
  if (!cust) { alert('No patient selected'); history.replaceState({}, '', '/'); return; }

  // Fallback path: most mobile browsers will re-use your file input content after share
  const files = $("upFile")?.files || [];
  if (!files.length) {
    alert('No files found in share payload; use the Upload button.');
    history.replaceState({}, '', '/');
    return;
  }

  for (const f of files) await uploadWithPresign(f, cust);
  alert(`Uploaded ${files.length} file(s) to S3 for ${cust}`);
  history.replaceState({}, '', '/');
})();

// ---- In-app QR scanner (ZXing) with proper stop() ----
(() => {
  const btn = document.getElementById('btnScanQR');
  const modal = document.getElementById('qrScanModal');
  const video = document.getElementById('qrVideo');
  const btnClose = document.getElementById('qrScanClose');

  let codeReader;
  let scannerControls = null; // <-- store controls here
  let stopping = false;

  async function ensureScannerLib(){
    if (window.ZXingBrowser) return window.ZXingBrowser;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    }).catch(()=>{});
    return window.ZXingBrowser || null;
  }

  async function startScanner(){
    try {
      const ZX = await ensureScannerLib();
      if (!ZX) throw new Error('QR scanner library unavailable. Try refreshing or check network.');
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('This device/browser has no camera access.');

      const devices = await ZX.BrowserCodeReader.listVideoInputDevices();
      if (!devices.length) throw new Error('No camera found. Use a phone or plug in a webcam.');
      const back = devices.find(d => /back|rear|environment/i.test(d.label)) || devices[0];

      codeReader = codeReader || new ZX.BrowserMultiFormatReader();
      modal.style.display = 'flex';
      stopping = false;

      // Start scanning and keep a handle to the controls
      scannerControls = await codeReader.decodeFromVideoDevice(back.deviceId, video, (result, err, controls) => {
        // controls is also provided here; ensure we keep it
        if (!scannerControls && controls) scannerControls = controls;

        if (stopping) return;
        if (result) {
          const text = result.getText();
          const m = /[?&]cust_id=([0-9a-f-]{36})/i.exec(text);
          const cust = m ? m[1] : (/^[0-9a-f-]{36}$/i.test(text) ? text : null);
          if (cust) {
            const input = document.getElementById('upCust');
            if (input) input.value = cust;
            stopScanner();
          }
        }
      });
    } catch (e) {
      modal.style.display = 'none';
      alert(e?.message || 'Camera error.');
    }
  }

  async function stopScanner(){
    try {
      stopping = true;
      // Properly stop ZXing
      if (scannerControls?.stop) {
        await scannerControls.stop();
      }
      scannerControls = null;

      // Also stop media tracks
      const stream = video.srcObject;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        video.srcObject = null;
      }
    } finally {
      modal.style.display = 'none';
      stopping = false;
    }
  }

  btn?.addEventListener('click', startScanner);
  btnClose?.addEventListener('click', stopScanner);
  modal?.addEventListener('click', (e) => { if (e.target === modal) stopScanner(); });
})();

