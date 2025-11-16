// ============================
// Reviews Page
// Send review requests and view review analytics
// ============================

import api from '../shared/api.js';
import utils from '../shared/utils.js';
import components from '../shared/components.js';

let selectedCustomer = null;

export async function render() {
  return `
    <div class="card">
      <h2>⭐ Review Requests</h2>
      <p style="color: var(--muted);">Send Google review requests to customers</p>
    </div>

    <!-- Send Review Request -->
    <div class="card">
      <h3>Send Review Request</h3>

      ${components.createCustomerSearch((customer) => {
        selectedCustomer = customer;
        updateUI();
      })}

      <div id="sendSection" style="display: none; margin-top: 16px;">
        <div style="
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 10px;
          padding: 16px;
          margin-bottom: 16px;
        ">
          <h4 style="margin: 0 0 8px 0;">Review Request Details</h4>
          <div style="font-size: 14px; color: var(--muted);">
            <div><strong>Customer:</strong> <span id="selectedCustomerName"></span></div>
            <div><strong>Phone:</strong> <span id="selectedCustomerPhone"></span></div>
            <div style="margin-top: 12px;">
              Customer will receive an SMS with a one-tap link to confirm they posted a Google review.
            </div>
          </div>
        </div>

        <div class="row" style="justify-content: flex-end;">
          <button id="sendReviewRequest" class="btn accent">
            📱 Send Review Request
          </button>
        </div>
      </div>
    </div>

    <!-- Recent Review Requests -->
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0;">Recent Requests</h3>
        <button id="refreshRequests" class="btn">🔄 Refresh</button>
      </div>

      <div id="recentRequests">
        ${renderRecentRequests()}
      </div>
    </div>
  `;
}

function renderRecentRequests() {
  // Mock data - in real implementation, would fetch from review_nudges table
  const mockRequests = [
    { customer_name: 'Jane Doe', phone: '+15555550123', sent_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), clicked: true, posted: true },
    { customer_name: 'Sarah Kim', phone: '+15555550124', sent_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), clicked: true, posted: false },
    { customer_name: 'Lisa Chen', phone: '+15555550125', sent_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), clicked: false, posted: false }
  ];

  if (mockRequests.length === 0) {
    return `
      <div style="text-align: center; padding: 40px 20px; color: var(--muted);">
        No review requests sent yet
      </div>
    `;
  }

  return `
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid var(--border);">
            <th style="text-align: left; padding: 12px; font-size: 14px;">Customer</th>
            <th style="text-align: left; padding: 12px; font-size: 14px;">Phone</th>
            <th style="text-align: left; padding: 12px; font-size: 14px;">Sent</th>
            <th style="text-align: center; padding: 12px; font-size: 14px;">Clicked</th>
            <th style="text-align: center; padding: 12px; font-size: 14px;">Posted</th>
          </tr>
        </thead>
        <tbody>
          ${mockRequests.map(req => `
            <tr style="border-bottom: 1px solid var(--border);">
              <td style="padding: 12px;">${utils.escapeHTML(req.customer_name)}</td>
              <td style="padding: 12px; color: var(--muted); font-size: 14px;">${utils.formatPhone(req.phone)}</td>
              <td style="padding: 12px; font-size: 14px;">${utils.formatRelativeTime(req.sent_at)}</td>
              <td style="padding: 12px; text-align: center;">
                ${req.clicked ? '✓' : '-'}
              </td>
              <td style="padding: 12px; text-align: center;">
                ${req.posted ? '<span style="color: #10b981;">✓ Posted</span>' : '-'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function init() {
  setupEventListeners();
}

function setupEventListeners() {
  // Send review request button
  const sendBtn = document.getElementById('sendReviewRequest');
  if (sendBtn) {
    sendBtn.addEventListener('click', handleSendRequest);
  }

  // Refresh button
  const refreshBtn = document.getElementById('refreshRequests');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await utils.withLock(refreshBtn, async () => {
        // Refresh recent requests
        const container = document.getElementById('recentRequests');
        if (container) {
          container.innerHTML = renderRecentRequests();
        }
        utils.toast('Requests refreshed', 'success');
      });
    });
  }
}

async function handleSendRequest() {
  const sendBtn = document.getElementById('sendReviewRequest');

  if (!selectedCustomer) {
    utils.toast('Please select a customer', 'error');
    return;
  }

  await utils.withLock(sendBtn, async () => {
    try {
      // Send review request via existing function
      await api.sendReviewRequest({
        cust_id: selectedCustomer.cust_id,
        place_ref: 'google'
      });

      utils.toast(`Review request sent to ${selectedCustomer.name}!`, 'success');

      // Refresh the list
      const container = document.getElementById('recentRequests');
      if (container) {
        container.innerHTML = renderRecentRequests();
      }

      // Clear selection
      selectedCustomer = null;
      updateUI();

      // Reload page to reset form
      setTimeout(() => {
        window.router.navigate('/reviews');
        location.reload();
      }, 1500);

    } catch (err) {
      utils.toast('Failed to send request: ' + err.message, 'error');
      console.error('Review request error:', err);
    }
  });
}

function updateUI() {
  const sendSection = document.getElementById('sendSection');

  if (sendSection) {
    sendSection.style.display = selectedCustomer ? 'block' : 'none';
  }

  if (selectedCustomer) {
    const nameEl = document.getElementById('selectedCustomerName');
    const phoneEl = document.getElementById('selectedCustomerPhone');

    if (nameEl) nameEl.textContent = selectedCustomer.name;
    if (phoneEl) phoneEl.textContent = utils.formatPhone(selectedCustomer.phone);
  }
}

export default { render, init };
