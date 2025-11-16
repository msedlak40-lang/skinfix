// ============================
// Approval Queue Page
// Review and approve/reject photo submissions
// ============================

import api from '../shared/api.js';
import utils from '../shared/utils.js';
import components from '../shared/components.js';

let encounters = [];
let currentFilter = { treatment_id: null };

export async function render() {
  try {
    // Load pending encounters
    encounters = await api.getEncounters({ status: 'pending_approval', limit: 100 });

    const treatmentSelectHTML = await components.createTreatmentSelect();

    if (encounters.length === 0) {
      return `
        <div class="card">
          <h2>✅ Approval Queue</h2>
          <div style="text-align: center; padding: 60px 20px;">
            <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
            <h3>All caught up!</h3>
            <p style="color: var(--muted);">No photos pending approval</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <h2>✅ Approval Queue</h2>
            <p style="color: var(--muted); margin: 4px 0 0 0;">${encounters.length} photo${encounters.length !== 1 ? 's' : ''} pending approval</p>
          </div>
          <div class="row" style="margin: 0;">
            ${treatmentSelectHTML}
            <button id="refreshQueue" class="btn">🔄 Refresh</button>
          </div>
        </div>
      </div>

      <div id="encountersList">
        ${renderEncountersList()}
      </div>

      <!-- Keyboard shortcuts hint -->
      <div class="card" style="background: var(--bg); border: 1px dashed var(--border);">
        <small style="color: var(--muted);">
          <strong>Keyboard shortcuts:</strong>
          A (Approve) • R (Reject) • → (Next) • ← (Previous)
        </small>
      </div>
    `;
  } catch (err) {
    return `
      <div class="card">
        <h2 class="err">Error Loading Queue</h2>
        <p>${err.message}</p>
      </div>
    `;
  }
}

function renderEncountersList() {
  const filtered = currentFilter.treatment_id
    ? encounters.filter(e => e.treatment_id === currentFilter.treatment_id)
    : encounters;

  if (filtered.length === 0) {
    return `
      <div class="card">
        <div style="text-align: center; padding: 40px 20px;">
          <p style="color: var(--muted);">No encounters match this filter</p>
          <button id="clearFilter" class="btn" style="margin-top: 12px;">Clear Filter</button>
        </div>
      </div>
    `;
  }

  return filtered.map((encounter, index) => `
    <div class="card encounter-item" data-encounter-id="${encounter.encounter_id}" data-index="${index}">
      <div style="display: flex; justify-content: space-between; align-items: start; gap: 16px; flex-wrap: wrap;">
        <!-- Customer & Treatment Info -->
        <div style="flex: 1; min-width: 200px;">
          <h3 style="margin: 0 0 8px 0;">${utils.escapeHTML(encounter.customer_name)}</h3>
          <div style="color: var(--muted); font-size: 14px;">
            <div>${encounter.treatment_name}</div>
            <div>${utils.formatDateTime(encounter.encounter_date)}</div>
            <div style="margin-top: 8px;">
              ${encounter.consent_granted ? '✓ Consent signed' : '⚠️ No consent'}
              ${encounter.private_notes ? ` • 📝 Has notes` : ''}
            </div>
          </div>
        </div>

        <!-- Photos Preview -->
        <div style="display: flex; gap: 12px;">
          ${encounter.before_count > 0 ? `
            <div style="text-align: center;">
              <div style="
                width: 120px;
                height: 120px;
                background: var(--card);
                border: 1px solid var(--border);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
              " class="photo-preview" data-encounter-id="${encounter.encounter_id}" data-type="before">
                <div>📷<br><small>Before</small></div>
              </div>
            </div>
          ` : ''}

          ${encounter.after_count > 0 ? `
            <div style="text-align: center;">
              <div style="
                width: 120px;
                height: 120px;
                background: var(--card);
                border: 1px solid var(--border);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
              " class="photo-preview" data-encounter-id="${encounter.encounter_id}" data-type="after">
                <div>📷<br><small>After</small></div>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Actions -->
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn preview-btn" data-encounter-id="${encounter.encounter_id}">
            👁️ Preview
          </button>
          <button class="btn accent approve-btn" data-encounter-id="${encounter.encounter_id}">
            ✓ Approve
          </button>
          <button class="btn reject-btn" data-encounter-id="${encounter.encounter_id}" style="border-color: #ef4444; color: #ef4444;">
            ✗ Reject
          </button>
        </div>
      </div>

      ${encounter.private_notes ? `
        <div style="
          margin-top: 16px;
          padding: 12px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 8px;
          font-size: 14px;
        ">
          <strong>Staff Notes:</strong> ${utils.escapeHTML(encounter.private_notes)}
        </div>
      ` : ''}
    </div>
  `).join('');
}

export function init() {
  setupEventListeners();
  setupKeyboardShortcuts();
}

function setupEventListeners() {
  // Treatment filter
  const treatmentSelect = document.getElementById('treatmentSelect');
  if (treatmentSelect) {
    treatmentSelect.addEventListener('change', async (e) => {
      currentFilter.treatment_id = e.target.value || null;
      await refreshList();
    });
  }

  // Refresh button
  const refreshBtn = document.getElementById('refreshQueue');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await utils.withLock(refreshBtn, async () => {
        encounters = await api.getEncounters({ status: 'pending_approval', limit: 100 });
        await refreshList();
        utils.toast('Queue refreshed', 'success');
      });
    });
  }

  // Clear filter button
  const clearFilterBtn = document.getElementById('clearFilter');
  if (clearFilterBtn) {
    clearFilterBtn.addEventListener('click', async () => {
      currentFilter.treatment_id = null;
      const treatmentSelect = document.getElementById('treatmentSelect');
      if (treatmentSelect) treatmentSelect.value = '';
      await refreshList();
    });
  }

  // Preview buttons
  document.querySelectorAll('.preview-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const encounterId = e.target.dataset.encounterId;
      showPreviewModal(encounterId);
    });
  });

  // Photo preview clicks
  document.querySelectorAll('.photo-preview').forEach(preview => {
    preview.addEventListener('click', (e) => {
      const encounterId = e.currentTarget.dataset.encounterId;
      showPreviewModal(encounterId);
    });
  });

  // Approve buttons
  document.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const encounterId = e.target.dataset.encounterId;
      await handleApprove(encounterId, btn);
    });
  });

  // Reject buttons
  document.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const encounterId = e.target.dataset.encounterId;
      showRejectModal(encounterId);
    });
  });
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Don't trigger if typing in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const items = document.querySelectorAll('.encounter-item');
    if (items.length === 0) return;

    // Find currently focused/selected item
    let currentIndex = -1;
    items.forEach((item, index) => {
      if (item.classList.contains('focused')) {
        currentIndex = index;
      }
    });

    switch(e.key.toLowerCase()) {
      case 'a':
        // Approve current/first item
        e.preventDefault();
        const approveTarget = currentIndex >= 0 ? items[currentIndex] : items[0];
        const approveBtn = approveTarget.querySelector('.approve-btn');
        if (approveBtn) approveBtn.click();
        break;

      case 'r':
        // Reject current/first item
        e.preventDefault();
        const rejectTarget = currentIndex >= 0 ? items[currentIndex] : items[0];
        const rejectBtn = rejectTarget.querySelector('.reject-btn');
        if (rejectBtn) rejectBtn.click();
        break;

      case 'arrowright':
        // Next item
        e.preventDefault();
        if (currentIndex < items.length - 1) {
          items.forEach(item => item.classList.remove('focused'));
          items[currentIndex + 1].classList.add('focused');
          items[currentIndex + 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        break;

      case 'arrowleft':
        // Previous item
        e.preventDefault();
        if (currentIndex > 0) {
          items.forEach(item => item.classList.remove('focused'));
          items[currentIndex - 1].classList.add('focused');
          items[currentIndex - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (currentIndex === -1 && items.length > 0) {
          items[0].classList.add('focused');
        }
        break;
    }
  });
}

async function showPreviewModal(encounterId) {
  const encounter = encounters.find(e => e.encounter_id === encounterId);
  if (!encounter) return;

  const files = await api.getEncounterFiles(encounterId);
  const beforeFile = files.find(f => f.file_type === 'before');
  const afterFile = files.find(f => f.file_type === 'after');

  components.showModal(
    `Preview: ${encounter.customer_name} - ${encounter.treatment_name}`,
    `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
        ${beforeFile ? `
          <div>
            <h4 style="margin-bottom: 8px;">Before</h4>
            <div style="background: #000; padding: 8px; border-radius: 8px;">
              <div style="color: #888; text-align: center; padding: 100px 20px;">
                📷 Before Photo<br>
                <small>${beforeFile.width}×${beforeFile.height}</small>
              </div>
            </div>
          </div>
        ` : ''}

        ${afterFile ? `
          <div>
            <h4 style="margin-bottom: 8px;">After</h4>
            <div style="background: #000; padding: 8px; border-radius: 8px;">
              <div style="color: #888; text-align: center; padding: 100px 20px;">
                📷 After Photo<br>
                <small>${afterFile.width}×${afterFile.height}</small>
              </div>
            </div>
          </div>
        ` : ''}
      </div>

      <div style="font-size: 14px; color: var(--muted); margin-bottom: 16px;">
        <div><strong>Customer:</strong> ${utils.escapeHTML(encounter.customer_name)}</div>
        <div><strong>Treatment:</strong> ${encounter.treatment_name}</div>
        <div><strong>Date:</strong> ${utils.formatDateTime(encounter.encounter_date)}</div>
        <div><strong>Consent:</strong> ${encounter.consent_granted ? '✓ Signed on ' + utils.formatDate(encounter.consent_date) : '⚠️ Missing'}</div>
        ${encounter.private_notes ? `<div style="margin-top: 8px;"><strong>Notes:</strong> ${utils.escapeHTML(encounter.private_notes)}</div>` : ''}
      </div>

      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="modalApprove" class="btn accent">✓ Approve</button>
        <button id="modalReject" class="btn" style="border-color: #ef4444; color: #ef4444;">✗ Reject</button>
      </div>
    `,
    {
      confirmText: null,
      cancelText: 'Close',
      width: '95vw',
      maxWidth: '900px'
    }
  );

  // Setup modal action buttons
  setTimeout(() => {
    const modalApproveBtn = document.getElementById('modalApprove');
    const modalRejectBtn = document.getElementById('modalReject');

    if (modalApproveBtn) {
      modalApproveBtn.addEventListener('click', async () => {
        await handleApprove(encounterId, modalApproveBtn);
        document.getElementById('globalModal')?.remove();
      });
    }

    if (modalRejectBtn) {
      modalRejectBtn.addEventListener('click', () => {
        document.getElementById('globalModal')?.remove();
        showRejectModal(encounterId);
      });
    }
  }, 100);
}

async function handleApprove(encounterId, btn) {
  await utils.withLock(btn, async () => {
    try {
      await api.approveEncounter(encounterId);

      // Remove from list
      encounters = encounters.filter(e => e.encounter_id !== encounterId);
      await refreshList();

      utils.toast('Photo approved!', 'success');
    } catch (err) {
      utils.toast('Approval failed: ' + err.message, 'error');
    }
  });
}

function showRejectModal(encounterId) {
  const encounter = encounters.find(e => e.encounter_id === encounterId);
  if (!encounter) return;

  components.showModal(
    `Reject: ${encounter.customer_name} - ${encounter.treatment_name}`,
    `
      <p style="margin-bottom: 16px;">Please select a reason for rejection:</p>

      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; border: 1px solid var(--border); border-radius: 8px;">
          <input type="radio" name="rejectReason" value="lighting_poor" />
          <span>Poor lighting / too dark</span>
        </label>

        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; border: 1px solid var(--border); border-radius: 8px;">
          <input type="radio" name="rejectReason" value="blurry" />
          <span>Blurry / out of focus</span>
        </label>

        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; border: 1px solid var(--border); border-radius: 8px;">
          <input type="radio" name="rejectReason" value="angle_inconsistent" />
          <span>Inconsistent angle between before/after</span>
        </label>

        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; border: 1px solid var(--border); border-radius: 8px;">
          <input type="radio" name="rejectReason" value="background_distracting" />
          <span>Distracting background</span>
        </label>

        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; border: 1px solid var(--border); border-radius: 8px;">
          <input type="radio" name="rejectReason" value="quality_low" />
          <span>Overall quality too low</span>
        </label>

        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; border: 1px solid var(--border); border-radius: 8px;">
          <input type="radio" name="rejectReason" value="other" />
          <span>Other (specify below)</span>
        </label>
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Additional notes (optional):</label>
        <textarea
          id="rejectNotes"
          placeholder="Specific feedback for staff..."
          style="
            width: 100%;
            min-height: 80px;
            padding: 12px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: transparent;
            color: var(--fg);
            font-family: inherit;
          "
        ></textarea>
      </div>
    `,
    {
      confirmText: '✗ Reject Photo',
      cancelText: 'Cancel',
      onConfirm: async () => {
        const selectedReason = document.querySelector('input[name="rejectReason"]:checked');
        if (!selectedReason) {
          utils.toast('Please select a rejection reason', 'warning');
          return;
        }

        const reasonMap = {
          'lighting_poor': 'Poor lighting / too dark',
          'blurry': 'Blurry / out of focus',
          'angle_inconsistent': 'Inconsistent angle between before/after',
          'background_distracting': 'Distracting background',
          'quality_low': 'Overall quality too low',
          'other': 'Other'
        };

        const notes = document.getElementById('rejectNotes')?.value.trim() || '';
        const reason = reasonMap[selectedReason.value] + (notes ? `: ${notes}` : '');

        try {
          await api.rejectEncounter(encounterId, reason);

          // Remove from list
          encounters = encounters.filter(e => e.encounter_id !== encounterId);
          await refreshList();

          utils.toast('Photo rejected', 'success');
        } catch (err) {
          utils.toast('Rejection failed: ' + err.message, 'error');
        }
      }
    }
  );
}

async function refreshList() {
  const listContainer = document.getElementById('encountersList');
  if (listContainer) {
    listContainer.innerHTML = renderEncountersList();
    setupEventListeners();
  }
}

export default { render, init };
