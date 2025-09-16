'use strict';
const DEBUG = false;

/** Method Index
 * export async function getFieldById(fieldId: string): Promise<object|null>
 * export async function getAreasByFieldId(fieldId: string): Promise<object[]>
 * export async function getAreaTypes(): Promise<object[]>
 * export async function getCropInstancesByAreaId(areaId: string): Promise<object[]>
 * export async function getOverdueTaskCountByAreaId(areaId: string): Promise<number>
 * export async function createArea(areaData: { fieldId: string, name: string, typeId?: string|null, size?: number|null, sizeUnit?: string, notes?: string|null }): Promise<object>
 * export async function deleteField(fieldId: string): Promise<boolean>
 */

// ---------------------------------------------------------------------------
// Private storage helpers (localStorage-backed)
// ---------------------------------------------------------------------------

const KEY_PREFIX = 'localDB:'; // Align with existing system initializer
const META_KEY = `${KEY_PREFIX}__pl_meta`;
const COLLECTIONS = Object.freeze({
  fields: 'fields',
  areas: 'areas',
  areaTypes: 'areaTypes',
  cropInstances: 'cropInstances',
  taskOccurrences: 'taskOccurrences',
  logs: 'logs',
  notes: 'notes',
});
const OVERDUE_STATUS_ID = 'status-overdue';
const SCHEMA_VERSION = 1;

/**
 * Get raw string value from localStorage.
 * @param {string} key
 * @returns {string|null}
 */
function _get(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    if (DEBUG) console.warn('localStorage.getItem failed', key, e);
    return null;
  }
}

/**
 * Set raw string value in localStorage.
 * @param {string} key
 * @param {string} value
 */
function _set(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (DEBUG) console.warn('localStorage.setItem failed', key, e);
  }
}

/**
 * Remove a key from localStorage.
 * @param {string} key
 */
function _remove(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    if (DEBUG) console.warn('localStorage.removeItem failed', key, e);
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
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

/**
 * Save an object/array atomically as JSON to localStorage.
 * @param {string} key
 * @param {any} obj
 */
function _saveJSON(key, obj) {
  try {
    _set(key, JSON.stringify(obj));
  } catch (e) {
    if (DEBUG) console.warn('Failed to save JSON', key, e);
  }
}

/**
 * Load a collection as an array.
 * @param {keyof typeof COLLECTIONS} name
 * @returns {any[]}
 */
function _loadCollection(name) {
  const key = `${KEY_PREFIX}${name}`;
  const arr = _loadJSON(key, []);
  return Array.isArray(arr) ? arr : [];
}

/**
 * Save a collection array atomically.
 * @param {keyof typeof COLLECTIONS} name
 * @param {any[]} items
 */
function _saveCollection(name, items) {
  const key = `${KEY_PREFIX}${name}`;
  _saveJSON(key, Array.isArray(items) ? items : []);
}

/**
 * Generate a reasonably unique id with a prefix.
 * @param {string} prefix
 * @returns {string}
 */
function _generateId(prefix) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}${Date.now().toString(36)}-${rand}`;
}

/**
 * ISO timestamp for now.
 * @returns {string}
 */
function _nowIso() {
  return new Date().toISOString();
}

/**
 * Ensure collections exist and meta is initialized.
 * Idempotent and safe to call many times.
 */
function _ensureInitialized() {
  // Initialize meta
  const meta = _loadJSON(META_KEY, null);
  if (!meta || typeof meta !== 'object' || meta.schemaVersion !== SCHEMA_VERSION) {
    const newMeta = {
      schemaVersion: SCHEMA_VERSION,
      initializedAt: _nowIso(),
      // Note: we do NOT seed data here; the app initializer handles that.
    };
    _saveJSON(META_KEY, newMeta);
  }

  // Ensure required collections exist; if missing or corrupt, default to []
  for (const name of Object.values(COLLECTIONS)) {
    const key = `${KEY_PREFIX}${name}`;
    const val = _get(key);
    if (val == null) {
      _saveJSON(key, []);
    } else {
      // Validate JSON array; if invalid, self-heal to []
      const parsed = _loadJSON(key, []);
      if (!Array.isArray(parsed)) {
        _saveJSON(key, []);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Exported API
// ---------------------------------------------------------------------------

/**
 * Fetch a single field by id.
 *
 * @param {string} fieldId - Field id to look up.
 * @returns {Promise<object|null>} Resolves with the field object if found, otherwise null.
 *
 * Usage notes:
 * - Field object shape (from schema): { id, userId, name, size?, sizeUnit?, notes?, createdAt, updatedAt }
 * - Safe to await; returns a resolved Promise immediately.
 */
export async function getFieldById(fieldId) {
  _ensureInitialized();
  const fields = _loadCollection(COLLECTIONS.fields);
  const idStr = String(fieldId);
  const field = fields.find(f => String(f.id) === idStr) || null;
  return field;
}

/**
 * Fetch areas that belong to a given field id.
 *
 * @param {string} fieldId - Parent field id.
 * @returns {Promise<object[]>} Resolves with an array (possibly empty) of area objects.
 *
 * Usage notes:
 * - Area object shape: { id, fieldId, userId, name, typeId?, size?, sizeUnit?, notes?, createdAt, updatedAt }
 * - The result is not sorted; consumer may order as desired.
 */
export async function getAreasByFieldId(fieldId) {
  _ensureInitialized();
  const areas = _loadCollection(COLLECTIONS.areas);
  const idStr = String(fieldId);
  return areas.filter(a => String(a.fieldId) === idStr);
}

/**
 * Return available area types for selection.
 *
 * @returns {Promise<object[]>} Resolves with array of areaType objects.
 *
 * Usage notes:
 * - Area type shape: { id, name, description? }
 * - If none exist, returns [].
 */
export async function getAreaTypes() {
  _ensureInitialized();
  const areaTypes = _loadCollection(COLLECTIONS.areaTypes);
  return areaTypes;
}

/**
 * Fetch crop instances assigned to a particular area.
 *
 * @param {string} areaId - The area id.
 * @returns {Promise<object[]>} Resolves with an array (possibly empty) of cropInstance objects.
 *
 * Usage notes:
 * - Crop instance shape: { id, userId, areaId, ... }
 */
export async function getCropInstancesByAreaId(areaId) {
  _ensureInitialized();
  const cropInstances = _loadCollection(COLLECTIONS.cropInstances);
  const idStr = String(areaId);
  return cropInstances.filter(ci => String(ci.areaId) === idStr);
}

/**
 * Compute number of overdue tasks for all crops in the given area.
 *
 * @param {string} areaId - The area id whose overdue tasks will be counted.
 * @returns {Promise<number>} Resolves with the count of taskOccurrences that are overdue.
 *
 * Logic:
 * - Find cropInstances where areaId matches.
 * - Count taskOccurrences with cropInstanceId in that set AND statusId === 'status-overdue'.
 * - Ignores other statuses (planned, due, completed, skipped, snoozed).
 */
export async function getOverdueTaskCountByAreaId(areaId) {
  _ensureInitialized();
  const cropInstances = _loadCollection(COLLECTIONS.cropInstances);
  const taskOccurrences = _loadCollection(COLLECTIONS.taskOccurrences);

  const idStr = String(areaId);
  const relatedCropIds = new Set(
    cropInstances.filter(ci => String(ci.areaId) === idStr).map(ci => String(ci.id))
  );
  if (relatedCropIds.size === 0) return 0;

  let count = 0;
  for (const to of taskOccurrences) {
    if (to && String(to.statusId) === OVERDUE_STATUS_ID && relatedCropIds.has(String(to.cropInstanceId))) {
      count++;
    }
  }
  return count;
}

/**
 * Create a new area under a field.
 *
 * @param {Object} areaData
 * @param {string} areaData.fieldId - Required parent field id.
 * @param {string} areaData.name - Required area name (non-empty after trim).
 * @param {string|null|undefined} [areaData.typeId] - Optional area type id.
 * @param {number|null|undefined} [areaData.size] - Optional numeric size.
 * @param {string|undefined} [areaData.sizeUnit='m2'] - Unit for size.
 * @param {string|null|undefined} [areaData.notes] - Optional notes.
 * @returns {Promise<object>} Resolves with the created area object as persisted.
 *
 * Edge cases:
 * - Throws if fieldId or name is missing/invalid.
 * - Sets userId from the parent field if available; otherwise null.
 * - Adds createdAt/updatedAt ISO timestamps.
 */
export async function createArea(areaData) {
  _ensureInitialized();

  const { fieldId, name } = areaData || {};
  const cleanName = (name || '').trim();
  if (!fieldId || !cleanName) {
    throw new Error('createArea requires fieldId and non-empty name');
  }

  const fields = _loadCollection(COLLECTIONS.fields);
  const parentField = fields.find(f => String(f.id) === String(fieldId)) || null;
  if (!parentField) {
    throw new Error('Parent field not found');
  }

  const areas = _loadCollection(COLLECTIONS.areas);

  const now = _nowIso();
  const newArea = {
    id: _generateId('a-'),
    fieldId: String(fieldId),
    userId: parentField.userId || null,
    name: cleanName,
    typeId: areaData.typeId || null,
    size: areaData.size != null ? Number(areaData.size) : null,
    sizeUnit: areaData.sizeUnit || 'm2',
    notes: areaData.notes != null ? String(areaData.notes) : null,
    createdAt: now,
    updatedAt: now,
  };

  areas.push(newArea);
  _saveCollection(COLLECTIONS.areas, areas);

  return newArea;
}

/**
 * Delete a field and cascade-delete related entities.
 *
 * Cascades:
 * - areas where area.fieldId === fieldId
 * - cropInstances where areaId in deleted areas
 * - taskOccurrences where cropInstanceId in deleted cropInstances
 * - logs where cropInstanceId in deleted cropInstances OR taskOccurrenceId in deleted taskOccurrences
 * - notes where areaId in deleted areas OR cropInstanceId in deleted cropInstances
 *
 * @param {string} fieldId - Field id to delete.
 * @returns {Promise<boolean>} Resolves true if a field was deleted, false if no matching field existed.
 *
 * Notes:
 * - Operation is atomic per-collection write; collections are updated independently but synchronously.
 * - No other collections (e.g., photos, syncQueue) are modified here.
 */
export async function deleteField(fieldId) {
  _ensureInitialized();

  const idStr = String(fieldId);

  // Load all impacted collections
  const fields = _loadCollection(COLLECTIONS.fields);
  const areas = _loadCollection(COLLECTIONS.areas);
  const cropInstances = _loadCollection(COLLECTIONS.cropInstances);
  const taskOccurrences = _loadCollection(COLLECTIONS.taskOccurrences);
  const logs = _loadCollection(COLLECTIONS.logs);
  const notes = _loadCollection(COLLECTIONS.notes);

  // Remove field
  const beforeFieldsLen = fields.length;
  const keptFields = fields.filter(f => String(f.id) !== idStr);
  const fieldWasDeleted = keptFields.length !== beforeFieldsLen;
  if (!fieldWasDeleted) {
    return false;
  }

  // Determine related areaIds
  const removedAreas = areas.filter(a => String(a.fieldId) === idStr);
  const removedAreaIds = new Set(removedAreas.map(a => String(a.id)));

  // Determine related cropInstanceIds
  const removedCropInstances = cropInstances.filter(ci => removedAreaIds.has(String(ci.areaId)));
  const removedCropInstanceIds = new Set(removedCropInstances.map(ci => String(ci.id)));

  // Determine related taskOccurrenceIds
  const removedTaskOccurrences = taskOccurrences.filter(to => removedCropInstanceIds.has(String(to.cropInstanceId)));
  const removedTaskOccurrenceIds = new Set(removedTaskOccurrences.map(to => String(to.id)));

  // Filter and save each collection atomically
  _saveCollection(COLLECTIONS.fields, keptFields);
  _saveCollection(
    COLLECTIONS.areas,
    areas.filter(a => !removedAreaIds.has(String(a.id)))
  );
  _saveCollection(
    COLLECTIONS.cropInstances,
    cropInstances.filter(ci => !removedCropInstanceIds.has(String(ci.id)))
  );
  _saveCollection(
    COLLECTIONS.taskOccurrences,
    taskOccurrences.filter(to => !removedTaskOccurrenceIds.has(String(to.id)))
  );
  _saveCollection(
    COLLECTIONS.logs,
    logs.filter(l =>
      !removedCropInstanceIds.has(String(l.cropInstanceId)) &&
      !removedTaskOccurrenceIds.has(String(l.taskOccurrenceId))
    )
  );
  _saveCollection(
    COLLECTIONS.notes,
    notes.filter(n =>
      !removedAreaIds.has(String(n.areaId)) &&
      !removedCropInstanceIds.has(String(n.cropInstanceId))
    )
  );

  return true;
}