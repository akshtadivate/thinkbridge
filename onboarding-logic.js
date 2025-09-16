'use strict';
const DEBUG = false;

/** Method Index
 * export async function getFieldsForUser(userId: string): Promise<object[]>
 * export async function createField(fieldData: object): Promise<object>
 * export async function getAreasForUser(userId: string): Promise<object[]>
 * export async function getAreaTypesAll(): Promise<object[]>
 * export async function createArea(areaData: object): Promise<object>
 * export async function getCropInstancesForUser(userId: string): Promise<object[]>
 * export async function getLibraryCropsAll(): Promise<object[]>
 * export async function createCropInstance(cropData: object): Promise<object>
 * export async function getUserSettings(userId: string): Promise<object|null>
 * export async function updateUserSettings(userId: string, updates: object): Promise<object>
 */

/* ===========================
   Private helpers (not exported)
   =========================== */

const KEY_PREFIX = 'localDB:';            // matches existing seeded data
const LEGACY_PREFIX = 'PL__';             // optional legacy prefix migration
const META_KEY = KEY_PREFIX + '__pl_meta';
const SCHEMA_VERSION = 1;

let _initialized = false;

/**
 * Get a raw localStorage string by key.
 * @param {string} key
 * @returns {string|null}
 */
function _get(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    if (DEBUG) console.error('localStorage.getItem failed:', key, err);
    return null;
  }
}

/**
 * Set a raw localStorage string by key.
 * @param {string} key
 * @param {string} value
 */
function _set(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    if (DEBUG) console.error('localStorage.setItem failed:', key, err);
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
    if (DEBUG) console.error('localStorage.removeItem failed:', key, err);
  }
}

/**
 * Safely parse JSON from storage.
 * @param {string} key
 * @param {any} fallback
 * @returns {any}
 */
function _loadJSON(key, fallback) {
  const raw = _get(key);
  if (raw == null) return _clone(fallback);
  try {
    return JSON.parse(raw);
  } catch (err) {
    if (DEBUG) console.warn('JSON parse failed for key:', key, err);
    return _clone(fallback);
  }
}

/**
 * Safely save JSON to storage atomically.
 * @param {string} key
 * @param {any} obj
 */
function _saveJSON(key, obj) {
  try {
    const payload = JSON.stringify(obj);
    _set(key, payload);
  } catch (err) {
    if (DEBUG) console.error('JSON stringify/set failed for key:', key, err);
  }
}

/**
 * Get the storage key for a collection.
 * @param {string} collection
 */
function _keyForCollection(collection) {
  return KEY_PREFIX + collection;
}

/**
 * Load a collection array with safe defaults.
 * @param {string} collection
 * @returns {any[]}
 */
function _loadCollection(collection) {
  return _loadJSON(_keyForCollection(collection), []);
}

/**
 * Save a complete collection array atomically.
 * @param {string} collection
 * @param {any[]} items
 */
function _saveCollection(collection, items) {
  _saveJSON(_keyForCollection(collection), Array.isArray(items) ? items : []);
}

/**
 * Shallow clone via JSON to avoid accidental external mutation.
 * @param {any} v
 * @returns {any}
 */
function _clone(v) {
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return v;
  }
}

/**
 * Generate a simple id with prefix.
 * @param {string} prefix
 */
function _genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Perform one-time initialization, ensure collections exist and handle simple migrations.
 * - Idempotent and safe to call multiple times.
 */
function _ensureInitialized() {
  if (_initialized) return;

  // Ensure meta
  const meta = _loadJSON(META_KEY, null);
  if (!meta || typeof meta !== 'object') {
    _saveJSON(META_KEY, { schemaVersion: SCHEMA_VERSION, initializedAt: new Date().toISOString(), lastMigratedAt: null });
  }

  // Collections used by this module (exact scope)
  const collections = [
    'users',
    'settings',
    'fields',
    'areas',
    'areaTypes',
    'libraryCrops',
    'cropInstances'
  ];

  // Migration from legacy prefix if present and target missing
  collections.forEach((c) => {
    const targetKey = _keyForCollection(c);
    const legacyKey = LEGACY_PREFIX + c;
    const hasTarget = _get(targetKey) != null;
    const hasLegacy = _get(legacyKey) != null;

    if (!hasTarget) {
      if (hasLegacy) {
        // migrate legacy -> target
        const legacyData = _loadJSON(legacyKey, []);
        _saveCollection(c, legacyData);
        _remove(legacyKey);
        // update meta
        const m = _loadJSON(META_KEY, { schemaVersion: SCHEMA_VERSION });
        m.lastMigratedAt = new Date().toISOString();
        _saveJSON(META_KEY, m);
      } else {
        // ensure empty array
        _saveCollection(c, []);
      }
    }
  });

  _initialized = true;
}

/* ===========================
   Exported API
   =========================== */

/**
 * Retrieve all fields owned by a specific user.
 * @param {string} userId - The owner's uid (users.uid).
 * @returns {Promise<object[]>} Resolves to an array of field objects (possibly empty).
 * Usage notes:
 *  - Safe if no data exists; returns [].
 *  - Objects are plain JSON; not class instances.
 */
export async function getFieldsForUser(userId) {
  _ensureInitialized();
  const fields = _loadCollection('fields');
  const result = fields.filter(f => f && f.userId === userId);
  return _clone(result);
}

/**
 * Create or upsert a field record.
 * @param {object} fieldData - Full field object to persist. Caller typically provides an id.
 * @returns {Promise<object>} Resolves to the created/updated field object.
 * Edge cases:
 *  - If an item with the same id exists, it will be replaced (upsert semantics).
 *  - Ensures atomic write to the 'fields' collection.
 */
export async function createField(fieldData) {
  _ensureInitialized();
  const fields = _loadCollection('fields');
  const idx = fields.findIndex(f => f && f.id === fieldData.id);
  if (idx >= 0) {
    fields[idx] = _clone(fieldData);
  } else {
    fields.push(_clone(fieldData));
  }
  _saveCollection('fields', fields);
  return _clone(fieldData);
}

/**
 * Retrieve all areas owned by a specific user.
 * @param {string} userId - The owner's uid (users.uid).
 * @returns {Promise<object[]>} Resolves to an array of area objects (possibly empty).
 */
export async function getAreasForUser(userId) {
  _ensureInitialized();
  const areas = _loadCollection('areas');
  const result = areas.filter(a => a && a.userId === userId);
  return _clone(result);
}

/**
 * Retrieve all available area types.
 * @returns {Promise<object[]>} Resolves to an array of area type objects (possibly empty).
 * Notes:
 *  - This reads from the shared 'areaTypes' collection (no user filter).
 */
export async function getAreaTypesAll() {
  _ensureInitialized();
  const types = _loadCollection('areaTypes');
  return _clone(types);
}

/**
 * Create or upsert an area record.
 * @param {object} areaData - Full area object to persist. Caller typically provides an id.
 * @returns {Promise<object>} Resolves to the created/updated area object.
 * Edge cases:
 *  - If an area with the same id exists, it will be replaced.
 */
export async function createArea(areaData) {
  _ensureInitialized();
  const areas = _loadCollection('areas');
  const idx = areas.findIndex(a => a && a.id === areaData.id);
  if (idx >= 0) {
    areas[idx] = _clone(areaData);
  } else {
    areas.push(_clone(areaData));
  }
  _saveCollection('areas', areas);
  return _clone(areaData);
}

/**
 * Retrieve all crop instances owned by a specific user.
 * @param {string} userId - The owner's uid (users.uid).
 * @returns {Promise<object[]>} Resolves to an array of crop instance objects (possibly empty).
 */
export async function getCropInstancesForUser(userId) {
  _ensureInitialized();
  const crops = _loadCollection('cropInstances');
  const result = crops.filter(ci => ci && ci.userId === userId);
  return _clone(result);
}

/**
 * Retrieve all available library crops.
 * @returns {Promise<object[]>} Resolves to an array of library crop objects (possibly empty).
 * Notes:
 *  - This reads from the shared 'libraryCrops' collection (no user filter).
 */
export async function getLibraryCropsAll() {
  _ensureInitialized();
  const library = _loadCollection('libraryCrops');
  return _clone(library);
}

/**
 * Create or upsert a crop instance record.
 * @param {object} cropData - Full crop instance object to persist. Caller typically provides an id.
 * @returns {Promise<object>} Resolves to the created/updated crop instance object.
 * Edge cases:
 *  - If a crop instance with the same id exists, it will be replaced.
 */
export async function createCropInstance(cropData) {
  _ensureInitialized();
  const crops = _loadCollection('cropInstances');
  const idx = crops.findIndex(ci => ci && ci.id === cropData.id);
  if (idx >= 0) {
    crops[idx] = _clone(cropData);
  } else {
    crops.push(_clone(cropData));
  }
  _saveCollection('cropInstances', crops);
  return _clone(cropData);
}

/**
 * Get the settings object for a specific user.
 * @param {string} userId - The user's uid (users.uid).
 * @returns {Promise<object|null>} Resolves to the settings object or null if none exists.
 * Usage notes:
 *  - Caller typically checks for a truthy value before attempting to update.
 */
export async function getUserSettings(userId) {
  _ensureInitialized();
  const settings = _loadCollection('settings');
  const found = settings.find(s => s && s.userId === userId) || null;
  return _clone(found);
}

/**
 * Update the settings object for a specific user, or create one if missing.
 * @param {string} userId - The user's uid (users.uid).
 * @param {object} updates - Partial settings to merge; takes precedence over existing values.
 * @returns {Promise<object>} Resolves to the updated (or newly created) settings object.
 * Behavior:
 *  - If a settings record for the user exists, merge and persist atomically.
 *  - If not found, a new settings object is created with minimal defaults plus the provided updates.
 * Edge cases:
 *  - Unknown fields in updates are accepted and stored.
 */
export async function updateUserSettings(userId, updates) {
  _ensureInitialized();
  const settings = _loadCollection('settings');
  const idx = settings.findIndex(s => s && s.userId === userId);
  const nowIso = new Date().toISOString();

  if (idx >= 0) {
    const merged = { ...settings[idx], ..._clone(updates) };
    if (!('updatedAt' in updates)) {
      merged.updatedAt = nowIso;
    }
    settings[idx] = merged;
    _saveCollection('settings', settings);
    return _clone(merged);
  }

  // Create a new settings record if none exists for this user
  const created = {
    id: _genId('s'),
    userId,
    language: 'EN',
    notificationsEnabled: false,
    backupEnabled: false,
    notificationPermission: 'default',
    weekStart: 'MON',
    lastSync: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    ..._clone(updates)
  };
  settings.push(created);
  _saveCollection('settings', settings);
  return _clone(created);
}