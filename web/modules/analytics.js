// ============================
// Analytics Dashboard
// Combined insights for media and reviews
// ============================

import api from '../shared/api.js';
import utils from '../shared/utils.js';
import components from '../shared/components.js';

export async function render() {
  try {
    // Load data
    const encounters = await api.getEncounters({ limit: 1000 });
    const treatments = await api.getTreatments();

    // Calculate stats
    const stats = calculateStats(encounters, treatments);

    return `
      <div class="card">
        <h2>📊 Analytics Dashboard</h2>
        <p style="color: var(--muted);">Media approval and review performance insights</p>
      </div>

      <!-- KPI Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
        ${renderKPICard('Total Submissions', stats.total, '📸')}
        ${renderKPICard('Approved', stats.approved, '✓', '#10b981')}
        ${renderKPICard('Pending', stats.pending, '⏳', '#f59e0b')}
        ${renderKPICard('Approval Rate', `${stats.approvalRate}%`, '📈', '#3b82f6')}
      </div>

      <!-- Treatment Performance -->
      <div class="card">
        <h3>Performance by Treatment Type</h3>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border);">
                <th style="text-align: left; padding: 12px;">Treatment</th>
                <th style="text-align: center; padding: 12px;">Submissions</th>
                <th style="text-align: center; padding: 12px;">Approved</th>
                <th style="text-align: center; padding: 12px;">Rejected</th>
                <th style="text-align: center; padding: 12px;">Approval Rate</th>
                <th style="text-align: center; padding: 12px;">Published</th>
              </tr>
            </thead>
            <tbody>
              ${stats.byTreatment.map(t => `
                <tr style="border-bottom: 1px solid var(--border);">
                  <td style="padding: 12px;"><strong>${t.name}</strong></td>
                  <td style="text-align: center; padding: 12px;">${t.total}</td>
                  <td style="text-align: center; padding: 12px; color: #10b981;">${t.approved}</td>
                  <td style="text-align: center; padding: 12px; color: #ef4444;">${t.rejected}</td>
                  <td style="text-align: center; padding: 12px;">
                    <span style="
                      background: ${t.approvalRate >= 80 ? '#10b981' : t.approvalRate >= 60 ? '#f59e0b' : '#ef4444'}22;
                      color: ${t.approvalRate >= 80 ? '#10b981' : t.approvalRate >= 60 ? '#f59e0b' : '#ef4444'};
                      padding: 4px 8px;
                      border-radius: 6px;
                      font-weight: 600;
                    ">
                      ${t.approvalRate}%
                    </span>
                  </td>
                  <td style="text-align: center; padding: 12px;">${t.published}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Top Rejection Reasons -->
      <div class="card">
        <h3>Top Rejection Reasons</h3>
        <div style="margin-top: 16px;">
          ${stats.rejectionReasons.length > 0 ? `
            ${stats.rejectionReasons.map((reason, index) => `
              <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px;
                background: ${index % 2 === 0 ? 'var(--card)' : 'transparent'};
                border-radius: 8px;
                margin-bottom: 8px;
              ">
                <div>
                  <strong>${reason.reason || 'Not specified'}</strong>
                  <div style="font-size: 14px; color: var(--muted); margin-top: 4px;">
                    Help staff improve by providing specific feedback
                  </div>
                </div>
                <div style="
                  font-size: 24px;
                  font-weight: 600;
                  color: #ef4444;
                ">
                  ${reason.count}
                </div>
              </div>
            `).join('')}
          ` : `
            <div style="text-align: center; padding: 40px 20px; color: var(--muted);">
              No rejections yet - great work!
            </div>
          `}
        </div>
      </div>

      <!-- Recent Activity Timeline -->
      <div class="card">
        <h3>Recent Activity</h3>
        <div style="margin-top: 16px;">
          ${renderTimeline(encounters.slice(0, 10))}
        </div>
      </div>
    `;
  } catch (err) {
    return `
      <div class="card">
        <h2 class="err">Error Loading Analytics</h2>
        <p>${err.message}</p>
      </div>
    `;
  }
}

function renderKPICard(title, value, icon, color = 'var(--fg)') {
  return `
    <div class="card" style="text-align: center;">
      <div style="font-size: 36px; margin-bottom: 8px;">${icon}</div>
      <div style="font-size: 32px; font-weight: 700; color: ${color}; margin-bottom: 4px;">
        ${value}
      </div>
      <div style="font-size: 14px; color: var(--muted);">
        ${title}
      </div>
    </div>
  `;
}

function renderTimeline(encounters) {
  if (encounters.length === 0) {
    return `
      <div style="text-align: center; padding: 40px 20px; color: var(--muted);">
        No activity yet
      </div>
    `;
  }

  return encounters.map(enc => {
    const statusIcons = {
      'pending_upload': '⏳',
      'pending_approval': '📸',
      'approved': '✓',
      'rejected': '✗'
    };

    const statusColors = {
      'pending_upload': '#f59e0b',
      'pending_approval': '#3b82f6',
      'approved': '#10b981',
      'rejected': '#ef4444'
    };

    return `
      <div style="
        display: flex;
        gap: 16px;
        padding: 12px;
        border-left: 3px solid ${statusColors[enc.status] || '#666'};
        margin-bottom: 12px;
        background: var(--card);
        border-radius: 0 8px 8px 0;
      ">
        <div style="font-size: 24px;">
          ${statusIcons[enc.status] || '•'}
        </div>
        <div style="flex: 1;">
          <div style="font-weight: 600; margin-bottom: 4px;">
            ${enc.customer_name} - ${enc.treatment_name}
          </div>
          <div style="font-size: 14px; color: var(--muted);">
            ${utils.formatRelativeTime(enc.encounter_date)} •
            ${enc.status === 'approved' ? 'Approved' :
              enc.status === 'rejected' ? 'Rejected' :
              enc.status === 'pending_approval' ? 'Pending Approval' :
              'Pending Upload'}
          </div>
          ${enc.rejected_reason ? `
            <div style="
              margin-top: 8px;
              padding: 8px;
              background: rgba(239, 68, 68, 0.1);
              border-radius: 6px;
              font-size: 13px;
            ">
              ${utils.escapeHTML(enc.rejected_reason)}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function calculateStats(encounters, treatments) {
  const total = encounters.length;
  const approved = encounters.filter(e => e.status === 'approved').length;
  const rejected = encounters.filter(e => e.status === 'rejected').length;
  const pending = encounters.filter(e => e.status === 'pending_approval').length;
  const approvalRate = total > 0 ? Math.round((approved / (approved + rejected)) * 100) || 0 : 0;

  // By treatment type
  const byTreatment = treatments.map(treatment => {
    const treatmentEnc = encounters.filter(e => e.treatment_id === treatment.treatment_id);
    const treatmentApproved = treatmentEnc.filter(e => e.status === 'approved').length;
    const treatmentRejected = treatmentEnc.filter(e => e.status === 'rejected').length;
    const treatmentPublished = treatmentEnc.filter(e => e.is_published).length;
    const treatmentApprovalRate = (treatmentApproved + treatmentRejected) > 0
      ? Math.round((treatmentApproved / (treatmentApproved + treatmentRejected)) * 100)
      : 0;

    return {
      name: treatment.name,
      total: treatmentEnc.length,
      approved: treatmentApproved,
      rejected: treatmentRejected,
      published: treatmentPublished,
      approvalRate: treatmentApprovalRate
    };
  }).filter(t => t.total > 0);

  // Rejection reasons
  const rejectionReasons = encounters
    .filter(e => e.status === 'rejected' && e.rejected_reason)
    .reduce((acc, enc) => {
      const reason = enc.rejected_reason.split(':')[0]; // Get main reason before colon
      const existing = acc.find(r => r.reason === reason);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ reason, count: 1 });
      }
      return acc;
    }, [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    total,
    approved,
    rejected,
    pending,
    approvalRate,
    byTreatment,
    rejectionReasons
  };
}

export function init() {
  // No event listeners needed for now
}

export default { render, init };
