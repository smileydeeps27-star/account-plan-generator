/* ===== Batch Runner =====
 * Unattended sequential account plan generation.
 * Pulls pending accounts from /api/batch-queue, calls AP.PlanGenerator.generate()
 * and AP.PlanExport.toDocx() in batch-mode (no downloads, server-saved),
 * then calls /api/update-trackers when the run finishes.
 *
 * Runs standalone on batch.html — no navigation, no plan viewer render.
 */

(function() {
  'use strict';

  // Suppress any accidental anchor.click() downloads from exporters.
  window.__suppressDownloads = true;

  // Monkey-patch HTMLAnchorElement.click() so older code paths that still try to
  // trigger a .docx download inside a batch don't open the Save As dialog.
  (function patchAnchorClick() {
    var origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function() {
      if (window.__suppressDownloads === true && this.hasAttribute('download')) {
        // Silently drop the click — file is already being saved via /api/save-docx.
        return;
      }
      return origClick.apply(this, arguments);
    };
  })();

  // ---------- State ----------
  var state = {
    running: false,
    stopRequested: false,
    queue: [],
    current: -1,
    done: 0,
    fail: 0,
    failures: [],
    totalPending: 0
  };

  // ---------- DOM refs ----------
  var $ = function(id) { return document.getElementById(id); };
  var log = $('batch-log');
  var tbody = document.querySelector('#queue-table tbody');

  // ---------- Logging ----------
  function append(line, cls) {
    var span = document.createElement('span');
    if (cls) span.className = cls;
    var t = new Date().toLocaleTimeString('en-US', { hour12: false });
    span.textContent = '[' + t + '] ' + line + '\n';
    log.appendChild(span);
    log.scrollTop = log.scrollHeight;
  }
  function info(m)  { append(m, 'log-info'); }
  function ok(m)    { append(m, 'log-ok'); }
  function warn(m)  { append(m, 'log-warn'); }
  function err(m)   { append(m, 'log-err'); }
  function dim(m)   { append(m, 'log-dim'); }

  // ---------- Stats ----------
  function setStats() {
    $('stat-pending').textContent = state.totalPending || '—';
    $('stat-batch').textContent   = state.queue.length || '—';
    $('stat-done').textContent    = state.done;
    $('stat-fail').textContent    = state.fail;
  }

  // ---------- Queue table ----------
  function renderQueue() {
    tbody.innerHTML = '';
    state.queue.forEach(function(a, i) {
      var tr = document.createElement('tr');
      tr.dataset.index = i;
      var status = a._status || 'pending';
      if (status === 'active') tr.classList.add('active');
      if (status === 'done')   tr.classList.add('done');
      if (status === 'fail')   tr.classList.add('fail');
      tr.innerHTML =
        '<td>' + (i + 1) + '</td>' +
        '<td><strong>' + esc(a.name) + '</strong></td>' +
        '<td>' + esc(a.cp) + '</td>' +
        '<td>' + esc(a.accountType) + '</td>' +
        '<td>' + esc(a.industry) + '</td>' +
        '<td>' + esc(a.revenue) + '</td>' +
        '<td><span class="status-pill status-' + status + '">' + status + '</span></td>';
      tbody.appendChild(tr);
    });
  }
  function esc(s) {
    if (s == null) return '';
    var div = document.createElement('div'); div.textContent = String(s); return div.innerHTML;
  }
  function updateRow(i, status, note) {
    state.queue[i]._status = status;
    var tr = tbody.querySelector('tr[data-index="' + i + '"]');
    if (!tr) return;
    tr.className = '';
    if (status === 'active') tr.classList.add('active');
    if (status === 'done')   tr.classList.add('done');
    if (status === 'fail')   tr.classList.add('fail');
    var pill = tr.querySelector('.status-pill');
    if (pill) {
      pill.className = 'status-pill status-' + status;
      pill.textContent = note ? (status + ' — ' + note) : status;
    }
  }

  // ---------- API calls ----------
  async function fetchQueue(size, cp, type) {
    var params = new URLSearchParams();
    params.set('size', String(size));
    if (cp)   params.set('cp', cp);
    if (type) params.set('type', type);
    var r = await fetch('/api/batch-queue?' + params.toString());
    if (!r.ok) throw new Error('batch-queue HTTP ' + r.status);
    var j = await r.json();
    if (j.error) throw new Error(j.error);
    return j;
  }

  async function runUpdateTrackers(batchNum) {
    info('Updating Batch Status Tracker + Executive Review Tracker (batch #' + batchNum + ')...');
    var r = await fetch('/api/update-trackers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchNum: batchNum })
    });
    var j = await r.json();
    if (j.stdout) j.stdout.trim().split('\n').forEach(function(l) { dim('  ' + l); });
    if (j.stderr) j.stderr.trim().split('\n').forEach(function(l) { if (l) warn('  ' + l); });
    if (!j.ok) throw new Error('update-trackers failed (exit ' + (j.code || '?') + ')');
    ok('Trackers updated.');
  }

  // ---------- Core loop ----------
  async function generateOne(idx) {
    var a = state.queue[idx];
    state.current = idx;
    updateRow(idx, 'active');
    info('(' + (idx + 1) + '/' + state.queue.length + ') ' + a.name + ' — ' + a.cp + ' · ' + a.accountType + ' · ' + a.industry + ' · ' + a.revenue);

    var userInputs = {
      dealStage: '',
      accountContext: '',
      suspectedCompetitors: '',
      goalsNext90Days: '',
      knownRisks: '',
      cpName: a.cp || '',           // triggers batch mode in plan-export.js
      accountType: a.accountType || ''
    };

    var t0 = Date.now();
    var plan;
    try {
      plan = await AP.PlanGenerator.generate(a.name, a.industry, a.revenue, userInputs);
    } catch (e) {
      throw new Error('generate: ' + e.message);
    }
    dim('    generated in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's — exporting...');

    try {
      await AP.PlanExport.toDocx(plan);
    } catch (e) {
      throw new Error('toDocx: ' + e.message);
    }

    var secs = ((Date.now() - t0) / 1000).toFixed(1);
    ok('    saved (' + secs + 's total)');
    updateRow(idx, 'done');
    state.done++;
    setStats();
  }

  async function startBatch() {
    if (state.running) return;

    var size    = parseInt($('batch-size').value, 10) || 10;
    var cp      = $('batch-cp').value.trim();
    var type    = $('batch-type').value;
    var autoTr  = $('batch-auto-trackers').checked;
    var batchNum = parseInt($('batch-num').value, 10) || 1;

    state = {
      running: true,
      stopRequested: false,
      queue: [],
      current: -1,
      done: 0,
      fail: 0,
      failures: [],
      totalPending: 0
    };
    log.innerHTML = '';
    info('Fetching next ' + size + ' pending accounts...');

    try {
      var q = await fetchQueue(size, cp, type);
      state.queue = (q.pending || []).map(function(a) { a._status = 'pending'; return a; });
      state.totalPending = q.totalPending || 0;
    } catch (e) {
      err('Queue fetch failed: ' + e.message);
      state.running = false;
      return;
    }

    if (state.queue.length === 0) {
      warn('Nothing pending matches the filters. Done.');
      state.running = false;
      return;
    }

    renderQueue();
    setStats();
    ok('Loaded ' + state.queue.length + ' accounts (of ' + state.totalPending + ' total pending). Starting...');

    $('btn-batch-start').disabled = true;
    $('btn-batch-stop').disabled = false;

    for (var i = 0; i < state.queue.length; i++) {
      if (state.stopRequested) {
        warn('Stop requested — halting after ' + state.done + ' completed.');
        break;
      }
      try {
        await withTimeout(generateOne(i), ACCOUNT_TIMEOUT_MS, state.queue[i].name);
      } catch (e) {
        err('    FAILED: ' + e.message);
        updateRow(i, 'fail', e.message.substring(0, 40));
        state.fail++;
        state.failures.push({ name: state.queue[i].name, error: e.message });
        setStats();
      }
      // Small breather between accounts so Gemini grounding quota has room.
      await sleep(500);
    }

    var summary = 'Batch finished — ' + state.done + ' ok, ' + state.fail + ' failed.';
    if (state.fail) warn(summary); else ok(summary);
    if (state.failures.length) {
      state.failures.forEach(function(f) { err('  • ' + f.name + ': ' + f.error); });
    }

    if (autoTr && state.done > 0) {
      try {
        await runUpdateTrackers(batchNum);
      } catch (e) {
        err('Tracker update failed: ' + e.message);
      }
    } else if (!autoTr) {
      dim('Tracker update skipped (checkbox off).');
    }

    $('btn-batch-start').disabled = false;
    $('btn-batch-stop').disabled = true;
    state.running = false;

    ok('All done. Safe to close tab.');
  }

  function stopBatch() {
    if (!state.running) return;
    state.stopRequested = true;
    warn('Stop requested — will halt after current account finishes.');
    $('btn-batch-stop').disabled = true;
  }

  async function previewQueue() {
    var size = parseInt($('batch-size').value, 10) || 10;
    var cp   = $('batch-cp').value.trim();
    var type = $('batch-type').value;
    info('Previewing next ' + size + ' pending accounts...');
    try {
      var q = await fetchQueue(size, cp, type);
      state.queue = (q.pending || []).map(function(a) { a._status = 'pending'; return a; });
      state.totalPending = q.totalPending || 0;
      renderQueue();
      setStats();
      ok('Preview loaded: ' + state.queue.length + ' accounts (of ' + state.totalPending + ' total pending).');
    } catch (e) {
      err('Preview failed: ' + e.message);
    }
  }

  // ---------- Helpers ----------
  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  // Wrap a promise with a timeout — rejects if it takes longer than ms.
  var ACCOUNT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes per account
  function withTimeout(promise, ms, label) {
    return new Promise(function(resolve, reject) {
      var timer = setTimeout(function() {
        reject(new Error('Timed out after ' + (ms / 1000) + 's: ' + label));
      }, ms);
      promise.then(
        function(v) { clearTimeout(timer); resolve(v); },
        function(e) { clearTimeout(timer); reject(e); }
      );
    });
  }

  // ---------- Progress from generator (drives a 1-line running status) ----------
  AP.EventBus.on('plan:progress', function(p) {
    if (!state.running || state.current < 0) return;
    var pct = Math.round((p.current / p.total) * 100);
    var tr = tbody.querySelector('tr[data-index="' + state.current + '"]');
    if (!tr) return;
    var pill = tr.querySelector('.status-pill');
    if (pill) pill.textContent = 'active ' + pct + '% · ' + (p.phase || '');
  });

  // ---------- Wire up ----------
  document.addEventListener('DOMContentLoaded', function() {
    AP.SellerProfile.load();
    if (AP.Methodology && AP.Methodology.load) AP.Methodology.load();
    if (AP.AeraContent && AP.AeraContent.load) AP.AeraContent.load();

    $('btn-batch-start').addEventListener('click', startBatch);
    $('btn-batch-stop').addEventListener('click', stopBatch);
    $('btn-batch-preview').addEventListener('click', previewQueue);

    // Preload pending count on open
    fetchQueue(0, '', '').then(function(q) {
      state.totalPending = q.totalPending || 0;
      setStats();
      dim('Ready. ' + state.totalPending + ' accounts currently pending in the tracker.');
    }).catch(function(e) {
      warn('Could not load pending count: ' + e.message);
    });
  });
})();
