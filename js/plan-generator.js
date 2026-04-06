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

  // ===== Grounded call with retry =====
  async function groundedCall(systemPrompt, message, maxTokens) {
    for (var attempt = 1; attempt <= 2; attempt++) {
      try {
        var r = await AP.ApiClient.call(systemPrompt, message, { maxTokens: maxTokens || 8192, useGrounding: true });
        if (!r.text && attempt < 2) { console.log('[PlanGen] Empty grounded response, retrying...'); continue; }
        var parsed = parseJSON(r.text);
        if (parsed) return { data: parsed, sources: r.sources || [] };
        if (attempt < 2) { console.log('[PlanGen] Grounded parse failed, retrying...'); continue; }
      } catch (err) {
        console.error('[PlanGen] Grounded call error:', err.message);
        if (attempt >= 2) throw err;
      }
    }
    return { data: null, sources: [] };
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
      _sources: []
    };

    var companyCtx = 'Company: ' + companyName + '\n';
    if (industryHint) companyCtx += 'Industry: ' + industryHint + '\n';
    if (revenueHint) companyCtx += 'Approximate Revenue: ' + revenueHint + '\n';

    var userCtx = userInputBlock(userInputs);

    var systemBase = 'You are a world-class B2B enterprise sales strategist at ' + sellerName + '. You have deep knowledge of every major company. Your job is to build account plans that are so insightful they could be presented to a Chief Revenue Officer.\n\nBe specific, not generic. Reference real business context, actual initiatives, and concrete data.\n\nReturn ONLY valid JSON — no markdown fences, no explanation outside the JSON.' + sellerCtx;

    var TOTAL_STEPS = 7;

    // ===== CALL 1: Account Overview + News (grounded) =====
    AP.EventBus.emit('plan:progress', { current: 1, total: TOTAL_STEPS, phase: 'Researching ' + companyName + '...' });

    var call1Msg = 'Build a deeply researched account profile for:\n\n' + companyCtx +
      '\nSearch the web for the latest information about this company. Use real, current data.\n\n' +
      'Return JSON:\n' +
      '{\n' +
      '  "overview": {\n' +
      '    "industry": "Their specific industry/vertical",\n' +
      '    "hqLocation": "City, Country",\n' +
      '    "annualRevenue": "Latest reported revenue with currency and fiscal year",\n' +
      '    "employeeCount": "Approximate headcount",\n' +
      '    "ticker": "Stock ticker(s) if public, or Private",\n' +
      '    "website": "company domain",\n' +
      '    "businessGroups": [{"name": "Division name", "description": "What it does", "revenueShare": "% of total"}],\n' +
      '    "financialSnapshot": [\n' +
      '      {"metric": "Revenue", "currentYear": "FY value", "priorYear": "FY value", "notes": "Growth rate"},\n' +
      '      {"metric": "Operating Profit", "currentYear": "value", "priorYear": "value", "notes": "Trend"}\n' +
      '    ],\n' +
      '    "strategicPriorities": ["Priority 1 — brief description", "Priority 2"]\n' +
      '  },\n' +
      '  "news": [\n' +
      '    {"date": "Mon YYYY", "headline": "Specific headline", "detail": "2-3 sentences", "source": "Publication", "relevanceTag": "Supply Chain|AI/Digital|Leadership|M&A|Financial|Strategy"}\n' +
      '  ]\n' +
      '}\n\n' +
      'CRITICAL: Use REAL data. Include 5-7 news items, 4-6 financial rows, real business groups, specific strategic priorities.';

    try {
      var r1 = await groundedCall(systemBase, call1Msg, 8192);
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

    var call2Msg = 'Research the technology stack and digital landscape of:\n\n' + companyCtx + overviewContext + '\n\n' +
      'Search for this company as a CUSTOMER of technology vendors. Look for:\n' +
      '- ERP systems (SAP, Oracle, Microsoft Dynamics, etc.) — check vendor customer pages, case studies, press releases\n' +
      '- Supply chain / planning tools (Blue Yonder, Kinaxis, o9, SAP IBP, etc.)\n' +
      '- Cloud platform (AWS, Azure, GCP)\n' +
      '- CRM (Salesforce, etc.)\n' +
      '- AI/ML investments and digital transformation initiatives\n' +
      '- Any publicly known technology partnerships or implementations\n\n' +
      'Return JSON:\n' +
      '{\n' +
      '  "technologyLandscape": {\n' +
      '    "knownSystems": [\n' +
      '      {"category": "ERP|Planning|CRM|Cloud|Analytics|AI/ML|Other", "vendor": "Vendor Name", "product": "Specific product if known", "evidence": "Where this was found — be specific", "confidence": "Confirmed|Likely|Rumored"}\n' +
      '    ],\n' +
      '    "digitalStrategy": "3-4 sentences about their digital transformation strategy and AI investments",\n' +
      '    "itLeadership": "Key CIO/CTO/CDO if findable",\n' +
      '    "techBudget": "Any known IT spending data"\n' +
      '  }\n' +
      '}\n\n' +
      'CRITICAL: Only report systems you find EVIDENCE for. Mark confidence level honestly. Do NOT guess or hallucinate vendor relationships.';

    try {
      var r2 = await groundedCall(systemBase, call2Msg, 4096);
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

    var call3Msg = 'Analyze decision intelligence opportunities for:\n\n' + companyCtx +
      overviewContext + techContext + newsContext + userCtx +
      '\n\nReturn JSON:\n' +
      '{\n' +
      '  "diPriorities": [\n' +
      '    {\n' +
      '      "rank": 1,\n' +
      '      "area": "Priority area name (e.g., Supply Chain Decision Intelligence)",\n' +
      '      "context": "3-4 SENTENCES about THIS company\'s specific situation and why this is a priority. Reference their actual operations and scale.",\n' +
      '      "sellerValueProp": "2-3 SENTENCES about how ' + sellerName + ' addresses this. Reference specific Aera Skills/capabilities.",\n' +
      '      "estimatedImpact": "Dollar or percentage estimate scaled to this company\'s revenue",\n' +
      '      "urgency": "HIGHEST|High|Medium"\n' +
      '    }\n' +
      '  ]\n' +
      '}\n\nGenerate 5 DI priorities ranked by importance. Each must be specific to this company, not generic.';

    try {
      var r3 = await AP.ApiClient.call(systemBase, call3Msg, { maxTokens: 8192, jsonMode: true });
      var p3 = parseJSON(r3.text);
      if (p3) plan.diPriorities = p3.diPriorities || [];
    } catch (err) { console.error('[PlanGen] Call 3 error:', err.message); }

    // ===== CALL 4: Stakeholders (grounded for real people) =====
    AP.EventBus.emit('plan:progress', { current: 4, total: TOTAL_STEPS, phase: 'Researching real stakeholders...' });

    var topPriorities = plan.diPriorities.slice(0, 3).map(function(p) { return p.area; }).join('; ');

    var call4Msg = 'Research and identify REAL executives and leaders at:\n\n' + companyCtx + overviewContext +
      '\nTop DI Priorities: ' + topPriorities + '\n' + userCtx +
      '\nSearch the web for ACTUAL people at this company. Look for:\n' +
      '- C-suite executives (CEO, CFO, COO, CIO, CTO, CSCO)\n' +
      '- Chief Digital Officer (CDO), Chief AI Officer (CAIO), Chief Data Officer, Chief Analytics Officer, Chief Transformation Officer — these new AI/digital leadership roles are increasingly common and highly relevant\n' +
      '- VP/SVP of Supply Chain, Operations, Digital, IT, Procurement, Finance, AI, Data Science, Digital Transformation\n' +
      '- Any recent leadership changes or appointments, especially new AI/digital roles\n' +
      '- Direct quotes from earnings calls, interviews, conferences, press releases\n' +
      '- LinkedIn profiles or public appearances\n\n' +
      'Return JSON:\n' +
      '{\n' +
      '  "stakeholders": [\n' +
      '    {\n' +
      '      "name": "REAL Full Name — only include people you found in search results",\n' +
      '      "title": "Their actual job title",\n' +
      '      "roleInDeal": "Executive Sponsor|Champion|Evaluator|Influencer|Gatekeeper",\n' +
      '      "relevance": "High|Medium",\n' +
      '      "notes": "2-3 SENTENCES: why they matter for a ' + sellerName + ' deal, what they care about",\n' +
      '      "engagementStrategy": "3-4 SPECIFIC SENTENCES: exactly how to approach this person — what message, what proof point, what format (email/LinkedIn/exec briefing/conference), what to reference from their public statements",\n' +
      '      "publicQuotes": [\n' +
      '        {"quote": "Direct quote or paraphrase from a real source", "source": "Where this was said — earnings call, interview, conference", "date": "When"}\n' +
      '      ],\n' +
      '      "confidence": "Verified|Likely"\n' +
      '    }\n' +
      '  ]\n' +
      '}\n\n' +
      'CRITICAL RULES:\n' +
      '- ONLY include people you found in search results. Do NOT invent names.\n' +
      '- If you cannot find a real person for a critical role, use: {"name": "Role to be identified", "title": "VP Supply Chain (target)", "confidence": "Unverified"}\n' +
      '- Include real quotes where available. If no quote found, omit the publicQuotes array for that person.\n' +
      '- Engagement strategy must be SPECIFIC: reference their actual background, quotes, and specific Aera capabilities.\n' +
      '- Target 5-8 stakeholders.';

    try {
      var r4 = await groundedCall(systemBase, call4Msg, 8192);
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
      '    "positioning": "4-5 SENTENCES: How ' + sellerName + ' should position for THIS account. Reference their tech stack, pain points, and competitive dynamics.",\n' +
      '    "landscape": [\n' +
      '      {"competitor": "Competitor Name", "presence": "Incumbent|Evaluating|Rumored|Potential Threat", "weakness": "2-3 SENTENCES about their weakness for THIS account", "sellerAdvantage": "2-3 SENTENCES about ' + sellerName + ' advantage", "battleCard": "1-2 sentence talk track for a CP", "userReported": false}\n' +
      '    ]\n' +
      '  },\n' +
      '  "valueHypothesis": {\n' +
      '    "executivePitch": "4-5 POWERFUL SENTENCES a CP could use verbatim to a CEO/COO. Reference their specific priorities, name specific numbers.",\n' +
      '    "metrics": [\n' +
      '      {"metric": "Specific business improvement", "impact": "Dollar value scaled to this company", "confidence": "High|Medium|Low", "basis": "How this was estimated"}\n' +
      '    ],\n' +
      '    "whyNow": "2-3 SENTENCES about urgency — why they should act now rather than next year"\n' +
      '  }\n' +
      '}\n\nGenerate 4-6 competitors. Generate 4-6 value metrics.';

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
      '      "actions": [{"day": "1-5", "action": "Specific action with stakeholder names", "owner": "CP|SE|Marketing|CP + SE", "deliverable": "What is produced"}]\n' +
      '    },\n' +
      '    "day60": {\n' +
      '      "title": "Phase title",\n' +
      '      "whatGoodLooksLike": "2-3 SENTENCES describing success at day 60",\n' +
      '      "actions": [{"day": "31-35", "action": "Specific action", "owner": "Role", "deliverable": "Output"}]\n' +
      '    },\n' +
      '    "day90": {\n' +
      '      "title": "Phase title",\n' +
      '      "whatGoodLooksLike": "2-3 SENTENCES describing success at day 90",\n' +
      '      "actions": [{"day": "61-70", "action": "Specific action", "owner": "Role", "deliverable": "Output"}]\n' +
      '    }\n' +
      '  },\n' +
      '  "nextFiveSteps": [\n' +
      '    {"step": 1, "action": "Immediate next action — be very specific", "owner": "Who does this", "by": "Target date or timeframe", "outcome": "Expected result"}\n' +
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
      '      "risk": "Specific risk for THIS deal — not generic",\n' +
      '      "category": "Organizational|Technical|Competitive|Commercial|Timeline",\n' +
      '      "likelihood": "High|Medium|Low",\n' +
      '      "impact": "High|Medium|Low",\n' +
      '      "mitigation": "3-4 SENTENCES with concrete, Aera-specific mitigation. Reference specific playbooks, proof points, or tactics that ' + sellerName + ' would actually use.",\n' +
      '      "owner": "Who owns this mitigation — CP, SE, Leadership, etc.",\n' +
      '      "userReported": false\n' +
      '    }\n' +
      '  ],\n' +
      '  "successMetrics": [\n' +
      '    {"metric": "Specific metric", "target": "Measurable target", "timeline": "By when", "measurement": "How to track"}\n' +
      '  ]\n' +
      '}\n\n' +
      'Generate 5-8 risks specific to THIS account and deal. Mitigations must be actionable and align to the Aera Way sales methodology.\n' +
      'Generate 6-8 success metrics aligned to the 30-60-90 day plan phases.';

    try {
      var r7 = await AP.ApiClient.call(systemBase, call7Msg, { maxTokens: 6144, jsonMode: true });
      var p7 = parseJSON(r7.text);
      if (p7) {
        plan.risks = p7.risks || [];
        plan.successMetrics = p7.successMetrics || [];
      }
    } catch (err) { console.error('[PlanGen] Call 7 error:', err.message); }

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
