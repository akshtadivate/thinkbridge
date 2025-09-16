'use strict';
const DEBUG = false;

/** Method Index
 * export async function getTaskDetail(taskOccurrenceId: string): Promise<{ taskOccurrence: object, template: object, cropInstance: object, area: object, taskType: object, status: object } | null>
 * export async function getRecentLogs(taskOccurrenceId: string, cropInstanceId: string, limit?: number): Promise<object[]>
 * export async function getUnits(): Promise<Array<{ id: string, symbol: string, name: string }>>
 * export async function getReasonCodes(): Promise<Array<{ id: string, name: string, description?: string }>>
 * export async function markTaskComplete(taskOccurrenceId: string, logData: { action?: 'completed', quantity?: number|null, unitId?: string|null, notes?: string|null, photoIds?: string[] }): Promise<void>
 * export async function skipTask(taskOccurrenceId: string, skipData: { reasonId: string, notes?: string|null }): Promise<void>
 * export async function snoozeTask(taskOccurrenceId: string, snoozeUntilIso: string): Promise<void>
 * export async function createPhoto(file: File|Blob): Promise<string>
 */

/* =============================================================================
   Private storage and utility helpers
   ========================================================================== */

const KEY_PREFIX = 'localDB:'; // align with existing initializer
const META_KEY = KEY_PREFIX + '__pl_meta';
const SCHEMA_VERSION = '1.0.0';

/** Safely get localStorage item by key. */
function _get(key) {
  try {
    return localStorage.getItem(key);
  } catch (_e) {
    return null;
  }
}

/** Safely set localStorage item by key. */
function _set(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (_e) {
    // ignore
  }
}

/** Safely remove localStorage item by key. */
function _remove(key) {
  try {
    localStorage.removeItem(key);
  } catch (_e) {
    // ignore
  }
}

/** Safely parse JSON; return fallback on error. */
function _loadJSON(key, fallback) {
  const raw = _get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return fallback;
  }
}

/** Atomically save JSON. */
function _saveJSON(key, obj) {
  try {
    _set(key, JSON.stringify(obj));
    return true;
  } catch (_e) {
    return false;
  }
}

function _dbKey(collection) {
  return KEY_PREFIX + collection;
}

function _nowISO() {
  return new Date().toISOString();
}

/** Ensure expected collections exist (idempotent). */
function _ensureCollections(collections) {
  for (const name of collections) {
    const key = _dbKey(name);
    const val = _loadJSON(key, null);
    if (!Array.isArray(val)) {
      _saveJSON(key, []);
    }
  }
}

/** Simple array loader. Always returns an array (possibly empty). */
function _loadCollection(name) {
  return _loadJSON(_dbKey(name), []);
}

/** Save full collection array (atomic). */
function _saveCollection(name, arr) {
  return _saveJSON(_dbKey(name), Array.isArray(arr) ? arr : []);
}

/** Find an item by id within a collection. Returns undefined if not found. */
function _findById(name, id) {
  if (!id) return undefined;
  const arr = _loadCollection(name);
  return arr.find((it) => it && it.id === id);
}

/** Replace an item within a collection by id using an updater fn. Returns updated item or null. */
function _updateById(name, id, updater) {
  const arr = _loadCollection(name);
  const idx = arr.findIndex((it) => it && it.id === id);
  if (idx === -1) return null;
  const current = arr[idx];
  const updated = updater({ ...current });
  arr[idx] = updated;
  _saveCollection(name, arr);
  return updated;
}

/** Push a new item into a collection. Returns the inserted item. */
function _insertItem(name, item) {
  const arr = _loadCollection(name);
  arr.push(item);
  _saveCollection(name, arr);
  return item;
}

/** Generate a compact unique id with a prefix. */
function _genId(prefix) {
  const rnd = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36);
  return `${prefix}-${ts}${rnd}`;
}

/** Ensure module schema/meta and needed collections exist. Idempotent and safe. */
function _ensureInitialized() {
  // Ensure meta
  const meta = _loadJSON(META_KEY, { schemaVersion: null, initializedAt: null });
  if (meta.schemaVersion !== SCHEMA_VERSION) {
    const newMeta = { schemaVersion: SCHEMA_VERSION, initializedAt: meta.initializedAt || _nowISO(), updatedAt: _nowISO() };
    _saveJSON(META_KEY, newMeta);
  }

  // Collections this module relies on
  _ensureCollections([
    'taskOccurrences',
    'taskTemplates',
    'taskTypes',
    'cropInstances',
    'areas',
    'units',
    'statusCodes',
    'reasonCodes',
    'logs',
    'photos'
  ]);
}

/* =============================================================================
   Domain helpers
   ========================================================================== */

/** Build a status object from statusId with graceful fallback. */
function _getStatus(statusId) {
  const statuses = _loadCollection('statusCodes');
  const found = statuses.find((s) => s && s.id === statusId);
  if (found) return found;
  // Fallback with minimal info
  return { id: statusId || 'status-unknown', name: (statusId || 'unknown').replace(/^status-/, '') };
}

/** Sort by timestamp desc (ISO strings). */
function _sortByTimestampDesc(a, b) {
  const at = new Date(a.timestamp || a.createdAt || 0).getTime();
  const bt = new Date(b.timestamp || b.createdAt || 0).getTime();
  return bt - at;
}

/* =============================================================================
   Exports
   ========================================================================== */

/**
 * Fetch a task occurrence and its related entities.
 *
 * @param {string} taskOccurrenceId - The ID of the task occurrence to load.
 * @returns {Promise<{
 *   taskOccurrence: object,
 *   template: object,
 *   cropInstance: object,
 *   area: object,
 *   taskType: object,
 *   status: object
 * } | null>} Resolves to composed task detail data, or null if not found.
 *
 * Fields used by the consumer UI:
 * - taskOccurrence: { dueDate, dueWindow, recurrenceType, ... }
 * - template: { name, defaultUnitId, recommendedQuantity, notes, taskTypeId }
 * - cropInstance: { id, name, areaId }
 * - area: { name, size, sizeUnit }
 * - taskType: { nameEn, icon, requiresQuantity }
 * - status: { id, name }
 *
 * Notes:
 * - Tolerates missing linked records by returning minimal placeholder objects.
 * - Always returns an object if the occurrence is found; else returns null.
 */
export async function getTaskDetail(taskOccurrenceId) {
  _ensureInitialized();

  const occurrence = _findById('taskOccurrences', taskOccurrenceId);
  if (!occurrence) return null;

  const template = _findById('taskTemplates', occurrence.templateId) || {
    id: occurrence.templateId || 'template-missing',
    name: 'Untitled Task',
    defaultUnitId: null,
    recommendedQuantity: null,
    notes: ''
  };

  const cropInstance = _findById('cropInstances', occurrence.cropInstanceId) || {
    id: occurrence.cropInstanceId || 'crop-missing',
    name: 'Unknown Crop',
    areaId: null
  };

  const area = _findById('areas', cropInstance.areaId) || {
    id: cropInstance.areaId || 'area-missing',
    name: 'Unknown Area',
    size: null,
    sizeUnit: ''
  };

  const taskType = _findById('taskTypes', template.taskTypeId) || {
    id: template.taskTypeId || 'tasktype-missing',
    nameEn: 'Task',
    icon: 'circle-check',
    requiresQuantity: false
  };

  const status = _getStatus(occurrence.statusId);

  return {
    taskOccurrence: occurrence,
    template,
    cropInstance,
    area,
    taskType,
    status
  };
}

/**
 * Load recent activity logs for a crop/task context.
 *
 * @param {string} taskOccurrenceId - The specific task occurrence id (informational; filtering primarily uses cropInstanceId).
 * @param {string} cropInstanceId - Crop instance whose logs should be returned.
 * @param {number} [limit=5] - Max number of logs to return.
 * @returns {Promise<object[]>} Resolves to array of logs sorted by timestamp desc.
 *
 * Log fields consumed by UI: { action, timestamp, quantity, unitId, notes, photoIds }
 *
 * Filtering strategy:
 * - Includes all logs with log.cropInstanceId === cropInstanceId (covers task-level and crop-level logs).
 * - Sorted by timestamp desc, truncated to the requested limit.
 */
export async function getRecentLogs(taskOccurrenceId, cropInstanceId, limit = 5) {
  _ensureInitialized();

  const allLogs = _loadCollection('logs');
  const filtered = allLogs
    .filter((l) => l && l.cropInstanceId === cropInstanceId)
    .sort(_sortByTimestampDesc)
    .slice(0, Math.max(0, limit | 0));

  return filtered;
}

/**
 * Return available measurement units for quantity input.
 *
 * @returns {Promise<Array<{ id: string, symbol: string, name: string }>>}
 * Resolves to array of unit records; may be empty if none configured.
 */
export async function getUnits() {
  _ensureInitialized();
  const units = _loadCollection('units');
  // Optional: stable sort by name for consistent UX
  return units.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

/**
 * Return available skip reason codes.
 *
 * @returns {Promise<Array<{ id: string, name: string, description?: string }>>}
 * Resolves to array of reasons; may be empty if none configured.
 */
export async function getReasonCodes() {
  _ensureInitialized();
  const reasons = _loadCollection('reasonCodes');
  return reasons.slice();
}

/**
 * Mark a task as completed and create a corresponding log entry.
 *
 * @param {string} taskOccurrenceId - The occurrence to complete.
 * @param {{
 *   action?: 'completed',
 *   quantity?: number|null,
 *   unitId?: string|null,
 *   notes?: string|null,
 *   photoIds?: string[]
 * }} logData - Details for the completion log. The 'action' field is ignored and forced to 'completed'.
 * @returns {Promise<void>} Resolves when updates are persisted.
 *
 * Behavior:
 * - Updates task occurrence: statusId -> 'status-completed', lastCompletedAt -> now, snoozeUntil -> null, updatedAt -> now.
 * - Creates a log with action='completed' linked to the occurrence and crop instance.
 *
 * Edge cases:
 * - If the occurrence is missing, this will throw an Error.
 */
export async function markTaskComplete(taskOccurrenceId, logData) {
  _ensureInitialized();

  const occurrence = _findById('taskOccurrences', taskOccurrenceId);
  if (!occurrence) throw new Error('Task occurrence not found');

  const now = _nowISO();
  const photoIds = Array.isArray(logData?.photoIds) ? logData.photoIds.filter(Boolean) : [];

  // Create log entry
  const log = {
    id: _genId('log'),
    userId: occurrence.userId || 'local-user',
    taskOccurrenceId: occurrence.id,
    cropInstanceId: occurrence.cropInstanceId || null,
    action: 'completed',
    timestamp: now,
    quantity: typeof logData?.quantity === 'number' ? logData.quantity : (logData?.quantity != null ? Number(logData.quantity) : null),
    unitId: logData?.unitId || null,
    notes: logData?.notes || null,
    photoIds,
    skipReasonId: null,
    createdAt: now,
    updatedAt: now
  };
  _insertItem('logs', log);

  // Update occurrence
  _updateById('taskOccurrences', occurrence.id, (cur) => {
    cur.statusId = 'status-completed';
    cur.lastCompletedAt = now;
    cur.snoozeUntil = null;
    cur.updatedAt = now;
    return cur;
  });

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.debug('markTaskComplete ->', taskOccurrenceId, log.id);
  }
}

/**
 * Mark a task as skipped and create a corresponding log entry.
 *
 * @param {string} taskOccurrenceId - The occurrence to skip.
 * @param {{ reasonId: string, notes?: string|null }} skipData - Skip reason and optional notes.
 * @returns {Promise<void>} Resolves when updates are persisted.
 *
 * Behavior:
 * - Updates task occurrence: statusId -> 'status-skipped', snoozeUntil -> null, updatedAt -> now.
 * - Creates a log with action='skipped' and skipReasonId.
 */
export async function skipTask(taskOccurrenceId, skipData) {
  _ensureInitialized();

  const occurrence = _findById('taskOccurrences', taskOccurrenceId);
  if (!occurrence) throw new Error('Task occurrence not found');

  const now = _nowISO();

  const log = {
    id: _genId('log'),
    userId: occurrence.userId || 'local-user',
    taskOccurrenceId: occurrence.id,
    cropInstanceId: occurrence.cropInstanceId || null,
    action: 'skipped',
    timestamp: now,
    quantity: null,
    unitId: null,
    notes: skipData?.notes || null,
    photoIds: [],
    skipReasonId: skipData?.reasonId || null,
    createdAt: now,
    updatedAt: now
  };
  _insertItem('logs', log);

  _updateById('taskOccurrences', occurrence.id, (cur) => {
    cur.statusId = 'status-skipped';
    cur.snoozeUntil = null;
    cur.updatedAt = now;
    return cur;
  });

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.debug('skipTask ->', taskOccurrenceId, log.id);
  }
}

/**
 * Snooze a task until a specified datetime (ISO string) and create a log entry.
 *
 * @param {string} taskOccurrenceId - The occurrence to snooze.
 * @param {string} snoozeUntilIso - Future datetime in ISO format.
 * @returns {Promise<void>} Resolves when updates are persisted.
 *
 * Behavior:
 * - Updates task occurrence: statusId -> 'status-snoozed', snoozeUntil -> provided date, updatedAt -> now.
 * - Creates a log with action='snoozed'.
 */
export async function snoozeTask(taskOccurrenceId, snoozeUntilIso) {
  _ensureInitialized();

  const occurrence = _findById('taskOccurrences', taskOccurrenceId);
  if (!occurrence) throw new Error('Task occurrence not found');

  const until = new Date(snoozeUntilIso);
  if (isNaN(until.getTime())) throw new Error('Invalid snoozeUntil date');

  const now = _nowISO();

  const log = {
    id: _genId('log'),
    userId: occurrence.userId || 'local-user',
    taskOccurrenceId: occurrence.id,
    cropInstanceId: occurrence.cropInstanceId || null,
    action: 'snoozed',
    timestamp: now,
    quantity: null,
    unitId: null,
    notes: null,
    photoIds: [],
    skipReasonId: null,
    createdAt: now,
    updatedAt: now
  };
  _insertItem('logs', log);

  _updateById('taskOccurrences', occurrence.id, (cur) => {
    cur.statusId = 'status-snoozed';
    cur.snoozeUntil = until.toISOString();
    cur.updatedAt = now;
    return cur;
  });

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.debug('snoozeTask ->', taskOccurrenceId, 'until', snoozeUntilIso);
  }
}

/**
 * Persist a photo selected or captured by the user and return its new id.
 *
 * @param {File|Blob} file - The image file/blob to store.
 * @returns {Promise<string>} Resolves to the generated photo id.
 *
 * Storage:
 * - Saves a photo record in the 'photos' collection with a data URL reference (storageRef).
 * - Owner cannot be inferred reliably; defaults to 'local-user'.
 *
 * Notes:
 * - File is read as a Data URL. For large files this increases localStorage size.
 * - Width/height are set to 0 (not measured) to avoid expensive decoding.
 */
export async function createPhoto(file) {
  _ensureInitialized();

  if (!(file instanceof Blob)) {
    throw new Error('createPhoto: expected a File/Blob');
  }

  // Read file as data URL
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });

  const now = _nowISO();
  const photoId = _genId('p');

  const photo = {
    id: photoId,
    ownerId: 'local-user',
    mimeType: file.type || 'image/*',
    width: 0,
    height: 0,
    storageRef: dataUrl,
    presetId: null,
    sizeBytes: typeof file.size === 'number' ? file.size : null,
    createdAt: now
  };

  _insertItem('photos', photo);

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.debug('createPhoto ->', photoId);
  }

  return photoId;
}