/* ===== Account Plan Generator — AI Orchestrator (7 Calls) ===== */

AP.PlanGenerator = (function() {

  // ===== JSON Repair Utilities =====

  function repairJSON(text) {
    var result = '';
    var inString = false;
    var escaped = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (escaped) { result += ch; escaped = false; continue; }
      if (ch === '\\') { result += ch; escaped = true; continue; }
      if (ch === '"') { inString = !inString; result += ch; continue; }
      if (inString) {
        if (ch === '\n') { result += '\\n'; continue; }
        if (ch === '\r') { continue; }
        if (ch === '\t') { result += '\\t'; continue; }
      }
      result += ch;
    }
    result = result.replace(/,\s*([}\]])/g, '$1');
    return result;
  }

  function extractJSON(text) {
    var start = text.indexOf('{');
    if (start === -1) return null;
    var depth = 0, inStr = false, esc = false;
    for (var i = start; i < text.length; i++) {
      var ch = text[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) return text.substring(start, i + 1); }
    }
    return text.substring(start);
  }

  function parseJSON(text) {
    if (!text) return null;
    var cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    try { return JSON.parse(cleaned); } catch (e) { /* continue */ }

    var jsonStr = extractJSON(cleaned);
    if (!jsonStr) return null;
    try { return JSON.parse(jsonStr); } catch (e2) { /* continue */ }

    var repaired = repairJSON(jsonStr);
    var lastError = null;
    try { return JSON.parse(repaired); } catch (e3) {
      lastError = e3;
      console.error('[PlanGen] Parse failed after repair:', e3.message);
    }

    if (lastError) {
      try {
        var posMatch = lastError.message.match(/position (\d+)/);
        if (posMatch) {
          var pos = parseInt(posMatch[1]);
          var truncated = repaired.substring(0, pos);
          truncated = truncated.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"]*$/, '');
          truncated = truncated.replace(/,\s*$/, '');
          var opens = 0, braces = 0, tInStr = false, tEsc = false;
          for (var ti = 0; ti < truncated.length; ti++) {
            var tc = truncated[ti];
            if (tEsc) { tEsc = false; continue; }
            if (tc === '\\') { tEsc = true; continue; }
            if (tc === '"') { tInStr = !tInStr; continue; }
            if (tInStr) continue;
            if (tc === '[') opens++;
            else if (tc === ']') opens--;
            else if (tc === '{') braces++;
            else if (tc === '}') braces--;
          }
          for (var j = 0; j < opens; j++) truncated += ']';
          for (var k = 0; k < braces; k++) truncated += '}';
          return JSON.parse(truncated);
        }
      } catch (e4) {
        console.error('[PlanGen] Truncation repair also failed:', e4.message);
      }
    }
    console.error('[PlanGen] All parse attempts failed. Text:', cleaned.substring(0, 500));
    return null;
  }

  // ===== Grounded call with retry + ungrounded fallback =====
  // sourceKey identifies which section the sources belong to (e.g. 'overview', 'tech', 'stakeholders')
  // If grounded search fails after all retries (common for lesser-known companies),
  // falls back to an ungrounded call so Gemini uses its training knowledge instead.
  async function groundedCall(systemPrompt, message, maxTokens, sourceKey) {
    for (var attempt = 1; attempt <= 4; attempt++) {
      try {
        var r = await AP.ApiClient.call(systemPrompt, message, { maxTokens: maxTokens || 8192, useGrounding: true });
        if (!r.text && attempt < 4) { console.log('[PlanGen] Empty grounded response, retrying (attempt ' + attempt + '/4)...'); await new Promise(function(ok) { setTimeout(ok, 2000 * attempt); }); continue; }
        var parsed = parseJSON(r.text);
        if (parsed) {
          var tagged = (r.sources || []).map(function(s) { return { url: s.url || '', title: s.title || '', section: sourceKey || 'general' }; });
          return { data: parsed, sources: tagged };
        }
        if (attempt < 4) { console.log('[PlanGen] Grounded parse failed, retrying (attempt ' + attempt + '/4)...'); continue; }
      } catch (err) {
        console.error('[PlanGen] Grounded call error:', err.message);
        if (attempt >= 4) break; // fall through to ungrounded fallback instead of throwing
        await new Promise(function(ok) { setTimeout(ok, 2000 * attempt); });
      }
    }

    // Fallback: retry WITHOUT grounding so Gemini uses its training knowledge.
    // This is critical for lesser-known companies where Google Search returns no results.
    console.log('[PlanGen] Grounded search failed for "' + sourceKey + '", falling back to ungrounded call...');
    try {
      var fallbackMsg = message + '\n\nNote: If you cannot find specific real-time data, use your best knowledge to provide a reasonable and helpful account profile. Clearly indicate where information is estimated or based on general industry knowledge.';
      var fr = await AP.ApiClient.call(systemPrompt, fallbackMsg, { maxTokens: maxTokens || 8192, jsonMode: true });
      var fallbackParsed = parseJSON(fr.text);
      if (fallbackParsed) {
        console.log('[PlanGen] Ungrounded fallback succeeded for "' + sourceKey + '"');
        return { data: fallbackParsed, sources: [] };
      }
    } catch (fallbackErr) {
      console.error('[PlanGen] Ungrounded fallback also failed for "' + sourceKey + '":', fallbackErr.message);
    }

    return { data: null, sources: [] };
  }

  // ===== Citation Helpers =====

  // Build numbered, de-duped references list from all grounding sources.
  // De-dupes by TITLE (domain) so multiple Gemini grounding chunks pointing to the same source
  // collapse into a single reference. Keeps the first URL seen for that title.
  function buildReferences(sources) {
    var seen = {};
    var refs = [];
    (sources || []).forEach(function(s) {
      if (!s.url && !s.title) return;
      // Normalize title for dedup: lowercase, strip non-alphanumeric
      var titleKey = (s.title || s.url || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!titleKey) return;
      if (seen[titleKey] != null) return;
      seen[titleKey] = refs.length;
      refs.push({ id: refs.length + 1, url: s.url || '', title: s.title || s.url || '', section: s.section || 'general' });
    });
    return refs;
  }

  // Fuzzy-match a text snippet (e.g. publication name) to references and return matching IDs.
  // Conservative: only returns refs with strong keyword overlap. Prefers fewer accurate matches over noise.
  // opts.section — restrict matching to refs from a specific section ('overview'|'tech'|'stakeholders')
  // opts.companyName — strip company name words from keywords (avoids matching every ref to the company itself)
  function findCitations(text, references, opts) {
    if (!text || !references || !references.length) return [];
    opts = opts || {};
    var stopWords = ['from','with','have','that','this','will','about','their','call','transcript','interview','article','press','release','report','annual','quarterly','q1','q2','q3','q4','inc','llc','corp','ltd','plc','company','group','the','and','for','operations','continuing'];
    var companyWords = (opts.companyName || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
    var lower = String(text).toLowerCase();
    var keywords = lower
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter(function(w) {
        return w.length >= 3 && stopWords.indexOf(w) < 0 && companyWords.indexOf(w) < 0;
      });
    if (!keywords.length) return [];

    var matches = [];
    references.forEach(function(ref) {
      if (opts.section && ref.section !== opts.section) return;
      // Compress haystack to alphanumeric for matching across "fooddive.com" vs "Food Dive"
      var hay = (ref.title + ' ' + ref.url).toLowerCase().replace(/[^a-z0-9]/g, '');
      var hits = 0;
      for (var i = 0; i < keywords.length; i++) {
        if (hay.indexOf(keywords[i]) >= 0) hits++;
      }
      if (hits > 0) matches.push({ id: ref.id, hits: hits });
    });
    if (!matches.length) return [];
    matches.sort(function(a, b) { return b.hits - a.hits; });

    // Conservative: only return refs that TIE for the top hit count. Drops noise from weaker matches.
    // Cap at 2 citations to keep output concise.
    var topHits = matches[0].hits;
    return matches.filter(function(m) { return m.hits === topHits; }).slice(0, 2).map(function(m) { return m.id; });
  }

  // Find references whose title contains the company's own domain — used as a fallback for facts
  // that come from the company itself (financial reports, business divisions, strategic priorities).
  function findCompanyOwnedRefs(companyName, references, section) {
    if (!companyName || !references || !references.length) return [];
    var name = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    var matches = [];
    references.forEach(function(ref) {
      if (section && ref.section !== section) return;
      var hay = (ref.title + ' ' + ref.url).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (hay.indexOf(name) >= 0) matches.push(ref.id);
    });
    return matches.slice(0, 2);
  }

  // ===== Context helpers =====
  function summaryOf(overview) {
    if (!overview) return '';
    var parts = [];
    if (overview.industry) parts.push('Industry: ' + overview.industry);
    if (overview.hqLocation) parts.push('HQ: ' + overview.hqLocation);
    if (overview.annualRevenue) parts.push('Revenue: ' + overview.annualRevenue);
    if (overview.employeeCount) parts.push('Employees: ' + overview.employeeCount);
    if (overview.strategicPriorities && overview.strategicPriorities.length) {
      parts.push('Strategic Priorities: ' + overview.strategicPriorities.slice(0, 3).join('; '));
    }
    return parts.join('\n');
  }

  function userInputBlock(userInputs) {
    if (!userInputs) return '';
    var lines = [];
    if (userInputs.dealStage) lines.push('Deal Stage: ' + userInputs.dealStage);
    if (userInputs.accountContext) lines.push('Account Context: ' + userInputs.accountContext);
    if (userInputs.suspectedCompetitors) lines.push('Known/Suspected Competitors: ' + userInputs.suspectedCompetitors);
    if (userInputs.goalsNext90Days) lines.push('Goals for Next 90 Days: ' + userInputs.goalsNext90Days);
    if (userInputs.knownRisks) lines.push('Known Risks/Concerns: ' + userInputs.knownRisks);
    if (lines.length === 0) return '';
    return '\n--- SALES TEAM INTELLIGENCE ---\n' + lines.join('\n') + '\n---\n';
  }

  // ===== MAIN GENERATE FUNCTION =====
  async function generate(companyName, industryHint, revenueHint, userInputs) {
    var sellerCtx = AP.SellerProfile.getContextString();
    var methodologyCtx = AP.Methodology ? AP.Methodology.getContextString() : '';
    var sp = AP.SellerProfile.get() || {};
    var sellerName = sp.companyName || 'Our Company';
    userInputs = userInputs || {};

    var plan = {
      companyName: companyName,
      generatedAt: new Date().toISOString(),
      userInputs: userInputs,
      overview: null,
      news: [],
      technologyLandscape: null,
      diPriorities: [],
      stakeholders: [],
      competitive: null,
      valueHypothesis: null,
      accountStrategy: null,
      dayPlan: null,
      nextFiveSteps: [],
      risks: [],
      successMetrics: [],
      valueChain: null,
      kpiBenchmarks: null,
      friendlyContacts: null,
      _sources: []
    };

    var companyCtx = 'Company: ' + companyName + '\n';
    if (industryHint) companyCtx += 'Industry: ' + industryHint + '\n';
    if (revenueHint) companyCtx += 'Approximate Revenue: ' + revenueHint + '\n';

    var userCtx = userInputBlock(userInputs);

    var systemBase = 'You are a world-class B2B enterprise sales strategist at ' + sellerName + '. You have deep knowledge of every major company. Your job is to build account plans that are so insightful they could be presented to a Chief Revenue Officer.\n\nBe specific, not generic. Reference real business context, actual initiatives, and concrete data.\n\nReturn ONLY valid JSON — no markdown fences, no explanation outside the JSON.' + sellerCtx;

    var TOTAL_STEPS = 10;

    // Aera customer list — used for cross-referencing former {COMPANY} employees who are now at
    // named Aera customers (higher warm-intro value than random employer). Keep this in sync
    // with the customer roster; move to data/aera-content.json if it needs UI editing.
    var AERA_CUSTOMER_LIST = 'KraftHeinz, Unilever, Dell Technologies, GSK, Estee Lauder, Rio Tinto, Kerry Foods, Viva Energy, Viatris, Gallo, Lipton, Bristol Myers Squibb, Diageo, Alcon, WGU University, Mars, Irving, ExxonMobil, Philip Morris International, BP Castrol, Hershey, Diacero, Merck, AstraZeneca, BAT, Mitsubishi Chemical Group';
    var CONSULTING_TARGETS = 'Deloitte, ZS Associates, Accenture, EY, PwC, McKinsey, Bain, Kearney, Oliver Wyman, BCG, Roland Berger';

    // Value Chain analysis is expensive and only relevant to physical-product industries.
    // Skip for pure services / SaaS / financial services etc.
    var industryStr = (industryHint || '').toLowerCase();
    var valueChainRelevant = /manuf|cpg|fmcg|automotive|industrial|chemical|pharma|energy|oil|gas|mining|retail|distribution|logistics|3pl|food|beverage|aerospace/.test(industryStr);
    // When industry hint is empty, still run it — the AI will decide relevance based on the company.
    if (!industryStr) valueChainRelevant = true;

    // ===== CALL 1: Account Overview + News (grounded) =====
    AP.EventBus.emit('plan:progress', { current: 1, total: TOTAL_STEPS, phase: 'Researching ' + companyName + '...' });

    var call1Msg = 'Build a deeply researched account profile for:\n\n' + companyCtx +
      '\nSearch the web for the latest information about this company. Prioritise sources from the last 24 months. Prefer: investor relations, SEC/annual filings, most recent earnings release and transcript, official company newsroom, and reputable business media.\n\n' +
      'ANTI-HALLUCINATION RULES:\n' +
      '- Every material fact (revenue, growth rate, business group split, strategic priority) needs a source URL and publication date.\n' +
      '- If a specific number is not publicly disclosed, write "Not found (public)" for that field or label your estimate [ESTIMATED] with your reasoning.\n' +
      '- Never invent quarter results, executive quotes, or M&A activity. If unsure, use "Not found (public)".\n' +
      '- News items must be verifiable — no synthesized "trend" headlines.\n\n' +
      'Return JSON:\n' +
      '{\n' +
      '  "overview": {\n' +
      '    "industry": "Their specific industry/vertical",\n' +
      '    "hqLocation": "City, Country",\n' +
      '    "annualRevenue": "Latest reported revenue with currency and fiscal year",\n' +
      '    "employeeCount": "Approximate headcount",\n' +
      '    "ticker": "Stock ticker(s) if public, or Private",\n' +
      '    "website": "company domain",\n' +
      '    "businessGroups": [{"name": "Division name", "description": "What it does", "revenueShare": "% of total", "confidence": "Confirmed|Estimated"}],\n' +
      '    "financialSnapshot": [\n' +
      '      {"metric": "Revenue", "currentYear": "FY value", "priorYear": "FY value", "notes": "Growth rate", "sourceDate": "Mon YYYY"},\n' +
      '      {"metric": "Operating Profit", "currentYear": "value", "priorYear": "value", "notes": "Trend", "sourceDate": "Mon YYYY"}\n' +
      '    ],\n' +
      '    "strategicPriorities": ["Priority 1 — brief description with source signal (e.g., cited in FY25 annual report)", "Priority 2"]\n' +
      '  },\n' +
      '  "news": [\n' +
      '    {"date": "Mon YYYY", "headline": "Specific headline", "detail": "2-3 sentences", "source": "Publication", "sourceUrl": "URL if available", "relevanceTag": "Supply Chain|AI/Digital|Leadership|M&A|Financial|Strategy", "confidence": "Confirmed|Reported"}\n' +
      '  ]\n' +
      '}\n\n' +
      'CRITICAL: Use REAL data. Include 5-7 news items from the last 24 months. Include 4-6 financial rows from the most recent full-year/interim results. Business groups and strategic priorities must come from disclosed company materials — do not invent divisions.';

    try {
      var r1 = await groundedCall(systemBase, call1Msg, 16384, 'overview');
      if (r1.data) {
        plan.overview = r1.data.overview || null;
        plan.news = r1.data.news || [];
        if (r1.sources.length) plan._sources = r1.sources;
      }
    } catch (err) {
      console.error('[PlanGen] Call 1 failed:', err.message);
      plan.overview = { industry: industryHint || '', hqLocation: '', annualRevenue: revenueHint || 'N/A', employeeCount: 'N/A', businessGroups: [], financialSnapshot: [], strategicPriorities: [] };
    }

    var overviewContext = summaryOf(plan.overview);
    var newsContext = plan.news.length > 0 ? '\nRecent News:\n' + plan.news.slice(0, 5).map(function(n) { return '- ' + n.headline; }).join('\n') : '';

    // ===== CALL 2: Technology Landscape (grounded) =====
    AP.EventBus.emit('plan:progress', { current: 2, total: TOTAL_STEPS, phase: 'Researching technology stack...' });

    var call2Msg = 'Research the enterprise technology stack of:\n\n' + companyCtx + overviewContext + '\n\n' +
      'Objective: map their end-to-end tech stack across five layers, then for each identified system explain where ' + sellerName + ' Decision Intelligence sits relative to it. This is pre-sales tech intelligence for an enterprise sales team.\n\n' +
      'SEARCH SOURCES (in this order of reliability):\n' +
      '1. Company investor relations, annual report, most recent earnings transcript, capital markets day materials\n' +
      '2. LinkedIn profiles of planning, IT, engineering, and finance staff at the company — technology tool references are gold\n' +
      '3. Current and archived job postings on LinkedIn/Indeed/company careers portal — extract every named system in requirements\n' +
      '4. Technology vendor customer case study libraries (SAP, Oracle, Kinaxis, Blue Yonder, o9, Manhattan, Aveva, Honeywell, etc.)\n' +
      '5. System integrator project portfolios: Accenture, Deloitte, Capgemini, IBM Consulting, Infosys, TCS\n' +
      '6. Industry conference presentations and speaker abstracts\n\n' +
      'FIVE LAYERS TO MAP:\n' +
      '- Layer 1 — OT & Site Automation: DCS/SCADA, historians, safety systems (Honeywell, Emerson, Rockwell, Siemens, Aveva PI)\n' +
      '- Layer 2 — MES & Quality: MES, LIMS, batch/order management, compliance tools\n' +
      '- Layer 3 — Planning & Scheduling: ERP planning modules, APS (Kinaxis/o9/Blue Yonder/SAP IBP/Aspen/OMP), S&OP/IBP tooling\n' +
      '- Layer 4 — Logistics & Execution: TMS by mode (Oracle TMS/SAP TM/Manhattan/Descartes/E2open/project44), WMS, order management\n' +
      '- Layer 5 — Analytics & Decision Support: BI (Power BI/Tableau/Qlik), financial consolidation (Anaplan/OneStream/SAP BPC), data lake\n\n' +
      'ANTI-HALLUCINATION RULES:\n' +
      '- Only report systems with observable evidence (case study, LinkedIn mention, job posting, press release). Cite the source in "evidence".\n' +
      '- Never assume a vendor relationship from industry norm alone — that must be marked confidence: "Inferred".\n' +
      '- If you cannot find a system for a layer, return {"category": "<Layer>", "vendor": "Not found (public)", "confidence": "Unknown"} rather than inventing.\n\n' +
      'Return JSON:\n' +
      '{\n' +
      '  "technologyLandscape": {\n' +
      '    "knownSystems": [\n' +
      '      {\n' +
      '        "layer": "OT|MES|Planning|Logistics|Analytics",\n' +
      '        "category": "ERP|APS|TMS|WMS|BI|Data Lake|MES|SCADA|CRM|Cloud|AI/ML|Other",\n' +
      '        "vendor": "Vendor Name",\n' +
      '        "product": "Specific product/version if known",\n' +
      '        "evidence": "Specific source snippet (e.g., \\"cited in SAP case study, Mar 2024\\" or \\"listed in Supply Chain Manager LinkedIn profile\\")",\n' +
      '        "confidence": "Confirmed|Likely|Inferred|Unknown",\n' +
      '        "aeraPosition": "1 SHORT SENTENCE: where ' + sellerName + ' sits relative to this system (upstream/downstream/complementary layer)",\n' +
      '        "dataInputs": "What Aera would READ from this system (e.g., \\"open orders, inventory positions, MRP output\\")",\n' +
      '        "dataOutputs": "What Aera would WRITE BACK (e.g., \\"safety-stock updates, expedite POs, transfer orders\\")",\n' +
      '        "likelyObjection": "1 SENTENCE: internal objection this system\'s owner will raise (e.g., \\"we already have this in SAP IBP\\")",\n' +
      '        "objectionOwner": "Role that owns the objection (e.g., \\"S&OP Manager\\", \\"CIO\\", \\"Planning Lead\\")"\n' +
      '      }\n' +
      '    ],\n' +
      '    "digitalStrategy": "3-4 sentences about their digital transformation strategy and AI investments, with source references",\n' +
      '    "itLeadership": "Key CIO/CTO/CDO name + title + evidence source",\n' +
      '    "techBudget": "Any known IT spending data with source, or Not found (public)",\n' +
      '    "layerGaps": ["Layers where no system was identified — likely manual/spreadsheet processes"]\n' +
      '  }\n' +
      '}\n\n' +
      'CRITICAL: Prioritise depth on Layers 3 (Planning) and 4 (Logistics) — these are where ' + sellerName + ' has highest displacement/complement value. Include 6-12 systems total across all layers.';

    try {
      var r2 = await groundedCall(systemBase, call2Msg, 8192, 'tech');
      if (r2.data) {
        plan.technologyLandscape = r2.data.technologyLandscape || null;
        if (r2.sources.length) plan._sources = plan._sources.concat(r2.sources);
      }
    } catch (err) { console.error('[PlanGen] Call 2 (tech) error:', err.message); }

    var techContext = '';
    if (plan.technologyLandscape && plan.technologyLandscape.knownSystems) {
      techContext = '\nKnown Tech Stack:\n' + plan.technologyLandscape.knownSystems.map(function(s) {
        return '- ' + s.category + ': ' + s.vendor + (s.product ? ' ' + s.product : '') + ' (' + s.confidence + ')';
      }).join('\n');
    }

    // ===== CALL 3: DI Priorities (jsonMode) =====
    AP.EventBus.emit('plan:progress', { current: 3, total: TOTAL_STEPS, phase: 'Analyzing decision intelligence opportunities...' });

    var call3Msg = 'Design 5 Decision Intelligence use cases for ' + sellerName + ' at:\n\n' + companyCtx +
      overviewContext + techContext + newsContext + userCtx +
      '\n\nEach use case must be a fully structured "Kit Skill" using the URAL framework: Understand → Recommend → Act → Learn. This is what a CP will use verbatim in an executive briefing, so make it concrete and specific.\n\n' +
      'URAL structure (mandatory — 2-3 substantive bullets per box, never empty):\n' +
      '- UNDERSTAND: what data/signals Aera monitors to detect a decision opportunity (source systems from the tech stack, monitoring frequency, trigger conditions)\n' +
      '- RECOMMEND: the specific decision Aera surfaces (concrete recommendation, target role/interface, key decision factors and confidence signals)\n' +
      '- ACT: what Aera executes in the system of record (specific system action, execution mode: autonomous-with-guardrails / human-in-loop / recommend-only, guardrail conditions)\n' +
      '- LEARN: how Aera improves the skill over time (override capture, outcome tracking, model/policy update mechanism)\n\n' +
      'Return JSON:\n' +
      '{\n' +
      '  "diPriorities": [\n' +
      '    {\n' +
      '      "rank": 1,\n' +
      '      "area": "Use Case Name (e.g., Autonomous Expedite Decisioning for At-Risk Inventory)",\n' +
      '      "oneSentence": "1 SENTENCE plain-language description of what the skill does and where it runs",\n' +
      '      "context": "3-4 SENTENCES about why THIS company needs this — reference their actual operations, scale, and pain points",\n' +
      '      "sellerValueProp": "2-3 SENTENCES: how ' + sellerName + ' addresses it. Reference specific Aera Skills/capabilities.",\n' +
      '      "understand": {\n' +
      '        "sourceSystems": ["ERP module (name from tech stack)", "APS", "Supplier portal"],\n' +
      '        "monitoringFrequency": "Real-time|Hourly|Daily",\n' +
      '        "triggers": ["Stockout risk > 80% in next 5 days", "Supplier late-ship signal", "Demand spike > forecast + 2σ"]\n' +
      '      },\n' +
      '      "recommend": {\n' +
      '        "recommendation": "The specific decision Aera surfaces (e.g., \\"expedite PO #XXXX by 3 days; estimated stockout risk 87% by Thursday\\")",\n' +
      '        "targetRole": "Who receives it (e.g., Demand Planner, S&OP Manager)",\n' +
      '        "interface": "Aera cockpit | Email alert | ERP workflow | Teams/Slack",\n' +
      '        "decisionFactors": ["Confidence signals shown to user, e.g., forecast accuracy 85%, supplier OTIF 92%"]\n' +
      '      },\n' +
      '      "act": {\n' +
      '        "systemAction": "The specific write-back action (e.g., \\"Create expedite PO in SAP\\", \\"Release STO\\", \\"Update safety-stock parameter in APS\\")",\n' +
      '        "executionMode": "Autonomous (with guardrails)|Human-in-the-loop|Recommend only",\n' +
      '        "guardrails": ["Value threshold (e.g., PO < $500K)", "Policy rule (must match approved supplier list)", "Escalation trigger (e.g., override logging + supervisor notify)"]\n' +
      '      },\n' +
      '      "learn": {\n' +
      '        "overrideCapture": "What happens when a user rejects/modifies (e.g., \\"reason captured, feature-weighted into next retrain\\")",\n' +
      '        "outcomeTracking": "How Aera measures impact (e.g., \\"actual vs recommended stockout avoidance, freight-cost delta\\")",\n' +
      '        "modelUpdate": "What gets retrained and at what cadence (e.g., \\"policy re-weight weekly, model retrain monthly\\")"\n' +
      '      },\n' +
      '      "cadence": "Real-time|Hourly|Daily|Weekly",\n' +
      '      "kpisImpacted": [\n' +
      '        {"kpi": "OTIF|Fill rate|Freight premium|Inventory turns|Forecast accuracy|Expedite cost %", "direction": "Up|Down", "targetLift": "e.g., +2-4pp OTIF, -15% expedite cost"}\n' +
      '      ],\n' +
      '      "pilotExitCriteria": "Adoption %, decision cycle-time reduction, KPI lift, automation rate, controls met — what \\"good\\" looks like at pilot close",\n' +
      '      "estimatedImpact": "$ or % estimate scaled to this company\'s revenue with basis (e.g., \\"$8-12M/yr = 0.05% of $22B revenue based on typical CPG expedite-cost reduction\\")",\n' +
      '      "urgency": "HIGHEST|High|Medium"\n' +
      '    }\n' +
      '  ]\n' +
      '}\n\nGenerate 5 use cases ranked by relevance. Each MUST have every URAL box filled with 2-3 substantive bullets — never leave any box empty. Ground the source systems in the tech stack you already researched (Layer 3/4/5). Keep language executive-ready but concrete.';

    try {
      var r3 = await AP.ApiClient.call(systemBase, call3Msg, { maxTokens: 8192, jsonMode: true });
      var p3 = parseJSON(r3.text);
      if (p3) plan.diPriorities = p3.diPriorities || [];
    } catch (err) { console.error('[PlanGen] Call 3 error:', err.message); }

    // ===== CALL 4: Stakeholders (grounded for real people) =====
    AP.EventBus.emit('plan:progress', { current: 4, total: TOTAL_STEPS, phase: 'Researching real stakeholders...' });

    var topPriorities = plan.diPriorities.slice(0, 3).map(function(p) { return p.area; }).join('; ');

    var call4Msg = 'Research REAL executives and leaders at:\n\n' + companyCtx + overviewContext +
      '\nTop DI Priorities: ' + topPriorities + '\n' + userCtx +
      '\nOBJECTIVE: build a longlist of decision-makers, influencers, and transformation sponsors ' + sellerName + ' should engage. Prioritise people with visible remit for supply chain, planning, digital, or AI initiatives.\n\n' +
      'SEARCH SOURCES (in this order):\n' +
      '1. Company leadership/executive bios, IR investor day speaker lineups\n' +
      '2. Recent earnings-call speaker attributions and Q&A responses\n' +
      '3. Press releases announcing appointments or organisational changes (last 24 months)\n' +
      '4. LinkedIn profiles with visible title + employer + tenure\n' +
      '5. Industry conference speaker pages and podcast/interview coverage\n' +
      '6. Awards, patents, published articles authored by the person\n\n' +
      'TARGET FUNCTIONS (prioritise in this order):\n' +
      '- Tier 1 (core decision-making): Chief Supply Chain Officer, VP/SVP Supply Chain, S&OP/IBP Lead, Demand Planning, Material Planning, Inventory, Logistics, Supply Chain Transformation\n' +
      '- Tier 2 (technology & data): CIO, CDO, VP Data & Analytics, Head of AI, Digital Transformation lead\n' +
      '- Tier 3 (execution & adjacent): Manufacturing/Plant Directors, CPO/Procurement, Continuous Improvement, Supply Chain Finance\n' +
      '- Include no more than 2 C-suite executives — focus on Director/Senior Director/VP/SVP levels who actually run initiatives.\n\n' +
      'EVIDENCE GATE (HARD RULE — every person must pass this):\n' +
      '- ROLE PROOF: a source showing their title AND employer (and dates if available). Cite the URL and publication date.\n' +
      '- RELEVANCE PROOF: a source showing transformation remit / AI-digital initiative / supply-chain-planning ownership. Cite URL and date.\n' +
      '- DISAMBIGUATOR: at least one — location, business unit, distinctive prior employer, or middle initial. Prevents confusion with same-name others.\n' +
      '- If EITHER proof is missing, EXCLUDE the person. Never invent names or "likely" titles.\n' +
      '- If you cannot find a real person for a critical role, use: {"name": "Not found (public)", "title": "VP Supply Chain (target)", "confidence": "Unverified", "searchQueries": ["3-5 specific searches a human could run"]}\n\n' +
      'Return JSON:\n' +
      '{\n' +
      '  "stakeholders": [\n' +
      '    {\n' +
      '      "name": "REAL Full Name",\n' +
      '      "title": "Their actual current job title",\n' +
      '      "linkedinUrl": "LinkedIn profile URL if visible, else empty",\n' +
      '      "location": "City/Country if public",\n' +
      '      "functionTier": "Tier 1|Tier 2|Tier 3",\n' +
      '      "roleInDeal": "Executive Sponsor|Champion|Evaluator|Influencer|Gatekeeper|Pain-bearer",\n' +
      '      "relevance": "High|Medium|Low",\n' +
      '      "confidence": "Confirmed|Inferred|Unverified",\n' +
      '      "roleProof": {"claim": "What the source says about title/employer", "sourceUrl": "URL", "sourceDate": "Mon YYYY"},\n' +
      '      "relevanceProof": {"claim": "What the source says about their transformation/AI/supply chain remit", "sourceUrl": "URL", "sourceDate": "Mon YYYY"},\n' +
      '      "disambiguator": "Location + BU + prior employer or other distinguishing detail",\n' +
      '      "notes": "1 SENTENCE: why they matter for a ' + sellerName + ' deal",\n' +
      '      "engagementStrategy": "1-2 SHORT SENTENCES max 40 words: specific approach — what message and format (email/LinkedIn/exec briefing)",\n' +
      '      "publicQuotes": [\n' +
      '        {"quote": "Direct quote from a real source", "source": "Earnings call | interview | conference", "sourceUrl": "URL", "date": "Mon YYYY"}\n' +
      '      ]\n' +
      '    }\n' +
      '  ]\n' +
      '}\n\n' +
      'Target 6-10 stakeholders across the three tiers. Prioritise Tier 1 (at least 4). Never bypass the Evidence Gate — better to return 5 verified names than 10 half-verified ones.';

    try {
      var r4 = await groundedCall(systemBase, call4Msg, 12288, 'stakeholders');
      if (r4.data) {
        plan.stakeholders = r4.data.stakeholders || [];
        if (r4.sources.length) plan._sources = plan._sources.concat(r4.sources);
      }
    } catch (err) { console.error('[PlanGen] Call 4 (stakeholders) error:', err.message); }

    // ===== CALL 5: Competitive + Value Hypothesis (jsonMode, uses user input) =====
    AP.EventBus.emit('plan:progress', { current: 5, total: TOTAL_STEPS, phase: 'Competitive analysis & value case...' });

    var stakeholderNames = plan.stakeholders.slice(0, 5).map(function(s) { return s.name + ' (' + s.title + ')'; }).join(', ');

    var competitorInput = '';
    if (userInputs.suspectedCompetitors) {
      competitorInput = '\n\nIMPORTANT — The sales team reports these competitors are present at this account:\n' +
        userInputs.suspectedCompetitors + '\n' +
        'You MUST address each of these competitors specifically. Mark them as "userReported": true in the output.\n' +
        'You may also add additional competitors you identify through analysis.';
    }

    var call5Msg = 'Build competitive analysis and value hypothesis for selling ' + sellerName + ' to:\n\n' + companyCtx +
      overviewContext + techContext + '\nKey Stakeholders: ' + stakeholderNames + '\n' +
      'Top DI Priorities: ' + topPriorities + '\n' + userCtx + competitorInput +
      '\n\nReturn JSON:\n' +
      '{\n' +
      '  "competitive": {\n' +
      '    "positioning": "2-3 SHORT SENTENCES: How ' + sellerName + ' should position for THIS account.",\n' +
      '    "landscape": [\n' +
      '      {"competitor": "Competitor Name", "presence": "Incumbent|Evaluating|Rumored|Potential Threat", "weakness": "1 SHORT SENTENCE about their key weakness", "sellerAdvantage": "1-2 SHORT SENTENCES max 30 words about ' + sellerName + ' advantage", "battleCard": "1 sentence talk track", "userReported": false}\n' +
      '    ]\n' +
      '  },\n' +
      '  "valueHypothesis": {\n' +
      '    "executivePitch": "2-3 POWERFUL SENTENCES max 60 words a CP could use verbatim to a CEO/COO. Reference their priorities and numbers.",\n' +
      '    "metrics": [\n' +
      '      {"metric": "Specific business improvement", "impact": "Dollar value scaled to this company", "confidence": "High|Medium|Low", "basis": "REQUIRED — show transparent calculation. Format: \\"X% of $Y revenue/spend = $Z, based on [benchmark source]\\". Example: \\"0.5-1% of $60B revenue = $300M-$600M, based on typical CPG working capital improvement from supply chain transformation\\". Reference the SPECIFIC revenue/cost figure from this company\'s overview, the benchmark percentage, and the calculation. NEVER leave this vague."}\n' +
      '    ],\n' +
      '    "whyNow": "2-3 SENTENCES about urgency — why they should act now rather than next year"\n' +
      '  }\n' +
      '}\n\nGenerate 4-6 competitors. Generate 4-6 value metrics.\n\n' +
      'CRITICAL FOR VALUE METRICS: Every "basis" field must show the math. Use the company\'s ACTUAL revenue/cost numbers from the overview. Cite the benchmark percentage and where it comes from (industry analyst, Aera customer outcomes, transformation case studies, etc.). Vague statements like "based on industry benchmarks" are NOT acceptable — show the percentage AND the dollar calculation.';

    try {
      var r5 = await AP.ApiClient.call(systemBase, call5Msg, { maxTokens: 8192, jsonMode: true });
      var p5 = parseJSON(r5.text);
      if (p5) {
        plan.competitive = p5.competitive || null;
        plan.valueHypothesis = p5.valueHypothesis || null;
      }
    } catch (err) { console.error('[PlanGen] Call 5 error:', err.message); }

    // ===== CALL 6: Account Strategy + 30-60-90 Plan + Next 5 Steps (jsonMode, uses user inputs + methodology) =====
    AP.EventBus.emit('plan:progress', { current: 6, total: TOTAL_STEPS, phase: 'Building strategy & engagement plan...' });

    var strategyInputs = '';
    if (userInputs.goalsNext90Days) strategyInputs += '\nSales Team Goals (Next 90 Days): ' + userInputs.goalsNext90Days;
    if (userInputs.accountContext) strategyInputs += '\nAccount Context: ' + userInputs.accountContext;
    if (userInputs.dealStage) strategyInputs += '\nCurrent Deal Stage: ' + userInputs.dealStage;

    var call6Msg = 'Create account strategy, 30-60-90 day plan, and next steps for ' + sellerName + ' selling into:\n\n' + companyCtx +
      overviewContext + '\n' +
      'Top DI Priorities: ' + topPriorities + '\n' +
      'Key Stakeholders: ' + stakeholderNames + '\n' +
      (plan.valueHypothesis && plan.valueHypothesis.executivePitch ? 'Value Pitch: ' + plan.valueHypothesis.executivePitch + '\n' : '') +
      (plan.competitive && plan.competitive.positioning ? 'Competitive Positioning: ' + plan.competitive.positioning + '\n' : '') +
      strategyInputs + userCtx +
      '\n' + methodologyCtx +
      '\n\nReturn JSON:\n' +
      '{\n' +
      '  "accountStrategy": {\n' +
      '    "positioning": "3-4 SENTENCES: What we are positioning and the overall deal narrative",\n' +
      '    "whyAera": "3-4 SENTENCES: Why Aera specifically — tied to THIS company\'s situation, tech stack, and priorities",\n' +
      '    "whyNow": "2-3 SENTENCES: Urgency drivers — why act now, what happens if they delay",\n' +
      '    "keyMessages": ["Message 1 — concise talk track", "Message 2", "Message 3"],\n' +
      '    "landingZone": "2-3 SENTENCES: The ideal first use case / entry point for Aera at this account"\n' +
      '  },\n' +
      '  "dayPlan": {\n' +
      '    "day30": {\n' +
      '      "title": "Phase title",\n' +
      '      "whatGoodLooksLike": "2-3 SENTENCES describing success criteria at day 30",\n' +
      '      "actions": [{"day": "1-5", "action": "1 SHORT SENTENCE max 20 words: specific action with stakeholder name", "owner": "CP|SE|Marketing|CP + SE", "deliverable": "Short deliverable"}]\n' +
      '    },\n' +
      '    "day60": {\n' +
      '      "title": "Phase title",\n' +
      '      "whatGoodLooksLike": "1 SENTENCE: measurable success criteria at day 60",\n' +
      '      "actions": [{"day": "31-35", "action": "1 SHORT SENTENCE max 20 words", "owner": "Role", "deliverable": "Short deliverable"}]\n' +
      '    },\n' +
      '    "day90": {\n' +
      '      "title": "Phase title",\n' +
      '      "whatGoodLooksLike": "1 SENTENCE: measurable success criteria at day 90",\n' +
      '      "actions": [{"day": "61-70", "action": "1 SHORT SENTENCE max 20 words", "owner": "Role", "deliverable": "Short deliverable"}]\n' +
      '    }\n' +
      '  },\n' +
      '  "nextFiveSteps": [\n' +
      '    {"step": 1, "action": "1 SHORT SENTENCE max 15 words", "owner": "Who", "by": "Timeframe", "outcome": "Expected result in 5 words"}\n' +
      '  ]\n' +
      '}\n\n' +
      'CRITICAL:\n' +
      '- Each phase should have 5-7 actions. Reference specific stakeholder names and ' + sellerName + ' capabilities.\n' +
      '- "What Good Looks Like" must be concrete and measurable.\n' +
      '- Next 5 Steps are the IMMEDIATE actions after this plan is created — very tactical, very specific.\n' +
      '- Align to the Aera Way sales methodology milestones if provided above.\n' +
      '- If user provided 90-day goals, ensure the plan directly addresses those goals.';

    try {
      var r6 = await AP.ApiClient.call(systemBase, call6Msg, { maxTokens: 10240, jsonMode: true });
      var p6 = parseJSON(r6.text);
      if (p6) {
        plan.accountStrategy = p6.accountStrategy || null;
        plan.dayPlan = p6.dayPlan || null;
        plan.nextFiveSteps = p6.nextFiveSteps || [];
      }
    } catch (err) { console.error('[PlanGen] Call 6 error:', err.message); }

    // Fallback day plan
    if (!plan.dayPlan) {
      plan.dayPlan = {
        day30: { title: 'Research & Outreach', whatGoodLooksLike: 'Champion identified and first discovery meeting completed.', actions: [
          { day: '1-5', action: 'Finalize account plan and validate org structure', owner: 'CP', deliverable: 'Completed account plan' },
          { day: '6-15', action: 'Multi-channel outreach to key stakeholders', owner: 'CP', deliverable: 'First meeting booked' },
          { day: '16-30', action: 'Conduct discovery and qualify opportunity', owner: 'CP + SE', deliverable: 'Discovery notes and qualification' }
        ]},
        day60: { title: 'Discovery & Value Demonstration', whatGoodLooksLike: 'Business case presented, 3+ stakeholders engaged.', actions: [
          { day: '31-40', action: 'Deliver tailored workshop or demo', owner: 'SE', deliverable: 'Workshop completed' },
          { day: '41-50', action: 'Build business case with account-specific data', owner: 'CP + Value Engineering', deliverable: 'Business case document' },
          { day: '51-60', action: 'Secure executive sponsor alignment', owner: 'CP', deliverable: 'Executive meeting' }
        ]},
        day90: { title: 'Qualification & Commitment', whatGoodLooksLike: 'POC/pilot agreed, commercial terms in discussion.', actions: [
          { day: '61-70', action: 'Present POC proposal', owner: 'CP + SE', deliverable: 'POC scope document' },
          { day: '71-80', action: 'Run POC or proof of value', owner: 'SE', deliverable: 'POC results' },
          { day: '81-90', action: 'Negotiate and close', owner: 'CP', deliverable: 'Agreement signed' }
        ]}
      };
    }

    // ===== CALL 7: Risks + Success Metrics (jsonMode, uses user input + methodology) =====
    AP.EventBus.emit('plan:progress', { current: 7, total: TOTAL_STEPS, phase: 'Assessing risks & defining success metrics...' });

    var riskInput = '';
    if (userInputs.knownRisks) {
      riskInput = '\n\nIMPORTANT — The sales team has flagged these specific risks/concerns:\n' +
        userInputs.knownRisks + '\n' +
        'You MUST address EACH of these with Aera-specific mitigations. Mark them as "userReported": true.';
    }

    var call7Msg = 'Create risk assessment and success metrics for selling ' + sellerName + ' to:\n\n' + companyCtx +
      overviewContext + '\n' +
      'Deal Stage: ' + (userInputs.dealStage || 'New') + '\n' +
      'Top Priorities: ' + topPriorities + '\n' +
      'Key Stakeholders: ' + stakeholderNames + '\n' +
      (plan.competitive ? 'Competitive Situation: ' + (plan.competitive.positioning || '').substring(0, 300) + '\n' : '') +
      riskInput + userCtx +
      '\n' + methodologyCtx +
      '\n\nReturn JSON:\n' +
      '{\n' +
      '  "risks": [\n' +
      '    {\n' +
      '      "risk": "1 SHORT SENTENCE: specific risk for THIS deal",\n' +
      '      "category": "Organizational|Technical|Competitive|Commercial|Timeline",\n' +
      '      "likelihood": "High|Medium|Low",\n' +
      '      "impact": "High|Medium|Low",\n' +
      '      "mitigation": "1-2 SHORT SENTENCES max 40 words with concrete Aera-specific mitigation.",\n' +
      '      "owner": "CP|SE|Leadership|CP + SE",\n' +
      '      "userReported": false\n' +
      '    }\n' +
      '  ],\n' +
      '  "successMetrics": [\n' +
      '    {"metric": "Specific metric", "target": "Measurable target", "timeline": "By when", "measurement": "How to track"}\n' +
      '  ]\n' +
      '}\n\n' +
      'Generate 5 risks specific to THIS account. Keep risk descriptions and mitigations SHORT and actionable.\n' +
      'Generate 5 success metrics aligned to the 30-60-90 day plan phases.';

    try {
      var r7 = await AP.ApiClient.call(systemBase, call7Msg, { maxTokens: 6144, jsonMode: true });
      var p7 = parseJSON(r7.text);
      if (p7) {
        plan.risks = p7.risks || [];
        plan.successMetrics = p7.successMetrics || [];
      }
    } catch (err) { console.error('[PlanGen] Call 7 error:', err.message); }

    // ===== CALL 8: Value Chain Analysis (grounded, industry-gated) =====
    if (valueChainRelevant) {
      AP.EventBus.emit('plan:progress', { current: 8, total: TOTAL_STEPS, phase: 'Mapping value chain & operational footprint...' });

      var call8Msg = 'Build a condensed value chain map for:\n\n' + companyCtx + overviewContext + techContext +
        '\n\nObjective: map the company\'s end-to-end supply chain so a ' + sellerName + ' CP can identify hot-spots where Decision Intelligence would land. Prioritise recent information (last 24-36 months). Where data is unavailable or estimated, say so explicitly with [ESTIMATED] or [INFERRED] labels.\n\n' +
        'SEARCH SOURCES:\n' +
        '- Company annual report, 10-K/20-F filings, capital markets day materials\n' +
        '- Most recent earnings release and transcript\n' +
        '- Company sustainability/ESG report and supplier disclosures\n' +
        '- Trade press for the industry (Supply Chain Dive, Automotive News, Food Dive, ChemWeek, etc.)\n' +
        '- Vendor case studies referencing this company as a customer\n\n' +
        'COVER THESE 8 SECTIONS (each brief but concrete):\n' +
        '1. Raw materials & commodity inputs — top spend categories, commodity exposure, PPV sensitivity\n' +
        '2. Supplier base & tier structure — named tier-1 suppliers, sole vs dual sourcing, geographic concentration, concentration risk\n' +
        '3. Procurement structure — centralised vs regional vs category-based, CPO name/priorities, digital procurement stack\n' +
        '4. BOM & parts complexity — estimated SKU count, variant drivers, ECN synchronization risks (if manufacturing)\n' +
        '5. Manufacturing & assembly — top sites (location + products), S&OP process, publicly disclosed KPIs (OEE, build attainment)\n' +
        '6. Inbound logistics — model (milk run/direct/consolidation), key 3PLs, mode mix (JIT/JIS), expedite/air freight exposure\n' +
        '7. Outbound logistics & distribution — DC footprint, top export markets, channel structure, channel inventory status\n' +
        '8. Market & customer structure — top markets by revenue, mix shift, retail vs fleet vs OEM breakdown\n\n' +
        'Then, based on this value chain map, identify 3-5 Aera hot-spots — specific points in the value chain where ' + sellerName + '\'s Decision Intelligence would deliver the highest impact for this account.\n\n' +
        'Return JSON:\n' +
        '{\n' +
        '  "valueChain": {\n' +
        '    "rawMaterials": {\n' +
        '      "primaryMaterials": [{"category": "e.g., Steel grades", "spendShare": "%", "confidence": "Confirmed|Estimated|Inferred"}],\n' +
        '      "commodityExposure": "1-2 sentences on hedging strategy and PPV exposure",\n' +
        '      "keyRisks": "1 sentence on rules-of-origin / CBAM / conflict minerals if relevant"\n' +
        '    },\n' +
        '    "supplierBase": {\n' +
        '      "tier1Suppliers": [{"category": "Powertrain|Packaging|Ingredients|...", "supplier": "Vendor Name", "scope": "Sole-sourced|Dual-sourced|Multi-sourced", "confidence": "Confirmed|Inferred"}],\n' +
        '      "geographicConcentration": "1 sentence on regional distribution",\n' +
        '      "concentrationRisk": "1 sentence on the biggest single-point exposure",\n' +
        '      "digitalStack": "SAP Ariba / Coupa / E2open / etc. if known"\n' +
        '    },\n' +
        '    "procurement": {\n' +
        '      "structure": "Centralised|Regional|Category-based",\n' +
        '      "cpoName": "Name + title if publicly identified, else Not found (public)",\n' +
        '      "cpoPriorities": ["Current CPO priority 1", "Priority 2"],\n' +
        '      "spendMix": "1 sentence on direct vs indirect spend split if known"\n' +
        '    },\n' +
        '    "bomComplexity": {\n' +
        '      "estimatedSkuCount": "Approximate active SKUs (with [ESTIMATED] label if not disclosed)",\n' +
        '      "variantDrivers": "1-2 sentences on regional compliance, channel differences, platform generations",\n' +
        '      "ecnRisk": "1 sentence on engineering change synchronization risks — only include if manufacturing/discrete industry"\n' +
        '    },\n' +
        '    "manufacturing": {\n' +
        '      "sites": [{"location": "City, Country", "products": "Product lines produced", "capacity": "Volume/throughput if known", "confidence": "Confirmed|Inferred"}],\n' +
        '      "sopProcess": "1-2 sentences on S&OP or IBP maturity — mention any reliance on manual/Excel processes if flagged",\n' +
        '      "publicKpis": ["Any disclosed operational KPI e.g., OEE X%, on-time build Y%"]\n' +
        '    },\n' +
        '    "inboundLogistics": {\n' +
        '      "model": "1 sentence on inbound model by region",\n' +
        '      "keyPartners": ["3PL / freight forwarder names"],\n' +
        '      "modeMix": "1 sentence on JIT / JIS / kanban usage",\n' +
        '      "expediteExposure": "1 sentence on air-freight or expedite exposure with cost signal if known"\n' +
        '    },\n' +
        '    "outboundLogistics": {\n' +
        '      "distributionModel": "1-2 sentences on plant-to-customer/dealer model",\n' +
        '      "dcFootprint": "1 sentence on DC count and regional coverage",\n' +
        '      "topExportMarkets": ["Top 5 export markets by volume/revenue"],\n' +
        '      "channelInventoryStatus": "1 sentence on any known destocking or correction cycle"\n' +
        '    },\n' +
        '    "marketStructure": {\n' +
        '      "topMarkets": [{"region": "Region/country", "revenueShare": "%", "trend": "Growing|Correcting|Stable"}],\n' +
        '      "mixShift": "1-2 sentences on premium vs standard, legacy vs next-gen shifts",\n' +
        '      "customerMix": "1 sentence on retail/fleet/OEM/government split"\n' +
        '    },\n' +
        '    "aeraHotSpots": [\n' +
        '      {\n' +
        '        "location": "Where in the value chain (e.g., \\"Tier-1 supplier collaboration\\", \\"Inbound expedite decisioning\\", \\"Channel inventory rebalancing\\")",\n' +
        '        "pain": "1 sentence on the specific execution gap or manual process at this hot-spot",\n' +
        '        "aeraPlay": "1-2 sentences on the Aera Skill that would address it and the systems it would integrate with",\n' +
        '        "estimatedImpact": "$ or % estimate scaled to this company"\n' +
        '      }\n' +
        '    ]\n' +
        '  }\n' +
        '}\n\n' +
        'CRITICAL:\n' +
        '- Focus on sections most relevant to THIS industry — e.g., BOM complexity matters more for automotive/electronics than food/beverage; commodity exposure matters more for chemicals/manufacturing than pure logistics.\n' +
        '- Never invent supplier names, site locations, or CPO names. Use "Not found (public)" if not verifiable.\n' +
        '- Aera hot-spots must be tied to specific value-chain locations you identified, not generic supply-chain talk.';

      try {
        var r8 = await groundedCall(systemBase, call8Msg, 12288, 'valueChain');
        if (r8.data) {
          plan.valueChain = r8.data.valueChain || null;
          if (r8.sources.length) plan._sources = plan._sources.concat(r8.sources);
        }
      } catch (err) { console.error('[PlanGen] Call 8 (value chain) error:', err.message); }
    }

    // ===== CALL 9: Industry KPI Benchmarks (grounded) =====
    AP.EventBus.emit('plan:progress', { current: 9, total: TOTAL_STEPS, phase: 'Benchmarking supply chain KPIs against industry...' });

    var companyPerfContext = '';
    if (plan.valueChain && plan.valueChain.manufacturing && plan.valueChain.manufacturing.publicKpis && plan.valueChain.manufacturing.publicKpis.length) {
      companyPerfContext += '\nCompany-disclosed operational KPIs: ' + plan.valueChain.manufacturing.publicKpis.join('; ');
    }
    var priorityAreasCtx = plan.diPriorities.slice(0, 5).map(function(p) { return p.area; }).join('; ');

    var call9Msg = 'Build an industry KPI benchmark for supply chain performance at:\n\n' + companyCtx + overviewContext + companyPerfContext +
      '\n\nTop DI Priorities identified: ' + priorityAreasCtx +
      '\n\nObjective: give the ' + sellerName + ' CP a set of measurable industry benchmarks so they can position ' + sellerName + '\'s expected KPI lift against numbers a CFO/COO will recognise. Every benchmark must be cited from a source no older than 36 months.\n\n' +
      'SEARCH SOURCES (in this order):\n' +
      '1. Gartner Supply Chain Top 25 reports, Gartner benchmark surveys\n' +
      '2. APICS/ASCM benchmarks, SCC (Supply Chain Council) SCOR benchmarks\n' +
      '3. IDC, Deloitte, McKinsey supply chain benchmark studies\n' +
      '4. Industry trade press with benchmarking data (Supply Chain Dive, Automotive News, Food Dive, ChemWeek)\n' +
      '5. The company\'s own disclosed operational KPIs from earnings calls, annual reports, capital markets days\n\n' +
      'COVER THESE STANDARD SUPPLY CHAIN KPIs (skip any that are truly irrelevant to this industry):\n' +
      '1. OTIF (On-Time In-Full) — service reliability\n' +
      '2. Fill rate / service level\n' +
      '3. Inventory turns / Days Inventory on Hand (DOH)\n' +
      '4. Forecast accuracy (MAPE or WMAPE)\n' +
      '5. E&O / short-dated / expired waste as % of sales\n' +
      '6. Logistics cost as % of sales\n' +
      '7. Expedite / air freight cost as % of total freight\n' +
      '8. Planning cycle time (S&OP to execution)\n' +
      '9. Shortage / backorder rate\n\n' +
      'PLUS 2-3 INDUSTRY-SPECIFIC KPIs relevant to this company\'s sector (e.g., fresh sell-through % for CPG-food; warranty claim rate for auto; batch yield for chemicals; on-shelf availability for retail; capacity utilisation for chemicals/energy).\n\n' +
      'ANTI-HALLUCINATION RULES:\n' +
      '- Every "typicalRange" must have a source citation with a date within the last 36 months.\n' +
      '- If a benchmark for this specific sub-industry is not publicly available, mark it [ESTIMATED] and cite the closest adjacent-industry benchmark.\n' +
      '- For "companyPerformance": only use numbers the company has actually disclosed. Use "Not disclosed" otherwise — never estimate a company\'s specific number.\n' +
      '- "gapToBenchmark" is only computable when both companyPerformance and the benchmark are numeric. Otherwise: "Not comparable".\n\n' +
      'Return JSON:\n' +
      '{\n' +
      '  "kpiBenchmarks": {\n' +
      '    "sector": "Specific industry vertical the benchmarks are calibrated to (e.g., \\"Consumer Packaged Goods — Beverages\\")",\n' +
      '    "supplyChainKpis": [\n' +
      '      {\n' +
      '        "kpi": "OTIF",\n' +
      '        "definition": "1 SHORT sentence — what it measures",\n' +
      '        "typicalRange": "e.g., 88-95%",\n' +
      '        "worldClass": "e.g., 97%+",\n' +
      '        "trend": "1-2 SENTENCES on recent trend and drivers",\n' +
      '        "citation": {"source": "Gartner Supply Chain Top 25 2024 | APICS Benchmark | Company IR", "date": "Mon YYYY", "url": "URL if available"},\n' +
      '        "companyPerformance": "Number if disclosed, else \\"Not disclosed\\"",\n' +
      '        "gapToBenchmark": "Above|At|Below by X pp | Not comparable",\n' +
      '        "aeraLever": "1 SENTENCE — which ' + sellerName + ' Skill/capability moves this KPI (reference the DI Priorities where applicable)"\n' +
      '      }\n' +
      '    ],\n' +
      '    "industrySpecificKpis": [\n' +
      '      {\n' +
      '        "kpi": "Sector-specific KPI name",\n' +
      '        "definition": "1 SHORT sentence",\n' +
      '        "typicalRange": "Range with unit",\n' +
      '        "worldClass": "World-class number",\n' +
      '        "trend": "1-2 sentences with source",\n' +
      '        "citation": {"source": "", "date": "", "url": ""},\n' +
      '        "companyPerformance": "",\n' +
      '        "gapToBenchmark": "",\n' +
      '        "aeraLever": ""\n' +
      '      }\n' +
      '    ],\n' +
      '    "keyTakeaway": "2-3 SENTENCES summarising where this company likely has the biggest KPI gap to industry benchmark and which ' + sellerName + ' priority addresses it. Ground in the disclosed numbers."\n' +
      '  }\n' +
      '}\n\n' +
      'Include 7-9 standard KPIs and 2-3 industry-specific KPIs. Every KPI must have a citation and an aeraLever. Cross-reference the DI Priorities where relevant so the CP can see the story flowing: benchmark gap → Aera Skill → expected lift.';

    try {
      var r9 = await groundedCall(systemBase, call9Msg, 12288, 'kpiBenchmarks');
      if (r9.data) {
        plan.kpiBenchmarks = r9.data.kpiBenchmarks || null;
        if (r9.sources.length) plan._sources = plan._sources.concat(r9.sources);
      }
    } catch (err) { console.error('[PlanGen] Call 9 (KPI benchmarks) error:', err.message); }

    // ===== CALL 10: Friendly Contacts — former {COMPANY} employees now at consultancies or Aera customers =====
    AP.EventBus.emit('plan:progress', { current: 10, total: TOTAL_STEPS, phase: 'Finding warm-intro candidates (former ' + companyName + ' employees)...' });

    var call10Msg = 'Identify verified former employees of:\n\n' + companyCtx +
      '\n\nOBJECTIVE: build a longlist of 5-10 people who previously worked at ' + companyName + ' at Director level or above (within the past 5 years) AND are now at either:\n' +
      '  (a) a major consulting/advisory firm: ' + CONSULTING_TARGETS + '\n' +
      '  (b) a named ' + sellerName + ' customer (potential warm-intro / peer-reference): ' + AERA_CUSTOMER_LIST + '\n\n' +
      'These are "friendly contacts" — the CP can approach them for warm intros, competitive intel, or peer references. Prioritise Supply Chain, Operations, Logistics, Procurement backgrounds; then Finance/Business Services/Customer Service/Commercial as secondary.\n\n' +
      'SEARCH APPROACH:\n' +
      '- LinkedIn people search: "was at ' + companyName + '" + current employer filter\n' +
      '- LinkedIn alumni pages if the company has one\n' +
      '- Press releases announcing appointments at consultancies/customers naming ' + companyName + ' as prior employer\n' +
      '- Conference speaker bios that list prior role at ' + companyName + '\n' +
      '- Published articles/papers where the author bio references prior ' + companyName + ' employment\n\n' +
      'STRICT EVIDENCE GATE (both must pass, or exclude the person):\n' +
      '- PAST ROLE PROOF: source showing they worked at ' + companyName + ' as Director+ with dates (within past 5 years). Cite URL + publication date.\n' +
      '- CURRENT ROLE PROOF: source showing current employer + title + timing. Cite URL + publication date.\n' +
      '- DISAMBIGUATOR: location, business unit, distinctive prior role, or second independent source. Prevents same-name confusion.\n' +
      '- Only High (2+ independent sources) or Medium (1 clear source) confidence — never Low.\n' +
      '- No inference. No "likely" or "appears to". If unverifiable → exclude.\n\n' +
      'FALLBACK IF NOTHING VERIFIABLE: Return an empty candidates array plus 5-10 specific search queries a human researcher could run to find these people manually. Format search queries as strings ready to paste into LinkedIn Sales Navigator or Google.\n\n' +
      'Return JSON:\n' +
      '{\n' +
      '  "friendlyContacts": {\n' +
      '    "candidates": [\n' +
      '      {\n' +
      '        "name": "Full Name",\n' +
      '        "linkedinUrl": "LinkedIn profile URL if visible, else empty",\n' +
      '        "formerRole": {"title": "Previous title at ' + companyName + '", "dates": "e.g., 2019-2022"},\n' +
      '        "currentRole": {"company": "Current employer", "title": "Current title", "dates": "e.g., 2022-present", "category": "Consultancy|Aera Customer"},\n' +
      '        "background": "Supply Chain|Operations|Logistics|Procurement|Finance|Business Services|Commercial",\n' +
      '        "location": "City/Country if public",\n' +
      '        "pastRoleProof": {"claim": "What the source says", "sourceUrl": "URL", "sourceDate": "Mon YYYY"},\n' +
      '        "currentRoleProof": {"claim": "What the source says", "sourceUrl": "URL", "sourceDate": "Mon YYYY"},\n' +
      '        "disambiguator": "Location + BU + distinctive prior role, or second source URL",\n' +
      '        "confidence": "High|Medium",\n' +
      '        "warmIntroAngle": "1-2 SHORT SENTENCES: specific way CP could approach this person — reference their overlap with the current deal (functional area, business unit, transformation experience)"\n' +
      '      }\n' +
      '    ],\n' +
      '    "searchQueries": ["Specific search string 1", "Specific search string 2"],\n' +
      '    "notFoundNote": "Only populate if candidates is empty — explain what was searched and why nothing was verifiable"\n' +
      '  }\n' +
      '}\n\n' +
      'Target 5-8 High/Medium-confidence candidates. Prefer people at Aera customers over consultancies (higher peer-reference value). Never invent people or dates.';

    try {
      var r10 = await groundedCall(systemBase, call10Msg, 10240, 'friendlyContacts');
      if (r10.data) {
        plan.friendlyContacts = r10.data.friendlyContacts || null;
        if (r10.sources.length) plan._sources = plan._sources.concat(r10.sources);
      }
    } catch (err) { console.error('[PlanGen] Call 10 (friendly contacts) error:', err.message); }

    // ===== Build numbered references and apply inline citations =====
    plan._references = buildReferences(plan._sources);

    var citeOpts = function(section) { return { section: section, companyName: companyName }; };
    var companyRefsOverview = findCompanyOwnedRefs(companyName, plan._references, 'overview');
    var companyRefsTech = findCompanyOwnedRefs(companyName, plan._references, 'tech');
    var companyRefsStake = findCompanyOwnedRefs(companyName, plan._references, 'stakeholders');

    // News: fuzzy-match publication name + headline keywords to grounding chunks
    if (plan.news && plan.news.length) {
      plan.news.forEach(function(n) {
        var hint = (n.source || '') + ' ' + (n.headline || '');
        var hits = findCitations(hint, plan._references, citeOpts('overview'));
        // If no fuzzy match found, fall back to company-owned refs (e.g., for IR press releases)
        n._citations = hits.length ? hits : companyRefsOverview;
      });
    }

    // Financial snapshot: comes from company filings / IR — use company-owned refs as primary source
    if (plan.overview && plan.overview.financialSnapshot && plan.overview.financialSnapshot.length) {
      plan.overview.financialSnapshot.forEach(function(row) {
        row._citations = companyRefsOverview;
      });
    }

    // Business groups: company-defined — use company-owned refs
    if (plan.overview && plan.overview.businessGroups && plan.overview.businessGroups.length) {
      plan.overview.businessGroups.forEach(function(bg) {
        bg._citations = companyRefsOverview;
      });
    }

    // Tech systems: try fuzzy match against vendor/product/evidence; fall back to company-owned
    if (plan.technologyLandscape && plan.technologyLandscape.knownSystems && plan.technologyLandscape.knownSystems.length) {
      plan.technologyLandscape.knownSystems.forEach(function(sys) {
        var hint = (sys.vendor || '') + ' ' + (sys.product || '') + ' ' + (sys.evidence || '');
        var hits = findCitations(hint, plan._references, citeOpts('tech'));
        sys._citations = hits.length ? hits : companyRefsTech;
      });
    }

    // Stakeholders: try fuzzy match; if Call 4 returned no grounding sources, fall back to overview-section refs
    var stakeFallback = companyRefsStake.length ? companyRefsStake : companyRefsOverview;
    if (plan.stakeholders && plan.stakeholders.length) {
      plan.stakeholders.forEach(function(s) {
        var hint = (s.name || '') + ' ' + (s.title || '');
        var hits = findCitations(hint, plan._references, citeOpts('stakeholders'));
        if (!hits.length) hits = findCitations(hint, plan._references, citeOpts('overview'));
        s._citations = hits.length ? hits : stakeFallback;
        if (s.publicQuotes && s.publicQuotes.length) {
          s.publicQuotes.forEach(function(q) {
            var qhits = findCitations((q.source || '') + ' ' + (q.quote || ''), plan._references, citeOpts('stakeholders'));
            if (!qhits.length) qhits = findCitations((q.source || '') + ' ' + (q.quote || ''), plan._references, citeOpts('overview'));
            q._citations = qhits.length ? qhits : stakeFallback;
          });
        }
      });
    }

    // Fallback success metrics
    if (!plan.successMetrics || plan.successMetrics.length === 0) {
      plan.successMetrics = [
        { metric: 'Discovery meetings secured', target: '3+', timeline: '30 days', measurement: 'Meetings with key stakeholders' },
        { metric: 'Champion identified', target: '1', timeline: '30 days', measurement: 'Named internal sponsor' },
        { metric: 'Executive sponsor engaged', target: '1', timeline: '45 days', measurement: 'C-level meeting completed' },
        { metric: 'Business case delivered', target: '1', timeline: '60 days', measurement: 'Quantified value document' },
        { metric: 'POC/pilot agreed', target: '1', timeline: '75 days', measurement: 'Signed scope document' },
        { metric: 'Pipeline value created', target: '$1M+ ACV', timeline: '90 days', measurement: 'Qualified opportunity in CRM' }
      ];
    }

    return plan;
  }

  return { generate: generate };
})();
