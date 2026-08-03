/* ===== Account Plan Generator — Stakeholder Scorer =====
 * Standalone batch-scoring workflow. CP pastes names + titles; AI scores each
 * as High/Medium/Low relevance with tier + confidence + rationale.
 * Session state kept in memory; loses ranking on refresh (by design — this is
 * a research tool, not persisted data).
 */

AP.StakeholderScorer = (function() {

  // Persistent-per-session state
  var state = {
    company: '',
    sector: '',
    rankedList: []   // { name, title, tier, functionArea, relevance, confidence, rationale, category }
  };

  var e = AP.escapeHTML;

  function parseBatchInput(raw) {
    var lines = raw.split(/\r?\n/);
    var entries = [];
    lines.forEach(function(line) {
      var trimmed = line.trim();
      if (!trimmed) return;
      // Split on em-dash, en-dash, pipe, or comma (in that priority order)
      var separators = ['—', '–', '|', ','];
      var parts = null;
      for (var i = 0; i < separators.length; i++) {
        var idx = trimmed.indexOf(separators[i]);
        if (idx > 0) {
          parts = [trimmed.substring(0, idx).trim(), trimmed.substring(idx + separators[i].length).trim()];
          break;
        }
      }
      if (!parts) parts = [trimmed, ''];
      if (parts[0]) entries.push({ name: parts[0], title: parts[1] });
    });
    return entries;
  }

  function buildScoringPrompt(entries) {
    var systemPrompt = 'You are a stakeholder relevance analyst for Aera Technology, a Decision Intelligence (DI) software vendor selling agentic decision automation into supply chain, planning, operations, and IT functions at large enterprises. Aera closes the "Execution Gap" between plan and reality — manual, fragmented, slow decision-making across ERP, planning, and OT/IT systems.\n\nReturn ONLY valid JSON — no markdown fences, no explanation outside the JSON.';

    var relevanceLens =
      'RELEVANCE LENS — score in this priority order:\n' +
      'Tier 1 (core decision-making): Supply Chain (Dir/VP/CXO/Head), S&OP/IBP, Demand Planning, Material Planning, Inventory, Logistics, Supply Chain Transformation.\n' +
      'Tier 2 (technology & data): IT (Dir/VP/CIO), Data & Analytics, AI/Digital, CDO / Head of Digital Transformation.\n' +
      'Tier 3 (execution & adjacent): Manufacturing/Plant Ops (Plant Dir, Manufacturing Excellence), Procurement/Sourcing, Continuous Improvement, Supply Chain Finance.\n\n' +
      'SENIORITY FILTER:\n' +
      '- Prioritise Director and above: Director, Sr Director, VP, SVP, CXO, Head of Department.\n' +
      '- Manager-level titles only relevant if labelled "Head of" or clear functional owner.\n' +
      '- Deprioritise pure individual contributors (Analyst, Specialist, Coordinator).\n\n' +
      'RELEVANCE CATEGORIES (a person is relevant if ANY apply):\n' +
      '1. Decision Owner — owns a structured/situational decision Aera improves\n' +
      '2. Technical Gatekeeper — controls systems Aera needs to integrate with\n' +
      '3. Transformation Sponsor — budget or mandate for digital/operational transformation\n' +
      '4. Pain-Bearer — function visibly hit by poor plan-to-execution alignment\n\n' +
      'CONFIDENCE LABELS:\n' +
      '- CONFIRMED: title + function unambiguous from the input\n' +
      '- INFERRED: reasonable read but title is ambiguous or company-specific naming makes function unclear\n' +
      '- UNVERIFIED: cannot tell — mark this rather than assuming\n\n' +
      'HARD RULE: never invent people, titles, or seniority beyond what is given. If title is genuinely unclear, mark UNVERIFIED — do not resolve confidently.';

    var currentTop = state.rankedList.slice(0, 20).map(function(p, i) {
      return (i + 1) + '. ' + p.name + ' — ' + p.title + ' [' + p.relevance + '/' + p.tier + '/' + p.confidence + ']';
    }).join('\n') || '(empty — this is the first batch)';

    var contextLine = 'Target Company: ' + state.company + (state.sector ? '\nSector: ' + state.sector : '');
    var entriesList = entries.map(function(e, i) {
      return (i + 1) + '. ' + e.name + (e.title ? ' — ' + e.title : ' — (title not provided)');
    }).join('\n');

    var userMessage = contextLine +
      '\n\n' + relevanceLens +
      '\n\nCURRENT RUNNING TOP-20 (context for deduplication and comparison):\n' + currentTop +
      '\n\nNEW BATCH TO SCORE:\n' + entriesList +
      '\n\nFor each person in the NEW BATCH, return a scored entry. Then return the FULL updated ranked list (up to 50, deduped by name+company, sorted High → Medium → Low → Excluded, then by tier 1 → 2 → 3).\n\n' +
      'Return JSON:\n' +
      '{\n' +
      '  "batchResults": [\n' +
      '    {\n' +
      '      "name": "Exact input name",\n' +
      '      "title": "Exact input title (or normalised if title was in the batch)",\n' +
      '      "tier": "Tier 1|Tier 2|Tier 3|Out-of-scope",\n' +
      '      "functionArea": "Specific function (e.g., S&OP, Digital Transformation, Plant Manufacturing)",\n' +
      '      "relevance": "High|Medium|Low|Excluded",\n' +
      '      "confidence": "CONFIRMED|INFERRED|UNVERIFIED",\n' +
      '      "category": "Decision Owner|Technical Gatekeeper|Transformation Sponsor|Pain-Bearer|Multiple|None",\n' +
      '      "rationale": "1 SHORT sentence — reference which of the 4 relevance categories applies and why"\n' +
      '    }\n' +
      '  ],\n' +
      '  "rankedList": [\n' +
      '    { same shape as batchResults — top 50 across ALL batches deduped }\n' +
      '  ],\n' +
      '  "swaps": [\n' +
      '    "1 SHORT sentence per swap: person X displaced by person Y (only include if new batch bumped someone out of the previous top 50)"\n' +
      '  ]\n' +
      '}\n\n' +
      'Excluded entries stay in the batchResults but do NOT count toward the top 50 in rankedList.';

    return { systemPrompt: systemPrompt, userMessage: userMessage };
  }

  async function scoreBatch(rawText) {
    var status = document.getElementById('scorer-status');
    if (status) status.textContent = 'Parsing input...';

    var entries = parseBatchInput(rawText);
    if (!entries.length) {
      if (status) status.textContent = 'No valid entries found. One name per line, format: "Name — Title".';
      return;
    }
    if (!state.company) {
      if (status) status.textContent = 'Please enter the target Company Name first.';
      return;
    }

    if (status) status.textContent = 'Scoring ' + entries.length + ' names against ' + state.company + '...';

    var prompt = buildScoringPrompt(entries);

    try {
      var r = await AP.ApiClient.call(prompt.systemPrompt, prompt.userMessage, { maxTokens: 8192, jsonMode: true });
      var parsed = tryParseJson(r.text);
      if (!parsed) {
        if (status) status.textContent = 'AI returned an unparseable response. Try a smaller batch or check console.';
        console.error('[Scorer] Unparseable response:', r.text.substring(0, 500));
        return;
      }

      // Update state
      if (parsed.rankedList && parsed.rankedList.length) {
        state.rankedList = parsed.rankedList.slice(0, 50);
      } else if (parsed.batchResults) {
        // Fallback: merge batchResults into existing rankedList manually
        mergeIntoRanking(parsed.batchResults);
      }

      renderRankedList();
      var swapsText = '';
      if (parsed.swaps && parsed.swaps.length) {
        swapsText = ' • Swaps: ' + parsed.swaps.length;
      }
      if (status) status.textContent = 'Scored ' + entries.length + ' names. Ranking now: ' + state.rankedList.length + ' candidates.' + swapsText;

      // Clear the batch input after successful scoring
      var input = document.getElementById('scorer-batch-input');
      if (input) input.value = '';
    } catch (err) {
      if (status) status.textContent = 'Error: ' + err.message;
      console.error('[Scorer] API error:', err);
    }
  }

  function tryParseJson(text) {
    if (!text) return null;
    var cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    try { return JSON.parse(cleaned); } catch (e) { /* fall through */ }
    // Extract JSON substring
    var start = cleaned.indexOf('{');
    var end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(cleaned.substring(start, end + 1)); } catch (e2) { /* give up */ }
    }
    return null;
  }

  function mergeIntoRanking(newResults) {
    // Merge by name (case-insensitive) — new entries win on conflict
    var byName = {};
    state.rankedList.forEach(function(p) { byName[(p.name || '').toLowerCase()] = p; });
    newResults.forEach(function(p) { byName[(p.name || '').toLowerCase()] = p; });

    var merged = Object.values(byName);
    // Sort: High → Medium → Low → Excluded, then Tier 1 → 2 → 3 → Out-of-scope
    var relevanceOrder = { 'High': 0, 'Medium': 1, 'Low': 2, 'Excluded': 3 };
    var tierOrder = { 'Tier 1': 0, 'Tier 2': 1, 'Tier 3': 2, 'Out-of-scope': 3 };
    merged.sort(function(a, b) {
      var rd = (relevanceOrder[a.relevance] || 4) - (relevanceOrder[b.relevance] || 4);
      if (rd !== 0) return rd;
      return (tierOrder[a.tier] || 4) - (tierOrder[b.tier] || 4);
    });
    state.rankedList = merged.filter(function(p) { return p.relevance !== 'Excluded'; }).slice(0, 50);
  }

  function renderRankedList() {
    var container = document.getElementById('scorer-ranked-list');
    var countEl = document.getElementById('scorer-rank-count');
    if (!container) return;

    if (countEl) countEl.textContent = '(' + state.rankedList.length + ' candidate' + (state.rankedList.length === 1 ? '' : 's') + ')';

    if (!state.rankedList.length) {
      container.innerHTML = '<p class="text-muted" style="font-size: 13px;">No candidates yet. Paste names above and click "Score Batch & Update Ranking".</p>';
      return;
    }

    var html = '<div class="scorer-list">';
    html += '<div class="scorer-list-header">';
    html += '<div class="scorer-col scorer-col-rank">#</div>';
    html += '<div class="scorer-col scorer-col-name">Name / Title</div>';
    html += '<div class="scorer-col scorer-col-tier">Tier / Function</div>';
    html += '<div class="scorer-col scorer-col-relevance">Relevance</div>';
    html += '<div class="scorer-col scorer-col-conf">Confidence</div>';
    html += '<div class="scorer-col scorer-col-rationale">Rationale</div>';
    html += '</div>';

    state.rankedList.forEach(function(p, i) {
      var relevanceClass = (p.relevance || '').toLowerCase();
      var confClass = (p.confidence || '').toLowerCase();

      html += '<div class="scorer-list-row scorer-relevance-' + relevanceClass + '">';
      html += '<div class="scorer-col scorer-col-rank">' + (i + 1) + '</div>';
      html += '<div class="scorer-col scorer-col-name">';
      html += '<div class="scorer-name">' + e(p.name || '') + '</div>';
      html += '<div class="scorer-title">' + e(p.title || '') + '</div>';
      html += '</div>';
      html += '<div class="scorer-col scorer-col-tier">';
      html += '<span class="scorer-tier-pill scorer-tier-' + (p.tier || '').toLowerCase().replace(/\s+/g, '-') + '">' + e(p.tier || '—') + '</span>';
      if (p.functionArea) html += '<div class="scorer-function">' + e(p.functionArea) + '</div>';
      html += '</div>';
      html += '<div class="scorer-col scorer-col-relevance"><span class="scorer-badge scorer-badge-' + relevanceClass + '">' + e(p.relevance || '—') + '</span></div>';
      html += '<div class="scorer-col scorer-col-conf"><span class="scorer-conf scorer-conf-' + confClass + '">' + e(p.confidence || '—') + '</span></div>';
      html += '<div class="scorer-col scorer-col-rationale">' + e(p.rationale || '') + (p.category && p.category !== 'None' ? '<div class="scorer-category">' + e(p.category) + '</div>' : '') + '</div>';
      html += '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
  }

  function reset() {
    state.rankedList = [];
    renderRankedList();
    var status = document.getElementById('scorer-status');
    if (status) status.textContent = 'Ranking cleared.';
  }

  function init() {
    // Company + sector inputs update state
    var companyInput = document.getElementById('scorer-company');
    var sectorInput = document.getElementById('scorer-sector');
    if (companyInput) {
      companyInput.addEventListener('input', function() { state.company = companyInput.value.trim(); });
    }
    if (sectorInput) {
      sectorInput.addEventListener('input', function() { state.sector = sectorInput.value.trim(); });
    }

    var scoreBtn = document.getElementById('btn-scorer-score');
    if (scoreBtn) {
      scoreBtn.addEventListener('click', function() {
        var input = document.getElementById('scorer-batch-input');
        if (input) scoreBatch(input.value);
      });
    }

    var clearBtn = document.getElementById('btn-scorer-clear-batch');
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        var input = document.getElementById('scorer-batch-input');
        if (input) input.value = '';
      });
    }

    var resetBtn = document.getElementById('btn-scorer-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', reset);
    }

    var homeBtn = document.getElementById('btn-scorer-home');
    if (homeBtn) {
      homeBtn.addEventListener('click', function() { AP.navigateTo('home'); });
    }

    // Initial empty render
    renderRankedList();
  }

  return {
    init: init,
    scoreBatch: scoreBatch,
    reset: reset,
    _state: state    // for debugging
  };
})();
