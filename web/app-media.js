// ============================
// Media Service App Integration
// Loads routing and page modules for media/review management
// ============================

import router from './shared/router.js';
import './shared/api.js';
import './shared/utils.js';
import './shared/components.js';

// Import page modules
import mediaUpload from './modules/media-upload.js';
import approvalQueue from './modules/approval-queue.js';
import mediaLibrary from './modules/media-library.js';
import reviews from './modules/reviews.js';
import analytics from './modules/analytics.js';

// ============================================================================
// ROUTER SETUP
// ============================================================================

router
  .setContainer('appContent')

  // Media routes
  .register('/media/upload', async () => {
    const html = await mediaUpload.render();
    setTimeout(() => mediaUpload.init(), 100);
    return html;
  })

  .register('/media/approval', async () => {
    const html = await approvalQueue.render();
    setTimeout(() => approvalQueue.init(), 100);
    return html;
  })

  .register('/media/library', async () => {
    const html = await mediaLibrary.render();
    setTimeout(() => mediaLibrary.init(), 100);
    return html;
  })

  // Reviews route
  .register('/reviews', async () => {
    const html = await reviews.render();
    setTimeout(() => reviews.init(), 100);
    return html;
  })

  // Analytics route
  .register('/analytics', async () => {
    const html = await analytics.render();
    setTimeout(() => analytics.init(), 100);
    return html;
  })

  // Default route (redirect to upload)
  .register('/', () => {
    router.navigate('/media/upload');
    return '<div class="card">Loading...</div>';
  })

  // 404 handler
  .register('*', () => {
    return `
      <div class="card">
        <h2 class="err">Page Not Found</h2>
        <p>The page you're looking for doesn't exist.</p>
        <button class="btn" onclick="router.navigate('/media/upload')">
          Go to Media Upload
        </button>
      </div>
    `;
  });

// ============================================================================
// NAVIGATION HIGHLIGHTING
// ============================================================================

window.addEventListener('routechange', (e) => {
  const path = e.detail.path;

  // Update active tab
  document.querySelectorAll('[data-route]').forEach(link => {
    const linkPath = link.getAttribute('data-route');
    if (linkPath === path || (linkPath !== '/' && path.startsWith(linkPath))) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
});

// ============================================================================
// START ROUTER
// ============================================================================

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    router.start();
  });
} else {
  router.start();
}

console.log('Media service app loaded');
