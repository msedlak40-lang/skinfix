// ============================
// Reusable UI Components
// ============================

import utils from './utils.js';
import api from './api.js';

// ============================================================================
// MODAL COMPONENT
// ============================================================================

export function showModal(title, content, options = {}) {
  const {
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm = null,
    onCancel = null,
    width = '90vw',
    maxWidth = '600px'
  } = options;

  // Remove existing modal if any
  const existingModal = document.getElementById('globalModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'globalModal';
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;

  modal.innerHTML = `
    <div style="
      background: var(--card);
      color: var(--fg);
      padding: 24px;
      border-radius: 16px;
      width: ${width};
      max-width: ${maxWidth};
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    ">
      <h3 style="margin-top: 0;">${utils.escapeHTML(title)}</h3>
      <div style="margin: 16px 0;">
        ${content}
      </div>
      <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
        ${cancelText ? `<button id="modalCancel" class="btn">${cancelText}</button>` : ''}
        ${confirmText ? `<button id="modalConfirm" class="btn accent">${confirmText}</button>` : ''}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Handle close
  const close = () => {
    modal.remove();
  };

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (onCancel) onCancel();
      close();
    }
  });

  // Cancel button
  const cancelBtn = modal.querySelector('#modalCancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (onCancel) onCancel();
      close();
    });
  }

  // Confirm button
  const confirmBtn = modal.querySelector('#modalConfirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (onConfirm) {
        await utils.withLock(confirmBtn, async () => {
          await onConfirm();
        });
      }
      close();
    });
  }

  return { close };
}

// ============================================================================
// LOADING SPINNER
// ============================================================================

export function showLoading(message = 'Loading...') {
  return `
    <div style="text-align: center; padding: 40px;">
      <div style="
        border: 4px solid var(--border);
        border-top-color: var(--accent);
        border-radius: 50%;
        width: 48px;
        height: 48px;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
      "></div>
      <p style="color: var(--muted);">${utils.escapeHTML(message)}</p>
    </div>
  `;
}

// Add spinner animation to page
if (!document.getElementById('spinnerStyles')) {
  const style = document.createElement('style');
  style.id = 'spinnerStyles';
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

// ============================================================================
// CUSTOMER SEARCH COMPONENT
// ============================================================================

export function createCustomerSearch(onSelect) {
  let selectedCustomer = null;

  const html = `
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
        width: calc(100% - 2px);
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
  `;

  // Setup event listeners after rendering
  setTimeout(() => {
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
            ">
              <strong>${utils.escapeHTML(c.name)}</strong>
              <div style="font-size: 14px; color: var(--muted);">${utils.formatPhone(c.phone)}</div>
            </div>
          `).join('') + `
            <div style="padding: 12px; cursor: pointer; color: var(--muted);" id="addNewCustomer">
              + Add new customer
            </div>
          `;
        }

        resultsDiv.style.display = 'block';

        // Handle result clicks
        resultsDiv.querySelectorAll('.customer-result').forEach(el => {
          el.addEventListener('click', () => {
            const custId = el.dataset.custId;
            const customer = customers.find(c => c.cust_id === custId);
            selectCustomer(customer);
          });
        });

        // Handle "Add new" click
        const addNewBtn = document.getElementById('addNewCustomer');
        if (addNewBtn) {
          addNewBtn.addEventListener('click', () => {
            resultsDiv.style.display = 'none';
            newCustomerForm.style.display = 'block';
            document.getElementById('newCustomerName').value = query;
            document.getElementById('newCustomerName').focus();
          });
        }
      } catch (err) {
        utils.toast('Search failed: ' + err.message, 'error');
      }
    }, 300);

    searchInput.addEventListener('input', (e) => {
      performSearch(e.target.value);
    });

    // Clear customer
    const clearBtn = document.getElementById('clearCustomer');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        selectedCustomer = null;
        selectedDiv.style.display = 'none';
        searchInput.value = '';
        searchInput.disabled = false;
        onSelect(null);
      });
    }

    // Save new customer
    const saveBtn = document.getElementById('saveNewCustomer');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const name = document.getElementById('newCustomerName').value.trim();
        const phone = document.getElementById('newCustomerPhone').value.trim();
        const email = document.getElementById('newCustomerEmail').value.trim();

        if (!name || !phone) {
          utils.toast('Name and phone are required', 'error');
          return;
        }

        await utils.withLock(saveBtn, async () => {
          try {
            const customer = await api.createCustomer({ name, phone, email });
            selectCustomer(customer);
            newCustomerForm.style.display = 'none';
            utils.toast('Customer created', 'success');
          } catch (err) {
            utils.toast('Failed to create customer: ' + err.message, 'error');
          }
        });
      });
    }

    // Cancel new customer
    const cancelBtn = document.getElementById('cancelNewCustomer');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        newCustomerForm.style.display = 'none';
        searchInput.value = '';
      });
    }

    function selectCustomer(customer) {
      selectedCustomer = customer;
      selectedDiv.style.display = 'block';
      searchInput.disabled = true;
      searchInput.value = customer.name;
      resultsDiv.style.display = 'none';

      document.getElementById('selectedCustomerName').textContent = customer.name;
      document.getElementById('selectedCustomerPhone').textContent = utils.formatPhone(customer.phone);

      onSelect(customer);
    }
  }, 100);

  return html;
}

// ============================================================================
// TREATMENT SELECTOR
// ============================================================================

export async function createTreatmentSelect(selectedId = null) {
  try {
    const treatments = await api.getTreatments();

    return `
      <select id="treatmentSelect" class="btn" style="min-width: 200px;">
        <option value="">Select treatment...</option>
        ${treatments.map(t => `
          <option value="${t.treatment_id}" ${t.treatment_id === selectedId ? 'selected' : ''}>
            ${utils.escapeHTML(t.name)}
          </option>
        `).join('')}
      </select>
    `;
  } catch (err) {
    utils.toast('Failed to load treatments: ' + err.message, 'error');
    return '<p class="err">Failed to load treatments</p>';
  }
}

// ============================================================================
// STATUS BADGE
// ============================================================================

export function statusBadge(status) {
  const badge = utils.getStatusBadge(status);
  return `
    <span style="
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      background: ${badge.color}22;
      color: ${badge.color};
    ">
      ${badge.text}
    </span>
  `;
}

// Export all
window.components = {
  showModal,
  showLoading,
  createCustomerSearch,
  createTreatmentSelect,
  statusBadge
};

export default window.components;
