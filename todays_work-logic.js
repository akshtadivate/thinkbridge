'use strict';
const DEBUG = false;

/** Method Index
 * export async function getTodayAndWeekTasks(userId: string): Promise<{ tasks: object[] }>
 * export async function getTaskStats(userId: string): Promise<{ overdue: number, dueToday: number, thisWeek: number, completed: number }>
 * export async function markTaskComplete(taskOccurrenceId: string, data: { quantity: number|null, unitId: string|null, notes: string, photoIds: string[] }): Promise<void>
 * export async function skipTask(taskOccurrenceId: string, reasonId: string, notes: string): Promise<void>
 * export async function snoozeTask(taskOccurrenceId: string, newDueIso: string): Promise<void>
 * export async function createTaskLog(taskOccurrenceId: string, data: { userId?: string, cropInstanceId?: string, action: 'completed'|'skipped'|'snoozed', timestamp?: string, quantity?: number|null, unitId?: string|null, notes?: string, photoIds?: string[], skipReasonId?: string|null }): Promise<{ id: string }>
 * export async function getUserAreas(userId: string): Promise<Array<{ id: string, name: string }>>
 * export async function getCurrentUser(): Promise<object|null>
 * export async function getUserSettings(userId?: string): Promise<object|null>
 * export async function getI18nBundle(locale: 'EN'|'TA'): Promise<object|null>
 * export async function savePhoto(blob: Blob, presetId: string): Promise<string>
 */

/* =========================
   Private storage helpers
   ========================= */

const KEY_PREFIX = 'localDB:'; // align with existing initializer
const META_PREFIX = 'PL__';    // module-private metadata keys
const SCHEMA_VERSION = '1.0.0';

function _k(collection) {
  return `${KEY_PREFIX}${collection}`;
}

function _get(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    if (DEBUG) console.warn('localStorage.getItem failed', key, e);
    return null;
  }
}

function _set(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (DEBUG) console.warn('localStorage.setItem failed', key, e);
  }
}

function _remove(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    if (DEBUG) console.warn('localStorage.removeItem failed', key, e);
  }
}

function _loadJSON(key, fallback) {
  const raw = _get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    if (DEBUG) console.warn('JSON parse failed for', key, e);
    return fallback;
  }
}

function _saveJSON(key, obj) {
  try {
    const str = JSON.stringify(obj);
    _set(key, str);
  } catch (e) {
    if (DEBUG) console.warn('JSON stringify failed for', key, e);
  }
}

/* =========================
   Private utilities & state
   ========================= */

let _initialized = false;
let _statusIdToName = null; // e.g., { 'status-due': 'due' }
let _unitsById = null;      // e.g., { 'u-kg': { id, symbol, ... } }
let _taskTypesById = null;  // e.g., { 'ttype-harvest': {...} }
let _templatesById = null;  // e.g., { 'tt-watering-1': {...} }
let _areasById = null;      // e.g., { 'a-1001': {...} }
let _cropsById = null;      // e.g., { 'ci-9001': {...} }

function _ensureInitialized() {
  if (_initialized) return;
  // Minimal meta
  const metaKey = `${META_PREFIX}SCHEMA_VERSION`;
  const prev = _get(metaKey);
  if (!prev) {
    _set(metaKey, SCHEMA_VERSION);
  }

  // Build frequently used lookup maps (tolerate missing)
  const statusCodes = _loadJSON(_k('statusCodes'), []);
  _statusIdToName = {};
  for (const s of statusCodes) {
    if (s && s.id) _statusIdToName[s.id] = s.name || s.id;
  }

  const units = _loadJSON(_k('units'), []);
  _unitsById = {};
  for (const u of units) {
    if (u && u.id) _unitsById[u.id] = u;
  }

  const taskTypes = _loadJSON(_k('taskTypes'), []);
  _taskTypesById = {};
  for (const t of taskTypes) {
    if (t && t.id) _taskTypesById[t.id] = t;
  }

  const templates = _loadJSON(_k('taskTemplates'), []);
  _templatesById = {};
  for (const tt of templates) {
    if (tt && tt.id) _templatesById[tt.id] = tt;
  }

  const areas = _loadJSON(_k('areas'), []);
  _areasById = {};
  for (const a of areas) {
    if (a && a.id) _areasById[a.id] = a;
  }

  const crops = _loadJSON(_k('cropInstances'), []);
  _cropsById = {};
  for (const c of crops) {
    if (c && c.id) _cropsById[c.id] = c;
  }

  _initialized = true;
}

function _nowIso() {
  return new Date().toISOString();
}

function _toDate(value) {
  try {
    return new Date(value);
  } catch {
    return new Date(NaN);
  }
}

function _startOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function _endOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function _isSameLocalDay(isoA, isoB) {
  const a = _toDate(isoA);
  const b = _toDate(isoB);
  return _startOfLocalDay(a).getTime() === _startOfLocalDay(b).getTime();
}

function _addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function _slugFromTaskTypeId(taskTypeId) {
  // e.g., 'ttype-harvest' -> 'harvest'
  if (!taskTypeId) return '';
  const parts = String(taskTypeId).split('ttype-');
  return parts.length > 1 ? parts[1] : String(taskTypeId);
}

function _getStatusName(statusId) {
  return _statusIdToName && _statusIdToName[statusId] ? _statusIdToName[statusId] : String(statusId || '');
}

function _clone(obj) {
  return obj ? JSON.parse(JSON.stringify(obj)) : obj;
}

function _loadCollection(name) {
  return _loadJSON(_k(name), []);
}

function _saveCollection(name, arr) {
  _saveJSON(_k(name), Array.isArray(arr) ? arr : []);
}

function _findById(arr, id) {
  return Array.isArray(arr) ? arr.find(x => x && x.id === id) : undefined;
}

function _updateCollectionItem(name, id, updater) {
  const arr = _loadCollection(name);
  let changed = false;
  const newArr = arr.map(item => {
    if (item && item.id === id) {
      const updated = updater(_clone(item));
      changed = true;
      return updated;
    }
    return item;
  });
  if (changed) {
    _saveCollection(name, newArr);
  }
  return changed;
}

function _nextSeq(userId, seqName) {
  const key = _k('seqCounters');
  const counters = _loadJSON(key, []);
  const idx = counters.findIndex(c => c && c.userId === userId && c.seqName === seqName);
  let val;
  if (idx >= 0) {
    val = (counters[idx].value || 0) + 1;
    counters[idx].value = val;
  } else {
    val = 1;
    counters.push({
      id: `seq-${seqName}-${userId || 'global'}`,
      userId: userId || null,
      seqName,
      value: val
    });
  }
  _saveJSON(key, counters);
  return val;
}

async function _blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(blob);
    } catch (e) {
      reject(e);
    }
  });
}

async function _imageSizeFromDataURL(dataUrl) {
  return new Promise(resolve => {
    try {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth || img.width || null, height: img.naturalHeight || img.height || null });
      img.onerror = () => resolve({ width: null, height: null });
      img.src = dataUrl;
    } catch {
      resolve({ width: null, height: null });
    }
  });
}

async function _getCurrentUserInternal() {
  // Reuse getCurrentUser logic without export semantics.
  const users = _loadCollection('users');
  if (!users.length) return null;
  const savedUid = _get(`${META_PREFIX}currentUserUid`);
  if (savedUid) {
    const found = users.find(u => u && (u.uid === savedUid || u.id === savedUid));
    if (found) return found;
  }
  // Prefer a farmer if present
  const farmer = users.find(u => (u && u.role === 'farmer')) || users[0];
  // cache selection
  _set(`${META_PREFIX}currentUserUid`, farmer.uid || farmer.id);
  return farmer;
}

/* =========================
   Exported API
   ========================= */

/**
 * Build the list of tasks for Today and This Week for a given user.
 * Joins taskOccurrences with cropInstances, areas, templates, taskTypes, units.
 *
 * @param {string} userId - The user's UID (users.uid).
 * @returns {Promise<{ tasks: Array<object> }>} Array is flat; UI groups by area/crop.
 * Task object shape:
 *  - id: string (task occurrence id)
 *  - areaId: string
 *  - areaName: string
 *  - cropInstanceId: string
 *  - cropName: string
 *  - taskName: string
 *  - taskIcon: string | undefined
 *  - taskType: string (slug, e.g., 'harvest', 'watering', 'fertilize')
 *  - status: 'overdue'|'due'|'planned'|'completed'|'skipped'|'snoozed'
 *  - dueDate: string ISO
 *  - priority: number | undefined
 *  - recommendedQuantity: number | null
 *  - requiresQuantity: boolean
 *  - unitId: string | null
 *  - unitSymbol: string | ''
 */
export async function getTodayAndWeekTasks(userId) {
  _ensureInitialized();

  const occurrences = _loadCollection('taskOccurrences').filter(o => o && o.userId === userId);
  const tasks = [];

  for (const occ of occurrences) {
    const crop = _cropsById[occ.cropInstanceId] || null;
    const area = crop ? _areasById[crop.areaId] : null;
    const template = _templatesById[occ.templateId] || null;
    const taskType = template ? _taskTypesById[template.taskTypeId] : null;
    const unitId = (template && template.defaultUnitId) || (taskType && taskType.defaultUnitId) || null;
    const unit = unitId ? _unitsById[unitId] : null;

    const statusName = _getStatusName(occ.statusId);
    const t = {
      id: occ.id,
      areaId: area ? area.id : null,
      areaName: area ? area.name : 'Unknown Area',
      cropInstanceId: crop ? crop.id : null,
      cropName: crop ? (crop.name || 'Crop') : 'Unknown Crop',
      taskName: template ? (template.name || 'Task') : 'Task',
      taskIcon: (template && template.icon) || (taskType && taskType.icon) || undefined,
      taskType: taskType ? _slugFromTaskTypeId(taskType.id) : '',
      status: statusName,
      dueDate: occ.dueDate,
      priority: occ.priority,
      recommendedQuantity: template ? (template.recommendedQuantity ?? null) : null,
      requiresQuantity: Boolean(template ? template.requiresQuantity : (taskType ? taskType.requiresQuantity : false)),
      unitId: unitId,
      unitSymbol: unit ? (unit.symbol || '') : ''
    };
    tasks.push(t);
  }

  // Sort: overdue -> due -> planned by priority desc within groups (fallback by dueDate asc)
  const weight = { overdue: 3, due: 2, planned: 1, snoozed: 0, skipped: -1, completed: -2 };
  tasks.sort((a, b) => {
    const w = (weight[b.status] || 0) - (weight[a.status] || 0);
    if (w !== 0) return w;
    const p = (b.priority || 0) - (a.priority || 0);
    if (p !== 0) return p;
    const ad = _toDate(a.dueDate).getTime();
    const bd = _toDate(b.dueDate).getTime();
    return ad - bd;
  });

  return { tasks };
}

/**
 * Compute quick stats: Overdue, Due Today, This Week, Completed.
 *
 * - overdue: occurrences with status 'overdue'
 * - dueToday: occurrences with status 'due'
 * - thisWeek: occurrences with status 'planned' and dueDate within the next 7 days (including today)
 * - completed: logs with action 'completed' that occurred today
 *
 * @param {string} userId
 * @returns {Promise<{overdue: number, dueToday: number, thisWeek: number, completed: number}>}
 */
export async function getTaskStats(userId) {
  _ensureInitialized();

  const occurrences = _loadCollection('taskOccurrences').filter(o => o && o.userId === userId);
  const logs = _loadCollection('logs').filter(l => l && l.userId === userId);

  const todayStart = _startOfLocalDay();
  const in7 = _endOfLocalDay(_addDays(todayStart, 7));

  let overdue = 0, dueToday = 0, thisWeek = 0;

  for (const occ of occurrences) {
    const status = _getStatusName(occ.statusId);
    if (status === 'overdue') overdue++;
    if (status === 'due') dueToday++;
    if (status === 'planned') {
      const d = _toDate(occ.dueDate);
      if (d >= todayStart && d <= in7) thisWeek++;
    }
  }

  let completed = 0;
  for (const log of logs) {
    if (log.action === 'completed' && _isSameLocalDay(log.timestamp, new Date().toISOString())) {
      completed++;
    }
  }

  return { overdue, dueToday, thisWeek, completed };
}

/**
 * Mark a task occurrence as completed and create a corresponding log.
 *
 * @param {string} taskOccurrenceId
 * @param {{ quantity: number|null, unitId: string|null, notes: string, photoIds: string[] }} data
 * @returns {Promise<void>}
 *
 * Notes:
 * - Updates taskOccurrences.statusId -> 'status-completed'
 * - Sets lastCompletedAt and updatedAt
 * - Logs action 'completed' with provided details
 */
export async function markTaskComplete(taskOccurrenceId, data) {
  _ensureInitialized();

  const occurrences = _loadCollection('taskOccurrences');
  const occ = _findById(occurrences, taskOccurrenceId);
  if (!occ) throw new Error('Task occurrence not found');

  const nowIso = _nowIso();

  // Update occurrence atomically
  _updateCollectionItem('taskOccurrences', taskOccurrenceId, (item) => {
    item.statusId = 'status-completed';
    item.lastCompletedAt = nowIso;
    item.updatedAt = nowIso;
    return item;
  });

  // Create log
  const userId = occ.userId;
  await createTaskLog(taskOccurrenceId, {
    userId,
    cropInstanceId: occ.cropInstanceId,
    action: 'completed',
    timestamp: nowIso,
    quantity: data && typeof data.quantity === 'number' ? data.quantity : null,
    unitId: data ? (data.unitId || null) : null,
    notes: data ? (data.notes || '') : '',
    photoIds: data ? (Array.isArray(data.photoIds) ? data.photoIds : []) : [],
    skipReasonId: null
  });
}

/**
 * Skip a task occurrence with a reason and optional notes, creating a log.
 *
 * @param {string} taskOccurrenceId
 * @param {string} reasonId - e.g., 'reason-other'
 * @param {string} notes
 * @returns {Promise<void>}
 */
export async function skipTask(taskOccurrenceId, reasonId, notes) {
  _ensureInitialized();

  const occurrences = _loadCollection('taskOccurrences');
  const occ = _findById(occurrences, taskOccurrenceId);
  if (!occ) throw new Error('Task occurrence not found');

  const nowIso = _nowIso();

  _updateCollectionItem('taskOccurrences', taskOccurrenceId, (item) => {
    item.statusId = 'status-skipped';
    item.updatedAt = nowIso;
    return item;
  });

  await createTaskLog(taskOccurrenceId, {
    userId: occ.userId,
    cropInstanceId: occ.cropInstanceId,
    action: 'skipped',
    timestamp: nowIso,
    quantity: null,
    unitId: null,
    notes: notes || '',
    photoIds: [],
    skipReasonId: reasonId || null
  });
}

/**
 * Snooze a task occurrence until a future date. Also adjusts dueDate for visibility.
 *
 * @param {string} taskOccurrenceId
 * @param {string} newDueIso - ISO datetime to snooze until (e.g., tomorrow's start of day)
 * @returns {Promise<void>}
 */
export async function snoozeTask(taskOccurrenceId, newDueIso) {
  _ensureInitialized();

  const occurrences = _loadCollection('taskOccurrences');
  const occ = _findById(occurrences, taskOccurrenceId);
  if (!occ) throw new Error('Task occurrence not found');

  const nowIso = _nowIso();

  _updateCollectionItem('taskOccurrences', taskOccurrenceId, (item) => {
    item.snoozeUntil = newDueIso;
    item.dueDate = newDueIso;
    // Return to 'planned' for future scheduling visibility
    item.statusId = 'status-planned';
    item.updatedAt = nowIso;
    return item;
  });

  await createTaskLog(taskOccurrenceId, {
    userId: occ.userId,
    cropInstanceId: occ.cropInstanceId,
    action: 'snoozed',
    timestamp: nowIso,
    quantity: null,
    unitId: null,
    notes: 'Snoozed',
    photoIds: [],
    skipReasonId: null
  });
}

/**
 * Create a log entry for a given task occurrence.
 *
 * @param {string} taskOccurrenceId
 * @param {{ userId?: string, cropInstanceId?: string, action: 'completed'|'skipped'|'snoozed', timestamp?: string, quantity?: number|null, unitId?: string|null, notes?: string, photoIds?: string[], skipReasonId?: string|null }} data
 * @returns {Promise<{ id: string }>} The created log's id.
 *
 * Usage notes:
 * - If userId or cropInstanceId are omitted, they will be inferred from the task occurrence.
 * - Timestamp defaults to now.
 */
export async function createTaskLog(taskOccurrenceId, data) {
  _ensureInitialized();

  const occurrences = _loadCollection('taskOccurrences');
  const occ = _findById(occurrences, taskOccurrenceId);
  if (!occ) throw new Error('Task occurrence not found for logging');

  const userId = data?.userId || occ.userId;
  const cropInstanceId = data?.cropInstanceId || occ.cropInstanceId;

  const logs = _loadCollection('logs');
  const seq = _nextSeq(userId, 'logSeq');
  const id = `log-${String(seq).padStart(4, '0')}`;

  const nowIso = _nowIso();
  const log = {
    id,
    userId,
    taskOccurrenceId,
    cropInstanceId,
    action: data.action,
    timestamp: data.timestamp || nowIso,
    quantity: data.hasOwnProperty('quantity') ? data.quantity : null,
    unitId: data.hasOwnProperty('unitId') ? data.unitId : null,
    notes: data.notes || '',
    photoIds: Array.isArray(data.photoIds) ? data.photoIds : [],
    skipReasonId: data.hasOwnProperty('skipReasonId') ? data.skipReasonId : null,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  logs.push(log);
  _saveCollection('logs', logs);

  // enqueue for sync (best-effort)
  const syncQueue = _loadCollection('syncQueue');
  syncQueue.push({
    id: `sq-${id}`,
    userId,
    entityType: 'logs',
    entityId: id,
    operation: 'create',
    payload: JSON.stringify({ ...log, photoData: undefined }),
    createdAt: nowIso,
    lastAttemptAt: null,
    retries: 0,
    status: 'pending'
  });
  _saveCollection('syncQueue', syncQueue);

  return { id };
}

/**
 * Return the list of Areas owned by the user.
 *
 * @param {string} userId
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export async function getUserAreas(userId) {
  _ensureInitialized();

  const areas = _loadCollection('areas').filter(a => a && a.userId === userId);
  // Ensure shape
  return areas.map(a => ({ id: a.id, name: a.name }));
}

/**
 * Resolve the current user (simple local heuristic).
 * - If PL__currentUserUid is set, returns that user.
 * - Else returns the first 'farmer' user, else the first user in list.
 *
 * @returns {Promise<object|null>}
 */
export async function getCurrentUser() {
  _ensureInitialized();
  return _getCurrentUserInternal();
}

/**
 * Load settings for a user. If none exist, returns a minimal default.
 *
 * @param {string} [userId] - If omitted, resolves current user first.
 * @returns {Promise<object|null>}
 */
export async function getUserSettings(userId) {
  _ensureInitialized();

  let uid = userId;
  if (!uid) {
    const u = await _getCurrentUserInternal();
    uid = u ? u.uid || u.id : null;
  }
  if (!uid) return null;

  const settings = _loadCollection('settings');
  const found = settings.find(s => s && s.userId === uid);
  if (found) return found;

  // Minimal default, not persisted
  return {
    id: null,
    userId: uid,
    language: 'EN',
    notificationsEnabled: false,
    backupEnabled: false,
    notificationPermission: 'default',
    weekStart: 'MON',
    lastSync: null,
    createdAt: null,
    updatedAt: null
  };
}

/**
 * Load the i18n bundle for a locale.
 *
 * @param {'EN'|'TA'} locale
 * @returns {Promise<object|null>} The bundle as stored, or a minimal stub if missing.
 */
export async function getI18nBundle(locale) {
  _ensureInitialized();

  const bundles = _loadCollection('i18nBundles').filter(b => b && b.locale === locale);
  if (!bundles.length) {
    return { id: null, locale, version: '0', entries: [], cachedAt: _nowIso() };
  }
  // Pick the one with the latest cachedAt
  bundles.sort((a, b) => _toDate(b.cachedAt).getTime() - _toDate(a.cachedAt).getTime());
  return bundles[0];
}

/**
 * Save a photo blob to local storage "photos" collection with the given preset.
 * Converts the Blob to a data URL for storageRef.
 *
 * @param {Blob} blob
 * @param {string} presetId - e.g., 'pp-default-1280'
 * @returns {Promise<string>} The new photo id.
 *
 * Notes:
 * - Attempts to detect image dimensions from the data URL.
 * - Owner is the current user (heuristic).
 */
export async function savePhoto(blob, presetId) {
  _ensureInitialized();

  if (!blob) throw new Error('Missing photo blob');

  const user = await _getCurrentUserInternal();
  const ownerId = user ? (user.uid || user.id) : null;

  const dataUrl = await _blobToDataURL(blob);
  const dim = await _imageSizeFromDataURL(dataUrl);

  const photos = _loadCollection('photos');
  const seq = _nextSeq(ownerId, 'photoSeq');
  const id = `p-${String(seq).padStart(3, '0')}`;
  const nowIso = _nowIso();

  photos.push({
    id,
    ownerId,
    mimeType: (blob && blob.type) || 'image/jpeg',
    width: dim.width,
    height: dim.height,
    storageRef: dataUrl,
    presetId,
    sizeBytes: blob.size || null,
    createdAt: nowIso
  });

  _saveCollection('photos', photos);

  // enqueue for sync (best-effort)
  const syncQueue = _loadCollection('syncQueue');
  syncQueue.push({
    id: `sq-${id}`,
    userId: ownerId,
    entityType: 'photos',
    entityId: id,
    operation: 'create',
    payload: JSON.stringify({ id, ownerId, presetId }),
    createdAt: nowIso,
    lastAttemptAt: null,
    retries: 0,
    status: 'pending'
  });
  _saveCollection('syncQueue', syncQueue);

  return id;
}