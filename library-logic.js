'use strict';
const DEBUG = false;

/** Method Index
 * export async function getLibraryCrops(category?: string): Promise<object[]>
 * export async function getTaskTemplates(): Promise<object[]>
 * export async function addCustomLibraryCrop(cropData: object): Promise<{ id: string, success: boolean, error?: string }>
 * export async function getCurrentUserSettings(): Promise<{ language: string, userId: (string|null), [key: string]: any }>
 */

/**
 * Private constants and helpers (not exported)
 */
const APP_PREFIX = 'PL__';              // Namespace for this module's own keys
const DB_PREFIX = 'localDB:';           // Namespace used by the app's seeded collections
const META_KEY = `${APP_PREFIX}meta`;   // Holds schema metadata for this module
const CURRENT_USER_KEY = `${APP_PREFIX}currentUserId`; // Optional selector persisted by this module
const SCHEMA_VERSION = 1;

/**
 * Safe localStorage getters/setters
 * All JSON operations are wrapped with try/catch and use atomic writes.
 */
function _get(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    if (DEBUG) console.error('localStorage.getItem failed for key:', key, err);
    return null;
  }
}

function _set(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    if (DEBUG) console.error('localStorage.setItem failed for key:', key, err);
    return false;
  }
}

function _remove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (err) {
    if (DEBUG) console.error('localStorage.removeItem failed for key:', key, err);
    return false;
  }
}

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

function _saveJSON(key, obj) {
  try {
    const json = JSON.stringify(obj);
    return _set(key, json);
  } catch (err) {
    if (DEBUG) console.error('JSON.stringify/set failed for key:', key, err);
    return false;
  }
}

/**
 * Ensure module schema initialization and handle migrations.
 * Idempotent and safe to call from any exported method.
 */
function _ensureInitialized() {
  const meta = _loadJSON(META_KEY, null);
  if (!meta) {
    const newMeta = {
      schemaVersion: SCHEMA_VERSION,
      createdAt: _now(),
      updatedAt: _now()
    };
    _saveJSON(META_KEY, newMeta);
    return;
  }
  if (typeof meta.schemaVersion !== 'number') {
    meta.schemaVersion = SCHEMA_VERSION;
    meta.updatedAt = _now();
    _saveJSON(META_KEY, meta);
  }
  if (meta.schemaVersion < SCHEMA_VERSION) {
    // Placeholder for future migrations; currently no-op.
    meta.schemaVersion = SCHEMA_VERSION;
    meta.updatedAt = _now();
    _saveJSON(META_KEY, meta);
  }
}

/**
 * Utility: current ISO timestamp
 */
function _now() {
  return new Date().toISOString();
}

/**
 * Utility: create a slug from a name for cropId generation
 * e.g., "Green Tomato" -> "green-tomato"
 */
function _slugify(str) {
  if (!str) return 'item';
  return String(str)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48) || 'item';
}

/**
 * Utility: short random id segment (base36)
 */
function _rid(len = 8) {
  const rnd = Math.random().toString(36).slice(2);
  const ts = Date.now().toString(36);
  return (ts + rnd).slice(-len);
}

/**
 * Utility: find "current" settings by heuristics
 * - Prefer explicit CURRENT_USER_KEY if present (matching settings.userId).
 * - Else, if only one settings item exists, return it.
 * - Else, prefer the settings of a "farmer" user if present.
 * - Else, return the most recently updated settings.
 */
function _findCurrentSettings() {
  const settings = _loadJSON(`${DB_PREFIX}settings`, []);
  if (!Array.isArray(settings) || settings.length === 0) {
    return null;
  }

  const users = _loadJSON(`${DB_PREFIX}users`, []);
  const byUserId = new Map();
  if (Array.isArray(users)) {
    for (const u of users) {
      if (u && u.uid) byUserId.set(u.uid, u);
    }
  }

  // 1) Explicit selection
  const selUserId = _get(CURRENT_USER_KEY);
  if (selUserId) {
    const chosen = settings.find(s => s && s.userId === selUserId);
    if (chosen) return chosen;
  }

  // 2) Single settings
  if (settings.length === 1) {
    return settings[0];
  }

  // 3) Prefer farmer
  const farmerSetting = settings.find(s => {
    const u = s && s.userId ? byUserId.get(s.userId) : null;
    return u && u.role === 'farmer';
  });
  if (farmerSetting) return farmerSetting;

  // 4) Most recently updated
  const sorted = [...settings].sort((a, b) => {
    const ta = Date.parse(a?.updatedAt || a?.createdAt || 0) || 0;
    const tb = Date.parse(b?.updatedAt || b?.createdAt || 0) || 0;
    return tb - ta;
  });
  return sorted[0] || settings[0];
}

/**
 * Fetch all library crops.
 * If a category is provided, results are filtered by that category.
 *
 * @param {string} [category] - Optional category filter (tree|vegetable|grain|fruit|flower|other).
 * @returns {Promise<object[]>} Resolves to an array of library crop templates.
 *   Each item typically includes:
 *   { id, cropId, nameEn, nameTa, category, daysToMaturity, spacingReference,
 *     defaultCareTemplateId, typicalPests, typicalNutrients, version, createdAt, updatedAt, stageDefinitions? }
 *
 * Edge cases:
 * - If storage is empty or unavailable, returns [].
 * - Unknown category yields [].
 *
 * Usage notes:
 * - Function is async for consistency; callers may await it.
 */
export async function getLibraryCrops(category) {
  _ensureInitialized();
  const list = _loadJSON(`${DB_PREFIX}libraryCrops`, []);
  if (!Array.isArray(list)) return [];
  if (!category) return list;
  return list.filter(c => c && c.category === category);
}

/**
 * Fetch available task templates for default care assignment.
 *
 * @returns {Promise<object[]>} Resolves to an array of task templates.
 *   Typical fields: { id, name, taskTypeId, defaultUnitId, requiresQuantity, notes, icon, ... }
 *
 * Edge cases:
 * - If storage is empty or unavailable, returns [].
 *
 * Usage notes:
 * - Function is async for consistency; callers may await it.
 */
export async function getTaskTemplates() {
  _ensureInitialized();
  const list = _loadJSON(`${DB_PREFIX}taskTemplates`, []);
  return Array.isArray(list) ? list : [];
}

/**
 * Add a new custom crop to the library.
 *
 * @param {object} cropData - Input data collected from the form.
 *   Expected keys (based on caller):
 *   - nameEn {string} required
 *   - nameTa {string} optional ('' if not provided)
 *   - category {string} required (tree|vegetable|grain|fruit|flower|other)
 *   - daysToMaturity {number|null} optional
 *   - defaultCareTemplateId {string|null} optional
 *   May also include optional text fields:
 *   - spacingReference {string}
 *   - typicalPests {string}
 *   - typicalNutrients {string}
 *
 * @returns {Promise<{id: string, success: boolean, error?: string}>}
 *   - success true/false indicating persistence outcome.
 *   - id is the new library crop id when success is true.
 *
 * Behavior:
 * - Generates stable ids:
 *   id: "lc-custom-<short>"
 *   cropId: "crop-custom-<slug>-<short>"
 * - Writes atomically to "localDB:libraryCrops".
 * - Fills defaults for missing optional string fields with '' and nulls where applicable.
 *
 * Edge cases:
 * - If storage write fails, returns { success: false, id: '' } with error description.
 *
 * Usage notes:
 * - Function is async; callers await it.
 */
export async function addCustomLibraryCrop(cropData) {
  _ensureInitialized();

  const now = _now();
  const nameEn = (cropData?.nameEn || '').trim();
  const nameTa = (cropData?.nameTa || '').trim();
  const category = (cropData?.category || '').trim();

  if (!nameEn || !category) {
    return { id: '', success: false, error: 'Missing required fields: nameEn/category' };
  }

  // Load current list or default to []
  const existing = _loadJSON(`${DB_PREFIX}libraryCrops`, []);
  const list = Array.isArray(existing) ? existing.slice() : [];

  const short = _rid(6);
  const slug = _slugify(nameEn);
  const newId = `lc-custom-${short}`;
  const newCropId = `crop-custom-${slug}-${short}`;

  const newItem = {
    id: newId,
    cropId: newCropId,
    nameEn,
    nameTa: nameTa || '',
    category,
    daysToMaturity: (typeof cropData.daysToMaturity === 'number' && isFinite(cropData.daysToMaturity))
      ? Math.trunc(cropData.daysToMaturity)
      : (cropData.daysToMaturity === null ? null : null),
    stageDefinitions: [],
    spacingReference: (cropData.spacingReference || '').toString(),
    defaultCareTemplateId: cropData.defaultCareTemplateId || null,
    typicalPests: (cropData.typicalPests || '').toString(),
    typicalNutrients: (cropData.typicalNutrients || '').toString(),
    version: '1.0',
    createdAt: now,
    updatedAt: now
  };

  list.push(newItem);
  const ok = _saveJSON(`${DB_PREFIX}libraryCrops`, list);
  if (!ok) {
    return { id: '', success: false, error: 'Failed to persist library crop' };
  }
  return { id: newId, success: true };
}

/**
 * Retrieve the current user's settings (language preference, etc.).
 *
 * @returns {Promise<{ language: string, userId: (string|null), [key: string]: any }>}
 *   - Returns a settings-like object. At minimum contains:
 *     { language: 'EN'|'TA', userId: string|null, ...originalSettingFields }
 *   - If no settings are found, returns a sensible default: { language: 'EN', userId: null }.
 *
 * Behavior:
 * - Uses an internal heuristic to select the "current" settings:
 *   1) If a userId is stored under PL__currentUserId, use matching settings.
 *   2) Else if only one settings entry exists, use it.
 *   3) Else prefer settings of a user with role 'farmer'.
 *   4) Else use the most recently updated settings.
 *
 * Collections read: settings, users
 *
 * Usage notes:
 * - Function is async; callers await it.
 */
export async function getCurrentUserSettings() {
  _ensureInitialized();
  const chosen = _findCurrentSettings();
  if (!chosen) {
    return { language: 'EN', userId: null };
  }
  // Ensure language and userId are present with defaults
  const language = (chosen.language === 'TA' || chosen.language === 'EN') ? chosen.language : 'EN';
  const userId = chosen.userId ?? null;
  // Return original fields plus enforced keys
  return { ...chosen, language, userId };
}