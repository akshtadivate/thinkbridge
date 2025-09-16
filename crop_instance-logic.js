'use strict';
const DEBUG = false;

/** Method Index
 * export async function getCropInstance(cropInstanceId: string): Promise<object|null>
 * export async function updateCropInstanceOverrides(cropInstanceId: string, overrides: Record<string, any>): Promise<object|null>
 * export async function getLibraryCrop(libraryCropId: string): Promise<object|null>
 * export async function getScheduledTasksForCrop(cropInstanceId: string, daysWindow?: number): Promise<object[]>
 * export async function getLogsForCrop(cropInstanceId: string, limit?: number): Promise<object[]>
 * export async function getUnits(): Promise<object[]>
 * export async function saveAsMyTemplate(cropInstanceId: string): Promise<string>
 * export async function applyLibraryUpdates(cropInstanceId: string): Promise<string|null>
 */

/* =========================
   Private storage helpers
   ========================= */

const KEY_PREFIX = 'localDB:';               // matches initializer dataset
const MODULE_PREFIX = 'PL__';                // module namespace for meta keys
const SCHEMA_VERSION = '1.0.0';              // internal contract version
const META_KEY = `${MODULE_PREFIX}page_logic_meta`;

/** Get raw localStorage item (string or null) */
function _get(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    if (DEBUG) console.warn('localStorage.getItem failed', key, err);
    return null;
  }
}

/** Set raw localStorage item; returns boolean success */
function _set(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    if (DEBUG) console.warn('localStorage.setItem failed', key, err);
    return false;
  }
}

/** Remove localStorage item; returns boolean success */
function _remove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (err) {
    if (DEBUG) console.warn('localStorage.removeItem failed', key, err);
    return false;
  }
}

/** Parse JSON safely */
function _parseJSONSafe(text, fallback) {
  if (typeof text !== 'string') return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

/** Load JSON value with fallback (atomic read) */
function _loadJSON(key, fallback) {
  return _parseJSONSafe(_get(key), fallback);
}

/** Save JSON value atomically */
function _saveJSON(key, obj) {
  const serialized = JSON.stringify(obj);
  return _set(key, serialized);
}

/** Ensure module initialization (idempotent). Creates empty arrays for missing collections. */
function _ensureInitialized() {
  // Store/track module metadata for migrations if needed later.
  const meta = _loadJSON(META_KEY, null);
  if (!meta || meta.schemaVersion !== SCHEMA_VERSION) {
    const newMeta = {
      schemaVersion: SCHEMA_VERSION,
      initializedAt: new Date().toISOString(),
      prev: meta || null
    };
    _saveJSON(META_KEY, newMeta);
  }

  // Ensure required collections exist (empty arrays if not found).
  const requiredCollections = [
    'cropInstances',
    'libraryCrops',
    'taskTemplates',
    'taskTypes',
    'taskOccurrences',
    'logs',
    'units'
  ];
  for (const c of requiredCollections) {
    const key = _collectionKey(c);
    if (_get(key) === null) {
      _saveJSON(key, []);
    }
  }
}

/* =========================
   Private utility helpers
   ========================= */

function _collectionKey(name) {
  return `${KEY_PREFIX}${name}`;
}

function _getCollection(name) {
  return _loadJSON(_collectionKey(name), []);
}

function _saveCollection(name, items) {
  // Atomic: write full array
  return _saveJSON(_collectionKey(name), Array.isArray(items) ? items : []);
}

function _findById(items, id) {
  if (!Array.isArray(items)) return null;
  return items.find((x) => x && x.id === id) || null;
}

function _nowISO() {
  return new Date().toISOString();
}

/** Convert schema overrides array [{key,value}] -> object map {key:value}, with light coercion */
function _overridesArrayToObject(arr) {
  const out = {};
  if (!Array.isArray(arr)) return out;
  for (const entry of arr) {
    if (!entry || typeof entry.key !== 'string') continue;
    const k = entry.key;
    const v = entry.value;
    out[k] = _coerceValue(k, v);
  }
  return out;
}

/** Convert overrides object map -> array [{key,value}] (value stored as string) */
function _overridesObjectToArray(obj) {
  if (!obj || typeof obj !== 'object') return [];
  const out = [];
  for (const [key, value] of Object.entries(obj)) {
    out.push({ key, value: value == null ? '' : String(value) });
  }
  return out;
}

/** Coerce common numeric override keys to numbers where appropriate */
function _coerceValue(key, value) {
  if (value === null || value === undefined) return value;
  const numKeys = new Set(['defaultIntervalDays', 'recommendedQuantity', 'daysToMaturity']);
  if (numKeys.has(key)) {
    const n = typeof value === 'number' ? value : (String(value).trim() === '' ? null : Number(value));
    return Number.isFinite(n) ? n : null;
  }
  return value;
}

/** Enrich a task occurrence with its taskType info via template -> taskType */
function _enrichTaskOccurrence(toItem, taskTemplates, taskTypes) {
  const template = _findById(taskTemplates, toItem.templateId);
  let taskTypeObj = null;
  if (template) {
    taskTypeObj = _findById(taskTypes, template.taskTypeId);
  }
  const taskType = taskTypeObj
    ? { id: taskTypeObj.id, nameEn: taskTypeObj.nameEn, nameTa: taskTypeObj.nameTa, icon: taskTypeObj.icon || 'circle' }
    : null;

  return {
    ...toItem,
    taskType
  };
}

/** Enrich a log with its unit object (if any) */
function _enrichLogWithUnit(log, units) {
  let unit = null;
  if (log && log.unitId) {
    const u = _findById(units, log.unitId);
    if (u) unit = { id: u.id, symbol: u.symbol, name: u.name, type: u.type };
  }
  return { ...log, unit };
}

/** Deep-ish clone via JSON for plain objects */
function _deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* =========================
   Exported API
   ========================= */

/**
 * Get a crop instance by id.
 *
 * Purpose:
 * - Fetch a single crop instance document from localStorage.
 * - Convert overrides (schema: array of {key,value}) into an object map for easier UI access.
 *
 * Params:
 * - cropInstanceId: string - the id of the crop instance to fetch.
 *
 * Returns:
 * - Promise<object|null>:
 *   The crop instance object with:
 *     - overrides: Record<string, any> (object map)
 *   or null if not found.
 *
 * Notes:
 * - This method does not join library crop data; use getLibraryCrop for that.
 * - Numeric-like override values are coerced to numbers.
 */
export async function getCropInstance(cropInstanceId) {
  _ensureInitialized();
  const instances = _getCollection('cropInstances');
  const found = _findById(instances, cropInstanceId);
  if (!found) return null;

  const instance = _deepClone(found);
  instance.overrides = _overridesArrayToObject(instance.overrides || []);
  return instance;
}

/**
 * Update overrides for a crop instance.
 *
 * Purpose:
 * - Saves the provided overrides map onto the crop instance (stored as array of {key,value}).
 * - Updates daysToMaturity top-level field if present in overrides.
 * - Intended to trigger a schedule rebuild; current implementation does not regenerate occurrences,
 *   but remains compatible for future migration.
 *
 * Params:
 * - cropInstanceId: string
 * - overrides: Record<string, any> (only keys provided will be stored)
 *
 * Returns:
 * - Promise<object|null>:
 *   The updated crop instance object (with overrides as object map) or null if not found.
 *
 * Edge cases:
 * - If the cropInstanceId is not found, returns null.
 * - Values are stored as strings in storage (per schema) but numeric-like keys are coerced to number on read.
 */
export async function updateCropInstanceOverrides(cropInstanceId, overrides) {
  _ensureInitialized();
  const instances = _getCollection('cropInstances');
  const idx = instances.findIndex(ci => ci && ci.id === cropInstanceId);
  if (idx === -1) return null;

  // Prepare updated record
  const now = _nowISO();
  const record = { ...instances[idx] };

  // Persist overrides as array
  const safeOverrides = overrides && typeof overrides === 'object' ? overrides : {};
  record.overrides = _overridesObjectToArray(safeOverrides);

  // Also set daysToMaturity if explicitly provided
  if (Object.prototype.hasOwnProperty.call(safeOverrides, 'daysToMaturity')) {
    const coerced = _coerceValue('daysToMaturity', safeOverrides.daysToMaturity);
    record.daysToMaturity = coerced;
  }

  record.updatedAt = now;

  // Atomic write
  const newArr = instances.slice();
  newArr[idx] = record;
  _saveCollection('cropInstances', newArr);

  // Future hook: schedule rebuild could occur here

  // Return updated object with overrides as map
  const out = _deepClone(record);
  out.overrides = _overridesArrayToObject(out.overrides || []);
  return out;
}

/**
 * Get a library crop by id, enriched with convenience fields.
 *
 * Purpose:
 * - Fetch a library crop document.
 * - Enrich with defaultIntervalDays, defaultUnitId, and recommendedQuantity derived from its defaultCareTemplateId.
 *
 * Params:
 * - libraryCropId: string
 *
 * Returns:
 * - Promise<object|null> enriched library crop, or null if not found.
 *
 * Fields added when possible:
 * - defaultIntervalDays?: number
 * - defaultUnitId?: string
 * - recommendedQuantity?: number|null
 *
 * Notes:
 * - Non-destructive: does not modify storage.
 */
export async function getLibraryCrop(libraryCropId) {
  _ensureInitialized();
  const libraryCrops = _getCollection('libraryCrops');
  const crop = _findById(libraryCrops, libraryCropId);
  if (!crop) return null;

  const result = _deepClone(crop);

  // Enrich from default care template if available
  if (result.defaultCareTemplateId) {
    const templates = _getCollection('taskTemplates');
    const tpl = _findById(templates, result.defaultCareTemplateId);
    if (tpl) {
      if (typeof tpl.defaultIntervalDays !== 'undefined') {
        result.defaultIntervalDays = tpl.defaultIntervalDays;
      }
      if (typeof tpl.defaultUnitId !== 'undefined') {
        result.defaultUnitId = tpl.defaultUnitId;
      }
      if (Object.prototype.hasOwnProperty.call(tpl, 'recommendedQuantity')) {
        result.recommendedQuantity = tpl.recommendedQuantity;
      }
    }
  }

  return result;
}

/**
 * Get scheduled task occurrences for a crop within an upcoming window.
 *
 * Purpose:
 * - Retrieve taskOccurrences filtered by cropInstanceId and dueDate within [now, now + daysWindow].
 * - Enrich each occurrence with taskType data (icon, nameEn/nameTa) via template->taskType join.
 *
 * Params:
 * - cropInstanceId: string
 * - daysWindow?: number (default 30)
 *
 * Returns:
 * - Promise<object[]>: Array of occurrences with properties from storage plus:
 *   - taskType?: { id: string, nameEn?: string, nameTa?: string, icon?: string }
 *
 * Notes:
 * - Sorted by dueDate ascending.
 * - Dates are compared as ISO strings by converting to Date objects.
 */
export async function getScheduledTasksForCrop(cropInstanceId, daysWindow = 30) {
  _ensureInitialized();
  const occurrences = _getCollection('taskOccurrences');
  const templates = _getCollection('taskTemplates');
  const taskTypes = _getCollection('taskTypes');

  const now = new Date();
  const end = new Date(now.getTime() + Math.max(0, Number(daysWindow) || 0) * 24 * 60 * 60 * 1000);

  const filtered = occurrences.filter((t) => {
    if (!t || t.cropInstanceId !== cropInstanceId || !t.dueDate) return false;
    const due = new Date(t.dueDate);
    return due >= now && due <= end;
  });

  const enriched = filtered
    .map(t => _enrichTaskOccurrence(t, templates, taskTypes))
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  return enriched;
}

/**
 * Get recent logs for a crop instance.
 *
 * Purpose:
 * - Fetch logs for the crop, sorted by timestamp descending, limited by 'limit'.
 * - Enrich each log with 'unit' object for convenient UI access.
 *
 * Params:
 * - cropInstanceId: string
 * - limit?: number (default 20)
 *
 * Returns:
 * - Promise<object[]>: Array of logs with added field:
 *   - unit?: { id: string, symbol: string, name: string, type: string }
 */
export async function getLogsForCrop(cropInstanceId, limit = 20) {
  _ensureInitialized();
  const logs = _getCollection('logs');
  const units = _getCollection('units');

  const filtered = logs
    .filter(l => l && l.cropInstanceId === cropInstanceId)
  .sort((a, b) => {
    const ta = a && a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b && b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tb - ta; // desc
  })
  .slice(0, Math.max(0, Number(limit) || 0))
  .map(l => _enrichLogWithUnit(l, units));

  return filtered;
}

/**
 * Get all units.
 *
 * Purpose:
 * - Provide the list of measurement units for dropdowns and joins.
 *
 * Params:
 * - none
 *
 * Returns:
 * - Promise<object[]>: Array of unit documents.
 */
export async function getUnits() {
  _ensureInitialized();
  const units = _getCollection('units');
  return Array.isArray(units) ? units.slice() : [];
}

/**
 * Save an existing crop instance as a user template.
 *
 * Purpose:
 * - Create a new entry in 'taskTemplates' that the UI can reference later.
 * - Uses the crop instance name and tries to derive sensible defaults from its linked library template.
 *
 * Params:
 * - cropInstanceId: string
 *
 * Returns:
 * - Promise<string>: The id of the newly created template.
 *
 * Behavior:
 * - If the crop has a libraryCropId and its defaultCareTemplate exists, we clone key fields.
 * - Otherwise, we create a minimal template record with generic defaults.
 * - Stored atomically back to localStorage.
 */
export async function saveAsMyTemplate(cropInstanceId) {
  _ensureInitialized();
  const cropInstances = _getCollection('cropInstances');
  const libraryCrops = _getCollection('libraryCrops');
  const templates = _getCollection('taskTemplates');

  const ci = _findById(cropInstances, cropInstanceId);
  const now = _nowISO();
  const newId = `tt-user-${Date.now()}`;

  let baseTpl = null;
  if (ci && ci.libraryCropId) {
    const lib = _findById(libraryCrops, ci.libraryCropId);
    if (lib && lib.defaultCareTemplateId) {
      baseTpl = _findById(templates, lib.defaultCareTemplateId);
    }
  }

  const newTemplate = {
    id: newId,
    name: ci && ci.name ? `My Template - ${ci.name}` : 'My Template',
    taskTypeId: baseTpl ? baseTpl.taskTypeId : null,
    defaultUnitId: baseTpl ? baseTpl.defaultUnitId : null,
    recurrencePatternId: baseTpl ? baseTpl.recurrencePatternId : null,
    defaultIntervalDays: baseTpl && typeof baseTpl.defaultIntervalDays !== 'undefined' ? baseTpl.defaultIntervalDays : 0,
    requiresQuantity: baseTpl && typeof baseTpl.requiresQuantity !== 'undefined' ? baseTpl.requiresQuantity : false,
    recommendedQuantity: baseTpl && Object.prototype.hasOwnProperty.call(baseTpl, 'recommendedQuantity') ? baseTpl.recommendedQuantity : null,
    notes: baseTpl && baseTpl.notes ? baseTpl.notes : '',
    icon: baseTpl && baseTpl.icon ? baseTpl.icon : 'circle',
    version: '1.0',
    createdAt: now,
    updatedAt: now
  };

  const updatedTemplates = templates.slice();
  updatedTemplates.push(newTemplate);
  _saveCollection('taskTemplates', updatedTemplates);

  return newId;
}

/**
 * Apply latest library updates to a crop instance.
 *
 * Purpose:
 * - Update the crop instance's appliedTemplateVersion to match the current library crop version.
 * - Optionally align top-level fields like daysToMaturity when library defines them (non-destructive of overrides).
 *
 * Params:
 * - cropInstanceId: string
 *
 * Returns:
 * - Promise<string|null>: The new applied template version, or null if not applicable.
 *
 * Notes:
 * - This does not regenerate occurrences in this implementation.
 * - Overrides are preserved as-is.
 */
export async function applyLibraryUpdates(cropInstanceId) {
  _ensureInitialized();
  const instances = _getCollection('cropInstances');
  const libraryCrops = _getCollection('libraryCrops');

  const idx = instances.findIndex(ci => ci && ci.id === cropInstanceId);
  if (idx === -1) return null;

  const ci = { ...instances[idx] };
  if (!ci.libraryCropId) return null;

  const lib = _findById(libraryCrops, ci.libraryCropId);
  if (!lib || !lib.version) return null;

  // Update applied version and align daysToMaturity if defined at library and not overridden directly
  ci.appliedTemplateVersion = lib.version;
  if (typeof lib.daysToMaturity !== 'undefined' && lib.daysToMaturity !== null) {
    // Respect explicit override if present
    const overridesMap = _overridesArrayToObject(ci.overrides || []);
    if (!Object.prototype.hasOwnProperty.call(overridesMap, 'daysToMaturity')) {
      ci.daysToMaturity = lib.daysToMaturity;
    }
  }
  ci.updatedAt = _nowISO();

  const newArr = instances.slice();
  newArr[idx] = ci;
  _saveCollection('cropInstances', newArr);

  return ci.appliedTemplateVersion || null;
}