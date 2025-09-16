'use strict';
const DEBUG = false;

//  Method Index
//   export async function getCurrentUserId(): Promise<string|null>
//   export async function getFieldsWithStats(userId: string): Promise<Array<object>>
//  export async function getAreaTypes(): Promise<Array<{id:string,name:string,description?:string}>>
//   export async function createField(fieldData: object): Promise<object>
//   export async function updateField(fieldId: string, fieldData: object): Promise<void>
//  export async function deleteField(fieldId: string): Promise<void>
//   export async function createArea(areaData: object): Promise<object>
//   export async function updateArea(areaId: string, areaData: object): Promise<void>
//   export async function deleteArea(areaId: string): Promise<void>
 

/* ============================
   Private helpers and storage
   ============================ */

const NS = 'PL__';               // internal namespace for page-logic metadata
const DB_PREFIX = 'localDB:';    // existing app data namespace for collections (from initializer)
const SCHEMA_VERSION = 1;

/** Safe localStorage get by key (raw string). */
function _get(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    if (DEBUG) console.warn('localStorage.getItem error:', key, err);
    return null;
  }
}

/** Safe localStorage set by key (raw string). */
function _set(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    if (DEBUG) console.warn('localStorage.setItem error:', key, err);
  }
}

/** Safe localStorage remove by key. */
function _remove(key) {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    if (DEBUG) console.warn('localStorage.removeItem error:', key, err);
  }
}

/** Safely parse JSON from key; returns fallback on error or missing. */
function _loadJSON(key, fallback) {
  const raw = _get(key);
  if (raw == null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch (err) {
    if (DEBUG) console.warn('JSON.parse error for key:', key, err);
    return fallback;
  }
}

/** Safely save object as JSON at key. Atomic write. */
function _saveJSON(key, obj) {
  try {
    const json = JSON.stringify(obj);
    _set(key, json);
  } catch (err) {
    if (DEBUG) console.warn('JSON.stringify error for key:', key, err);
  }
}

/** Compose localDB key for a collection. */
function _collKey(name) {
  return `${DB_PREFIX}${name}`;
}

/** Load a collection (array) or return empty array if missing/invalid. */
function _readColl(name) {
  return _loadJSON(_collKey(name), []);
}

/** Save an entire collection array atomically. */
function _writeColl(name, items) {
  _saveJSON(_collKey(name), Array.isArray(items) ? items : []);
}

/** ISO timestamp now. */
function _nowIso() {
  return new Date().toISOString();
}

/** Generate a simple unique id with prefix. */
function _id(prefix) {
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

/** Ensure base collections exist and schema tracked. Idempotent, safe. */
function _ensureInitialized() {
  const storedVersionRaw = _get(`${NS}schemaVersion`);
  if (!storedVersionRaw) {
    // First-time initialization for this module; ensure collections exist or create empties.
    const needed = [
      'users',
      'fields',
      'areas',
      'areaTypes',
      'cropInstances',
      'taskOccurrences',
      'logs'
    ];
    for (const coll of needed) {
      const k = _collKey(coll);
      if (_get(k) == null) {
        // Create empty array to tolerate missing data; no dummy seeding beyond empties.
        _saveJSON(k, []);
      }
    }
    _set(`${NS}schemaVersion`, String(SCHEMA_VERSION));
  } else {
    const ver = Number(storedVersionRaw);
    if (Number.isFinite(ver) && ver < SCHEMA_VERSION) {
      // Place for future migrations. Keep no-ops for now.
      _set(`${NS}schemaVersion`, String(SCHEMA_VERSION));
    }
  }
}

/* ============================
   Exported API
   ============================ */

/**
 * Get the current user's UID string.
 *
 * Strategy:
 * - Try previously selected user from internal key (NS + 'currentUserUid').
 * - Else fallback to the first available user from localDB:users (prefer role 'farmer' if present).
 * - Persist chosen UID for subsequent calls.
 *
 * Returns:
 * - Promise<string|null> current user UID; null if no users exist.
 *
 * Usage Notes:
 * - This function is async for uniformity and future compatibility, although it currently performs sync storage operations.
 */
export async function getCurrentUserId() {
  _ensureInitialized();
  const saved = _get(`${NS}currentUserUid`);
  if (saved) return saved;

  const users = _readColl('users');
  if (!Array.isArray(users) || users.length === 0) return null;

  let chosen = users.find(u => u && typeof u === 'object' && u.role === 'farmer') || users[0];
  const uid = chosen?.uid || chosen?.id || null;
  if (uid) {
    _set(`${NS}currentUserUid`, String(uid));
  }
  return uid || null;
}

/**
 * Load all area types.
 *
 * Data source: localDB:areaTypes
 *
 * Returns:
 * - Promise<Array<{ id:string, name:string, description?:string }>>
 *
 * Edge cases:
 * - Returns empty array if collection missing or malformed.
 */
export async function getAreaTypes() {
  _ensureInitialized();
  const types = _readColl('areaTypes');
  // Ensure sanitized shape
  return (types || []).filter(t => t && t.id && t.name).map(t => ({
    id: String(t.id),
    name: String(t.name),
    description: t.description != null ? String(t.description) : undefined
  }));
}

/**
 * Build fields with nested areas and computed statistics.
 *
 * Input:
 * - userId: string (required) owner UID
 *
 * Output array items (FieldWithStats):
 * - {
 *     id: string,
 *     name: string,
 *     size: number|null,
 *     sizeUnit: string|undefined,
 *     notes: string|undefined,
 *     areas: Array<{
 *       id: string,
 *       name: string,
 *       typeId: string|null,
 *       size: number|null,
 *       sizeUnit: string|undefined,
 *       notes: string|undefined,
 *       cropInstancesCount: number,
 *       overdueTasksCount: number
 *     }>,
 *     totalAreas: number,
 *     totalCropInstances: number,
 *     totalOverdueTasks: number
 *   }
 *
 * Counting rules:
 * - cropInstancesCount: number of cropInstances with areaId == area.id and userId == input.
 * - overdueTasksCount: number of taskOccurrences with cropInstanceId in that area's crop instances,
 *   userId == input, and statusId == 'status-overdue'.
 *
 * Notes:
 * - Only entities owned by provided userId are considered.
 */
export async function getFieldsWithStats(userId) {
  _ensureInitialized();
  if (!userId) return [];

  const [fields, areas, cropInstances, taskOccurrences] = [
    _readColl('fields'),
    _readColl('areas'),
    _readColl('cropInstances'),
    _readColl('taskOccurrences')
  ];

  const fieldsForUser = (fields || []).filter(f => f && f.userId === userId);

  const result = fieldsForUser.map(f => {
    const fieldAreas = (areas || []).filter(a => a && a.fieldId === f.id && a.userId === userId);

    const areaItems = fieldAreas.map(a => {
      const areaCrops = (cropInstances || []).filter(ci => ci && ci.userId === userId && ci.areaId === a.id);
      const cropIds = new Set(areaCrops.map(ci => ci.id));
      const overdueCount = (taskOccurrences || []).filter(to =>
        to && to.userId === userId &&
        cropIds.has(to.cropInstanceId) &&
        to.statusId === 'status-overdue'
      ).length;

      return {
        id: String(a.id),
        name: String(a.name),
        typeId: a.typeId ?? null,
        size: (typeof a.size === 'number' ? a.size : (a.size != null ? Number(a.size) : null)) ?? null,
        sizeUnit: a.sizeUnit || undefined,
        notes: a.notes || undefined,
        cropInstancesCount: areaCrops.length,
        overdueTasksCount: overdueCount
      };
    });

    const totals = areaItems.reduce(
      (acc, a) => {
        acc.crops += a.cropInstancesCount;
        acc.od += a.overdueTasksCount;
        return acc;
      },
      { crops: 0, od: 0 }
    );

    return {
      id: String(f.id),
      name: String(f.name),
      size: (typeof f.size === 'number' ? f.size : (f.size != null ? Number(f.size) : null)) ?? null,
      sizeUnit: f.sizeUnit || undefined,
      notes: f.notes || undefined,
      areas: areaItems,
      totalAreas: areaItems.length,
      totalCropInstances: totals.crops,
      totalOverdueTasks: totals.od
    };
  });

  return result;
}

/**
 * Create a new Field.
 *
 * Input fieldData (required keys):
 * - { userId: string, name: string, size?: number|null, sizeUnit?: string, notes?: string }
 *
 * Behavior:
 * - Validates presence of userId and non-empty name.
 * - Generates id, createdAt, updatedAt.
 * - Persists into localDB:fields atomically.
 *
 * Returns:
 * - Promise<object> the created field object.
 *
 * Throws:
 * - Error if validation fails or field not creatable.
 */
export async function createField(fieldData) {
  _ensureInitialized();
  const data = fieldData || {};
  const userId = data.userId;
  const name = (data.name || '').trim();
  if (!userId) throw new Error('createField: userId is required');
  if (!name) throw new Error('createField: name is required');

  const now = _nowIso();
  const field = {
    id: _id('f'),
    userId,
    name,
    size: data.size != null ? Number(data.size) : null,
    sizeUnit: data.sizeUnit || 'm2',
    notes: data.notes || '',
    createdAt: now,
    updatedAt: now
  };

  const fields = _readColl('fields');
  fields.push(field);
  _writeColl('fields', fields);

  return field;
}

/**
 * Update an existing Field by id.
 *
 * Inputs:
 * - fieldId: string
 * - fieldData: Partial<{ name:string, size:number|null, sizeUnit:string, notes:string }>
 *
 * Behavior:
 * - Finds field, merges whitelisted props, preserves userId and createdAt.
 * - Updates updatedAt timestamp.
 * - Atomic collection write.
 *
 * Returns:
 * - Promise<void>
 *
 * Throws:
 * - Error if field not found.
 */
export async function updateField(fieldId, fieldData) {
  _ensureInitialized();
  const fields = _readColl('fields');
  const idx = fields.findIndex(f => f && f.id === fieldId);
  if (idx === -1) throw new Error('updateField: field not found');

  const prev = fields[idx];
  const patch = fieldData || {};
  const next = {
    ...prev,
    name: patch.name != null ? String(patch.name).trim() : prev.name,
    size: patch.size != null ? (patch.size === '' ? null : Number(patch.size)) : prev.size,
    sizeUnit: patch.sizeUnit != null ? String(patch.sizeUnit) : prev.sizeUnit,
    notes: patch.notes != null ? String(patch.notes) : prev.notes,
    updatedAt: _nowIso()
  };

  fields[idx] = next;
  _writeColl('fields', fields);
}

/**
 * Delete a Field and cascade delete related entities.
 *
 * Cascade:
 * - areas where fieldId == fieldId
 * - cropInstances where areaId in deleted areas
 * - taskOccurrences where cropInstanceId in deleted cropInstances
 * - logs where cropInstanceId in deleted cropInstances OR taskOccurrenceId in deleted taskOccurrences
 *
 * Returns:
 * - Promise<void>
 *
 * Throws:
 * - No throw if field absent (no-op).
 */
export async function deleteField(fieldId) {
  _ensureInitialized();

  // Load all impacted collections
  const fields = _readColl('fields');
  const areas = _readColl('areas');
  const cropInstances = _readColl('cropInstances');
  const taskOccurrences = _readColl('taskOccurrences');
  const logs = _readColl('logs');

  // Identify areas under this field
  const deletedAreas = areas.filter(a => a && a.fieldId === fieldId);
  const deletedAreaIds = new Set(deletedAreas.map(a => a.id));

  // Identify crops in those areas
  const deletedCrops = cropInstances.filter(ci => ci && deletedAreaIds.has(ci.areaId));
  const deletedCropIds = new Set(deletedCrops.map(ci => ci.id));

  // Identify occurrences for those crops
  const deletedTOs = taskOccurrences.filter(to => to && deletedCropIds.has(to.cropInstanceId));
  const deletedTOIds = new Set(deletedTOs.map(to => to.id));

  // Filter collections
  const nextFields = fields.filter(f => !(f && f.id === fieldId));
  const nextAreas = areas.filter(a => !(a && deletedAreaIds.has(a.id)));
  const nextCrops = cropInstances.filter(ci => !(ci && deletedCropIds.has(ci.id)));
  const nextTOs = taskOccurrences.filter(to => !(to && deletedTOIds.has(to.id)));
  const nextLogs = logs.filter(l =>
    !(
      l &&
      ((l.cropInstanceId && deletedCropIds.has(l.cropInstanceId)) ||
       (l.taskOccurrenceId && deletedTOIds.has(l.taskOccurrenceId)))
    )
  );

  // Atomic writes per collection
  _writeColl('fields', nextFields);
  _writeColl('areas', nextAreas);
  _writeColl('cropInstances', nextCrops);
  _writeColl('taskOccurrences', nextTOs);
  _writeColl('logs', nextLogs);
}

/**
 * Create a new Area.
 *
 * Input areaData (required keys):
 * - { userId: string, fieldId: string, name: string, typeId?: string|null, size?: number|null, sizeUnit?: string, notes?: string }
 *
 * Behavior:
 * - Validates presence of userId, fieldId, name.
 * - Generates id, createdAt, updatedAt.
 * - Persists into localDB:areas atomically.
 *
 * Returns:
 * - Promise<object> the created area object.
 *
 * Throws:
 * - Error if validation fails.
 */
export async function createArea(areaData) {
  _ensureInitialized();
  const data = areaData || {};
  const userId = data.userId;
  const fieldId = data.fieldId;
  const name = (data.name || '').trim();
  if (!userId) throw new Error('createArea: userId is required');
  if (!fieldId) throw new Error('createArea: fieldId is required');
  if (!name) throw new Error('createArea: name is required');

  const now = _nowIso();
  const area = {
    id: _id('a'),
    userId,
    fieldId,
    name,
    typeId: data.typeId ?? null,
    size: data.size != null ? Number(data.size) : null,
    sizeUnit: data.sizeUnit || 'm2',
    notes: data.notes || '',
    createdAt: now,
    updatedAt: now
  };

  const areas = _readColl('areas');
  areas.push(area);
  _writeColl('areas', areas);

  return area;
}

/**
 * Update an existing Area by id.
 *
 * Inputs:
 * - areaId: string
 * - areaData: Partial<{ fieldId:string, name:string, typeId:string|null, size:number|null, sizeUnit:string, notes:string }>
 *
 * Behavior:
 * - Finds area, merges allowed props. Preserves userId and createdAt.
 * - If fieldId supplied, updates association.
 * - Updates updatedAt.
 *
 * Returns:
 * - Promise<void>
 *
 * Throws:
 * - Error if area not found.
 */
export async function updateArea(areaId, areaData) {
  _ensureInitialized();
  const areas = _readColl('areas');
  const idx = areas.findIndex(a => a && a.id === areaId);
  if (idx === -1) throw new Error('updateArea: area not found');

  const prev = areas[idx];
  const patch = areaData || {};
  const next = {
    ...prev,
    fieldId: patch.fieldId != null ? String(patch.fieldId) : prev.fieldId,
    name: patch.name != null ? String(patch.name).trim() : prev.name,
    typeId: patch.typeId !== undefined ? (patch.typeId === '' ? null : patch.typeId) : prev.typeId,
    size: patch.size != null ? (patch.size === '' ? null : Number(patch.size)) : prev.size,
    sizeUnit: patch.sizeUnit != null ? String(patch.sizeUnit) : prev.sizeUnit,
    notes: patch.notes != null ? String(patch.notes) : prev.notes,
    updatedAt: _nowIso()
  };

  areas[idx] = next;
  _writeColl('areas', areas);
}

/**
 * Delete an Area and cascade delete related entities.
 *
 * Cascade:
 * - cropInstances where areaId == areaId
 * - taskOccurrences where cropInstanceId in deleted cropInstances
 * - logs where cropInstanceId in deleted cropInstances OR taskOccurrenceId in deleted taskOccurrences
 *
 * Returns:
 * - Promise<void>
 *
 * Throws:
 * - No throw if area absent (no-op).
 */
export async function deleteArea(areaId) {
  _ensureInitialized();

  const areas = _readColl('areas');
  const cropInstances = _readColl('cropInstances');
  const taskOccurrences = _readColl('taskOccurrences');
  const logs = _readColl('logs');

  const deletedArea = areas.find(a => a && a.id === areaId);
  if (!deletedArea) {
    // Nothing to do
    return;
  }

  // Identify crops within this area
  const deletedCrops = cropInstances.filter(ci => ci && ci.areaId === areaId);
  const deletedCropIds = new Set(deletedCrops.map(ci => ci.id));

  // Identify occurrences for those crops
  const deletedTOs = taskOccurrences.filter(to => to && deletedCropIds.has(to.cropInstanceId));
  const deletedTOIds = new Set(deletedTOs.map(to => to.id));

  // Filter collections
  const nextAreas = areas.filter(a => !(a && a.id === areaId));
  const nextCrops = cropInstances.filter(ci => !(ci && deletedCropIds.has(ci.id)));
  const nextTOs = taskOccurrences.filter(to => !(to && deletedTOIds.has(to.id)));
  const nextLogs = logs.filter(l =>
    !(
      l &&
      ((l.cropInstanceId && deletedCropIds.has(l.cropInstanceId)) ||
       (l.taskOccurrenceId && deletedTOIds.has(l.taskOccurrenceId)))
    )
  );

  _writeColl('areas', nextAreas);
  _writeColl('cropInstances', nextCrops);
  _writeColl('taskOccurrences', nextTOs);
  _writeColl('logs', nextLogs);
}