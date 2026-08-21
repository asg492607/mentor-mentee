/**
 * Lumina Reliability & Security Suite
 * Fast, lightweight error boundary and file validation
 */

// ─── 1. SECURE FILE VALIDATION HELPER ───────────────────────────────────────
export function validateFile(file, allowedMimeTypes = ['image/png', 'image/jpeg', 'application/pdf'], maxSizeMB = 5) {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > maxSizeMB) {
    return { valid: false, error: `File size exceeds max limit of ${maxSizeMB} MB.` };
  }

  if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.type)) {
    return { valid: false, error: `Invalid file format (${file.type}). Allowed formats: ${allowedMimeTypes.join(', ')}` };
  }

  return { valid: true };
}

// ─── 2. AUDIT LOGGING SERVICE (SAFE NO-LOOP) ─────────────────────────────────
export const AuditLogService = {
  async log(action, details = {}) {
    // Non-blocking in-memory log
    if (typeof window !== 'undefined' && window.__LUMINA_DEBUG) {
      console.log(`[AuditLog] ${action}:`, details);
    }
  }
};

// ─── 3. GLOBAL UNHANDLED ERROR BOUNDARY ────────────────────────────────────
export function setupGlobalErrorHandler() {
  window.addEventListener('error', (event) => {
    console.warn('[Lumina Error Caught]:', event.message || event.error);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.warn('[Lumina Unhandled Rejection]:', event.reason);
  });
}

// Initialize error reporting immediately
setupGlobalErrorHandler();
