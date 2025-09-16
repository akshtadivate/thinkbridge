'use strict';
const DEBUG = false;

/** Method Index
 * export async function getFilterOptions(): Promise<{fields: {id:string,name:string}[], areas: {id:string,name:string}[], crops: {id:string,name:string}[], taskTypes: {id:string,nameEn:string}[]}>
 * export async function getLogbookData(filters: object, page: number, pageSize: number): Promise<{logs: object[], totalCount: number}>
 * export async function calculateAggregatedTotals(filters: object): Promise<{ totalWaterL: number, totalFertilizerKg: number, totalHarvestKg: number, totalLogs: number }>
 * export async function exportLogsData(filters: object, includePhotos?: boolean): Promise<{logCount:number, estimatedSizeKB:number} | {metadata: object, logs: object[], photos?: object[]}>
 * export async function getPhotoById(photoId: string): Promise<object | null>
 * export async function deletePhotoById(photoId: string): Promise<boolean>
 */

/* =========================
   Private helpers and state
   ========================= */

const COLLECTION_PREFIX = 'localDB:'; // matches existing initializer
const LOGIC_PREFIX = 'PL__LOGIC__';
const MODULE_SCHEMA_VERSION = 1;

/** Get raw string from localStorage by key. */
function _get(key) {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

/** Set raw string to localStorage by key. */
function _set(key, value) {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch (_) {
    return false;
  }
}

/** Remove key from localStorage. */
function _remove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (_) {
    return false;
  }
}

/** Safely parse JSON from localStorage. */
function _loadJSON(key, fallback) {
  const raw = _get(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    if (DEBUG) console.warn('JSON parse failed for', key, e);
    return fallback;
  }
}

/** Safely stringify JSON and store atomically. */
function _saveJSON(key, obj) {
  try {
    const payload = JSON.stringify(obj);
    return _set(key, payload);
  } catch (e) {
    if (DEBUG) console.warn('JSON save failed for', key, e);
    return false;
  }
}

/** Resolve collection key name. */
function _colKey(collectionName) {
  return `${COLLECTION_PREFIX}${collectionName}`;
}

/** Idempotent module initialization and schema versioning. */
function _ensureInitialized() {
  try {
    const verKey = `${LOGIC_PREFIX}SCHEMA_VERSION`;
    const current = _get(verKey);
    if (current === String(MODULE_SCHEMA_VERSION)) return;
    // Future migrations could go here based on Number(current) || 0
    _set(verKey, String(MODULE_SCHEMA_VERSION));
  } catch (_) {
    // swallow
  }
}

/** Load a collection array, returning [] if not found or invalid. */
function _readCollection(name) {
  return _loadJSON(_colKey(name), []) || [];
}

/** Write a full collection array atomically. */
function _writeCollection(name, arr) {
  return _saveJSON(_colKey(name), Array.isArray(arr) ? arr : []);
}

function _indexById(arr) {
  const map = new Map();
  for (const item of arr || []) {
    if (item && typeof item.id === 'string') map.set(item.id, item);
  }
  return map;
}

function _parseDateRange(startDate, endDate) {
  // Both startDate and endDate expected as 'YYYY-MM-DD' strings (from input[type="date"])
  let start = -Infinity;
  let end = Infinity;
  if (startDate) {
    const d = new Date(startDate);
    start = isNaN(d.getTime()) ? -Infinity : d.getTime();
  }
  if (endDate) {
    const d = new Date(endDate);
    const t = d.getTime();
    end = isNaN(t) ? Infinity : (t + 24 * 60 * 60 * 1000 - 1); // inclusive end of day
  }
  return [start, end];
}

function _buildCache() {
  const logs = _readCollection('logs');
  const units = _readCollection('units');
  const cropInstances = _readCollection('cropInstances');
  const areas = _readCollection('areas');
  const fields = _readCollection('fields');
  const taskTypes = _readCollection('taskTypes');
  const taskTemplates = _readCollection('taskTemplates');
  const taskOccurrences = _readCollection('taskOccurrences');
  const reasonCodes = _readCollection('reasonCodes');
  const photos = _readCollection('photos');

  return {
    arrays: {
      logs,
      units,
      cropInstances,
      areas,
      fields,
      taskTypes,
      taskTemplates,
      taskOccurrences,
      reasonCodes,
      photos,
    },
    maps: {
      units: _indexById(units),
      cropInstances: _indexById(cropInstances),
      areas: _indexById(areas),
      fields: _indexById(fields),
      taskTypes: _indexById(taskTypes),
      taskTemplates: _indexById(taskTemplates),
      taskOccurrences: _indexById(taskOccurrences),
      reasonCodes: _indexById(reasonCodes),
      photos: _indexById(photos),
    }
  };
}

function _getTaskTypeForLog(log, cache) {
  if (!log || !log.taskOccurrenceId) return null;
  const occ = cache.maps.taskOccurrences.get(log.taskOccurrenceId);
  if (!occ) return null;
  const tmpl = cache.maps.taskTemplates.get(occ.templateId);
  if (!tmpl) return null;
  const ttype = cache.maps.taskTypes.get(tmpl.taskTypeId);
  return ttype || null;
}

function _matchesFilters(log, filters, cache) {
  const f = filters || {};
  // Date range filter
  if (f.startDate || f.endDate) {
    const [start, end] = _parseDateRange(f.startDate, f.endDate);
    const ts = new Date(log.timestamp).getTime();
    if (isNaN(ts) || ts < start || ts > end) return false;
  }

  // Crop/area/field filters via relationships
  if (f.cropInstanceId) {
    if (log.cropInstanceId !== f.cropInstanceId) return false;
  }
  if (f.areaId) {
    const ci = cache.maps.cropInstances.get(log.cropInstanceId);
    if (!ci || ci.areaId !== f.areaId) return false;
  }
  if (f.fieldId) {
    const ci = cache.maps.cropInstances.get(log.cropInstanceId);
    if (!ci) return false;
    const area = cache.maps.areas.get(ci.areaId);
    if (!area || area.fieldId !== f.fieldId) return false;
  }
  if (f.taskTypeId) {
    const ttype = _getTaskTypeForLog(log, cache);
    if (!ttype || ttype.id !== f.taskTypeId) return false;
  }

  return true;
}

function _enrichLog(log, cache) {
  const unit = log.unitId ? cache.maps.units.get(log.unitId) : null;
  const ci = cache.maps.cropInstances.get(log.cropInstanceId);
  const area = ci ? cache.maps.areas.get(ci.areaId) : null;
  const field = area ? cache.maps.fields.get(area.fieldId) : null;
  const reason = log.skipReasonId ? cache.maps.reasonCodes.get(log.skipReasonId) : null;
  const ttype = _getTaskTypeForLog(log, cache);

  return {
    id: log.id,
    timestamp: log.timestamp,
    action: log.action,
    quantity: typeof log.quantity === 'number' ? log.quantity : null,
    unitSymbol: unit ? (unit.symbol || null) : null,
    cropName: ci ? (ci.name || '') : '',
    areaName: area ? (area.name || '') : '',
    fieldName: field ? (field.name || '') : '',
    taskTypeName: ttype ? (ttype.nameEn || '') : '',
    notes: log.notes || '',
    photoIds: Array.isArray(log.photoIds) ? log.photoIds.filter(Boolean) : [],
    skipReasonName: reason ? (reason.name || '') : null,
  };
}

function _convertToBase(value, unit) {
  if (typeof value !== 'number' || !unit) return 0;
  const factor = typeof unit.conversionFactorToBase === 'number' ? unit.conversionFactorToBase : 1;
  return value * factor;
}

function _round1(n) {
  return Math.round(n * 10) / 10;
}

/* ================
   Exported methods
   ================ */

/**
 * Retrieve filter options for the Logbook page.
 *
 * Reads local collections and returns minimal data for dropdowns:
 * - fields: [{id, name}]
 * - areas: [{id, name}]
 * - crops: [{id, name}] from cropInstances
 * - taskTypes: [{id, nameEn}]
 *
 * Returns an empty array for each if storage is missing.
 *
 * @returns {Promise<{ fields: Array<{id:string,name:string}>, areas: Array<{id:string,name:string}>, crops: Array<{id:string,name:string}>, taskTypes: Array<{id:string,nameEn:string}> }>}
 */
export async function getFilterOptions() {
  _ensureInitialized();

  const fields = _readCollection('fields').map((f) => ({ id: f.id, name: f.name }));
  const areas = _readCollection('areas').map((a) => ({ id: a.id, name: a.name }));
  const crops = _readCollection('cropInstances').map((c) => ({ id: c.id, name: c.name }));
  const taskTypes = _readCollection('taskTypes').map((t) => ({ id: t.id, nameEn: t.nameEn }));

  return { fields, areas, crops, taskTypes };
}

/**
 * Get logbook entries with filtering and pagination.
 *
 * Expected shape per log (enriched):
 * { id, timestamp, action, quantity, unitSymbol, cropName, areaName, fieldName, taskTypeName, notes, photoIds, skipReasonName }
 *
 * Sorting: newest first by timestamp.
 * Pagination: page (1-based), pageSize items per page.
 *
 * Edge cases:
 * - Missing collections are treated as empty arrays.
 * - Unknown references are tolerated; names default to '' or null symbols.
 *
 * @param {object} filters Filter object: { fieldId?, areaId?, cropInstanceId?, taskTypeId?, startDate?, endDate? }
 * @param {number} page 1-based page index
 * @param {number} pageSize number of items per page
 * @returns {Promise<{ logs: object[], totalCount: number }>}
 */
export async function getLogbookData(filters, page, pageSize) {
  _ensureInitialized();

  const cache = _buildCache();
  const allLogs = cache.arrays.logs || [];

  const filtered = allLogs.filter((log) => _matchesFilters(log, filters, cache));
  // Sort by timestamp desc
  filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Pagination
  const p = Math.max(1, Number(page) || 1);
  const size = Math.max(1, Number(pageSize) || 50);
  const startIdx = (p - 1) * size;
  const endIdx = startIdx + size;

  const pageSlice = filtered.slice(startIdx, endIdx);
  const enriched = pageSlice.map((log) => _enrichLog(log, cache));

  return {
    logs: enriched,
    totalCount: filtered.length
  };
}

/**
 * Calculate aggregated totals for the aggregation bar.
 *
 * Totals include:
 * - totalLogs: number of logs matching filters
 * - totalWaterL: sum of quantities for "watering" task type converted to liters (base volume)
 * - totalFertilizerKg: sum for "fertilize" task type converted to kilograms (base weight)
 * - totalHarvestKg: sum for "harvest" task type converted to kilograms (base weight)
 *
 * Notes:
 * - Conversion uses units.conversionFactorToBase toward the base unit for the unit type.
 * - Logs without quantity or unit are skipped from numeric totals.
 * - If a unit's type doesn't match the expected category (e.g., count), it is skipped.
 *
 * @param {object} filters Same shape as in getLogbookData
 * @returns {Promise<{ totalWaterL: number, totalFertilizerKg: number, totalHarvestKg: number, totalLogs: number }>}
 */
export async function calculateAggregatedTotals(filters) {
  _ensureInitialized();

  const cache = _buildCache();
  const allLogs = cache.arrays.logs || [];
  const unitsMap = cache.maps.units;

  let totalWaterL = 0;
  let totalFertilizerKg = 0;
  let totalHarvestKg = 0;

  const matching = allLogs.filter((log) => _matchesFilters(log, filters, cache));
  for (const log of matching) {
    if (typeof log.quantity !== 'number' || !log.unitId) continue;

    const unit = unitsMap.get(log.unitId);
    const ttype = _getTaskTypeForLog(log, cache);
    if (!ttype) continue;

    if (ttype.id === 'ttype-watering') {
      if (unit && unit.type === 'volume') {
        totalWaterL += _convertToBase(log.quantity, unit);
      }
    } else if (ttype.id === 'ttype-fertilize') {
      if (unit && unit.type === 'weight') {
        totalFertilizerKg += _convertToBase(log.quantity, unit);
      }
    } else if (ttype.id === 'ttype-harvest') {
      if (unit && unit.type === 'weight') {
        totalHarvestKg += _convertToBase(log.quantity, unit);
      }
    }
  }

  return {
    totalLogs: matching.length,
    totalWaterL: _round1(totalWaterL),
    totalFertilizerKg: _round1(totalFertilizerKg),
    totalHarvestKg: _round1(totalHarvestKg),
  };
}

/**
 * Prepare export data or a quick export summary depending on arguments.
 *
 * Dual-behavior contract (intended by call sites):
 * - If called as exportLogsData(filters) with only one argument:
 *   Returns a summary object: { logCount, estimatedSizeKB }
 * - If called as exportLogsData(filters, includePhotos):
 *   Returns the full export payload:
 *     {
 *       metadata: { exportedAt, logCount, filters },
 *       logs: [enriched logs...],
 *       photos?: [photo objects used by logs] // present only when includePhotos === true
 *     }
 *
 * Notes:
 * - Enriched logs follow the shape from getLogbookData.
 * - estimatedSizeKB is a best-effort estimate based on JSON string length of {metadata, logs} without photos.
 *
 * @param {object} filters Filter object used to select logs
 * @param {boolean} [includePhotos] When provided, triggers full export payload. If true, embeds photo documents referenced by selected logs.
 * @returns {Promise<{logCount:number, estimatedSizeKB:number} | {metadata: object, logs: object[], photos?: object[]}>}
 */
export async function exportLogsData(filters, includePhotos) {
  _ensureInitialized();

  const cache = _buildCache();
  const allLogs = cache.arrays.logs || [];
  const selected = allLogs.filter((log) => _matchesFilters(log, filters, cache));
  const enriched = selected.map((l) => _enrichLog(l, cache));

  if (typeof includePhotos === 'undefined') {
    // Summary mode
    const metadata = { exportedAt: new Date().toISOString(), logCount: enriched.length, filters: filters || {} };
    const estimateObj = { metadata, logs: enriched };
    const json = JSON.stringify(estimateObj);
    const estimatedSizeKB = json ? json.length / 1024 : 0;
    return { logCount: enriched.length, estimatedSizeKB };
  }

  // Full export
  const metadata = {
    exportedAt: new Date().toISOString(),
    logCount: enriched.length,
    filters: filters || {}
  };

  const result = { metadata, logs: enriched };

  if (includePhotos) {
    const uniquePhotoIds = new Set();
    for (const log of enriched) {
      for (const pid of log.photoIds || []) uniquePhotoIds.add(pid);
    }
    const photos = [];
    for (const pid of uniquePhotoIds) {
      const p = cache.maps.photos.get(pid);
      if (p) {
        photos.push({
          id: p.id,
          storageRef: p.storageRef,
          mimeType: p.mimeType || null,
          width: p.width || null,
          height: p.height || null,
          sizeBytes: p.sizeBytes || null,
          createdAt: p.createdAt || null
        });
      }
    }
    if (photos.length) {
      result.photos = photos;
    }
  }

  return result;
}

/**
 * Fetch a photo document by id.
 *
 * Returns the photo object from the "photos" collection or null if not found.
 * The object contains at least: { id, storageRef, mimeType, width, height, sizeBytes, createdAt }
 *
 * @param {string} photoId Photo id to retrieve
 * @returns {Promise<object|null>}
 */
export async function getPhotoById(photoId) {
  _ensureInitialized();

  if (!photoId) return null;
  const photos = _readCollection('photos');
  const photo = photos.find((p) => p && p.id === photoId) || null;
  return photo;
}

/**
 * Delete a photo by id and remove references from logs.photoIds.
 *
 * Atomicity:
 * - Writes the full updated photos collection in one setItem.
 * - Writes the full updated logs collection in one setItem.
 *
 * Edge cases:
 * - If photo does not exist, the function resolves true (idempotent).
 * - Any logs referencing the id will have it removed from their arrays.
 *
 * @param {string} photoId Photo id to delete
 * @returns {Promise<boolean>} true if operation completed (even if the photo didn't exist)
 */
export async function deletePhotoById(photoId) {
  _ensureInitialized();

  if (!photoId) return true;

  const photos = _readCollection('photos');
  const logs = _readCollection('logs');

  const newPhotos = photos.filter((p) => p && p.id !== photoId);
  const newLogs = logs.map((log) => {
    if (Array.isArray(log.photoIds) && log.photoIds.includes(photoId)) {
      const filtered = log.photoIds.filter((id) => id !== photoId);
      return { ...log, photoIds: filtered };
    }
    return log;
  });

  _writeCollection('photos', newPhotos);
  _writeCollection('logs', newLogs);

  return true;
}