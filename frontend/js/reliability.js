/**
 * Lumina Phase 1 Reliability & Security Suite
 * Auto-retry, Global Error Catchers, Audit Logging, and File Validation
 */

import { db } from '/js/firebase-init.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getCurrentUser } from '/js/auth.js';

// ─── 1. AUTO-RETRY NETWORK HELPER ────────────────────────────────────────────
export async function fetchWithRetry(fn, retries = 3, delayMs = 1000) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn(`[Network Retry] Attempt ${attempt}/${retries} failed:`, err.message || err);
      if (attempt < retries) {
        await new Promise(res => setTimeout(res, delayMs * attempt));
      }
    }
  }
  throw lastError;
}

// ─── 2. AUDIT LOGGING SERVICE ────────────────────────────────────────────────
export const AuditLogService = {
  async log(action, details = {}) {
    try {
      const user = getCurrentUser();
      await addDoc(collection(db, 'audit_logs'), {
        action,
        details,
        performedBy: user ? user.uid : 'SYSTEM',
        performedByEmail: user ? user.email : 'anonymous',
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      });
    } catch (e) {
      console.warn('Audit log write error:', e);
    }
  }
};

// ─── 3. SECURE FILE VALIDATION HELPER ───────────────────────────────────────
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

// ─── 4. GLOBAL UNHANDLED ERROR BOUNDARY ────────────────────────────────────
export function setupGlobalErrorHandler() {
  window.addEventListener('error', (event) => {
    console.error('[Global Error Caught]:', event.error || event.message);
    AuditLogService.log('CLIENT_ERROR', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Unhandled Promise Rejection]:', event.reason);
    AuditLogService.log('PROMISE_REJECTION', {
      reason: String(event.reason)
    });
  });
}

// Initialize error reporting immediately
setupGlobalErrorHandler();
