'use strict';
const DEBUG = false;

/** Method Index
 * export async function getCurrentUserSettings(): Promise<{language:string, notificationsEnabled:boolean, backupEnabled:boolean, weekStart:string, lastSync:string|null, notificationPermission:'granted'|'denied'|'default'}>
 * export async function updateUserSettings(patch: Partial<{language:string, notificationsEnabled:boolean, backupEnabled:boolean, notificationPermission:string, weekStart:string, lastSync:string|null}>): Promise<{language:string, notificationsEnabled:boolean, backupEnabled:boolean, weekStart:string, lastSync:string|null, notificationPermission:'granted'|'denied'|'default'}>
 * export async function requestNotificationPermission(): Promise<'granted'|'denied'|'default'>
 * export async function getNotificationPermissionStatus(): Promise<{permission:'granted'|'denied'|'default', supported:boolean}>
 * export function formatLastSyncDate(isoString: string): string
 * export async function enableBackupService(): Promise<{enabled:boolean, lastSync:string|null}>
 * export async function disableBackupService(): Promise<void>
 */

/* =============================================================================
   Private storage helpers and initialization
   ========================================================================== */

const KEY_PREFIX = 'localDB:';       // Namespace used by existing local storage schema
const META_PREFIX = 'PL__';          // Module-internal metadata prefix
const SCHEMA_VERSION = 1;            // For future migrations; bump if structure changes

/**
 * Get a localStorage string value.
 * All storage access must go through these helpers.
 * @param {string} key
 * @returns {string|null}
 */
function _get(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    if (DEBUG) console.warn('localStorage.getItem failed for key:', key, err);
    return null;
  }
}

/**
 * Set a localStorage string value.
 * @param {string} key
 * @param {string} value
 */
function _set(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    if (DEBUG) console.warn('localStorage.setItem failed for key:', key, err);
  }
}

/**
 * Remove a localStorage key.
 * @param {string} key
 */
function _remove(key) {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    if (DEBUG) console.warn('localStorage.removeItem failed for key:', key, err);
  }
}

/**
 * Safely load JSON from localStorage.
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {T}
 */
function _loadJSON(key, fallback) {
  const raw = _get(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch (err) {
    if (DEBUG) console.warn('JSON.parse failed for key:', key, err);
    return fallback;
  }
}

/**
 * Safely save JSON to localStorage (atomic: single write).
 * @param {string} key
 * @param {any} obj
 */
function _saveJSON(key, obj) {
  try {
    const data = JSON.stringify(obj);
    _set(key, data);
  } catch (err) {
    if (DEBUG) console.warn('JSON.stringify failed for key:', key, err);
  }
}

/**
 * Load a collection array.
 * @param {string} collectionName
 * @returns {any[]}
 */
function _loadCollection(collectionName) {
  return _loadJSON(KEY_PREFIX + collectionName, []);
}

/**
 * Save a full collection array (atomic).
 * @param {string} collectionName
 * @param {any[]} items
 */
function _saveCollection(collectionName, items) {
  _saveJSON(KEY_PREFIX + collectionName, Array.isArray(items) ? items : []);
}

/**
 * Idempotent module initialization and light migration hook.
 * Ensures presence of core collection keys. Does not seed data.
 */
function _ensureInitialized() {
  // Track module schema version
  const verKey = META_PREFIX + 'schemaVersion';
  const current = _get(verKey);
  if (current === null) {
    _set(verKey, String(SCHEMA_VERSION));
  } else {
    const num = Number(current);
    if (!Number.isFinite(num) || num < SCHEMA_VERSION) {
      // Placeholder for future migrations
      _set(verKey, String(SCHEMA_VERSION));
    }
  }

  // Ensure required collections exist (empty arrays if missing)
  const mustHave = ['users', 'settings', 'syncQueue'];
  for (const name of mustHave) {
    const key = KEY_PREFIX + name;
    if (_get(key) === null) {
      _saveCollection(name, []);
    }
  }
}

/* =============================================================================
   Domain helpers
   ========================================================================== */

/**
 * Generate a short id.
 * @param {number} [size=8]
 * @returns {string}
 */
function _nanoid(size = 8) {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let out = '';
  for (let i = 0; i < size; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * Returns now as ISO string.
 * @returns {string}
 */
function _nowISO() {
  return new Date().toISOString();
}

/**
 * Determine the "current user" uid in a best-effort way.
 * - Checks a few common keys.
 * - Falls back to the first user found in localDB:users.
 * @returns {string|null} uid or null if none
 */
function _getCurrentUserUid() {
  // Common keys some apps use to store current user
  const candidates = ['currentUserId', 'app:currentUserId', 'auth:uid', 'activeUserId', 'app:activeUserUid'];
  for (const k of candidates) {
    const v = _get(k);
    if (v) return v;
  }

  // Fallback to first user in collection (prefer non-admin if multiple)
  const users = _loadCollection('users');
  if (!Array.isArray(users) || users.length === 0) return null;

  const nonAdmins = users.filter(u => (u && typeof u === 'object' && u.role !== 'admin'));
  const pickFrom = nonAdmins.length > 0 ? nonAdmins : users;

  // Sort by createdAt if present to stabilize selection
  pickFrom.sort((a, b) => {
    const ad = Date.parse(a?.createdAt || '') || 0;
    const bd = Date.parse(b?.createdAt || '') || 0;
    return ad - bd;
  });
  return pickFrom[0]?.uid || pickFrom[0]?.id || null;
}

/**
 * Find settings for a user uid or create with defaults.
 * Also links users.settingsId if missing.
 * @param {string} userUid
 * @returns {{settings:any, users:any[], settingsList:any[]}}
 */
function _findOrCreateSettingsForUser(userUid) {
  const users = _loadCollection('users');
  const settingsList = _loadCollection('settings');

  let settings = settingsList.find(s => s && s.userId === userUid);

  if (!settings) {
    const now = _nowISO();
    const newId = 's-' + _nanoid(6);
    settings = {
      id: newId,
      userId: userUid,
      language: 'EN',
      notificationsEnabled: false,
      backupEnabled: false,
      notificationPermission: 'default',
      weekStart: 'MON',
      lastSync: null,
      createdAt: now,
      updatedAt: now
    };
    settingsList.push(settings);

    // Link in user record if present
    const uIdx = users.findIndex(u => u && (u.uid === userUid || u.id === userUid));
    if (uIdx >= 0) {
      const user = users[uIdx];
      if (user) {
        const updated = { ...user, settingsId: settings.id, updatedAt: _nowISO() };
        users[uIdx] = updated;
      }
      _saveCollection('users', users);
    }
    _saveCollection('settings', settingsList);
  }

  return { settings, users, settingsList };
}

/**
 * Normalize settings to the subset consumed by UI.
 * @param {any} s
 * @returns {{language:string, notificationsEnabled:boolean, backupEnabled:boolean, weekStart:string, lastSync:string|null, notificationPermission:'granted'|'denied'|'default'}}
 */
function _toSettingsSummary(s) {
  return {
    language: s?.language ?? 'EN',
    notificationsEnabled: Boolean(s?.notificationsEnabled),
    backupEnabled: Boolean(s?.backupEnabled),
    weekStart: s?.weekStart ?? 'MON',
    lastSync: s?.lastSync ?? null,
    notificationPermission: /** @type {'granted'|'denied'|'default'} */ (s?.notificationPermission ?? 'default')
  };
}

/* =============================================================================
   Exports
   ========================================================================== */

/**
 * Load current user's settings.
 * - Resolves the current user uid from localStorage or falls back to the first available user.
 * - If the user has no settings, creates a default settings document and links it to the user.
 *
 * @returns {Promise<{language:string, notificationsEnabled:boolean, backupEnabled:boolean, weekStart:string, lastSync:string|null, notificationPermission:'granted'|'denied'|'default'}>}
 *
 * Edge cases:
 * - If no user exists, returns default values without persistence.
 * - Self-heals missing settings by creating them.
 */
export async function getCurrentUserSettings() {
  _ensureInitialized();

  const userUid = _getCurrentUserUid();
  if (!userUid) {
    // No users in storage; return ephemeral defaults.
    return {
      language: 'EN',
      notificationsEnabled: false,
      backupEnabled: false,
      weekStart: 'MON',
      lastSync: null,
      notificationPermission: 'default'
    };
  }

  const { settings } = _findOrCreateSettingsForUser(userUid);
  return _toSettingsSummary(settings);
}

/**
 * Update current user's settings with a partial patch.
 * - Applies only known keys; ignores unknown properties.
 * - Updates updatedAt timestamp.
 *
 * @param {Partial<{language:string, notificationsEnabled:boolean, backupEnabled:boolean, notificationPermission:string, weekStart:string, lastSync:string|null}>} patch
 * @returns {Promise<{language:string, notificationsEnabled:boolean, backupEnabled:boolean, weekStart:string, lastSync:string|null, notificationPermission:'granted'|'denied'|'default'}>}
 *
 * Usage notes:
 * - Callers typically pass a subset, e.g., { language: 'EN' } or { notificationsEnabled: true }.
 * - Returns the normalized updated settings summary.
 */
export async function updateUserSettings(patch) {
  _ensureInitialized();

  const userUid = _getCurrentUserUid();
  if (!userUid) {
    // No user to update; return defaults
    return {
      language: 'EN',
      notificationsEnabled: false,
      backupEnabled: false,
      weekStart: 'MON',
      lastSync: null,
      notificationPermission: 'default'
    };
  }

  const { settingsList, settings } = _findOrCreateSettingsForUser(userUid);

  // Allowlist of fields that can be updated
  const allowedKeys = new Set([
    'language',
    'notificationsEnabled',
    'backupEnabled',
    'notificationPermission',
    'weekStart',
    'lastSync'
  ]);

  const idx = settingsList.findIndex(s => s && s.id === settings.id);
  if (idx < 0) {
    // Should not happen, but self-heal: append
    settingsList.push(settings);
  } else {
    const next = { ...settings };
    for (const [k, v] of Object.entries(patch || {})) {
      if (allowedKeys.has(k)) {
        next[k] = v;
      }
    }
    next.updatedAt = _nowISO();
    settingsList[idx] = next;
  }

  _saveCollection('settings', settingsList);

  const updated = settingsList.find(s => s && s.id === settings.id) || settings;
  return _toSettingsSummary(updated);
}

/**
 * Request browser notification permission.
 *
 * @returns {Promise<'granted'|'denied'|'default'>}
 *
 * Behavior:
 * - If Notification API not supported, resolves to 'denied'.
 * - If already 'granted' or 'denied', returns that without prompting.
 * - Otherwise, prompts the user and returns the resulting permission string.
 *
 * Note:
 * - Callers typically follow up with updateUserSettings(...) to record app-level flags.
 */
export async function requestNotificationPermission() {
  _ensureInitialized();

  const supported = typeof window !== 'undefined' && typeof window.Notification !== 'undefined';
  if (!supported) return 'denied';

  try {
    const current = Notification.permission;
    if (current === 'granted' || current === 'denied') {
      return current;
    }
    // Normalize to Promise in case older implementations use callbacks
    const result = await Promise.resolve(Notification.requestPermission());
    return result === 'granted' || result === 'denied' ? result : 'default';
  } catch (_e) {
    return 'denied';
  }
}

/**
 * Get current browser notification permission status.
 * May also mirror this status into the stored settings for the current user.
 *
 * @returns {Promise<{permission:'granted'|'denied'|'default', supported:boolean}>}
 *
 * Edge cases:
 * - If Notification API is unsupported, returns { permission: 'denied', supported: false }.
 */
export async function getNotificationPermissionStatus() {
  _ensureInitialized();

  const supported = typeof window !== 'undefined' && typeof window.Notification !== 'undefined';
  const permission = supported ? (Notification.permission || 'default') : 'denied';

  // Opportunistically sync this to settings.notificationPermission for current user
  try {
    await updateUserSettings({ notificationPermission: permission });
  } catch (_e) {
    // Non-fatal if settings cannot be updated
  }

  return { permission, supported };
}

/**
 * Format a last-sync ISO timestamp into a user-friendly string.
 *
 * @param {string} isoString
 * @returns {string}
 *
 * Notes:
 * - Returns 'Invalid date' if the input cannot be parsed.
 * - Uses the browser's current locale and includes date and time.
 */
export function formatLastSyncDate(isoString) {
  _ensureInitialized();

  if (!isoString || typeof isoString !== 'string') return 'Invalid date';
  const dt = new Date(isoString);
  if (isNaN(dt.getTime())) return 'Invalid date';

  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(dt);
  } catch (_e) {
    return dt.toLocaleString();
  }
}

/**
 * Enable data backup service for the current user.
 * - Sets backupEnabled = true in settings.
 * - Schedules an initial sync by adding a pending entry to syncQueue.
 *
 * @returns {Promise<{enabled:boolean, lastSync:string|null}>}
 *
 * Notes:
 * - This function does not perform actual network sync; it only persists intent and queues a task.
 * - lastSync is not set by this method (remains previous value or null), so UI may show 'Initializing...'.
 */
export async function enableBackupService() {
  _ensureInitialized();

  const userUid = _getCurrentUserUid();
  if (!userUid) {
    return { enabled: false, lastSync: null };
  }

  // Update settings
  const updated = await updateUserSettings({ backupEnabled: true });

  // Queue initial sync task
  const syncQueue = _loadCollection('syncQueue');
  const now = _nowISO();
  syncQueue.push({
    id: 'sq-' + _nanoid(6),
    userId: userUid,
    entityType: 'backup',       // informational; consumer can interpret this as a full backup request
    entityId: updated ? 'settings' : null,
    operation: 'syncAll',
    payload: JSON.stringify({ reason: 'enableBackup', requestedAt: now }),
    createdAt: now,
    lastAttemptAt: null,
    retries: 0,
    status: 'pending'
  });
  _saveCollection('syncQueue', syncQueue);

  return { enabled: true, lastSync: updated.lastSync || null };
}

/**
 * Disable data backup service for the current user.
 * - Sets backupEnabled = false in settings.
 * - Removes any pending "backup" syncQueue entries for the user (best-effort).
 *
 * @returns {Promise<void>}
 */
export async function disableBackupService() {
  _ensureInitialized();

  const userUid = _getCurrentUserUid();
  await updateUserSettings({ backupEnabled: false });

  if (!userUid) return;

  // Prune pending backup requests for this user
  const syncQueue = _loadCollection('syncQueue');
  const filtered = syncQueue.filter(
    (q) => !(q && q.userId === userUid && q.entityType === 'backup' && q.status === 'pending')
  );
  if (filtered.length !== syncQueue.length) {
    _saveCollection('syncQueue', filtered);
  }
}