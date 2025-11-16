// ============================
// Media Library Page
// Browse approved photos, generate captions, export for Instagram
// ============================

import api from '../shared/api.js';
import utils from '../shared/utils.js';
import components from '../shared/components.js';

let approvedEncounters = [];
let currentFilter = { treatment_id: null, published: null };

export async function render() {
  try {
    // Load approved encounters
    approvedEncounters = await api.getEncounters({ status: 'approved', limit: 100 });

    const treatmentSelectHTML = await components.createTreatmentSelect();

    if (approvedEncounters.length === 0) {
      return `
        <div class="card">
          <h2>🖼️ Media Library</h2>
          <div style="text-align: center; padding: 60px 20px;">
            <div style="font-size: 48px; margin-bottom: 16px;">📸</div>
            <h3>No approved media yet</h3>
            <p style="color: var(--muted);">Approved photos will appear here</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <h2>🖼️ Media Library</h2>
            <p style="color: var(--muted); margin: 4px 0 0 0;">${approvedEncounters.length} approved photo${approvedEncounters.length !== 1 ? 's' : ''}</p>
          </div>
          <div class="row" style="margin: 0;">
            ${treatmentSelectHTML}
            <select id="publishedFilter" class="btn">
              <option value="">All Photos</option>
              <option value="unpublished">Not Published</option>
              <option value="published">Published</option>
            </select>
            <button id="refreshLibrary" class="btn">🔄 Refresh</button>
          </div>
        </div>
      </div>

      <div id="mediaGrid" style="
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      ">
        ${renderMediaGrid()}
      </div>
    `;
  } catch (err) {
    return `
      <div class="card">
        <h2 class="err">Error Loading Library</h2>
        <p>${err.message}</p>
      </div>
    `;
  }
}

function renderMediaGrid() {
  let filtered = approvedEncounters;

  if (currentFilter.treatment_id) {
    filtered = filtered.filter(e => e.treatment_id === currentFilter.treatment_id);
  }

  if (currentFilter.published === 'published') {
    filtered = filtered.filter(e => e.is_published);
  } else if (currentFilter.published === 'unpublished') {
    filtered = filtered.filter(e => !e.is_published);
  }

  if (filtered.length === 0) {
    return `
      <div class="card" style="grid-column: 1 / -1;">
        <div style="text-align: center; padding: 40px 20px;">
          <p style="color: var(--muted);">No media matches these filters</p>
          <button id="clearFilters" class="btn" style="margin-top: 12px;">Clear Filters</button>
        </div>
      </div>
    `;
  }

  return filtered.map(encounter => `
    <div class="card media-card" style="padding: 0; overflow: hidden;">
      <!-- Photo Thumbnail -->
      <div style="
        background: #000;
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      " class="media-thumbnail" data-encounter-id="${encounter.encounter_id}">
        <div style="color: #666; text-align: center;">
          <div style="font-size: 48px;">📷</div>
          <div style="font-size: 14px;">Before/After</div>
        </div>
      </div>

      <!-- Info -->
      <div style="padding: 12px;">
        <div style="font-weight: 600; margin-bottom: 4px;">${encounter.treatment_name}</div>
        <div style="font-size: 14px; color: var(--muted); margin-bottom: 8px;">
          ${utils.formatDate(encounter.encounter_date)}
        </div>

        ${encounter.is_published ? `
          <div style="
            font-size: 12px;
            padding: 4px 8px;
            background: rgba(16, 185, 129, 0.1);
            color: #10b981;
            border-radius: 6px;
            display: inline-block;
            margin-bottom: 8px;
          ">
            ✓ Published
          </div>
        ` : ''}

        <!-- Actions -->
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button class="btn view-btn" data-encounter-id="${encounter.encounter_id}" style="flex: 1; padding: 8px 12px; font-size: 14px;">
            View
          </button>
          <button class="btn export-btn" data-encounter-id="${encounter.encounter_id}" style="flex: 1; padding: 8px 12px; font-size: 14px;">
            Export
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

export function init() {
  setupEventListeners();
}

function setupEventListeners() {
  // Treatment filter
  const treatmentSelect = document.getElementById('treatmentSelect');
  if (treatmentSelect) {
    treatmentSelect.addEventListener('change', async (e) => {
      currentFilter.treatment_id = e.target.value || null;
      await refreshGrid();
    });
  }

  // Published filter
  const publishedFilter = document.getElementById('publishedFilter');
  if (publishedFilter) {
    publishedFilter.addEventListener('change', async (e) => {
      currentFilter.published = e.target.value || null;
      await refreshGrid();
    });
  }

  // Refresh button
  const refreshBtn = document.getElementById('refreshLibrary');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await utils.withLock(refreshBtn, async () => {
        approvedEncounters = await api.getEncounters({ status: 'approved', limit: 100 });
        await refreshGrid();
        utils.toast('Library refreshed', 'success');
      });
    });
  }

  // Clear filters
  const clearBtn = document.getElementById('clearFilters');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      currentFilter = { treatment_id: null, published: null };
      const treatmentSelect = document.getElementById('treatmentSelect');
      const publishedFilter = document.getElementById('publishedFilter');
      if (treatmentSelect) treatmentSelect.value = '';
      if (publishedFilter) publishedFilter.value = '';
      await refreshGrid();
    });
  }

  // View buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const encounterId = e.target.dataset.encounterId;
      showViewModal(encounterId);
    });
  });

  // Thumbnail clicks
  document.querySelectorAll('.media-thumbnail').forEach(thumb => {
    thumb.addEventListener('click', (e) => {
      const encounterId = e.currentTarget.dataset.encounterId;
      showViewModal(encounterId);
    });
  });

  // Export buttons
  document.querySelectorAll('.export-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const encounterId = e.target.dataset.encounterId;
      showExportModal(encounterId);
    });
  });
}

async function showViewModal(encounterId) {
  const encounter = approvedEncounters.find(e => e.encounter_id === encounterId);
  if (!encounter) return;

  const files = await api.getEncounterFiles(encounterId);
  const publications = await api.getEncounterPublications(encounterId);

  components.showModal(
    `${encounter.treatment_name} - ${encounter.customer_name}`,
    `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
        <div>
          <h4>Before</h4>
          <div style="background: #000; padding: 8px; border-radius: 8px; aspect-ratio: 1;">
            <div style="color: #888; text-align: center; padding: 60px 20px;">
              📷 Before
            </div>
          </div>
        </div>

        <div>
          <h4>After</h4>
          <div style="background: #000; padding: 8px; border-radius: 8px; aspect-ratio: 1;">
            <div style="color: #888; text-align: center; padding: 60px 20px;">
              📷 After
            </div>
          </div>
        </div>
      </div>

      <div style="font-size: 14px; margin-bottom: 16px;">
        <div><strong>Date:</strong> ${utils.formatDateTime(encounter.encounter_date)}</div>
        <div><strong>Approved:</strong> ${utils.formatDateTime(encounter.approved_at)}</div>
        ${encounter.custom_tags && encounter.custom_tags.length > 0 ? `
          <div style="margin-top: 8px;">
            <strong>Tags:</strong> ${encounter.custom_tags.map(tag => `<span style="background: var(--border); padding: 2px 8px; border-radius: 4px; margin-right: 4px;">#${tag}</span>`).join('')}
          </div>
        ` : ''}
      </div>

      ${publications.length > 0 ? `
        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
          <h4 style="margin: 0 0 8px 0;">Published</h4>
          ${publications.map(pub => `
            <div style="font-size: 14px; margin-bottom: 4px;">
              <strong>${pub.post_type}:</strong> ${utils.formatDate(pub.published_at)}
              ${pub.post_url ? `<a href="${pub.post_url}" target="_blank" style="color: #10b981;">View →</a>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div style="display: flex; gap: 12px;">
        <button id="modalExport" class="btn accent" style="flex: 1;">Export for Instagram</button>
        ${!encounter.is_published ? `<button id="modalPublish" class="btn" style="flex: 1;">Mark as Published</button>` : ''}
      </div>
    `,
    {
      confirmText: null,
      cancelText: 'Close',
      width: '95vw',
      maxWidth: '800px'
    }
  );

  setTimeout(() => {
    const exportBtn = document.getElementById('modalExport');
    const publishBtn = document.getElementById('modalPublish');

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        document.getElementById('globalModal')?.remove();
        showExportModal(encounterId);
      });
    }

    if (publishBtn) {
      publishBtn.addEventListener('click', async () => {
        await utils.withLock(publishBtn, async () => {
          try {
            // Show quick publish form
            showPublishForm(encounterId);
          } catch (err) {
            utils.toast('Error: ' + err.message, 'error');
          }
        });
      });
    }
  }, 100);
}

function showExportModal(encounterId) {
  const encounter = approvedEncounters.find(e => e.encounter_id === encounterId);
  if (!encounter) return;

  components.showModal(
    `Export: ${encounter.treatment_name}`,
    `
      <h4 style="margin-bottom: 12px;">Select Instagram Format(s)</h4>
      <p style="color: var(--muted); font-size: 14px; margin-bottom: 16px;">
        Choose which format(s) to generate. You can select multiple.
      </p>

      <div style="display: grid; gap: 12px; margin-bottom: 24px;">
        <label style="
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 2px solid var(--border);
          border-radius: 10px;
          cursor: pointer;
        " class="export-format-option">
          <input type="checkbox" name="exportFormat" value="feed" checked />
          <div style="flex: 1;">
            <strong>Feed Post (1:1 Square)</strong>
            <div style="font-size: 14px; color: var(--muted);">1080×1080 • Best for main feed visibility</div>
          </div>
        </label>

        <label style="
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 2px solid var(--border);
          border-radius: 10px;
          cursor: pointer;
        " class="export-format-option">
          <input type="checkbox" name="exportFormat" value="story" />
          <div style="flex: 1;">
            <strong>Story (9:16 Vertical)</strong>
            <div style="font-size: 14px; color: var(--muted);">1080×1920 • Quick swipe-through format</div>
          </div>
        </label>

        <label style="
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 2px solid var(--border);
          border-radius: 10px;
          cursor: pointer;
        " class="export-format-option">
          <input type="checkbox" name="exportFormat" value="reel" />
          <div style="flex: 1;">
            <strong>Reel (9:16 Vertical)</strong>
            <div style="font-size: 14px; color: var(--muted);">1080×1920 • For viral reach & trending audio</div>
          </div>
        </label>

        <label style="
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 2px solid var(--border);
          border-radius: 10px;
          cursor: pointer;
        " class="export-format-option">
          <input type="checkbox" name="exportFormat" value="carousel" />
          <div style="flex: 1;">
            <strong>Carousel (Multiple Slides)</strong>
            <div style="font-size: 14px; color: var(--muted);">1080×1080 • Before → After storytelling</div>
          </div>
        </label>
      </div>

      <h4 style="margin-bottom: 12px;">AI-Generated Captions</h4>
      <div id="captionsContainer" style="margin-bottom: 16px;">
        <button id="generateCaptions" class="btn accent" style="width: 100%;">
          🤖 Generate Caption Ideas
        </button>
      </div>

      <div style="display: flex; gap: 12px;">
        <button id="exportDownload" class="btn accent" style="flex: 1;">Download Selected Formats</button>
      </div>
    `,
    {
      confirmText: null,
      cancelText: 'Close',
      width: '95vw',
      maxWidth: '700px'
    }
  );

  setTimeout(() => {
    const generateBtn = document.getElementById('generateCaptions');
    const exportBtn = document.getElementById('exportDownload');

    if (generateBtn) {
      generateBtn.addEventListener('click', async () => {
        await utils.withLock(generateBtn, async () => {
          await showAICaptions(encounter);
        });
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        const selectedFormats = Array.from(document.querySelectorAll('input[name="exportFormat"]:checked'))
          .map(cb => cb.value);

        if (selectedFormats.length === 0) {
          utils.toast('Please select at least one format', 'warning');
          return;
        }

        await utils.withLock(exportBtn, async () => {
          await handleExport(encounter, selectedFormats);
        });
      });
    }
  }, 100);
}

async function showAICaptions(encounter) {
  // Mock AI captions (will be replaced with actual API call)
  const mockCaptions = [
    {
      style: 'Educational',
      text: `✨ ${encounter.treatment_name} glow-up! This treatment deeply cleanses, exfoliates, and hydrates skin in just 30 minutes.\n\nPerfect for:\n✓ Fine lines & wrinkles\n✓ Congested pores\n✓ Dull, uneven skin tone\n\nBook your glow: link in bio\n\n#${encounter.treatment_name.toLowerCase().replace(/\s/g, '')} #glowingskin #skinfixmedispa #beforeandafter`,
      hashtags: ['hydrafacial', 'glowingskin', 'beforeandafter', 'medispa']
    },
    {
      style: 'Social Proof',
      text: `🌟 Real skin, real results! See the difference ${encounter.treatment_name} makes in just one treatment. No downtime, instant glow! ✨\n\nDM to book or tap link in bio 💕\n\n#realskin #realresults #${encounter.treatment_name.toLowerCase().replace(/\s/g, '')}beforeafter #medispa`,
      hashtags: ['realskin', 'realresults', 'transformation']
    },
    {
      style: 'Promotional',
      text: `💧 Hydration Station! Get that post-facial glow without the wait. Our ${encounter.treatment_name} leaves skin plump, radiant, and camera-ready.\n\n⏰ Limited slots this month - book now!\n\n#${encounter.treatment_name.toLowerCase().replace(/\s/g, '')}special #glowup #skincaregoals`,
      hashtags: ['skincaresale', 'medspaoffers', 'glowup']
    }
  ];

  const container = document.getElementById('captionsContainer');
  if (container) {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${mockCaptions.map((caption, index) => `
          <div style="
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 12px;
            background: var(--card);
          ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong style="font-size: 14px;">${caption.style}</strong>
              <button class="btn copy-caption-btn" data-caption-index="${index}" style="padding: 4px 12px; font-size: 12px;">
                📋 Copy
              </button>
            </div>
            <div style="
              font-size: 14px;
              line-height: 1.5;
              white-space: pre-wrap;
              color: var(--muted);
            ">${utils.escapeHTML(caption.text)}</div>
          </div>
        `).join('')}
      </div>
    `;

    // Setup copy buttons
    container.querySelectorAll('.copy-caption-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.captionIndex);
        const caption = mockCaptions[index];
        utils.copyToClipboard(caption.text);
      });
    });
  }
}

async function handleExport(encounter, formats) {
  // Mock export - in real implementation, this would generate actual images
  utils.toast(`Generating ${formats.length} format(s)...`, 'info');

  // Simulate export delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  const downloads = formats.map(format => {
    const dimensions = {
      feed: '1080×1080',
      story: '1080×1920',
      reel: '1080×1920',
      carousel: '1080×1080 (multiple)'
    };

    return `${encounter.treatment_name.replace(/\s/g, '-').toLowerCase()}-${format}-${Date.now()}.jpg (${dimensions[format]})`;
  });

  utils.toast(`Ready to download: ${downloads.join(', ')}`, 'success');

  // In real implementation, would trigger actual file downloads
  console.log('Export formats:', formats, 'for encounter:', encounter.encounter_id);
}

function showPublishForm(encounterId) {
  const encounter = approvedEncounters.find(e => e.encounter_id === encounterId);
  if (!encounter) return;

  components.showModal(
    'Mark as Published',
    `
      <p style="margin-bottom: 16px;">Record where this photo was published:</p>

      <div class="row">
        <label>Platform</label>
        <select id="publishPlatform" class="btn" style="width: 100%;">
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="tiktok">TikTok</option>
        </select>
      </div>

      <div class="row">
        <label>Post Type</label>
        <select id="publishType" class="btn" style="width: 100%;">
          <option value="feed">Feed Post</option>
          <option value="story">Story</option>
          <option value="reel">Reel</option>
          <option value="carousel">Carousel</option>
        </select>
      </div>

      <div class="row">
        <label>Post URL (optional)</label>
        <input id="publishUrl" type="url" placeholder="https://instagram.com/p/..." style="width: 100%;" />
      </div>

      <div class="row">
        <label>Caption (optional)</label>
        <textarea id="publishCaption" style="width: 100%; min-height: 100px; padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: transparent; color: var(--fg);"></textarea>
      </div>
    `,
    {
      confirmText: 'Mark as Published',
      cancelText: 'Cancel',
      onConfirm: async () => {
        const platform = document.getElementById('publishPlatform')?.value || 'instagram';
        const postType = document.getElementById('publishType')?.value || 'feed';
        const postUrl = document.getElementById('publishUrl')?.value.trim() || null;
        const caption = document.getElementById('publishCaption')?.value.trim() || null;

        try {
          await api.createPublication({
            encounter_id: encounterId,
            platform,
            post_type: postType,
            post_url: postUrl,
            caption
          });

          // Update local state
          const encounter = approvedEncounters.find(e => e.encounter_id === encounterId);
          if (encounter) {
            encounter.is_published = true;
          }

          await refreshGrid();
          utils.toast('Marked as published!', 'success');
        } catch (err) {
          utils.toast('Failed to mark as published: ' + err.message, 'error');
        }
      }
    }
  );
}

async function refreshGrid() {
  const gridContainer = document.getElementById('mediaGrid');
  if (gridContainer) {
    gridContainer.innerHTML = renderMediaGrid();
    setupEventListeners();
  }
}

export default { render, init };
