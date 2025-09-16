'use strict';
const DEBUG = false;

/** Method Index
 * export async function getAreasForUser(userId: string): Promise<Array<{id: string, name: string, fieldName: string}>>
 * export async function getCropInstancesForUser(userId: string): Promise<Array<{id: string, name: string, areaName: string}>>
 * export async function createNote(payload: {userId: string, type: string, weatherEventId?: string|null, cropInstanceId?: string|null, areaId?: string|null, date: string, content: string}): Promise<{id: string}>
 * export async function createWeatherEvent(payload: {userId: string, weatherEventType: string, severity?: string|null, amount?: number|null, date: string, notes?: string|null}): Promise<{id: string}>
 * export async function getWateringTasksDueOnDate(date: string, userId: string): Promise<Array<{taskId: string, cropName: string, areaName: string}>> 
 * export async function skipTasksForRain(params: {date: string, userId: string, taskIds: string[], skipReason: string}): Promise<{skippedCount: number}>
 */

// =========================
// Private helpers (not exported)
// =========================

const _COLLECTION_PREFIX = 'localDB:'; // matches the initializer's namespace
const _META_KEY = 'PL__page_logic_meta';
const _SCHEMA_VERSION = 1;

/** Cache to avoid repeated init work */
let _initialized = false;

/**
 * Build a namespaced key for a collection.
 * @param {string} name
 * @returns {string}
 */
function _key(name) {
  return `${_COLLECTION_PREFIX}${name}`;
}

/**
 * localStorage.getItem wrapper.
 * @param {string} key
 * @returns {string|null}
 */
function _get(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    if (DEBUG) console.warn('localStorage.getItem failed for', key, err);
    return null;
  }
}

/**
 * localStorage.setItem wrapper.
 * @param {string} key
 * @param {string} value
 */
function _set(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    if (DEBUG) console.warn('localStorage.setItem failed for', key, err);
  }
}

/**
 * localStorage.removeItem wrapper.
 * @param {string} key
 */
function _remove(key) {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    if (DEBUG) console.warn('localStorage.removeItem failed for', key, err);
  }
}

/**
 * Safely parse JSON from localStorage.
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {T}
 */
function _loadJSON(key, fallback) {
  const raw = _get(key);
  if (raw == null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    // Ensure arrays/objects defaults
    if (parsed === null || typeof parsed !== 'object') return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

/**
 * Safely stringify and write JSON to localStorage.
 * @param {string} key
 * @param {any} obj
 */
function _saveJSON(key, obj) {
  try {
    const json = JSON.stringify(obj);
    _set(key, json);
  } catch (err) {
    if (DEBUG) console.warn('Failed to save JSON for', key, err);
  }
}

/**
 * Ensure required collections exist (as arrays) and meta is present.
 * Idempotent and safe to call repeatedly.
 */
function _ensureInitialized() {
  if (_initialized) return;

  const requiredCollections = [
    'areas',
    'fields',
    'cropInstances',
    'notes',
    'weatherEvents',
    'taskOccurrences',
    'taskTemplates',
    'taskTypes',
    'logs',
    'reasonCodes'
  ];

  for (const col of requiredCollections) {
    const k = _key(col);
    if (_get(k) == null) {
      _saveJSON(k, []);
    } else {
      // If present but corrupt, self-heal
      const val = _loadJSON(k, []);
      if (!Array.isArray(val)) {
        _saveJSON(k, []);
      }
    }
  }

  // Minimal meta for migration compatibility
  const meta = _loadJSON(_META_KEY, { schemaVersion: _SCHEMA_VERSION, initializedAt: null, lastUpdatedAt: null });
  if (!meta.initializedAt) {
    meta.initializedAt = _nowISO();
  }
  meta.schemaVersion = _SCHEMA_VERSION;
  meta.lastUpdatedAt = _nowISO();
  _saveJSON(_META_KEY, meta);

  _initialized = true;
}

/**
 * Generate a simple unique id with prefix.
 * @param {string} prefix
 * @returns {string}
 */
function _genId(prefix) {
  const rand = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36);
  return `${prefix}${ts}${rand}`;
}

/**
 * Return current time in ISO string.
 * @returns {string}
 */
function _nowISO() {
  return new Date().toISOString();
}

/**
 * Extract date-only (YYYY-MM-DD) from an ISO-like string.
 * If input already looks like YYYY-MM-DD, return as-is.
 * @param {string} s
 * @returns {string}
 */
function _dateOnlyFromISO(s) {
  if (!s) return '';
  if (s.length >= 10 && s[4] === '-' && s[7] === '-') return s.slice(0, 10);
  try {
    return new Date(s).toISOString().slice(0, 10);
  } catch {
    return String(s).slice(0, 10);
  }
}

/**
 * Convert a date-only string (YYYY-MM-DD) to canonical ISO at UTC midnight.
 * If already ISO with 'T', return as-is.
 * @param {string} dateStr
 * @returns {string}
 */
function _toISODate(dateStr) {
  if (!dateStr) return _nowISO();
  if (dateStr.includes('T')) return dateStr;
  // Use UTC midnight to align with seeded data
  return `${dateStr}T00:00:00Z`;
}

/**
 * Try to resolve the "watering" taskType ids from taskTypes collection.
 * Falls back to id matching 'ttype-watering' when present.
 * @param {Array<any>} taskTypes
 * @returns {Set<string>}
 */
function _wateringTaskTypeIds(taskTypes) {
  const ids = new Set();
  for (const tt of taskTypes) {
    if (!tt || typeof tt !== 'object') continue;
    const nameEn = (tt.nameEn || '').toString().toLowerCase();
    const id = (tt.id || '').toString();
    if (nameEn === 'watering' || id === 'ttype-watering' || id.endsWith('watering')) {
      if (id) ids.add(id);
    }
  }
  return ids;
}

/**
 * Map of status names (semantic) to IDs present in storage.
 * Attempts to resolve by id fallback.
 * @returns {{due: string, overdue: string, skipped: string}}
 */
function _statusIds() {
  // We infer ids based on conventional ids used in the schema
  return {
    due: 'status-due',
    overdue: 'status-overdue',
    skipped: 'status-skipped'
  };
}

/**
 * Find a reason code id for a given semantic reason string.
 * @param {string} reasonName
 * @param {Array<any>} reasonCodes
 * @returns {string}
 */
function _resolveReasonId(reasonName, reasonCodes) {
  const nameLC = (reasonName || '').toLowerCase();
  // Prefer exact 'rain' match
  const byName = reasonCodes.find(rc => (rc.name || '').toLowerCase() === nameLC);
  if (byName && byName.id) return byName.id;
  // Fallback: id contains the reason string
  const byId = reasonCodes.find(rc => (rc.id || '').toLowerCase().includes(nameLC));
  if (byId && byId.id) return byId.id;
  // Fallback to 'reason-other' if present
  const other = reasonCodes.find(rc => rc.id === 'reason-other');
  if (other && other.id) return other.id;
  // As last resort, echo the name
  return nameLC || 'other';
}

// =========================
// Exports
// =========================

/**
 * Get all areas for a user with their parent field name.
 *
 * @param {string} userId - The owner's user id (users.uid).
 * @returns {Promise<Array<{id: string, name: string, fieldName: string}>>}
 *
 * Usage notes:
 * - Returns an empty array if no areas are found or storage is missing.
 * - fieldName is resolved from fields collection via areas.fieldId. If not found, 'Unknown Field'.
 */
export async function getAreasForUser(userId) {
  _ensureInitialized();
  const areas = _loadJSON(_key('areas'), []);
  const fields = _loadJSON(_key('fields'), []);
  const fieldById = new Map(fields.map(f => [f.id, f]));
  const result = [];
  for (const a of areas) {
    if (!a || a.userId !== userId) continue;
    const field = fieldById.get(a.fieldId);
    const fieldName = field?.name || 'Unknown Field';
    result.push({ id: a.id, name: a.name, fieldName });
  }
  return result;
}

/**
 * Get all crop instances for a user with their area names.
 *
 * @param {string} userId - The owner's user id (users.uid).
 * @returns {Promise<Array<{id: string, name: string, areaName: string}>>}
 *
 * Usage notes:
 * - Returns an empty array if none found.
 * - areaName is resolved from areas collection via cropInstances.areaId. If not found, 'Unknown Area'.
 */
export async function getCropInstancesForUser(userId) {
  _ensureInitialized();
  const crops = _loadJSON(_key('cropInstances'), []);
  const areas = _loadJSON(_key('areas'), []);
  const areaById = new Map(areas.map(a => [a.id, a]));
  const result = [];
  for (const c of crops) {
    if (!c || c.userId !== userId) continue;
    const area = areaById.get(c.areaId);
    const areaName = area?.name || 'Unknown Area';
    result.push({ id: c.id, name: c.name, areaName });
  }
  return result;
}

/**
 * Create a note entry.
 *
 * @param {{userId: string, type: string, weatherEventId?: string|null, cropInstanceId?: string|null, areaId?: string|null, date: string, content: string}} payload
 *  - userId: owner uid (required)
 *  - type: 'general' | 'weather' | other supported types (required)
 *  - weatherEventId: optional reference to weatherEvents.id
 *  - cropInstanceId: optional reference to cropInstances.id
 *  - areaId: optional reference to areas.id
 *  - date: YYYY-MM-DD or ISO string (required)
 *  - content: free text (required)
 * @returns {Promise<{id: string}>} - Created note id.
 *
 * Edge cases:
 * - If required fields are missing, this function throws an Error.
 * - Dates in YYYY-MM-DD are stored as ISO at UTC midnight.
 */
export async function createNote(payload) {
  _ensureInitialized();
  const { userId, type, weatherEventId = null, cropInstanceId = null, areaId = null, date, content } = payload || {};
  if (!userId || !type || !date || typeof content !== 'string') {
    throw new Error('createNote: missing required fields');
  }

  const notes = _loadJSON(_key('notes'), []);
  const now = _nowISO();
  const id = _genId('n-');
  const record = {
    id,
    userId,
    type,
    weatherEventId: weatherEventId || null,
    cropInstanceId: cropInstanceId || null,
    areaId: areaId || null,
    date: _toISODate(date),
    content,
    createdAt: now,
    updatedAt: now
  };
  // Atomic write: push then save full array
  notes.push(record);
  _saveJSON(_key('notes'), notes);
  return { id };
}

/**
 * Create a weather event entry.
 *
 * @param {{userId: string, weatherEventType: string, severity?: string|null, amount?: number|null, date: string, notes?: string|null}} payload
 *  - userId: owner uid (required)
 *  - weatherEventType: e.g., 'rain', 'heavyRain', 'drought' (required)
 *  - severity: optional descriptor (e.g., 'light', 'heavy')
 *  - amount: optional numeric amount (e.g., mm)
 *  - date: YYYY-MM-DD or ISO string (required)
 *  - notes: optional text notes
 * @returns {Promise<{id: string}>} - Created weather event id.
 *
 * Edge cases:
 * - Throws if required fields missing.
 * - Dates in YYYY-MM-DD are stored as ISO at UTC midnight.
 */
export async function createWeatherEvent(payload) {
  _ensureInitialized();
  const { userId, weatherEventType, severity = null, amount = null, date, notes = null } = payload || {};
  if (!userId || !weatherEventType || !date) {
    throw new Error('createWeatherEvent: missing required fields');
  }

  const events = _loadJSON(_key('weatherEvents'), []);
  const now = _nowISO();
  const id = _genId('we-');
  const record = {
    id,
    userId,
    weatherEventType,
    severity: severity || null,
    amount: typeof amount === 'number' ? amount : (amount == null ? null : Number(amount)),
    date: _toISODate(date),
    notes: notes || null,
    createdAt: now
  };
  events.push(record);
  _saveJSON(_key('weatherEvents'), events);
  return { id };
}

/**
 * Get watering task occurrences due on a specific date for a user.
 *
 * @param {string} date - Target day in 'YYYY-MM-DD'.
 * @param {string} userId - Owner uid.
 * @returns {Promise<Array<{taskId: string, cropName: string, areaName: string}>>}
 *
 * Logic:
 * - Join taskOccurrences -> taskTemplates -> taskTypes to filter taskType 'Watering'.
 * - Filter occurrences by:
 *   - userId matches
 *   - dueDate matches the provided date (date-only compare)
 *   - status in ['due', 'overdue'] via IDs ('status-due', 'status-overdue')
 * - Join to cropInstances and areas to produce display names.
 */
export async function getWateringTasksDueOnDate(date, userId) {
  _ensureInitialized();
  const dateOnly = _dateOnlyFromISO(date);
  const occ = _loadJSON(_key('taskOccurrences'), []);
  const templates = _loadJSON(_key('taskTemplates'), []);
  const types = _loadJSON(_key('taskTypes'), []);
  const crops = _loadJSON(_key('cropInstances'), []);
  const areas = _loadJSON(_key('areas'), []);

  const wateringTypeIds = _wateringTaskTypeIds(types);
  const templatesById = new Map(templates.map(t => [t.id, t]));
  const cropsById = new Map(crops.map(c => [c.id, c]));
  const areasById = new Map(areas.map(a => [a.id, a]));
  const statuses = _statusIds();

  const results = [];
  for (const o of occ) {
    if (!o || o.userId !== userId) continue;
    const dueDateOnly = _dateOnlyFromISO(o.dueDate);
    if (dueDateOnly !== dateOnly) continue;

    const tpl = templatesById.get(o.templateId);
    if (!tpl || !wateringTypeIds.has(tpl.taskTypeId)) continue;

    const statusId = o.statusId;
    if (statusId !== statuses.due && statusId !== statuses.overdue) continue;

    const crop = cropsById.get(o.cropInstanceId);
    const area = crop ? areasById.get(crop.areaId) : undefined;

    results.push({
      taskId: o.id,
      cropName: crop?.name || 'Unknown Crop',
      areaName: area?.name || 'Unknown Area'
    });
  }

  return results;
}

/**
 * Mark provided task occurrences as skipped due to rain and create log entries.
 *
 * @param {{date: string, userId: string, taskIds: string[], skipReason: string}} params
 *  - date: Target date (YYYY-MM-DD) used as an extra safeguard for matching.
 *  - userId: Owner uid to restrict updates.
 *  - taskIds: Array of taskOccurrences.id to be skipped.
 *  - skipReason: semantic reason string, e.g., 'rain'.
 * @returns {Promise<{skippedCount: number}>}
 *
 * Behavior:
 * - For each matching occurrence (id in taskIds, userId match, dueDate matches date), set statusId='status-skipped'.
 * - Create a corresponding logs entry with action='skipped' and skipReasonId resolved from reasonCodes.
 * - Atomic saves: entire collections written after batched updates.
 *
 * Notes:
 * - Non-existent ids or mismatched user/date are ignored.
 */
export async function skipTasksForRain(params) {
  _ensureInitialized();
  const { date, userId, taskIds, skipReason } = params || {};
  if (!userId || !Array.isArray(taskIds)) {
    throw new Error('skipTasksForRain: missing userId or taskIds');
  }
  const dateOnly = _dateOnlyFromISO(date || '');

  const occ = _loadJSON(_key('taskOccurrences'), []);
  const logs = _loadJSON(_key('logs'), []);
  const reasonCodes = _loadJSON(_key('reasonCodes'), []);
  const crops = _loadJSON(_key('cropInstances'), []);

  const statuses = _statusIds();
  const reasonId = _resolveReasonId(skipReason || 'rain', reasonCodes);
  const now = _nowISO();
  const cropById = new Map(crops.map(c => [c.id, c]));

  let skippedCount = 0;

  const idsSet = new Set(taskIds);
  for (const o of occ) {
    if (!o) continue;
    if (!idsSet.has(o.id)) continue;
    if (o.userId !== userId) continue;
    if (dateOnly && _dateOnlyFromISO(o.dueDate) !== dateOnly) continue;

    // Update status
    if (o.statusId !== statuses.skipped) {
      o.statusId = statuses.skipped;
      o.updatedAt = now;
      skippedCount += 1;

      // Create log entry
      const cropId = o.cropInstanceId || null;
      const logEntry = {
        id: _genId('log-'),
        userId,
        taskOccurrenceId: o.id,
        cropInstanceId: cropId,
        action: 'skipped',
        timestamp: now,
        quantity: null,
        unitId: null,
        notes: `Skipped due to ${skipReason || 'rain'} on ${dateOnly || _dateOnlyFromISO(o.dueDate)}`,
        photoIds: [],
        skipReasonId: reasonId,
        createdAt: now,
        updatedAt: now
      };
      // Ensure crop exists reference wise; still record even if missing
      if (cropId && !cropById.has(cropId)) {
        // no-op, safe
      }
      logs.push(logEntry);
    }
  }

  // Persist changes atomically
  _saveJSON(_key('taskOccurrences'), occ);
  _saveJSON(_key('logs'), logs);

  return { skippedCount };
}