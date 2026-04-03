/* ===== Account Plan Generator — Persistence ===== */

AP.PlanPersistence = (function() {

  var INDEX_KEY = AP.Config.LS_KEY_PLANS;

  function getIndex() {
    try {
      return JSON.parse(localStorage.getItem(INDEX_KEY)) || [];
    } catch (e) { return []; }
  }

  function saveIndex(idx) {
    localStorage.setItem(INDEX_KEY, JSON.stringify(idx));
  }

  function saveLocal(plan) {
    var key = 'ap_plan_' + AP.slugify(plan.companyName) + '_' + Date.now();
    localStorage.setItem(key, JSON.stringify(plan));

    var idx = getIndex();
    idx.unshift({ key: key, companyName: plan.companyName, generatedAt: plan.generatedAt });
    saveIndex(idx);
    return key;
  }

  function listLocal() {
    return getIndex();
  }

  function loadLocal(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch (e) { return null; }
  }

  function deleteLocal(key) {
    localStorage.removeItem(key);
    var idx = getIndex().filter(function(p) { return p.key !== key; });
    saveIndex(idx);
  }

  function downloadJSON(plan) {
    var blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = AP.slugify(plan.companyName) + '-account-plan.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var plan = JSON.parse(e.target.result);
          resolve(plan);
        } catch (err) {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.onerror = function() { reject(new Error('Failed to read file')); };
      reader.readAsText(file);
    });
  }

  return { saveLocal: saveLocal, listLocal: listLocal, loadLocal: loadLocal, deleteLocal: deleteLocal, downloadJSON: downloadJSON, importJSON: importJSON };
})();
