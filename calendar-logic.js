'use strict';
const DEBUG = false;

/** Method Index
 * export async function getTaskOccurrencesByDateRange(startDate: Date, endDate: Date, filters?: object): Promise<object[]>
 * export async function getCropInstances(): Promise<object[]>
 * export async function getAreas(): Promise<object[]>
 * export async function getFields(): Promise<object[]>
 * export async function getTaskTypes(): Promise<object[]>
 * export async function getStatusCodes(): Promise<object[]>
 * export async function getWeatherEventsByDateRange(startDate: Date, endDate: Date): Promise<object[]>
 * export async function getUserSettings(): Promise<object | null>
 */

/**
 * Internal constants and helpers (private)
 */
const NS = 'PL__'; // namespace for this module's own keys
const META_KEY = `${NS}meta`;
const CURRENT_USER_KEY = `${NS}currentUserId`;
const SCHEMA_VERSION = 1;

// In-memory cache for parsed collections
const _cache = new Map();

/**
 * Safely get a raw string from localStorage.
 * @param {string} key
 * @returns {string|null}
 */
function _get(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    if (DEBUG) console.warn('localStorage.getItem failed', key, err);
    return null;
  }
}

/**
 * Safely and atomically set a string value in localStorage.
 * @param {string} key
 * @param {string} value
 */
function _set(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    if (DEBUG) console.warn('localStorage.setItem failed', key, err);
  }
}

/**
 * Safely remove a key from localStorage.
 * @param {string} key
 */
function _remove(key) {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    if (DEBUG) console.warn('localStorage.removeItem failed', key, err);
  }
}

/**
 * Safely parse JSON from localStorage, returning fallback on error.
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
  } catch {
    return fallback;
  }
}

/**
 * Safely write an object to localStorage as JSON (atomic).
 * @param {string} key
 * @param {any} obj
 */
function _saveJSON(key, obj) {
  try {
    const payload = JSON.stringify(obj);
    _set(key, payload);
  } catch (err) {
    if (DEBUG) console.warn('JSON stringify/set failed', key, err);
  }
}

/**
 * Load a collection from the app's seeded localDB, cached per session.
 * Seed initializer uses key pattern: "localDB:<collectionName>"
 * @param {string} collectionName
 * @returns {any[]}
 */
function _loadCollection(collectionName) {
  const key = `localDB:${collectionName}`;
  if (_cache.has(key)) return /** @type {any[]} */ (_cache.get(key));
  const arr = _loadJSON(key, []);
  if (!Array.isArray(arr)) {
    _cache.set(key, []);
    return [];
  }
  _cache.set(key, arr);
  return arr;
}

/**
 * Returns the start-of-day Date (local) for a given date-like value.
 * @param {Date|string|number} d
 * @returns {Date}
 */
function _startOfDay(d) {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
}

/**
 * Returns numeric day index for range comparison (ms since epoch at local 00:00).
 * @param {Date|string|number} d
 * @returns {number}
 */
function _dayNum(d) {
  return _startOfDay(d).getTime();
}

/**
 * Inclusive day-range check using local day boundaries.
 * @param {Date|string|number} date
 * @param {Date} start
 * @param {Date} end
 * @returns {boolean}
 */
function _isInDayRange(date, start, end) {
  const dn = _dayNum(date);
  return dn >= _dayNum(start) && dn <= _dayNum(end);
}

/**
 * Determine the current user's uid for filtering user-scoped collections.
 * Strategy:
 * 1) Use cached value in NS key if present.
 * 2) Otherwise, prefer first uiState entry.userId.
 * 3) Otherwise, fall back to first users entry.uid.
 * The chosen value is cached for subsequent calls.
 * @returns {string|null}
 */
function _getCurrentUserId() {
  const existing = _get(CURRENT_USER_KEY);
  if (existing) return existing;

  const uiStates = _loadCollection('uiState');
  if (Array.isArray(uiStates) && uiStates.length > 0) {
    const chosen = uiStates[0]?.userId || null;
    if (chosen) {
      _set(CURRENT_USER_KEY, chosen);
      return chosen;
    }
  }

  const users = _loadCollection('users');
  if (Array.isArray(users) && users.length > 0) {
    const chosen = users[0]?.uid || null;
    if (chosen) {
      _set(CURRENT_USER_KEY, chosen);
      return chosen;
    }
  }

  return null;
}

/**
 * Idempotent module initialization:
 * - Ensures a meta record with schemaVersion is present.
 * - No data seeding here (seed is handled externally).
 */
function _ensureInitialized() {
  const meta = _loadJSON(META_KEY, null);
  if (!meta || typeof meta !== 'object') {
    const newMeta = {
      schemaVersion: SCHEMA_VERSION,
      initializedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    _saveJSON(META_KEY, newMeta);
    return;
  }
  // Migrations could be handled here in future versions.
  if (meta.schemaVersion !== SCHEMA_VERSION) {
    meta.schemaVersion = SCHEMA_VERSION;
    meta.updatedAt = new Date().toISOString();
    _saveJSON(META_KEY, meta);
  }
}

/**
 * Build quick lookup maps for joins.
 * @param {any[]} arr
 * @param {string} key
 * @returns {Record<string, any>}
 */
function _indexBy(arr, key) {
  /** @type {Record<string, any>} */
  const out = {};
  for (const item of arr || []) {
    if (item && typeof item === 'object' && item[key]) {
      out[item[key]] = item;
    }
  }
  return out;
}

/**
 * Normalize and sort by string property.
 * @param {any[]} arr
 * @param {string} prop
 * @returns {any[]}
 */
function _sortByString(arr, prop) {
  return [...(arr || [])].sort((a, b) => {
    const av = (a?.[prop] ?? '').toString().toLowerCase();
    const bv = (b?.[prop] ?? '').toString().toLowerCase();
    return av.localeCompare(bv);
  });
}

/**
 * Normalize and sort tasks by dueDate asc, then priority desc (if present).
 * @param {any[]} tasks
 * @returns {any[]}
 */
function _sortTasks(tasks) {
  return [...(tasks || [])].sort((a, b) => {
    const ad = new Date(a?.dueDate || 0).getTime();
    const bd = new Date(b?.dueDate || 0).getTime();
    if (ad !== bd) return ad - bd;
    const ap = typeof a?.priority === 'number' ? a.priority : -Infinity;
    const bp = typeof b?.priority === 'number' ? b.priority : -Infinity;
    return bp - ap;
  });
}

/**
 * Public API implementations
 */

/**
 * Fetch task occurrences within a date range, filtered and joined with related entities.
 *
 * Joins included:
 *  - taskType (via taskTemplates.taskTypeId)
 *  - cropInstance
 *  - area (via cropInstance.areaId)
 *  - field (via area.fieldId)
 *
 * Filters applied (if provided and non-empty):
 *  - fieldId
 *  - areaId
 *  - cropInstanceId
 *  - taskTypeId
 *  - statusId
 *
 * Returned task objects include original occurrence fields plus:
 *  - taskType?: { id, nameEn, nameTa, icon, ... }
 *  - cropInstance?: { id, name, areaId, ... }
 *  - area?: { id, name, fieldId, ... }
 *  - field?: { id, name, ... }
 *
 * Notes:
 * - Only records belonging to the current user are returned (based on userId).
 * - Date comparisons are inclusive and performed at local day granularity.
 *
 * @param {Date} startDate - inclusive start date
 * @param {Date} endDate - inclusive end date
 * @param {Object} [filters] - optional filter bag
 * @returns {Promise<object[]>} Promise resolving to an array of TaskOccurrenceWithDetails
 */
export async function getTaskOccurrencesByDateRange(startDate, endDate, filters = {}) {
  _ensureInitialized();
  const userId = _getCurrentUserId();

  const occurrences = _loadCollection('taskOccurrences');
  const cropInstances = _loadCollection('cropInstances');
  const areas = _loadCollection('areas');
  const fields = _loadCollection('fields');
  const taskTemplates = _loadCollection('taskTemplates');
  const taskTypes = _loadCollection('taskTypes');

  const byCropInstance = _indexBy(cropInstances, 'id');
  const byArea = _indexBy(areas, 'id');
  const byField = _indexBy(fields, 'id');
  const byTemplate = _indexBy(taskTemplates, 'id');
  const byTaskType = _indexBy(taskTypes, 'id');

  /** @type {any[]} */
  const result = [];

  for (const to of occurrences) {
    if (!to) continue;

    // Scope to current user if available on the record
    if (userId && to.userId && to.userId !== userId) continue;

    // Date range check (inclusive by local day)
    if (!_isInDayRange(to.dueDate, startDate, endDate)) continue;

    // Join relations
    const ci = byCropInstance[to.cropInstanceId] || null;
    // Respect user scoping from relations as well (if missing userId on occurrence)
    if (userId && !to.userId && ci?.userId && ci.userId !== userId) continue;

    const area = ci ? byArea[ci.areaId] || null : null;
    const field = area ? byField[area.fieldId] || null : null;
    const tmpl = byTemplate[to.templateId] || null;
    const tt = tmpl ? byTaskType[tmpl.taskTypeId] || null : null;

    // Apply filters if provided
    if (filters) {
      const { fieldId, areaId, cropInstanceId, taskTypeId, statusId } = filters;

      if (fieldId && fieldId !== '' && (field?.id !== fieldId)) continue;
      if (areaId && areaId !== '' && (area?.id !== areaId)) continue;
      if (cropInstanceId && cropInstanceId !== '' && (to.cropInstanceId !== cropInstanceId)) continue;
      if (taskTypeId && taskTypeId !== '' && (tt?.id !== taskTypeId)) continue;
      if (statusId && statusId !== '' && (to.statusId !== statusId)) continue;
    }

    // Compose enriched record
    result.push({
      ...to,
      taskType: tt || null,
      cropInstance: ci || null,
      area: area || null,
      field: field || null
    });
  }

  return _sortTasks(result);
}

/**
 * Get crop instances for the current user.
 * Returned objects are as stored in the local DB, typically including:
 * { id, userId, areaId, libraryCropId, custom, name, startDate, ... }
 *
 * @returns {Promise<object[]>} Promise resolving to sorted crop instances (by name)
 */
export async function getCropInstances() {
  _ensureInitialized();
  const userId = _getCurrentUserId();
  const cropInstances = _loadCollection('cropInstances') || [];
  const filtered = cropInstances.filter(ci => (userId ? ci?.userId === userId : true));
  return _sortByString(filtered, 'name');
}

/**
 * Get areas for the current user.
 * Returned objects typically include: { id, userId, fieldId, name, ... }
 *
 * @returns {Promise<object[]>} Promise resolving to sorted areas (by name)
 */
export async function getAreas() {
  _ensureInitialized();
  const userId = _getCurrentUserId();
  const areas = _loadCollection('areas') || [];
  const filtered = areas.filter(a => (userId ? a?.userId === userId : true));
  return _sortByString(filtered, 'name');
}

/**
 * Get fields for the current user.
 * Returned objects typically include: { id, userId, name, ... }
 *
 * @returns {Promise<object[]>} Promise resolving to sorted fields (by name)
 */
export async function getFields() {
  _ensureInitialized();
  const userId = _getCurrentUserId();
  const fields = _loadCollection('fields') || [];
  const filtered = fields.filter(f => (userId ? f?.userId === userId : true));
  return _sortByString(filtered, 'name');
}

/**
 * Get available task types (global list).
 * Returned objects typically include: { id, nameEn, nameTa, icon, ... }
 *
 * @returns {Promise<object[]>} Promise resolving to sorted task types (by nameEn)
 */
export async function getTaskTypes() {
  _ensureInitialized();
  const taskTypes = _loadCollection('taskTypes') || [];
  return _sortByString(taskTypes, 'nameEn');
}

/**
 * Get available status codes (global list).
 * Returned objects typically include: { id, name, description, priority }
 *
 * @returns {Promise<object[]>} Promise resolving to status codes (sorted by priority desc, then name)
 */
export async function getStatusCodes() {
  _ensureInitialized();
  const statusCodes = _loadCollection('statusCodes') || [];
  return [...statusCodes].sort((a, b) => {
    const ap = typeof a?.priority === 'number' ? a.priority : 0;
    const bp = typeof b?.priority === 'number' ? b.priority : 0;
    if (bp !== ap) return bp - ap;
    const an = (a?.name ?? '').toString().toLowerCase();
    const bn = (b?.name ?? '').toString().toLowerCase();
    return an.localeCompare(bn);
  });
}

/**
 * Fetch weather events within the provided date range for the current user.
 * Returned objects typically include: { id, userId, weatherEventType, severity, amount, date, ... }
 *
 * Notes:
 * - Date comparisons are inclusive and performed at local day granularity.
 *
 * @param {Date} startDate - inclusive
 * @param {Date} endDate - inclusive
 * @returns {Promise<object[]>} Promise resolving to weather events in range
 */
export async function getWeatherEventsByDateRange(startDate, endDate) {
  _ensureInitialized();
  const userId = _getCurrentUserId();
  const events = _loadCollection('weatherEvents') || [];
  const filtered = events.filter(ev => {
    if (userId && ev?.userId && ev.userId !== userId) return false;
    return _isInDayRange(ev?.date, startDate, endDate);
  });
  // Sort by date asc
  return [...filtered].sort((a, b) => new Date(a?.date || 0).getTime() - new Date(b?.date || 0).getTime());
}

/**
 * Get user-related settings for the current user.
 *
 * This method consolidates preferences from:
 *  - settings collection (e.g., language, weekStart)
 *  - uiState collection (e.g., calendarViewMode)
 *
 * Returned object shape (fields may be absent if data is missing):
 * {
 *   userId: string,
 *   language?: 'EN'|'TA'|string,
 *   weekStart?: 'MON'|'SUN'|string,
 *   calendarViewMode?: 'week'|'month'
 * }
 *
 * Edge cases:
 * - If no current user is resolvable or no data exists, returns a minimal object with defaults.
 *
 * @returns {Promise<object|null>} Promise resolving to settings object or null
 */
export async function getUserSettings() {
  _ensureInitialized();
  const userId = _getCurrentUserId();
  if (!userId) {
    // No user context; return minimal defaults
    return {
      userId: '',
      language: 'EN',
      weekStart: 'MON',
      calendarViewMode: 'week'
    };
  }

  const settings = _loadCollection('settings') || [];
  const uiState = _loadCollection('uiState') || [];

  const userSettings = settings.find(s => s?.userId === userId) || null;
  const userUi = uiState.find(u => u?.userId === userId) || null;

  return {
    userId,
    language: userSettings?.language ?? 'EN',
    weekStart: userSettings?.weekStart ?? 'MON',
    calendarViewMode: userUi?.calendarViewMode ?? 'week'
  };
}