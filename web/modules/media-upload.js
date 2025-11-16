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
let beforePhoto = null;
let afterPhoto = null;
let currentEncounterId = null;

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

    <!-- Treatment Selection -->
    <div class="card" id="treatmentSection" style="display: none;">
      <h3>2. Select Treatment</h3>
      <div class="row">
        ${treatmentSelectHTML}
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

      <!-- Before Photo -->
      <div style="margin-bottom: 24px;">
        <h4 style="margin-bottom: 12px;">Before Photo</h4>
        <div id="beforePhotoPreview" style="display: none; margin-bottom: 12px;">
          <img id="beforePhotoImg" style="max-width: 100%; max-height: 300px; border-radius: 10px; border: 1px solid var(--border);" />
          <div style="margin-top: 8px; font-size: 14px; color: var(--muted);" id="beforePhotoInfo"></div>
        </div>
        <div class="row">
          <button id="takeBeforePhoto" class="btn accent">📷 Take Before Photo</button>
          <button id="uploadBeforePhoto" class="btn">📁 Upload from Gallery</button>
          <button id="clearBeforePhoto" class="btn" style="display: none;">✕ Clear</button>
        </div>
        <input type="file" id="beforePhotoInput" accept="image/*" style="display: none;" />
      </div>

      <!-- After Photo -->
      <div>
        <h4 style="margin-bottom: 12px;">After Photo</h4>
        <div id="afterPhotoPreview" style="display: none; margin-bottom: 12px;">
          <img id="afterPhotoImg" style="max-width: 100%; max-height: 300px; border-radius: 10px; border: 1px solid var(--border);" />
          <div style="margin-top: 8px; font-size: 14px; color: var(--muted);" id="afterPhotoInfo"></div>
        </div>
        <div class="row">
          <button id="takeAfterPhoto" class="btn accent">📷 Take After Photo</button>
          <button id="uploadAfterPhoto" class="btn">📁 Upload from Gallery</button>
          <button id="clearAfterPhoto" class="btn" style="display: none;">✕ Clear</button>
        </div>
        <input type="file" id="afterPhotoInput" accept="image/*" style="display: none;" />
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
          <h3 style="margin: 0;">Ready to Submit</h3>
          <p style="color: var(--muted); margin: 4px 0 0 0;">Photos will be sent to approval queue</p>
        </div>
        <button id="submitEncounter" class="btn accent" style="padding: 14px 24px; font-size: 16px;">
          Submit for Approval
        </button>
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

  function selectCustomer(customer) {
    selectedCustomer = customer;
    document.getElementById('selectedCustomerName').textContent = customer.name;
    document.getElementById('selectedCustomerPhone').textContent = utils.formatPhone(customer.phone);
    searchInput.parentElement.style.display = 'none';
    selectedDiv.style.display = 'block';
    resultsDiv.style.display = 'none';
    updateUI();
  }
}

function setupEventListeners() {
  // Treatment selection
  const treatmentSelect = document.getElementById('treatmentSelect');
  if (treatmentSelect) {
    treatmentSelect.addEventListener('change', (e) => {
      selectedTreatment = e.target.value;
      updateUI();
    });
  }

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

  // Submit button
  const submitBtn = document.getElementById('submitEncounter');
  if (submitBtn) {
    submitBtn.addEventListener('click', handleSubmit);
  }
}

function setupPhotoButtons(type) {
  const takeBtn = document.getElementById(`take${type.charAt(0).toUpperCase() + type.slice(1)}Photo`);
  const uploadBtn = document.getElementById(`upload${type.charAt(0).toUpperCase() + type.slice(1)}Photo`);
  const clearBtn = document.getElementById(`clear${type.charAt(0).toUpperCase() + type.slice(1)}Photo`);
  const fileInput = document.getElementById(`${type}PhotoInput`);

  if (takeBtn) {
    takeBtn.addEventListener('click', () => openCamera(type));
  }

  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => fileInput?.click());
  }

  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        await handlePhotoSelected(file, type);
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (type === 'before') {
        beforePhoto = null;
      } else {
        afterPhoto = null;
      }
      updateUI();
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

async function handlePhotoSelected(file, type) {
  try {
    // Strip EXIF data (privacy)
    const cleanFile = await utils.stripEXIF(file);

    // Compress if needed
    const finalFile = await utils.compressImage(cleanFile, 10);

    // Get dimensions
    const dimensions = await utils.getImageDimensions(finalFile);

    // Store photo
    if (type === 'before') {
      beforePhoto = { file: finalFile, ...dimensions };
    } else {
      afterPhoto = { file: finalFile, ...dimensions };
    }

    // Show preview
    const preview = document.getElementById(`${type}PhotoPreview`);
    const img = document.getElementById(`${type}PhotoImg`);
    const info = document.getElementById(`${type}PhotoInfo`);

    if (preview && img && info) {
      img.src = URL.createObjectURL(finalFile);
      info.textContent = `${dimensions.width}×${dimensions.height} • ${utils.formatFileSize(finalFile.size)}`;
      preview.style.display = 'block';
    }

    updateUI();
    utils.toast(`${type === 'before' ? 'Before' : 'After'} photo ready`, 'success');

  } catch (err) {
    utils.toast('Failed to process photo: ' + err.message, 'error');
    console.error('Photo processing error:', err);
  }
}

async function handleSubmit() {
  const submitBtn = document.getElementById('submitEncounter');

  await utils.withLock(submitBtn, async () => {
    try {
      // Validation
      if (!selectedCustomer || !selectedTreatment || !consentConfirmed || !beforePhoto || !afterPhoto) {
        utils.toast('Please complete all required fields', 'error');
        return;
      }

      // Create consent record
      const user = await api.getUser();
      const consent = await api.createConsent({
        cust_id: selectedCustomer.cust_id,
        staff_user: user.id,
        method: 'digital',
        consent_type: 'marketing',
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
        custom_tags: customTags
      });

      currentEncounterId = encounter.encounter_id;

      // Upload before photo
      await uploadPhoto(beforePhoto.file, 'before', encounter.encounter_id);

      // Upload after photo
      await uploadPhoto(afterPhoto.file, 'after', encounter.encounter_id);

      // Update encounter status to pending_approval
      await api.updateEncounter(encounter.encounter_id, {
        status: 'pending_approval'
      });

      utils.toast('Photos submitted for approval!', 'success');

      // Reset form
      setTimeout(() => {
        window.router.navigate('/media/upload');
        location.reload(); // Simple reset for now
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

  // Show submit only when both photos are ready
  if (submitSection) {
    submitSection.style.display = beforePhoto && afterPhoto ? 'block' : 'none';
  }

  // Update clear buttons
  const clearBeforeBtn = document.getElementById('clearBeforePhoto');
  const clearAfterBtn = document.getElementById('clearAfterPhoto');

  if (clearBeforeBtn) {
    clearBeforeBtn.style.display = beforePhoto ? 'inline-block' : 'none';
  }

  if (clearAfterBtn) {
    clearAfterBtn.style.display = afterPhoto ? 'inline-block' : 'none';
  }
}

export default { render, init };
