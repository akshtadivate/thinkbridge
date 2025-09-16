/**
 * Local Storage Dummy Data Initializer
 *
 * - Writes the provided dummy dataset into localStorage, one key per collection.
 * - Safe to re-run: will skip if same DATA_VERSION already initialized.
 * - If DATA_VERSION changes, it will overwrite existing collections with the new seed.
 *
 * Storage key pattern used: "localDB:<collectionName>"
 * Additional flags:
 *   - appInitialized: "true" | "false"
 *   - appDataVersion: string
 *   - appInitializedAt: ISO string
 *
 * Call AppData.init() to run.
 */

const AppData = (function () {
  // DATA_VERSION: use today's date (2025-09-15) with a version suffix.
  // Update this string when you intentionally change or refresh the seed data.
  const DATA_VERSION = "2025-09-15-v0";

  // The complete dummy dataset (from input).
  const DUMMY_DATA = {
    "users":[{"id":"u-001","uid":"user-uid-1","firstName":"Kumar","lastName":"R","role":"farmer","email":"kumar@example.invalid","createdAt":"2024-11-02T06:30:00Z","updatedAt":"2025-09-14T12:00:00Z","settingsId":"s-001"},{"id":"u-002","uid":"user-uid-2","firstName":"Meena","lastName":"S","role":"farmer","email":"meena@example.invalid","createdAt":"2025-01-15T09:10:00Z","updatedAt":"2025-09-10T08:45:00Z","settingsId":"s-002"},{"id":"u-010","uid":"user-uid-admin","firstName":"Admin","lastName":"User","role":"admin","email":"admin@example.invalid","createdAt":"2023-07-01T00:00:00Z","updatedAt":"2025-09-01T07:00:00Z","settingsId":"s-010"}],
    "settings":[{"id":"s-001","userId":"user-uid-1","language":"TA","notificationsEnabled":true,"backupEnabled":true,"notificationPermission":"granted","weekStart":"MON","lastSync":"2025-09-14T11:50:00Z","createdAt":"2024-11-02T06:30:00Z","updatedAt":"2025-09-14T11:50:00Z"},{"id":"s-002","userId":"user-uid-2","language":"EN","notificationsEnabled":false,"backupEnabled":false,"notificationPermission":"default","weekStart":"SUN","lastSync":null,"createdAt":"2025-01-15T09:10:00Z","updatedAt":"2025-09-10T08:45:00Z"},{"id":"s-010","userId":"user-uid-admin","language":"EN","notificationsEnabled":true,"backupEnabled":true,"notificationPermission":"granted","weekStart":"MON","lastSync":"2025-09-14T09:30:00Z","createdAt":"2023-07-01T00:00:00Z","updatedAt":"2025-09-14T09:30:00Z"}],
    "fields":[{"id":"f-100","userId":"user-uid-1","name":"North Plot","size":1200.5,"sizeUnit":"m2","notes":"Main vegetable patch near well.","createdAt":"2024-11-02T06:45:00Z","updatedAt":"2025-09-12T10:00:00Z"},{"id":"f-101","userId":"user-uid-1","name":"Coconut Grove","size":5000,"sizeUnit":"m2","notes":"Older coconut trees, partially intercropped.","createdAt":"2024-12-01T07:10:00Z","updatedAt":"2025-08-20T09:20:00Z"},{"id":"f-200","userId":"user-uid-2","name":"Back Garden","size":300,"sizeUnit":"m2","notes":"Home garden, tomatoes and herbs.","createdAt":"2025-01-15T09:20:00Z","updatedAt":"2025-09-11T07:55:00Z"}],
    "areaTypes":[{"id":"atype-bed","name":"Bed","description":"Raised bed for vegetables and herbs."},{"id":"atype-row","name":"Row","description":"Linear planting row."},{"id":"atype-block","name":"Block","description":"Larger block area for dense planting."},{"id":"atype-grove","name":"Grove","description":"Group of trees (orchard / grove)."},{"id":"atype-corner","name":"Corner","description":"Small corner plot or experimental patch."}],
    "areas":[{"id":"a-1001","fieldId":"f-100","userId":"user-uid-1","name":"Tomato Bed A","typeId":"atype-bed","size":60,"sizeUnit":"m2","notes":"Tomatoes planted Jan 2025; drip line present.","createdAt":"2025-01-20T05:00:00Z","updatedAt":"2025-09-12T10:00:00Z"},{"id":"a-1002","fieldId":"f-101","userId":"user-uid-1","name":"Coconut Sector South","typeId":"atype-grove","size":2000,"sizeUnit":"m2","notes":"Older trees with banana intercropping.","createdAt":"2024-12-02T07:20:00Z","updatedAt":"2025-08-20T09:20:00Z"},{"id":"a-2001","fieldId":"f-200","userId":"user-uid-2","name":"Herb & Tomato Corner","typeId":"atype-corner","size":40,"sizeUnit":"m2","notes":"Small family plot.","createdAt":"2025-01-16T09:25:00Z","updatedAt":"2025-09-11T07:55:00Z"}],
    "libraryCrops":[{"id":"lc-tomato-v1","cropId":"crop-tomato","nameEn":"Tomato","nameTa":"தக்காளி","category":"vegetable","daysToMaturity":90,"stageDefinitions":[{"stageNameEn":"Seedling","stageNameTa":"மரக்கிளைகள்","minDays":0,"maxDays":21},{"stageNameEn":"Vegetative","stageNameTa":"வளர்ச்சி","minDays":22,"maxDays":50},{"stageNameEn":"Flowering & Fruit","stageNameTa":"புஷ்பித்து மற்றும் பழம் மார்பும் மர்மப்பழம்கள்","minDays":51,"maxDays":90}],"spacingReference":"30-45 cm between plants, 75 cm between rows.","defaultCareTemplateId":"tt-watering-1","typicalPests":"aphids, whitefly, tomato fruit borer","typicalNutrients":"NPK, calcium","version":"1.0","createdAt":"2024-06-01T00:00:00Z","updatedAt":"2024-06-01T00:00:00Z"},{"id":"lc-coconut-v1","cropId":"crop-coconut","nameEn":"Coconut","nameTa":"தேங்காய์","category":"tree","daysToMaturity":null,"stageDefinitions":[{"stageNameEn":"Young","stageNameTa":"இளம்","minDays":0,"maxDays":365},{"stageNameEn":"Maturing","stageNameTa":"பெரிதாக்றதாக்கம்","minDays":366,"maxDays":3650}],"spacingReference":"7-10 m spacing recommended.","defaultCareTemplateId":"tt-fertilize-1","typicalPests":"red palm weevil, rhinoceros beetle","typicalNutrients":"potassium, magnesium","version":"1.1","createdAt":"2023-04-15T00:00:00Z","updatedAt":"2024-08-01T00:00:00Z"},{"id":"lc-banana-v1","cropId":"crop-banana","nameEn":"Banana","nameTa":"வாழைப்பழம்","category":"fruit","daysToMaturity":400,"stageDefinitions":[{"stageNameEn":"Vegetative","stageNameTa":"வளர்ச்சி","minDays":0,"maxDays":200},{"stageNameEn":"Bunch Formation","stageNameTa":"குழு உருவாக்கம்","minDays":201,"maxDays":400}],"spacingReference":"2-3 m between plants.","defaultCareTemplateId":"tt-harvest-1","typicalPests":"banana weevil, nematodes, bunchy top","typicalNutrients":"N, K, micronutrients","version":"1.0","createdAt":"2023-05-20T00:00:00Z","updatedAt":"2023-05-20T00:00:00Z"}],
    "taskTypes":[{"id":"ttype-watering","nameEn":"Watering","nameTa":"நீர் ஊற்றுதல்","defaultUnitId":"u-L","icon":"water-drop","defaultRecurrenceType":"floating","typicalIntervals":[{"intervalDays":3}],"requiresQuantity":false,"createdAt":"2023-06-01T00:00:00Z","updatedAt":"2024-10-10T00:00:00Z"},{"id":"ttype-fertilize","nameEn":"Fertilize","nameTa":"உயர்த்துநீர்/போஷணங்கள்","defaultUnitId":"u-kg","icon":"fertilizer","defaultRecurrenceType":"fixed","typicalIntervals":[{"intervalDays":30}],"requiresQuantity":true,"createdAt":"2023-06-01T00:00:00Z","updatedAt":"2024-10-10T00:00:00Z"},{"id":"ttype-harvest","nameEn":"Harvest","nameTa":"பழம் அறிதல்","defaultUnitId":"u-kg","icon":"harvest","defaultRecurrenceType":"floating","typicalIntervals":[{"intervalDays":0}],"requiresQuantity":true,"createdAt":"2023-06-01T00:00:00Z","updatedAt":"2024-10-10T00:00:00Z"}],
    "units":[{"id":"u-L","symbol":"L","name":"litre","type":"volume","conversionFactorToBase":1,"baseUnitId":"u-L"},{"id":"u-ml","symbol":"ml","name":"millilitre","type":"volume","conversionFactorToBase":0.001,"baseUnitId":"u-L"},{"id":"u-kg","symbol":"kg","name":"kilogram","type":"weight","conversionFactorToBase":1,"baseUnitId":"u-kg"},{"id":"u-g","symbol":"g","name":"gram","type":"weight","conversionFactorToBase":0.001,"baseUnitId":"u-kg"},{"id":"u-pc","symbol":"pc","name":"pieces","type":"count","conversionFactorToBase":1,"baseUnitId":"u-pc"}],
    "recurrencePatterns":[{"id":"rp-everyNDays","description":"Every N days","patternType":"everyNDays","paramsSchema":"{\"n\":3}","defaultSnoozeDays":1},{"id":"rp-weeklyDOW","description":"Weekly on specific days of week","patternType":"weeklyOnDow","paramsSchema":"{\"days\":[\"MON\",\"THU\"]}","defaultSnoozeDays":1},{"id":"rp-monthlyDay","description":"Monthly on day N","patternType":"monthlyOnDay","paramsSchema":"{\"day\":15}","defaultSnoozeDays":2}],
    "statusCodes":[{"id":"status-planned","name":"planned","description":"Task planned for future","priority":1},{"id":"status-due","name":"due","description":"Task due today","priority":4},{"id":"status-overdue","name":"overdue","description":"Task overdue","priority":5},{"id":"status-completed","name":"completed","description":"Task completed","priority":2},{"id":"status-skipped","name":"skipped","description":"Task skipped","priority":1},{"id":"status-snoozed","name":"snoozed","description":"Task snoozed","priority":3}],
    "reasonCodes":[{"id":"reason-rain","name":"rain","description":"Skipped due to rain"},{"id":"reason-no-resources","name":"no_resources","description":"Skipped due to lack of resources"},{"id":"reason-pest-low","name":"pest_pressure_low","description":"Skipped because pest pressure low"},{"id":"reason-other","name":"other","description":"Other/unspecified"}],
    "photoPresets":[{"id":"pp-default-1280","maxDimension":1280,"quality":80,"storageKey":"local:photos/1280"},{"id":"pp-thumb-300","maxDimension":300,"quality":60,"storageKey":"local:photos/thumb"},{"id":"pp-low-800","maxDimension":800,"quality":70,"storageKey":"local:photos/800"}],
    "harvestUnits":[{"id":"h-kg","name":"kilogram","symbol":"kg","defaultForCategory":"vegetable"},{"id":"h-g","name":"gram","symbol":"g","defaultForCategory":"flower"},{"id":"h-pc","name":"pieces","symbol":"pc","defaultForCategory":"fruit"}],
    "cropInstances":[{"id":"ci-9001","userId":"user-uid-1","areaId":"a-1001","libraryCropId":"lc-tomato-v1","custom":false,"name":"Tomato - Bed A (Batch Jan 2025)","startDate":"2025-01-15T00:00:00Z","appliedTemplateVersion":"1.0","overrides":[{"key":"defaultIntervalDays","value":"4"}],"daysToMaturity":90,"stage":"Vegetative","notes":"Drip irrigation, pruning weekly.","createdAt":"2025-01-15T09:00:00Z","updatedAt":"2025-09-10T08:00:00Z"},{"id":"ci-9002","userId":"user-uid-1","areaId":"a-1002","libraryCropId":"lc-coconut-v1","custom":false,"name":"Coconut - South Sector","startDate":"2018-06-01T00:00:00Z","appliedTemplateVersion":"1.1","overrides":[],"daysToMaturity":null,"stage":"Maturing","notes":"Intercropped with a few banana plants.","createdAt":"2018-06-01T00:00:00Z","updatedAt":"2025-08-20T09:20:00Z"},{"id":"ci-2001","userId":"user-uid-2","areaId":"a-2001","libraryCropId":"lc-banana-v1","custom":false,"name":"Banana - Family Row","startDate":"2024-03-01T00:00:00Z","appliedTemplateVersion":"1.0","overrides":[{"key":"daysToMaturity","value":"380"}],"daysToMaturity":380,"stage":"Bunch Formation","notes":"Regular mulch and potassium application.","createdAt":"2024-03-01T00:00:00Z","updatedAt":"2025-09-11T07:50:00Z"}],
    "taskTemplates":[{"id":"tt-watering-1","name":"Standard Watering","taskTypeId":"ttype-watering","defaultUnitId":"u-L","recurrencePatternId":"rp-everyNDays","defaultIntervalDays":3,"requiresQuantity":false,"recommendedQuantity":5,"notes":"Water early morning; adjust after rain.","icon":"water-drop","version":"1.0","createdAt":"2023-06-01T00:00:00Z","updatedAt":"2024-06-01T00:00:00Z"},{"id":"tt-fertilize-1","name":"Monthly Fertilizer","taskTypeId":"ttype-fertilize","defaultUnitId":"u-kg","recurrencePatternId":"rp-monthlyDay","defaultIntervalDays":30,"requiresQuantity":true,"recommendedQuantity":0.5,"notes":"Apply NPK around root zone.","icon":"fertilizer","version":"1.1","createdAt":"2023-04-01T00:00:00Z","updatedAt":"2024-08-01T00:00:00Z"},{"id":"tt-harvest-1","name":"Harvest Check","taskTypeId":"ttype-harvest","defaultUnitId":"u-kg","recurrencePatternId":"rp-everyNDays","defaultIntervalDays":0,"requiresQuantity":true,"recommendedQuantity":null,"notes":"Record weight/pieces; photo recommended.","icon":"harvest","version":"1.0","createdAt":"2023-05-15T00:00:00Z","updatedAt":"2023-05-15T00:00:00Z"}],
    "taskOccurrences":[{"id":"to-3001","userId":"user-uid-1","cropInstanceId":"ci-9001","templateId":"tt-watering-1","dueDate":"2025-09-15T00:00:00Z","scheduledDate":"2025-09-15T00:00:00Z","statusId":"status-due","dueWindow":"Today","recurrenceType":"floating","isFloating":true,"snoozeUntil":null,"lastCompletedAt":"2025-09-11T04:00:00Z","nextDue":"2025-09-15T00:00:00Z","priority":4,"createdAt":"2025-01-15T09:05:00Z","updatedAt":"2025-09-14T10:00:00Z"},{"id":"to-3002","userId":"user-uid-1","cropInstanceId":"ci-9001","templateId":"tt-fertilize-1","dueDate":"2025-09-10T00:00:00Z","scheduledDate":"2025-09-10T00:00:00Z","statusId":"status-overdue","dueWindow":"ThisWeek","recurrenceType":"fixed","isFloating":false,"snoozeUntil":null,"lastCompletedAt":"2025-08-10T07:00:00Z","nextDue":"2025-09-10T00:00:00Z","priority":5,"createdAt":"2025-01-15T09:07:00Z","updatedAt":"2025-09-10T08:00:00Z"},{"id":"to-3003","userId":"user-uid-1","cropInstanceId":"ci-9002","templateId":"tt-fertilize-1","dueDate":"2025-09-20T00:00:00Z","scheduledDate":"2025-09-20T00:00:00Z","statusId":"status-planned","dueWindow":"ThisWeek","recurrenceType":"fixed","isFloating":false,"snoozeUntil":null,"lastCompletedAt":"2025-08-01T06:00:00Z","nextDue":"2025-09-20T00:00:00Z","priority":1,"createdAt":"2018-06-01T00:00:00Z","updatedAt":"2025-08-20T09:20:00Z"},{"id":"to-4001","userId":"user-uid-2","cropInstanceId":"ci-2001","templateId":"tt-watering-1","dueDate":"2025-09-14T00:00:00Z","scheduledDate":"2025-09-14T00:00:00Z","statusId":"status-overdue","dueWindow":"Today","recurrenceType":"floating","isFloating":true,"snoozeUntil":"2025-09-15T00:00:00Z","lastCompletedAt":"2025-09-10T05:00:00Z","nextDue":"2025-09-15T00:00:00Z","priority":5,"createdAt":"2024-03-01T00:05:00Z","updatedAt":"2025-09-14T07:40:00Z"},{"id":"to-4002","userId":"user-uid-2","cropInstanceId":"ci-2001","templateId":"tt-harvest-1","dueDate":"2025-09-18T00:00:00Z","scheduledDate":"2025-09-18T00:00:00Z","statusId":"status-planned","dueWindow":"ThisWeek","recurrenceType":"floating","isFloating":true,"snoozeUntil":null,"lastCompletedAt":null,"nextDue":"2025-09-18T00:00:00Z","priority":2,"createdAt":"2024-03-01T00:10:00Z","updatedAt":"2025-09-11T07:50:00Z"}],
    "logs":[{"id":"log-7001","userId":"user-uid-1","taskOccurrenceId":"to-3001","cropInstanceId":"ci-9001","action":"completed","timestamp":"2025-09-11T04:00:00Z","quantity":5,"unitId":"u-L","notes":"Watered early; soil moist below 5cm.","photoIds":["p-501"],"skipReasonId":null,"createdAt":"2025-09-11T04:02:00Z","updatedAt":"2025-09-11T04:02:00Z"},{"id":"log-7002","userId":"user-uid-1","taskOccurrenceId":"to-3002","cropInstanceId":"ci-9001","action":"skipped","timestamp":"2025-09-10T08:15:00Z","quantity":null,"unitId":null,"notes":"Fertilizer out of stock; will reschedule.","photoIds":[],"skipReasonId":"reason-no-resources","createdAt":"2025-09-10T08:16:00Z","updatedAt":"2025-09-10T08:16:00Z"},{"id":"log-8001","userId":"user-uid-2","taskOccurrenceId":"to-4001","cropInstanceId":"ci-2001","action":"snoozed","timestamp":"2025-09-14T07:45:00Z","quantity":null,"unitId":null,"notes":"Left for tomorrow due to busy schedule.","photoIds":[],"skipReasonId":null,"createdAt":"2025-09-14T07:45:00Z","updatedAt":"2025-09-14T07:45:00Z"}],
    "photos":[{"id":"p-501","ownerId":"user-uid-1","mimeType":"image/jpeg","width":1280,"height":720,"storageRef":"https://images.unsplash.com/photo-1501004318641-b39e6451bec6","presetId":"pp-default-1280","sizeBytes":142300,"createdAt":"2025-09-11T04:01:00Z"},{"id":"p-502","ownerId":"user-uid-1","mimeType":"image/jpeg","width":800,"height":600,"storageRef":"https://images.unsplash.com/photo-1495020689067-958852a7765e","presetId":"pp-low-800","sizeBytes":85240,"createdAt":"2025-08-30T06:00:00Z"},{"id":"p-601","ownerId":"user-uid-2","mimeType":"image/jpeg","width":1280,"height":960,"storageRef":"https://images.unsplash.com/photo-1447175008436-054170c2e979","presetId":"pp-default-1280","sizeBytes":167800,"createdAt":"2025-09-10T05:05:00Z"}],
    "notes":[{"id":"n-9001","userId":"user-uid-1","type":"weather","weatherEventId":"we-1001","cropInstanceId":null,"areaId":"a-1001","date":"2025-09-15T00:00:00Z","content":"Light rain in the morning; soil wet on surface.","createdAt":"2025-09-15T05:30:00Z","updatedAt":"2025-09-15T05:30:00Z"},{"id":"n-9002","userId":"user-uid-2","type":"general","weatherEventId":null,"cropInstanceId":"ci-2001","areaId":"a-2001","date":"2025-09-12T00:00:00Z","content":"Observed banana bunch starting to form; added mulch.","createdAt":"2025-09-12T07:00:00Z","updatedAt":"2025-09-12T07:00:00Z"},{"id":"n-9003","userId":"user-uid-1","type":"general","weatherEventId":null,"cropInstanceId":"ci-9002","areaId":"a-1002","date":"2025-08-20T00:00:00Z","content":"Applied potassium in August; monitor for new fronds.","createdAt":"2025-08-20T09:21:00Z","updatedAt":"2025-08-20T09:21:00Z"}],
    "weatherEvents":[{"id":"we-1001","userId":"user-uid-1","weatherEventType":"rain","severity":"light","amount":4.5,"date":"2025-09-15T00:00:00Z","notes":"Short shower ~4.5 mm measured near well.","createdAt":"2025-09-15T05:25:00Z"},{"id":"we-1002","userId":"user-uid-2","weatherEventType":"heavyRain","severity":"heavy","amount":25,"date":"2025-08-10T00:00:00Z","notes":"Heavy rains; check drainage.","createdAt":"2025-08-10T06:00:00Z"},{"id":"we-1003","userId":"user-uid-admin","weatherEventType":"drought","severity":"moderate","amount":null,"date":"2025-06-01T00:00:00Z","notes":"Regional note: low rains in May.","createdAt":"2025-06-02T00:00:00Z"}],
    "i18nBundles":[{"id":"i18n-en-v1","locale":"EN","version":"1.0","entries":[{"key":"today_work","value":"Today's Work","context":"UI"},{"key":"my_fields","value":"My Fields","context":"UI"},{"key":"water","value":"Water","context":"TaskType"}],"cachedAt":"2025-09-14T12:00:00Z"},{"id":"i18n-ta-v1","locale":"TA","version":"1.0","entries":[{"key":"today_work","value":"இன்றைய வேலை","context":"UI"},{"key":"my_fields","value":"எனது நிலங்கள்","context":"UI"},{"key":"water","value":"நீர் ஊற்றுதல்","context":"TaskType"}],"cachedAt":"2025-09-14T11:55:00Z"},{"id":"i18n-en-v1-lib","locale":"EN","version":"1.0-lib","entries":[{"key":"crop_tomato_desc","value":"Tomato: fast-growing vegetable, requires regular watering.","context":"Library"},{"key":"crop_coconut_desc","value":"Coconut: perennial tree, spaced widely.","context":"Library"}],"cachedAt":"2024-06-01T00:00:00Z"}],
    "uiState":[{"id":"ui-001","userId":"user-uid-1","lastSelectedTab":"Today","filters":[{"key":"fieldId","value":"f-100"},{"key":"statusId","value":"status-due"}],"calendarViewMode":"week","lastOpenedEntityIds":[{"value":"ci-9001"}],"createdAt":"2025-01-15T09:05:00Z","updatedAt":"2025-09-14T11:58:00Z"},{"id":"ui-002","userId":"user-uid-2","lastSelectedTab":"Calendar","filters":[],"calendarViewMode":"month","lastOpenedEntityIds":[{"value":"a-2001"}],"createdAt":"2025-01-16T09:26:00Z","updatedAt":"2025-09-11T07:55:00Z"},{"id":"ui-010","userId":"user-uid-admin","lastSelectedTab":"Settings","filters":[],"calendarViewMode":"week","lastOpenedEntityIds":[],"createdAt":"2023-07-01T00:05:00Z","updatedAt":"2025-09-01T07:05:00Z"}],
    "syncQueue":[{"id":"sq-001","userId":"user-uid-1","entityType":"logs","entityId":"log-7001","operation":"create","payload":"{\"id\":\"log-7001\",\"action\":\"completed\"}","createdAt":"2025-09-11T04:03:00Z","lastAttemptAt":"2025-09-14T11:49:00Z","retries":1,"status":"synced"},{"id":"sq-002","userId":"user-uid-1","entityType":"taskOccurrences","entityId":"to-3001","operation":"update","payload":"{\"id\":\"to-3001\",\"statusId\":\"status-due\"}","createdAt":"2025-09-14T10:01:00Z","lastAttemptAt":null,"retries":0,"status":"pending"},{"id":"sq-003","userId":"user-uid-2","entityType":"photos","entityId":"p-601","operation":"create","payload":"{\"id\":\"p-601\",\"ownerId\":\"user-uid-2\"}","createdAt":"2025-09-10T05:06:00Z","lastAttemptAt":"2025-09-10T06:00:00Z","retries":2,"status":"failed"}],
    "seqCounters":[{"id":"seq-log","userId":"user-uid-1","seqName":"logSeq","value":7002},{"id":"seq-task","userId":"user-uid-1","seqName":"taskSeq","value":3003},{"id":"seq-photo","userId":"user-uid-2","seqName":"photoSeq","value":601}]
  };

  // prefix used for collection keys in localStorage
  const KEY_PREFIX = "localDB:";

  // Utility: get localStorage key for a collection
  function keyForCollection(collectionName) {
    return `${KEY_PREFIX}${collectionName}`;
  }

  // Write a single collection to localStorage
  function writeCollection(collectionName, items) {
    try {
      const key = keyForCollection(collectionName);
      localStorage.setItem(key, JSON.stringify(items));
      return { key, count: Array.isArray(items) ? items.length : 0 };
    } catch (err) {
      console.error("Failed to write collection", collectionName, err);
      return { key: keyForCollection(collectionName), count: 0, error: String(err) };
    }
  }

  // Public initializer
  function init() {
    try {
      const prevVersion = localStorage.getItem("appDataVersion");
      const initializedFlag = localStorage.getItem("appInitialized");

      if (initializedFlag === "true" && prevVersion === DATA_VERSION) {
        console.info("App data already initialized for version", DATA_VERSION);
        return;
      }

      console.info("Initializing app data (version:", DATA_VERSION, ")");

      // If version mismatch or not initialized, (re)seed all collections.
      const results = [];
      for (const collectionName of Object.keys(DUMMY_DATA)) {
        const items = DUMMY_DATA[collectionName];
        const res = writeCollection(collectionName, items);
        results.push({ collection: collectionName, ...res });
      }

      // Save metadata flags
      localStorage.setItem("appDataVersion", DATA_VERSION);
      localStorage.setItem("appInitialized", "true");
      localStorage.setItem("appInitializedAt", new Date().toISOString());

      console.info("Seed results:");
      results.forEach(r => {
        if (r.error) {
          console.warn(` - ${r.collection}: error -> ${r.error}`);
        } else {
          console.info(` - ${r.collection}: wrote ${r.count} items to "${r.key}"`);
        }
      });

      // Provide a small sanity-check: list primary users and one photo URL if present.
      try {
        const users = DUMMY_DATA.users || [];
        const photos = DUMMY_DATA.photos || [];
        console.info("Primary users:", users.map(u => ({ id: u.id, uid: u.uid, name: `${u.firstName} ${u.lastName}` })));
        if (photos.length) {
          console.info("Example photo stored (direct URL):", photos[0].storageRef);
        }
      } catch (err) {
        // non-fatal
      }

      console.info("Local storage initialization complete.");
    } catch (err) {
      console.error("AppData.init error:", err);
    }
  }

  // Expose only init
  return { init };
})();

// Run initializer immediately
AppData.init();