// ============================
// Media Upload Page
// Upload before/after photos for treatments
// ============================

import api from '../shared/api.js';
import utils from '../shared/utils.js';
import components from '../shared/components.js';

let selectedCustomer = null;
let selectedTreatment = null;
let consentConfirmed = false;
let beforePhotos = [];
let afterPhotos = [];
let currentEncounterId = null;
let isAddingAfterPhotos = false; // Flag to indicate we're adding after photos to existing encounter

export async function render() {
  const treatmentSelectHTML = await components.createTreatmentSelect();

  return `
    <div class="card">
      <h2>📸 Media Upload</h2>
      <p style="color: var(--muted);">Upload before/after treatment photos for approval</p>
    </div>

    <!-- Customer Selection -->
    <div class="card">
      <h3>1. Select Customer</h3>
      <div class="customer-search">
        <input
          id="customerSearchInput"
          type="text"
          placeholder="Search by name or phone..."
          autocomplete="off"
          style="width: 100%;"
        />
        <div id="customerSearchResults" style="
          position: absolute;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 10px;
          margin-top: 4px;
          max-height: 300px;
          overflow-y: auto;
          display: none;
          z-index: 100;
          width: calc(100% - 32px);
        "></div>
      </div>

      <div id="selectedCustomer" style="display: none; margin-top: 12px;">
        <div style="
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div>
            <strong id="selectedCustomerName"></strong>
            <div style="font-size: 14px; color: var(--muted);" id="selectedCustomerPhone"></div>
          </div>
          <button id="clearCustomer" class="btn" style="padding: 6px 12px;">Change</button>
        </div>
      </div>

      <div id="newCustomerForm" style="display: none; margin-top: 12px;">
        <div class="card" style="padding: 16px;">
          <h4>New Customer</h4>
          <div class="row">
            <label>Name</label>
            <input id="newCustomerName" type="text" required />
          </div>
          <div class="row">
            <label>Phone</label>
            <input id="newCustomerPhone" type="tel" placeholder="+15555550123" required />
          </div>
          <div class="row">
            <label>Email (optional)</label>
            <input id="newCustomerEmail" type="email" />
          </div>
          <div class="row">
            <button id="saveNewCustomer" class="btn accent">Create Customer</button>
            <button id="cancelNewCustomer" class="btn">Cancel</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Pending Encounters (needs after photos) -->
    <div class="card" id="pendingEncountersSection" style="display: none;">
      <h3>📋 Encounters Awaiting After Photos</h3>
      <p style="color: var(--muted); margin-bottom: 12px;">This customer has treatments waiting for after photos:</p>
      <div id="pendingEncountersList"></div>
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
        <button id="startNewEncounter" class="btn accent">+ Start New Treatment</button>
      </div>
    </div>

    <!-- Treatment Selection -->
    <div class="card" id="treatmentSection" style="display: none;">
      <h3>2. Select Treatment</h3>
      <div class="row" style="gap: 12px; align-items: center;">
        ${treatmentSelectHTML}
        <button id="addTreatmentBtn" class="btn" style="white-space: nowrap;">+ Add Treatment</button>
      </div>

      <!-- New Treatment Form -->
      <div id="newTreatmentForm" style="display: none; margin-top: 16px; padding: 16px; background: var(--card); border: 1px solid var(--border); border-radius: 10px;">
        <h4>Add New Treatment</h4>
        <div class="row">
          <label>Treatment Name</label>
          <input id="newTreatmentName" type="text" placeholder="e.g., Dermaplaning" required />
        </div>
        <div class="row">
          <label>Results Timing</label>
          <select id="newTreatmentTiming" class="btn">
            <option value="immediate">Immediate (results show right away)</option>
            <option value="delayed">Delayed (results take time to appear)</option>
          </select>
        </div>
        <div class="row" id="delayDaysRow" style="display: none;">
          <label>Days Until Results Show</label>
          <input id="newTreatmentDelayDays" type="number" min="1" max="30" value="7" />
        </div>
        <div class="row" style="gap: 12px;">
          <button id="saveTreatment" class="btn accent">Create Treatment</button>
          <button id="cancelTreatment" class="btn">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Consent Verification -->
    <div class="card" id="consentSection" style="display: none;">
      <h3>3. Verify Consent</h3>
      <div style="
        background: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.3);
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 16px;
      ">
        <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
          <input type="checkbox" id="consentCheckbox" style="width: 20px; height: 20px; cursor: pointer;" />
          <span>
            <strong>✓ Customer signed marketing consent in EMR</strong>
            <div style="font-size: 14px; color: var(--muted); margin-top: 4px;">
              I confirm this customer has signed consent for before/after photos and social media use
            </div>
          </span>
        </label>
      </div>

      <div id="consentDetails" style="display: none;">
        <div style="font-size: 14px; color: var(--muted);">
          <div>Staff: <span id="staffEmail"></span></div>
          <div>Date: <span id="consentDate"></span></div>
          <div>Method: Digital signature in EMR</div>
        </div>
      </div>
    </div>

    <!-- Photo Upload -->
    <div class="card" id="photoSection" style="display: none;">
      <h3>4. Take Photos</h3>

      <!-- Before Photos -->
      <div style="margin-bottom: 32px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="margin: 0;">Before Photos (<span id="beforePhotoCount">0</span>)</h4>
          <div style="display: flex; gap: 8px;">
            <button id="takeBeforePhoto" class="btn accent" style="padding: 8px 16px;">📷 Take Photo</button>
            <button id="uploadBeforePhoto" class="btn" style="padding: 8px 16px;">📁 Upload</button>
          </div>
        </div>
        <div id="beforePhotosGrid" style="
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 12px;
          margin-top: 12px;
        "></div>
        <input type="file" id="beforePhotoInput" accept="image/*" multiple style="display: none;" />
      </div>

      <!-- After Photos -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="margin: 0;">After Photos (<span id="afterPhotoCount">0</span>)</h4>
          <div style="display: flex; gap: 8px;">
            <button id="takeAfterPhoto" class="btn accent" style="padding: 8px 16px;">📷 Take Photo</button>
            <button id="uploadAfterPhoto" class="btn" style="padding: 8px 16px;">📁 Upload</button>
          </div>
        </div>
        <div id="afterPhotosGrid" style="
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 12px;
          margin-top: 12px;
        "></div>
        <input type="file" id="afterPhotoInput" accept="image/*" multiple style="display: none;" />
      </div>
    </div>

    <!-- Optional Details -->
    <div class="card" id="detailsSection" style="display: none;">
      <h3>5. Additional Details (Optional)</h3>

      <div class="row">
        <label>Private Notes</label>
        <textarea
          id="privateNotes"
          placeholder="Customer preferences, special instructions (staff only - never shown in marketing)"
          style="
            width: 100%;
            min-height: 80px;
            padding: 12px;
            border: 1px solid var(--border);
            border-radius: 10px;
            background: transparent;
            color: var(--fg);
            font-family: inherit;
            resize: vertical;
          "
        ></textarea>
      </div>

      <div class="row">
        <label>Custom Tags</label>
        <input
          id="customTags"
          type="text"
          placeholder="dramatic, glowing, natural (comma-separated)"
          style="width: 100%;"
        />
        <small style="color: var(--muted);">Add tags to help find photos later (e.g., dramatic, natural, before-event)</small>
      </div>
    </div>

    <!-- Submit -->
    <div class="card" id="submitSection" style="display: none;">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <div>
          <h3 style="margin: 0;" id="submitTitle">Ready to Submit</h3>
          <p style="color: var(--muted); margin: 4px 0 0 0;" id="submitDescription">Photos will be sent to approval queue</p>
        </div>
        <div style="display: flex; gap: 12px;">
          <button id="saveBeforePhotos" class="btn accent" style="padding: 14px 24px; font-size: 16px; display: none;">
            💾 Save Before Photos
          </button>
          <button id="submitForApproval" class="btn accent" style="padding: 14px 24px; font-size: 16px; display: none;">
            ✅ Submit for Approval
          </button>
        </div>
      </div>
    </div>

    <!-- Camera Modal -->
    <div id="cameraModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 9999; align-items: center; justify-content: center;">
      <div style="width: 100%; max-width: 600px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="color: white; margin: 0;">Take Photo</h3>
          <button id="closeCameraModal" class="btn">Close</button>
        </div>
        <video id="cameraVideo" autoplay playsinline style="width: 100%; border-radius: 10px; background: #000;"></video>
        <div style="text-align: center; margin-top: 12px;">
          <button id="capturePhoto" class="btn accent" style="padding: 14px 32px; font-size: 18px;">
            📷 Capture
          </button>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  setupCustomerSearch();
  setupEventListeners();
}

function setupCustomerSearch() {
  const searchInput = document.getElementById('customerSearchInput');
  const resultsDiv = document.getElementById('customerSearchResults');
  const selectedDiv = document.getElementById('selectedCustomer');
  const newCustomerForm = document.getElementById('newCustomerForm');

  if (!searchInput) return;

  // Debounced search
  const performSearch = utils.debounce(async (query) => {
    if (query.length < 2) {
      resultsDiv.style.display = 'none';
      return;
    }

    try {
      const customers = await api.searchCustomers(query);

      if (customers.length === 0) {
        resultsDiv.innerHTML = `
          <div style="padding: 12px; cursor: pointer;" id="addNewCustomer">
            <strong>+ Add "${utils.escapeHTML(query)}" as new customer</strong>
          </div>
        `;
      } else {
        resultsDiv.innerHTML = customers.map(c => `
          <div class="customer-result" data-cust-id="${c.cust_id}" style="
            padding: 12px;
            cursor: pointer;
            border-bottom: 1px solid var(--border);
          " data-customer='${JSON.stringify(c)}'>
            <strong>${utils.escapeHTML(c.name)}</strong>
            <div style="font-size: 14px; color: var(--muted);">${utils.formatPhone(c.phone)}</div>
          </div>
        `).join('');

        // Add click handlers to results
        document.querySelectorAll('.customer-result').forEach(el => {
          el.addEventListener('click', () => {
            const customer = JSON.parse(el.getAttribute('data-customer'));
            selectCustomer(customer);
          });
        });
      }

      resultsDiv.style.display = 'block';

      // Handle "add new customer" click
      document.getElementById('addNewCustomer')?.addEventListener('click', () => {
        resultsDiv.style.display = 'none';
        newCustomerForm.style.display = 'block';
        document.getElementById('newCustomerName').value = query;

        // Auto-format phone number
        const phoneInput = document.getElementById('newCustomerPhone');
        if (phoneInput && !phoneInput.hasAttribute('data-formatted')) {
          utils.autoFormatPhone(phoneInput);
          phoneInput.setAttribute('data-formatted', 'true');
        }
      });

    } catch (error) {
      console.error('Customer search error:', error);
      utils.toast('Failed to search customers: ' + error.message, 'error');
    }
  }, 300);

  searchInput.addEventListener('input', (e) => {
    performSearch(e.target.value.trim());
  });

  // Clear customer
  document.getElementById('clearCustomer')?.addEventListener('click', () => {
    selectedCustomer = null;
    searchInput.value = '';
    selectedDiv.style.display = 'none';
    searchInput.parentElement.style.display = 'block';
    updateUI();
  });

  // Save new customer
  document.getElementById('saveNewCustomer')?.addEventListener('click', async () => {
    const name = document.getElementById('newCustomerName').value.trim();
    const phone = document.getElementById('newCustomerPhone').value.trim();
    const email = document.getElementById('newCustomerEmail').value.trim();

    if (!name || !phone) {
      utils.toast('Name and phone are required', 'error');
      return;
    }

    try {
      const newCustomer = await api.createCustomer({ name, phone, email });
      selectCustomer(newCustomer);
      newCustomerForm.style.display = 'none';
      utils.toast('Customer created!', 'success');
    } catch (error) {
      console.error('Create customer error:', error);
      utils.toast('Failed to create customer: ' + error.message, 'error');
    }
  });

  // Cancel new customer
  document.getElementById('cancelNewCustomer')?.addEventListener('click', () => {
    newCustomerForm.style.display = 'none';
    searchInput.value = '';
  });

  async function selectCustomer(customer) {
    selectedCustomer = customer;
    document.getElementById('selectedCustomerName').textContent = customer.name;
    document.getElementById('selectedCustomerPhone').textContent = utils.formatPhone(customer.phone);
    searchInput.parentElement.style.display = 'none';
    selectedDiv.style.display = 'block';
    resultsDiv.style.display = 'none';

    // Load pending encounters for this customer
    await loadPendingEncounters(customer.cust_id);

    updateUI();
  }
}

async function loadPendingEncounters(cust_id) {
  try {
    // Get encounters with status 'pending_after_photos'
    const encounters = await api.getEncounters({
      cust_id,
      status: 'pending_after_photos',
      limit: 10
    });

    const pendingSection = document.getElementById('pendingEncountersSection');
    const pendingList = document.getElementById('pendingEncountersList');

    if (!pendingSection || !pendingList) return;

    if (encounters.length === 0) {
      pendingSection.style.display = 'none';
      return;
    }

    // Show pending encounters
    pendingSection.style.display = 'block';
    pendingList.innerHTML = encounters.map(enc => `
      <div
        class="pending-encounter-item"
        data-encounter-id="${enc.encounter_id}"
        data-treatment-id="${enc.treatment_id}"
        data-treatment-name="${utils.escapeHTML(enc.treatment_name || 'Unknown')}"
        style="
          padding: 12px;
          border: 1px solid var(--border);
          border-radius: 10px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          justify-content: space-between;
          align-items: center;
        "
        onmouseover="this.style.borderColor='var(--accent)'"
        onmouseout="this.style.borderColor='var(--border)'"
      >
        <div>
          <strong>${utils.escapeHTML(enc.treatment_name || 'Unknown Treatment')}</strong>
          <div style="font-size: 14px; color: var(--muted);">
            ${utils.formatRelativeTime(enc.created_at)} • ${enc.before_photo_count || 0} before photo(s)
          </div>
        </div>
        <button class="btn accent" style="padding: 8px 16px;">Add After Photos →</button>
      </div>
    `).join('');

    // Add click handlers to pending encounters
    document.querySelectorAll('.pending-encounter-item').forEach(item => {
      item.addEventListener('click', () => {
        const encounterId = item.getAttribute('data-encounter-id');
        const treatmentId = item.getAttribute('data-treatment-id');
        const treatmentName = item.getAttribute('data-treatment-name');
        loadExistingEncounter(encounterId, treatmentId, treatmentName);
      });
    });

  } catch (error) {
    console.error('Failed to load pending encounters:', error);
  }
}

function loadExistingEncounter(encounterId, treatmentId, treatmentName) {
  // Set mode to adding after photos
  isAddingAfterPhotos = true;
  currentEncounterId = encounterId;
  selectedTreatment = treatmentId;

  // Hide pending encounters section
  document.getElementById('pendingEncountersSection').style.display = 'none';

  // Skip to photo upload section
  consentConfirmed = true; // Consent already exists from before photos

  // Show only after photo section
  utils.toast(`Adding after photos to ${treatmentName} treatment`, 'info');

  updateUI();
}

function setupEventListeners() {
  // Start new encounter button
  document.getElementById('startNewEncounter')?.addEventListener('click', () => {
    document.getElementById('pendingEncountersSection').style.display = 'none';
    isAddingAfterPhotos = false;
    currentEncounterId = null;
    updateUI();
  });

  // Treatment selection
  const treatmentSelect = document.getElementById('treatmentSelect');
  if (treatmentSelect) {
    treatmentSelect.addEventListener('change', (e) => {
      selectedTreatment = e.target.value;
      updateUI();
    });
  }

  // Add treatment button
  const addTreatmentBtn = document.getElementById('addTreatmentBtn');
  const newTreatmentForm = document.getElementById('newTreatmentForm');
  const newTreatmentTiming = document.getElementById('newTreatmentTiming');
  const delayDaysRow = document.getElementById('delayDaysRow');

  if (addTreatmentBtn) {
    addTreatmentBtn.addEventListener('click', () => {
      newTreatmentForm.style.display = 'block';
    });
  }

  if (newTreatmentTiming) {
    newTreatmentTiming.addEventListener('change', (e) => {
      delayDaysRow.style.display = e.target.value === 'delayed' ? 'flex' : 'none';
    });
  }

  // Save new treatment
  document.getElementById('saveTreatment')?.addEventListener('click', async () => {
    const name = document.getElementById('newTreatmentName').value.trim();
    const timing = document.getElementById('newTreatmentTiming').value;
    const delayDays = document.getElementById('newTreatmentDelayDays').value;

    if (!name) {
      utils.toast('Treatment name is required', 'error');
      return;
    }

    try {
      const newTreatment = await api.createTreatment({
        name,
        results_timing: timing,
        results_delay_days: timing === 'delayed' ? parseInt(delayDays) : 0,
        review_delay_days: timing === 'delayed' ? parseInt(delayDays) : 1
      });

      // Refresh treatment dropdown
      const treatmentSection = document.getElementById('treatmentSection');
      const container = treatmentSection.querySelector('.row');
      const newSelect = await components.createTreatmentSelect(newTreatment.treatment_id);
      container.querySelector('select').outerHTML = newSelect;

      // Re-setup listener
      const updatedSelect = document.getElementById('treatmentSelect');
      if (updatedSelect) {
        selectedTreatment = newTreatment.treatment_id;
        updatedSelect.addEventListener('change', (e) => {
          selectedTreatment = e.target.value;
          updateUI();
        });
      }

      newTreatmentForm.style.display = 'none';
      document.getElementById('newTreatmentName').value = '';
      utils.toast(`Treatment "${name}" created!`, 'success');
      updateUI();
    } catch (error) {
      console.error('Create treatment error:', error);
      utils.toast('Failed to create treatment: ' + error.message, 'error');
    }
  });

  // Cancel new treatment
  document.getElementById('cancelTreatment')?.addEventListener('click', () => {
    newTreatmentForm.style.display = 'none';
    document.getElementById('newTreatmentName').value = '';
  });

  // Consent checkbox
  const consentCheckbox = document.getElementById('consentCheckbox');
  if (consentCheckbox) {
    consentCheckbox.addEventListener('change', async (e) => {
      consentConfirmed = e.target.checked;

      if (consentConfirmed) {
        const user = await api.getUser();
        const consentDetails = document.getElementById('consentDetails');
        if (consentDetails) {
          document.getElementById('staffEmail').textContent = user?.email || 'Unknown';
          document.getElementById('consentDate').textContent = utils.formatDate(new Date().toISOString());
          consentDetails.style.display = 'block';
        }
      }

      updateUI();
    });
  }

  // Before photo buttons
  setupPhotoButtons('before');
  setupPhotoButtons('after');

  // Save Before Photos button
  const saveBeforeBtn = document.getElementById('saveBeforePhotos');
  if (saveBeforeBtn) {
    saveBeforeBtn.addEventListener('click', handleSaveBeforePhotos);
  }

  // Submit For Approval button
  const submitApprovalBtn = document.getElementById('submitForApproval');
  if (submitApprovalBtn) {
    submitApprovalBtn.addEventListener('click', handleSubmitForApproval);
  }
}

function setupPhotoButtons(type) {
  const takeBtn = document.getElementById(`take${type.charAt(0).toUpperCase() + type.slice(1)}Photo`);
  const uploadBtn = document.getElementById(`upload${type.charAt(0).toUpperCase() + type.slice(1)}Photo`);
  const fileInput = document.getElementById(`${type}PhotoInput`);

  if (takeBtn) {
    takeBtn.addEventListener('click', () => openCamera(type));
  }

  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => fileInput?.click());
  }

  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        await handlePhotoSelected(file, type);
      }
      e.target.value = ''; // Reset input to allow selecting same file again
    });
  }
}

async function openCamera(type) {
  const modal = document.getElementById('cameraModal');
  const video = document.getElementById('cameraVideo');
  const captureBtn = document.getElementById('capturePhoto');
  const closeBtn = document.getElementById('closeCameraModal');

  let stream = null;

  try {
    // Request camera access (prefer back camera on mobile)
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false
    });

    video.srcObject = stream;
    modal.style.display = 'flex';

    // Capture button
    const captureHandler = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      canvas.toBlob(async (blob) => {
        const file = new File([blob], `${type}-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        await handlePhotoSelected(file, type);
        closeCamera();
      }, 'image/jpeg', 0.95);
    };

    const closeCamera = () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      video.srcObject = null;
      modal.style.display = 'none';
      captureBtn.removeEventListener('click', captureHandler);
      closeBtn.removeEventListener('click', closeCamera);
    };

    captureBtn.addEventListener('click', captureHandler);
    closeBtn.addEventListener('click', closeCamera);

  } catch (err) {
    utils.toast('Camera access denied or unavailable', 'error');
    console.error('Camera error:', err);
  }
}

function renderPhotoGrid(type) {
  const photos = type === 'before' ? beforePhotos : afterPhotos;
  const grid = document.getElementById(`${type}PhotosGrid`);
  const countSpan = document.getElementById(`${type}PhotoCount`);

  if (!grid || !countSpan) return;

  countSpan.textContent = photos.length;

  if (photos.length === 0) {
    grid.innerHTML = '<p style="color: var(--muted); grid-column: 1/-1; text-align: center; padding: 20px;">No photos yet</p>';
    return;
  }

  grid.innerHTML = photos.map(photo => `
    <div style="position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; border: 2px solid var(--border);">
      <img src="${photo.url}" style="width: 100%; height: 100%; object-fit: cover;" />
      <button
        class="remove-photo-btn"
        data-photo-id="${photo.id}"
        data-photo-type="${type}"
        style="
          position: absolute;
          top: 4px;
          right: 4px;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          border: none;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          line-height: 1;
        "
        title="Remove photo"
      >×</button>
      <div style="
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(transparent, rgba(0,0,0,0.7));
        color: white;
        font-size: 10px;
        padding: 4px;
        text-align: center;
      ">${photo.width}×${photo.height}</div>
    </div>
  `).join('');

  // Add remove button listeners
  grid.querySelectorAll('.remove-photo-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const photoId = parseFloat(btn.getAttribute('data-photo-id'));
      const photoType = btn.getAttribute('data-photo-type');
      removePhoto(photoId, photoType);
    });
  });
}

function removePhoto(photoId, type) {
  if (type === 'before') {
    beforePhotos = beforePhotos.filter(p => p.id !== photoId);
  } else {
    afterPhotos = afterPhotos.filter(p => p.id !== photoId);
  }
  renderPhotoGrid(type);
  updateUI();
  utils.toast('Photo removed', 'success');
}

async function handlePhotoSelected(file, type) {
  try {
    // Strip EXIF data (privacy)
    const cleanFile = await utils.stripEXIF(file);

    // Compress if needed
    const finalFile = await utils.compressImage(cleanFile, 10);

    // Get dimensions
    const dimensions = await utils.getImageDimensions(finalFile);

    // Create photo object with preview URL
    const photoObj = {
      file: finalFile,
      url: URL.createObjectURL(finalFile),
      width: dimensions.width,
      height: dimensions.height,
      size: finalFile.size,
      id: Date.now() + Math.random() // Unique ID for removal
    };

    // Add to appropriate array
    if (type === 'before') {
      beforePhotos.push(photoObj);
    } else {
      afterPhotos.push(photoObj);
    }

    // Save to camera roll (for iPad/mobile)
    await savePhotoToCameraRoll(finalFile, type);

    // Render photo grid
    renderPhotoGrid(type);
    updateUI();
    utils.toast(`${type === 'before' ? 'Before' : 'After'} photo added`, 'success');

  } catch (err) {
    utils.toast('Failed to process photo: ' + err.message, 'error');
    console.error('Photo processing error:', err);
  }
}

async function savePhotoToCameraRoll(file, type) {
  try {
    // Create a download link to trigger save to Photos on iOS
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedCustomer.name.replace(/\s+/g, '_')}_${type}_${Date.now()}.jpg`;

    // Trigger download (iOS will prompt to save to Photos)
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Small delay to show the toast
    await new Promise(resolve => setTimeout(resolve, 500));
    utils.toast(`Photo saved to device (check Downloads/Photos)`, 'info');
  } catch (err) {
    console.warn('Could not auto-save to camera roll:', err);
    // Don't show error to user, it's a nice-to-have feature
  }
}

async function handleSaveBeforePhotos() {
  const saveBtn = document.getElementById('saveBeforePhotos');

  await utils.withLock(saveBtn, async () => {
    try {
      // Validation
      if (!selectedCustomer || !selectedTreatment || !consentConfirmed) {
        utils.toast('Please complete all required fields', 'error');
        return;
      }

      if (beforePhotos.length === 0) {
        utils.toast('Please upload at least one before photo', 'error');
        return;
      }

      // Create consent record
      const user = await api.getUser();
      const consent = await api.createConsent({
        cust_id: selectedCustomer.cust_id,
        staff_user: user.id,
        method: 'digital',
        consent_type: 'media_release',
        source: 'emr',
        channel: 'in_person'
      });

      // Create encounter
      const privateNotes = document.getElementById('privateNotes')?.value.trim() || null;
      const customTagsStr = document.getElementById('customTags')?.value.trim() || '';
      const customTags = customTagsStr ? customTagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

      const encounter = await api.createEncounter({
        cust_id: selectedCustomer.cust_id,
        treatment_id: selectedTreatment,
        consent_id: consent.consent_id,
        private_notes: privateNotes,
        custom_tags: customTags,
        status: 'pending_after_photos' // Key difference!
      });

      currentEncounterId = encounter.encounter_id;

      // Upload all before photos
      utils.toast(`Uploading ${beforePhotos.length} before photo(s)...`, 'info');
      for (const photo of beforePhotos) {
        await uploadPhoto(photo.file, 'before', encounter.encounter_id);
      }

      utils.toast(`Before photos saved! Come back later to add after photos.`, 'success');

      // Reset form
      setTimeout(() => {
        window.router.navigate('/media/upload');
        location.reload();
      }, 2000);

    } catch (err) {
      utils.toast('Failed to save before photos: ' + err.message, 'error');
      console.error('Save before photos error:', err);
    }
  });
}

async function handleSubmitForApproval() {
  const submitBtn = document.getElementById('submitForApproval');

  await utils.withLock(submitBtn, async () => {
    try {
      // Two scenarios:
      // 1. Adding after photos to existing encounter (isAddingAfterPhotos = true)
      // 2. Creating new encounter with both before and after photos

      if (isAddingAfterPhotos) {
        // Scenario 1: Adding after photos only
        if (afterPhotos.length === 0) {
          utils.toast('Please upload at least one after photo', 'error');
          return;
        }

        // Upload all after photos to existing encounter
        utils.toast(`Uploading ${afterPhotos.length} after photo(s)...`, 'info');
        for (const photo of afterPhotos) {
          await uploadPhoto(photo.file, 'after', currentEncounterId);
        }

        // Update encounter status to pending_approval
        await api.updateEncounter(currentEncounterId, {
          status: 'pending_approval'
        });

        utils.toast(`${afterPhotos.length} after photos added! Submitted for approval.`, 'success');

      } else {
        // Scenario 2: New encounter with both before and after photos
        if (!selectedCustomer || !selectedTreatment || !consentConfirmed) {
          utils.toast('Please complete all required fields', 'error');
          return;
        }

        if (beforePhotos.length === 0 || afterPhotos.length === 0) {
          utils.toast('Please upload at least one before and one after photo', 'error');
          return;
        }

        // Create consent record
        const user = await api.getUser();
        const consent = await api.createConsent({
          cust_id: selectedCustomer.cust_id,
          staff_user: user.id,
          method: 'digital',
          consent_type: 'media_release',
          source: 'emr',
          channel: 'in_person'
        });

        // Create encounter
        const privateNotes = document.getElementById('privateNotes')?.value.trim() || null;
        const customTagsStr = document.getElementById('customTags')?.value.trim() || '';
        const customTags = customTagsStr ? customTagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

        const encounter = await api.createEncounter({
          cust_id: selectedCustomer.cust_id,
          treatment_id: selectedTreatment,
          consent_id: consent.consent_id,
          private_notes: privateNotes,
          custom_tags: customTags,
          status: 'pending_approval'
        });

        currentEncounterId = encounter.encounter_id;

        // Upload all before photos
        utils.toast(`Uploading ${beforePhotos.length} before photo(s)...`, 'info');
        for (const photo of beforePhotos) {
          await uploadPhoto(photo.file, 'before', encounter.encounter_id);
        }

        // Upload all after photos
        utils.toast(`Uploading ${afterPhotos.length} after photo(s)...`, 'info');
        for (const photo of afterPhotos) {
          await uploadPhoto(photo.file, 'after', encounter.encounter_id);
        }

        utils.toast(`${beforePhotos.length + afterPhotos.length} photos submitted for approval!`, 'success');
      }

      // Reset form
      setTimeout(() => {
        window.router.navigate('/media/upload');
        location.reload();
      }, 1500);

    } catch (err) {
      utils.toast('Submission failed: ' + err.message, 'error');
      console.error('Submit error:', err);
    }
  });
}

async function uploadPhoto(file, type, encounterId) {
  // Get presigned URL
  const { url, key, bucket, headers } = await api.getUploadUrl(
    selectedCustomer.cust_id,
    `${utils.uuid()}.jpg`,
    file.type
  );

  // Upload to S3
  await api.uploadToS3(url, file, headers);

  // Get image dimensions
  const { width, height } = await utils.getImageDimensions(file);

  // Create media file record
  await api.createMediaFile({
    encounter_id: encounterId,
    file_type: type,
    s3_bucket: bucket,
    s3_key: key,
    file_size: file.size,
    mime_type: file.type,
    width,
    height
  });
}

function updateUI() {
  // Show/hide sections based on progress
  const treatmentSection = document.getElementById('treatmentSection');
  const consentSection = document.getElementById('consentSection');
  const photoSection = document.getElementById('photoSection');
  const detailsSection = document.getElementById('detailsSection');
  const submitSection = document.getElementById('submitSection');
  const saveBeforeBtn = document.getElementById('saveBeforePhotos');
  const submitApprovalBtn = document.getElementById('submitForApproval');
  const submitTitle = document.getElementById('submitTitle');
  const submitDescription = document.getElementById('submitDescription');

  if (isAddingAfterPhotos) {
    // Adding after photos to existing encounter
    treatmentSection.style.display = 'none';
    consentSection.style.display = 'none';
    photoSection.style.display = 'block';
    detailsSection.style.display = 'block';

    // Show submit when we have after photos
    if (submitSection && afterPhotos.length > 0) {
      submitSection.style.display = 'block';
      if (saveBeforeBtn) saveBeforeBtn.style.display = 'none';
      if (submitApprovalBtn) submitApprovalBtn.style.display = 'inline-block';
      if (submitTitle) submitTitle.textContent = 'Ready to Submit for Approval';
      if (submitDescription) submitDescription.textContent = `${afterPhotos.length} after photo(s) ready`;
    } else {
      submitSection.style.display = 'none';
    }

  } else {
    // Normal workflow: new encounter
    if (treatmentSection) {
      treatmentSection.style.display = selectedCustomer ? 'block' : 'none';
    }

    if (consentSection) {
      consentSection.style.display = selectedCustomer && selectedTreatment ? 'block' : 'none';
    }

    if (photoSection) {
      photoSection.style.display = selectedCustomer && selectedTreatment && consentConfirmed ? 'block' : 'none';
    }

    if (detailsSection) {
      detailsSection.style.display = selectedCustomer && selectedTreatment && consentConfirmed ? 'block' : 'none';
    }

    // Determine which submit button to show
    if (submitSection) {
      const hasBeforePhotos = beforePhotos.length > 0;
      const hasAfterPhotos = afterPhotos.length > 0;

      if (hasBeforePhotos && hasAfterPhotos) {
        // Both before and after: show "Submit for Approval"
        submitSection.style.display = 'block';
        if (saveBeforeBtn) saveBeforeBtn.style.display = 'none';
        if (submitApprovalBtn) submitApprovalBtn.style.display = 'inline-block';
        if (submitTitle) submitTitle.textContent = 'Ready to Submit for Approval';
        if (submitDescription) submitDescription.textContent = `${beforePhotos.length + afterPhotos.length} photos ready`;

      } else if (hasBeforePhotos && !hasAfterPhotos) {
        // Only before photos: show "Save Before Photos"
        submitSection.style.display = 'block';
        if (saveBeforeBtn) saveBeforeBtn.style.display = 'inline-block';
        if (submitApprovalBtn) submitApprovalBtn.style.display = 'none';
        if (submitTitle) submitTitle.textContent = 'Save Before Photos';
        if (submitDescription) submitDescription.textContent = 'Come back later to add after photos';

      } else {
        // No photos yet
        submitSection.style.display = 'none';
      }
    }
  }
}

export default { render, init };
