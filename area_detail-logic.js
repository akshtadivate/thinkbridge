'use strict';
const DEBUG = false;

/** Method Index
 * export async function getAreaById(id: string): Promise<object|null>
 * export async function getFieldById(id: string): Promise<object|null>
 * export async function getCropInstancesByAreaId(areaId: string): Promise<object[]>
 * export async function getLibraryCrops(): Promise<object[]>
 * export async function getUpcomingTasksByAreaId(areaId: string): Promise<object[]>
 * export async function createCropInstance(data: object): Promise<{success: boolean, cropInstanceId?: string, message?: string}>
 * export async function updateCropInstance(id: string, patch: object): Promise<{success: boolean, updated?: object, message?: string}>
 * export async function bulkMarkTasksComplete(areaId: string, taskTypeId: string): Promise<{success: boolean, completedCount: number, message?: string}>
 * export async function getTaskTemplateById(id: string): Promise<object|null>
 * export async function getUserPreferences(userId?: string): Promise<object>
 */

/* ============================== *
 * Private helpers (not exported)
 * ============================== */

const KEY_PREFIX = 'localDB:'; // Use the app's existing namespace
const META_KEY = 'PL::schemaVersion';
const SCHEMA_VERSION = '1.0.0';

/** Get raw value from localStorage */
function _get(key) {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

/** Set raw value in localStorage */
function _set(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (_) {
    return false;
  }
}

/** Remove a key from localStorage */
function _remove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (_) {
    return false;
  }
}

/** Safely load JSON from localStorage. Returns fallback on error/missing. */
function _loadJSON(key, fallback) {
  const raw = _get(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

/** Safely save JSON to localStorage atomically. */
function _saveJSON(key, obj) {
  try {
    const j = JSON.stringify(obj);
    return _set(key, j);
  } catch (_) {
    return false;
  }
}

function _collectionKey(name) {
  return `${KEY_PREFIX}${name}`;
}

function _loadCollection(name) {
  return _loadJSON(_collectionKey(name), []);
}

function _saveCollection(name, arr) {
  return _saveJSON(_collectionKey(name), Array.isArray(arr) ? arr : []);
}

function _nowISO() {
  return new Date().toISOString();
}

function _genId(prefix) {
  const rnd = Math.floor(Math.random() * 36 ** 4).toString(36).padStart(4, '0');
  return `${prefix}${Date.now().toString(36)}${rnd}`;
}

function _toDate(val) {
  return new Date(val);
}

function _dateOnlyISO(dateOrISO) {
  const d = typeof dateOrISO === 'string' ? new Date(dateOrISO) : dateOrISO;
  const iso = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0)).toISOString();
  return iso;
}

function _addDaysISO(dateIso, days) {
  const d = new Date(dateIso);
  const res = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (days || 0), 0, 0, 0));
  return res.toISOString();
}

function _statusNameById(id, statusCodes) {
  const sc = statusCodes.find(s => s.id === id);
  return sc ? sc.name : 'planned';
}

function _statusPriorityById(id, statusCodes) {
  const sc = statusCodes.find(s => s.id === id);
  return sc && typeof sc.priority === 'number' ? sc.priority : 0;
}

function _ensureInitialized() {
  const cur = _get(META_KEY);
  if (cur === SCHEMA_VERSION) {
    return;
  }
  // Idempotent: write current version marker; do not seed data here.
  _set(META_KEY, SCHEMA_VERSION);
  // Optionally, future migrations can be handled here based on cur.
  // No side-effects on collections to respect "no seeding" constraint.
}

/* ============================== *
 * Exported methods
 * ============================== */

/**
 * Fetch a single area by its id.
 * - Reads from localStorage collection "areas".
 * @param {string} id - areas.id
 * @returns {Promise<object|null>} Resolves to the area object or null if not found.
 * @usage
 *  const area = await getAreaById('a-1001');
 *  if (area) { console.log(area.name); }
 */
export async function getAreaById(id) {
  _ensureInitialized();
  const areas = _loadCollection('areas');
  return areas.find(a => a.id === id) || null;
}

/**
 * Fetch a single field by its id.
 * - Reads from localStorage collection "fields".
 * @param {string} id - fields.id
 * @returns {Promise<object|null>} Resolves to the field object or null if not found.
 */
export async function getFieldById(id) {
  _ensureInitialized();
  const fields = _loadCollection('fields');
  return fields.find(f => f.id === id) || null;
}

/**
 * Fetch crop instances in a specific area.
 * - Reads from localStorage collection "cropInstances".
 * @param {string} areaId - areas.id to filter by.
 * @returns {Promise<object[]>} Array of crop instance objects (may be empty).
 * Notes:
 * - The returned objects are stored as-is from the collection and may contain:
 *   { id, userId, areaId, libraryCropId, custom, name, startDate, appliedTemplateVersion, overrides, daysToMaturity, stage, notes, createdAt, updatedAt }
 */
export async function getCropInstancesByAreaId(areaId) {
  _ensureInitialized();
  const all = _loadCollection('cropInstances');
  return all.filter(ci => ci.areaId === areaId);
}

/**
 * List all library crops.
 * - Reads from localStorage collection "libraryCrops".
 * @returns {Promise<object[]>} Array of library crop definitions.
 * Each object typically includes:
 *  { id, cropId, nameEn, nameTa, category, daysToMaturity, stageDefinitions, spacingReference, defaultCareTemplateId, typicalPests, typicalNutrients, version, createdAt, updatedAt }
 */
export async function getLibraryCrops() {
  _ensureInitialized();
  const crops = _loadCollection('libraryCrops');
  // Sort by English name if available for stable UX.
  return [...crops].sort((a, b) => (a.nameEn || '').localeCompare(b.nameEn || ''));
}

/**
 * Build upcoming/planned tasks view for a given area.
 * Joins taskOccurrences with cropInstances, taskTemplates, and statusCodes.
 * Filters statuses to planned/due/overdue only.
 * Sorted by dueDate (asc), then priority (desc).
 * @param {string} areaId - Target area id.
 * @returns {Promise<Array<{cropInstanceId: string, taskOccurrenceId: string, cropName: string, taskName: string, dueDate: string, priority: number, statusName: string}>>}
 * Edge cases:
 * - Returns [] if the area has no crop instances or no matching tasks.
 * - If template or crop is missing, placeholders "Task"/"Crop" are used.
 */
export async function getUpcomingTasksByAreaId(areaId) {
  _ensureInitialized();
  const cropInstances = _loadCollection('cropInstances').filter(ci => ci.areaId === areaId);
  if (cropInstances.length === 0) return [];

  const ciIds = new Set(cropInstances.map(ci => ci.id));
  const occ = _loadCollection('taskOccurrences').filter(o => ciIds.has(o.cropInstanceId));
  const templates = _loadCollection('taskTemplates');
  const statusCodes = _loadCollection('statusCodes');

  const allowedStatusIds = new Set(['status-planned', 'status-due', 'status-overdue']);
  const ciMap = new Map(cropInstances.map(ci => [ci.id, ci]));
  const templateMap = new Map(templates.map(t => [t.id, t]));

  const items = occ
    .filter(o => allowedStatusIds.has(o.statusId))
    .map(o => {
      const ci = ciMap.get(o.cropInstanceId);
      const t = templateMap.get(o.templateId);
      const statusName = _statusNameById(o.statusId, statusCodes);
      const priority = typeof o.priority === 'number' ? o.priority : _statusPriorityById(o.statusId, statusCodes);
      return {
        cropInstanceId: o.cropInstanceId,
        taskOccurrenceId: o.id,
        cropName: ci?.name || 'Crop',
        taskName: t?.name || 'Task',
        dueDate: o.dueDate || o.scheduledDate || _nowISO(),
        priority,
        statusName
      };
    })
    .sort((a, b) => {
      const d = _toDate(a.dueDate) - _toDate(b.dueDate);
      if (d !== 0) return d;
      return (b.priority || 0) - (a.priority || 0);
    });

  return items;
}

/**
 * Create a crop instance and optionally generate initial task occurrences
 * based on the library crop's default care template.
 *
 * Expected input (as used by the page):
 *  {
 *    areaId: string,
 *    startDate: string (ISO like "YYYY-MM-DDT00:00:00Z"),
 *    name: string,
 *    custom: boolean,
 *    libraryCropId?: string,
 *    appliedTemplateVersion?: string,
 *    overrides?: Array<{ key: string, value: string }>
 *  }
 *
 * Behavior:
 * - Inserts a new document into "cropInstances".
 * - If libraryCropId is provided and that libraryCrop has defaultCareTemplateId,
 *   generates a single initial task occurrence in "taskOccurrences".
 *
 * Return:
 *  { success: true, cropInstanceId: string }
 *  or { success: false, message: string }
 *
 * Notes:
 * - User ownership is inferred from the parent area (area.userId) if available.
 * - Dates are normalized to midnight UTC for day-based scheduling.
 */
export async function createCropInstance(data) {
  _ensureInitialized();
  try {
    if (!data || !data.areaId || !data.startDate) {
      return { success: false, message: 'Missing required fields: areaId/startDate' };
    }

    const areas = _loadCollection('areas');
    const area = areas.find(a => a.id === data.areaId) || null;

    const cropInstances = _loadCollection('cropInstances');
    const now = _nowISO();
    const cropInstanceId = _genId('ci-');

    const instance = {
      id: cropInstanceId,
      userId: area?.userId || null,
      areaId: data.areaId,
      libraryCropId: data.libraryCropId || null,
      custom: !!data.custom,
      name: data.name || 'New Crop',
      startDate: _dateOnlyISO(data.startDate),
      appliedTemplateVersion: data.appliedTemplateVersion || null,
      overrides: Array.isArray(data.overrides) ? data.overrides : [],
      daysToMaturity: data.daysToMaturity ?? null,
      stage: data.stage ?? null,
      notes: data.notes ?? null,
      createdAt: now,
      updatedAt: now
    };

    // Save crop instance atomically
    const nextInstances = [...cropInstances, instance];
    _saveCollection('cropInstances', nextInstances);

    // Optionally create initial task occurrence from default care template
    if (data.libraryCropId) {
      const libraryCrops = _loadCollection('libraryCrops');
      const taskTemplates = _loadCollection('taskTemplates');
      const statusCodes = _loadCollection('statusCodes');

      const lCrop = libraryCrops.find(lc => lc.id === data.libraryCropId);
      const templateId = lCrop?.defaultCareTemplateId || null;
      const template = templateId ? taskTemplates.find(tt => tt.id === templateId) : null;

      if (template) {
        const occurrences = _loadCollection('taskOccurrences');

        const baseDate = _dateOnlyISO(instance.startDate);
        const dueDays = typeof template.defaultIntervalDays === 'number' ? template.defaultIntervalDays : 0;
        const dueDate = _addDaysISO(baseDate, dueDays);

        // Determine initial status
        const todayISO = _dateOnlyISO(new Date());
        let statusId = 'status-planned';
        if (_toDate(dueDate) < _toDate(todayISO)) {
          statusId = 'status-overdue';
        } else if (_dateOnlyISO(dueDate) === todayISO) {
          statusId = 'status-due';
        }
        const statusPriority = _statusPriorityById(statusId, statusCodes);

        const occurrence = {
          id: _genId('to-'),
          userId: instance.userId || null,
          cropInstanceId: instance.id,
          templateId: template.id,
          dueDate,
          scheduledDate: baseDate,
          statusId,
          dueWindow: _dateOnlyISO(dueDate) === todayISO ? 'Today' : 'ThisWeek',
          recurrenceType: template.defaultRecurrenceType || 'floating',
          isFloating: (template.defaultRecurrenceType || 'floating') === 'floating',
          snoozeUntil: null,
          lastCompletedAt: null,
          nextDue: dueDate,
          priority: statusPriority,
          createdAt: now,
          updatedAt: now
        };

        const nextOccurrences = [...occurrences, occurrence];
        _saveCollection('taskOccurrences', nextOccurrences);
      }
    }

    return { success: true, cropInstanceId };
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('createCropInstance error', err);
    }
    return { success: false, message: 'Unexpected error creating crop instance' };
  }
}

/**
 * Update a crop instance with a partial patch.
 * @param {string} id - cropInstances.id to update.
 * @param {object} patch - Partial fields to merge. updatedAt is set automatically.
 * @returns {Promise<{success: boolean, updated?: object, message?: string}>}
 * Notes:
 * - If the instance is not found, returns success: false with a message.
 * - No validation of schema keys is enforced here.
 */
export async function updateCropInstance(id, patch) {
  _ensureInitialized();
  try {
    const items = _loadCollection('cropInstances');
    const idx = items.findIndex(ci => ci.id === id);
    if (idx === -1) {
      return { success: false, message: 'Crop instance not found' };
    }
    const now = _nowISO();
    const updated = { ...items[idx], ...patch, updatedAt: now };
    const next = [...items];
    next[idx] = updated;
    _saveCollection('cropInstances', next);
    return { success: true, updated };
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('updateCropInstance error', err);
    }
    return { success: false, message: 'Unexpected error updating crop instance' };
  }
}

/**
 * Bulk mark tasks of a given type as completed for all crop instances in an area.
 * Also creates a completion log per updated occurrence.
 *
 * @param {string} areaId - Target area id.
 * @param {string} taskTypeId - Task type id to filter (e.g., "ttype-watering").
 * @returns {Promise<{success: boolean, completedCount: number, message?: string}>}
 *
 * Behavior:
 * - Finds crop instances in the area.
 * - Selects taskOccurrences for those instances with status in [planned, due, overdue],
 *   and whose template.taskTypeId === taskTypeId.
 * - For each found occurrence:
 *    - Sets statusId = "status-completed"
 *    - Sets lastCompletedAt = now, updatedAt = now
 *    - Appends a log entry in "logs" with action = "completed"
 * - Saves collections atomically (full-array writes).
 */
export async function bulkMarkTasksComplete(areaId, taskTypeId) {
  _ensureInitialized();
  try {
    const cropInstances = _loadCollection('cropInstances').filter(ci => ci.areaId === areaId);
    if (cropInstances.length === 0) {
      return { success: true, completedCount: 0, message: 'No crop instances in area' };
    }
    const ciIds = new Set(cropInstances.map(ci => ci.id));
    const occurrences = _loadCollection('taskOccurrences');
    const taskTemplates = _loadCollection('taskTemplates');
    const statusCodes = _loadCollection('statusCodes');
    const logs = _loadCollection('logs');

    const templateMap = new Map(taskTemplates.map(t => [t.id, t]));
    const allowedStatusIds = new Set(['status-planned', 'status-due', 'status-overdue']);
    const completedStatusId = 'status-completed';
    const now = _nowISO();

    const toUpdateIdx = [];
    for (let i = 0; i < occurrences.length; i++) {
      const o = occurrences[i];
      if (!ciIds.has(o.cropInstanceId)) continue;
      if (!allowedStatusIds.has(o.statusId)) continue;
      const t = templateMap.get(o.templateId);
      if (!t) continue;
      if (t.taskTypeId !== taskTypeId) continue;
      toUpdateIdx.push(i);
    }

    if (toUpdateIdx.length === 0) {
      return { success: true, completedCount: 0, message: 'No matching tasks to complete' };
    }

    // Update occurrences
    const nextOccurrences = [...occurrences];
    for (const idx of toUpdateIdx) {
      const orig = nextOccurrences[idx];
      nextOccurrences[idx] = {
        ...orig,
        statusId: completedStatusId,
        lastCompletedAt: now,
        updatedAt: now
      };
    }

    // Create logs
    const ciById = new Map(cropInstances.map(ci => [ci.id, ci]));
    const newLogs = toUpdateIdx.map(idx => {
      const occ = nextOccurrences[idx];
      const ci = ciById.get(occ.cropInstanceId);
      return {
        id: _genId('log-'),
        userId: ci?.userId || null,
        taskOccurrenceId: occ.id,
        cropInstanceId: occ.cropInstanceId,
        action: 'completed',
        timestamp: now,
        quantity: null,
        unitId: null,
        notes: null,
        photoIds: [],
        skipReasonId: null,
        createdAt: now,
        updatedAt: now
      };
    });

    _saveCollection('taskOccurrences', nextOccurrences);
    _saveCollection('logs', [...logs, ...newLogs]);

    return { success: true, completedCount: toUpdateIdx.length };
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('bulkMarkTasksComplete error', err);
    }
    return { success: false, completedCount: 0, message: 'Unexpected error completing tasks' };
  }
}

/**
 * Fetch a task template by its id.
 * @param {string} id - taskTemplates.id
 * @returns {Promise<object|null>} Task template object or null if not found.
 */
export async function getTaskTemplateById(id) {
  _ensureInitialized();
  const templates = _loadCollection('taskTemplates');
  return templates.find(t => t.id === id) || null;
}

/**
 * Retrieve user preferences/settings.
 * If userId is provided, returns settings record for that user if available.
 * Otherwise, returns the first settings object found or sensible defaults.
 *
 * @param {string} [userId] - Optional users.uid to target.
 * @returns {Promise<object>} A lightweight preferences object:
 *  {
 *    language: 'EN'|'TA',
 *    notificationsEnabled: boolean,
 *    backupEnabled: boolean,
 *    weekStart: 'MON'|'SUN'|string,
 *    notificationPermission: 'granted'|'denied'|'default'|string,
 *    userId?: string
 *  }
 * Notes:
 * - This utility is generic and not used by the current page, but provided as part of the contract.
 */
export async function getUserPreferences(userId) {
  _ensureInitialized();
  const settings = _loadCollection('settings');
  let s = null;
  if (userId) {
    s = settings.find(x => x.userId === userId) || null;
  }
  if (!s) {
    s = settings[0] || null;
  }
  if (!s) {
    return {
      language: 'EN',
      notificationsEnabled: false,
      backupEnabled: false,
      weekStart: 'MON',
      notificationPermission: 'default'
    };
  }
  return {
    language: s.language || 'EN',
    notificationsEnabled: !!s.notificationsEnabled,
    backupEnabled: !!s.backupEnabled,
    weekStart: s.weekStart || 'MON',
    notificationPermission: s.notificationPermission || 'default',
    userId: s.userId
  };
}