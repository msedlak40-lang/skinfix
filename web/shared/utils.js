// ============================
// Shared Utility Functions
// ============================

// Toast notifications (using existing Toastify)
export function toast(msg, type = 'info') {
  try {
    if (window?.Toastify) {
      const backgroundColor = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
      }[type] || '#3b82f6';

      window.Toastify({
        text: msg,
        duration: 3000,
        gravity: 'bottom',
        position: 'right',
        style: { background: backgroundColor }
      }).showToast();
    } else {
      console.log(`[${type.toUpperCase()}]`, msg);
    }
  } catch {
    console.log(`[${type.toUpperCase()}]`, msg);
  }
}

// Button lock helper (prevents double-clicks)
export async function withLock(btn, fn) {
  if (!btn) return fn();
  if (btn.disabled) return; // Already locked

  btn.disabled = true;
  const originalText = btn.textContent;

  try {
    btn.textContent = 'Loading...';
    return await fn();
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// Format date/time
export function formatDate(dateStr, options = {}) {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  const defaults = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Chicago'
  };

  return date.toLocaleDateString('en-US', { ...defaults, ...options });
}

export function formatDateTime(dateStr) {
  return formatDate(dateStr, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago'
  });
}

export function formatRelativeTime(dateStr) {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) return formatDate(dateStr);
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

// Format phone number
export function formatPhone(phone) {
  if (!phone) return '';

  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');

  // Format as (555) 555-0123 or +1 (555) 555-0123
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  return phone; // Return as-is if can't format
}

// Auto-format phone number as user types
export function autoFormatPhone(inputElement) {
  if (!inputElement) return;

  inputElement.addEventListener('input', (e) => {
    const input = e.target;
    const cursorPos = input.selectionStart;
    const oldLength = input.value.length;

    // Remove all non-digits
    const cleaned = input.value.replace(/\D/g, '');

    // Format based on length
    let formatted = '';
    if (cleaned.length === 0) {
      formatted = '';
    } else if (cleaned.length <= 3) {
      formatted = `(${cleaned}`;
    } else if (cleaned.length <= 6) {
      formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else if (cleaned.length <= 10) {
      formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    } else {
      // Limit to 10 digits for US numbers
      formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }

    input.value = formatted;

    // Adjust cursor position
    const newLength = formatted.length;
    const diff = newLength - oldLength;
    input.setSelectionRange(cursorPos + diff, cursorPos + diff);
  });
}

// Debounce function (for search inputs)
export function debounce(fn, delay = 300) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Generate UUID (client-side, for temporary IDs)
export function uuid() {
  return crypto.randomUUID();
}

// File size formatter
export function formatFileSize(bytes) {
  if (!bytes) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// Image dimension checker
export function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

// Strip EXIF data from image (privacy)
export async function stripEXIF(file) {
  // Create canvas and draw image without EXIF
  const img = new Image();
  const url = URL.createObjectURL(file);

  return new Promise((resolve, reject) => {
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (blob) {
          resolve(new File([blob], file.name, { type: file.type }));
        } else {
          reject(new Error('Failed to strip EXIF'));
        }
      }, file.type || 'image/jpeg', 0.95);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

// Compress image if too large
export async function compressImage(file, maxSizeMB = 10) {
  if (file.size <= maxSizeMB * 1024 * 1024) {
    return file; // Already small enough
  }

  const img = new Image();
  const url = URL.createObjectURL(file);

  return new Promise((resolve, reject) => {
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      // Reduce dimensions if very large
      const maxDimension = 2048;
      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width *= scale;
        height *= scale;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (blob) {
          resolve(new File([blob], file.name, { type: file.type }));
        } else {
          reject(new Error('Failed to compress image'));
        }
      }, file.type || 'image/jpeg', 0.85);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

// Copy to clipboard
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard', 'success');
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    toast('Failed to copy', 'error');
    return false;
  }
}

// Download file (for images, asset packs, etc.)
export function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Escape HTML (prevent XSS)
export function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Parse query string
export function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(params.entries());
}

// Status badge colors
export function getStatusBadge(status) {
  const badges = {
    'pending_upload': { text: 'Pending Upload', color: '#f59e0b' },
    'pending_approval': { text: 'Pending Approval', color: '#3b82f6' },
    'approved': { text: 'Approved', color: '#10b981' },
    'rejected': { text: 'Rejected', color: '#ef4444' }
  };

  return badges[status] || { text: status, color: '#6b7280' };
}

// Export all
window.utils = {
  toast,
  withLock,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatPhone,
  formatFileSize,
  debounce,
  uuid,
  getImageDimensions,
  stripEXIF,
  compressImage,
  copyToClipboard,
  downloadFile,
  escapeHTML,
  getQueryParams,
  getStatusBadge
};

export default window.utils;
