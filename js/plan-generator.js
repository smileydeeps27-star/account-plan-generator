/* ===== Account Plan Generator — AI Orchestrator (5 Calls) ===== */

AP.PlanGenerator = (function() {

  function repairJSON(text) {
    // Fix unescaped control characters inside strings
    var result = '';
    var inString = false;
    var escaped = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (escaped) { result += ch; escaped = false; continue; }
      if (ch === '\\') { result += ch; escaped = true; continue; }
      if (ch === '"') { inString = !inString; result += ch; continue; }
      if (inString) {
        // Replace unescaped newlines/tabs inside strings
        if (ch === '\n') { result += '\\n'; continue; }
        if (ch === '\r') { continue; }
        if (ch === '\t') { result += '\\t'; continue; }
      }
      result += ch;
    }
    // Fix trailing commas before ] or }
    result = result.replace(/,\s*([}\]])/g, '$1');
    return result;
  }

  function parseJSON(text) {
    if (!text) return null;

    // Strip markdown fences
    var cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    // Direct parse
    try { return JSON.parse(cleaned); } catch (e) { /* continue */ }

    // Extract JSON object by brace matching
    var start = cleaned.indexOf('{');
    if (start === -1) return null;

    var depth = 0;
    var end = -1;
    for (var i = start; i < cleaned.length; i++) {
      if (cleaned[i] === '{') depth++;
      else if (cleaned[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }

    var jsonStr = end > start ? cleaned.substring(start, end + 1) : cleaned;

    // Try direct parse of extracted
    try { return JSON.parse(jsonStr); } catch (e2) { /* continue */ }

    // Repair and retry
    var repaired = repairJSON(jsonStr);
    try { return JSON.parse(repaired); } catch (e3) {
      console.error('[PlanGen] Parse failed after repair at:', e3.message.match(/position (\d+)/)?.[1] || 'unknown');
    }

    // Last resort: truncate at the error position and close brackets
    try {
      var posMatch = e3 ? e3.message.match(/position (\d+)/) : null;
      if (posMatch) {
        var pos = parseInt(posMatch[1]);
        // Walk back to find last complete element
        var truncated = repaired.substring(0, pos);
        // Close any open structures
        var opens = (truncated.match(/\[/g) || []).length - (truncated.match(/\]/g) || []).length;
        var braces = (truncated.match(/\{/g) || []).length - (truncated.match(/\}/g) || []).length;
        // Remove trailing comma or partial value
        truncated = truncated.replace(/,\s*$/, '').replace(/,\s*"[^"]*$/, '');
        for (var j = 0; j < opens; j++) truncated += ']';
        for (var k = 0; k < braces; k++) truncated += '}';
        return JSON.parse(truncated);
      }
    } catch (e4) {
      console.error('[PlanGen] Truncation repair also failed');
    }

    return null;
  }

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

  async function generate(companyName, industryHint, revenueHint) {
    var sellerCtx = AP.SellerProfile.getContextString();
    var sp = AP.SellerProfile.get() || {};
    var sellerName = sp.companyName || 'Our Company';

    var plan = {
      companyName: companyName,
      generatedAt: new Date().toISOString(),
      overview: null,
      news: [],
      diPriorities: [],
      stakeholders: [],
      competitive: null,
      valueHypothesis: null,
      plan: null,
      risks: [],
      successMetrics: []
    };

    var companyCtx = 'Company: ' + companyName + '\n';
    if (industryHint) companyCtx += 'Industry: ' + industryHint + '\n';
    if (revenueHint) companyCtx += 'Approximate Revenue: ' + revenueHint + '\n';

    var systemBase = 'You are a world-class B2B enterprise sales strategist at ' + sellerName + '. You have deep knowledge of every major company, their business models, competitive dynamics, financial performance, and technology stacks. Your job is to build account plans that are so insightful they could be presented to a Chief Revenue Officer.\n\nUse your full knowledge of the company — their actual business model, real products, actual market position, known strategic initiatives, and genuine competitive landscape. DO NOT be generic. Be as specific and detailed as if you had just read their latest 10-K filing, investor presentation, and 5 recent analyst reports.\n\nReturn ONLY valid JSON — no markdown fences, no explanation outside the JSON.' + sellerCtx;

    // ===== CALL 1: Account Overview + News (with web grounding) =====
    AP.EventBus.emit('plan:progress', { current: 1, total: 5, phase: 'Researching ' + companyName + '...' });

    var call1Message = 'Build a deeply researched account profile for:\n\n' + companyCtx +
      '\nSearch the web for the latest information about this company. Use real, current data.\n\n' +
      'Return JSON:\n' +
      '{\n' +
      '  "overview": {\n' +
      '    "industry": "Their specific industry/vertical",\n' +
      '    "hqLocation": "City, Country",\n' +
      '    "annualRevenue": "Latest reported revenue with currency and fiscal year",\n' +
      '    "employeeCount": "Approximate headcount with context",\n' +
      '    "ticker": "Stock ticker(s) if public, or Private",\n' +
      '    "website": "company domain",\n' +
      '    "businessGroups": [\n' +
      '      {"name": "Division/Segment name", "description": "Key brands/products and what it does", "revenueShare": "Percentage of total revenue if known"}\n' +
      '    ],\n' +
      '    "financialSnapshot": [\n' +
      '      {"metric": "Revenue/Turnover", "currentYear": "FY value", "priorYear": "FY value", "notes": "Growth rate or context"},\n' +
      '      {"metric": "Operating Margin", "currentYear": "X%", "priorYear": "Y%", "notes": "Trend"},\n' +
      '      {"metric": "Operating Profit", "currentYear": "value", "priorYear": "value", "notes": "Growth"},\n' +
      '      {"metric": "Volume/Sales Growth", "currentYear": "X%", "priorYear": "Y%", "notes": "Organic vs total"}\n' +
      '    ],\n' +
      '    "strategicPriorities": ["Priority 1 — brief description", "Priority 2 — brief description", "Priority 3", "Priority 4"],\n' +
      '    "technologyLandscape": "2-3 sentences about their digital/AI/tech strategy and investments"\n' +
      '  },\n' +
      '  "news": [\n' +
      '    {"date": "Mon YYYY or specific date", "headline": "Detailed, specific headline", "detail": "2-3 sentences explaining what happened and why it matters", "source": "Publication name", "relevanceTag": "Supply Chain|AI/Digital|Leadership|M&A|Financial|Strategy"}\n' +
      '  ]\n' +
      '}\n\n' +
      'CRITICAL:\n' +
      '- Use REAL data from the web. Include actual financial figures, real executive names, genuine strategic initiatives.\n' +
      '- Include 5-7 news items that are recent and relevant to a ' + sellerName + ' sales engagement.\n' +
      '- Financial snapshot should have 4-6 rows with real numbers.\n' +
      '- Business groups should reflect their actual organizational structure.\n' +
      '- Strategic priorities should be specific and named (e.g., "Growth Action Plan" not just "growth").';

    try {
      var r1 = await AP.ApiClient.call(systemBase, call1Message, { maxTokens: 8192, useGrounding: true });
      console.log('[PlanGen] Call 1 response received, text length:', r1.text ? r1.text.length : 0);
      var p1 = parseJSON(r1.text);
      if (p1) {
        plan.overview = p1.overview || null;
        plan.news = p1.news || [];
        if (r1.sources && r1.sources.length) {
          plan._sources = r1.sources;
        }
        console.log('[PlanGen] Call 1 parsed successfully, overview keys:', plan.overview ? Object.keys(plan.overview) : 'null');
      } else {
        console.error('[PlanGen] Call 1 parsed to null');
      }
    } catch (err) {
      console.error('[PlanGen] Call 1 error:', err.message);
      plan.overview = { industry: industryHint || '', hqLocation: '', annualRevenue: revenueHint || 'N/A', employeeCount: 'N/A', businessGroups: [], financialSnapshot: [], strategicPriorities: [], technologyLandscape: 'Research failed: ' + err.message };
    }

    // ===== CALL 2: Decision Intelligence Priorities + Competitive =====
    AP.EventBus.emit('plan:progress', { current: 2, total: 5, phase: 'Analyzing opportunities & competitive landscape...' });

    var overviewContext = summaryOf(plan.overview);
    var newsContext = plan.news.length > 0 ? '\nRecent News:\n' + plan.news.slice(0, 5).map(function(n) { return '- ' + n.headline; }).join('\n') : '';

    var call2Message = 'Analyze decision intelligence opportunities and competitive positioning for:\n\n' + companyCtx +
      overviewContext + '\n' +
      (plan.overview && plan.overview.technologyLandscape ? 'Tech Landscape: ' + plan.overview.technologyLandscape + '\n' : '') +
      newsContext +
      '\n\nReturn JSON:\n' +
      '{\n' +
      '  "diPriorities": [\n' +
      '    {\n' +
      '      "rank": 1,\n' +
      '      "area": "Priority area name (e.g., Supply Chain Decision Intelligence)",\n' +
      '      "context": "3-4 SENTENCES about this company\'s specific situation, challenges, and why this is a priority. Reference their actual operations, scale, and recent initiatives.",\n' +
      '      "sellerValueProp": "2-3 SENTENCES about how ' + sellerName + '\'s specific capabilities address this. Reference actual Skills/products by name.",\n' +
      '      "estimatedImpact": "Dollar or percentage estimate scaled to this company\'s revenue (e.g., $200-500M annually)",\n' +
      '      "urgency": "HIGHEST|High|Medium"\n' +
      '    }\n' +
      '  ],\n' +
      '  "competitive": {\n' +
      '    "positioning": "3-4 SENTENCES: How ' + sellerName + ' should position against incumbents for THIS account",\n' +
      '    "landscape": [\n' +
      '      {"competitor": "Competitor Name", "weakness": "2-3 SENTENCES about their weakness for THIS account", "sellerAdvantage": "2-3 SENTENCES about ' + sellerName + '\'s advantage"}\n' +
      '    ]\n' +
      '  }\n' +
      '}\n\n' +
      'Generate 5 DI priorities ranked by importance (first = HIGHEST). Each must be specific to this company.\n' +
      'Generate 4-6 competitors in the landscape. Include both direct competitors and existing vendors they may need to displace.';

    try {
      var r2 = await AP.ApiClient.call(systemBase, call2Message, { maxTokens: 8192, jsonMode: true });
      var p2 = parseJSON(r2.text);
      if (p2) {
        plan.diPriorities = p2.diPriorities || [];
        plan.competitive = p2.competitive || null;
      }
    } catch (err) { console.error('[PlanGen] Call 2 error:', err.message); }

    // ===== CALL 3: Stakeholders + Value Hypothesis =====
    AP.EventBus.emit('plan:progress', { current: 3, total: 5, phase: 'Mapping stakeholders & building value case...' });

    var topPriorities = plan.diPriorities.slice(0, 3).map(function(p) { return p.area + ' (' + p.estimatedImpact + ')'; }).join('; ');

    var call3Message = 'Build stakeholder map and value hypothesis for selling ' + sellerName + ' to:\n\n' + companyCtx +
      overviewContext + '\n' +
      'Top DI Priorities: ' + topPriorities + '\n' +
      (plan.competitive ? 'Positioning: ' + (plan.competitive.positioning || '').substring(0, 200) + '\n' : '') +
      '\nReturn JSON:\n' +
      '{\n' +
      '  "stakeholders": [\n' +
      '    {\n' +
      '      "name": "Full Name (use REAL executives if you know them, otherwise realistic titles)",\n' +
      '      "title": "Job Title",\n' +
      '      "roleInDeal": "Executive Sponsor|Champion|Evaluator|Influencer|Blocker",\n' +
      '      "relevance": "High|Medium",\n' +
      '      "notes": "2-3 SENTENCES: why they matter, what they care about",\n' +
      '      "engagementStrategy": "2-3 SENTENCES: specific approach to engage this persona — what messaging, what proof points, what format",\n' +
      '      "linkedin": "https://linkedin.com/in/plausible-slug"\n' +
      '    }\n' +
      '  ],\n' +
      '  "valueHypothesis": {\n' +
      '    "metrics": [\n' +
      '      {"metric": "Specific business improvement", "impact": "Dollar value scaled to this company", "confidence": "High|Medium|Low"}\n' +
      '    ],\n' +
      '    "executivePitch": "3-4 POWERFUL SENTENCES an AE could use verbatim in an email to the CEO/COO. Reference their specific strategic priorities and quantified value."\n' +
      '  }\n' +
      '}\n\n' +
      'Generate 5-7 stakeholders with engagement strategies. Generate 4-6 value metrics.\n' +
      'Use REAL executive names where known. Include engagement strategy per persona.';

    try {
      var r3 = await AP.ApiClient.call(systemBase, call3Message, { maxTokens: 8192, jsonMode: true });
      var p3 = parseJSON(r3.text);
      if (p3) {
        plan.stakeholders = p3.stakeholders || [];
        plan.valueHypothesis = p3.valueHypothesis || null;
      }
    } catch (err) { console.error('[PlanGen] Call 3 error:', err.message); }

    // ===== CALL 4: 10-30-60 Day Plan =====
    AP.EventBus.emit('plan:progress', { current: 4, total: 5, phase: 'Building engagement plan...' });

    var stakeholderNames = plan.stakeholders.slice(0, 5).map(function(s) { return s.name + ' (' + s.title + ', ' + s.roleInDeal + ')'; }).join('\n- ');

    var call4Message = 'Create a detailed 10-30-60 day engagement plan for ' + sellerName + ' to sell into:\n\n' + companyCtx +
      'Top Priorities:\n' + plan.diPriorities.slice(0, 3).map(function(p, i) { return (i + 1) + '. ' + p.area; }).join('\n') + '\n' +
      'Key Stakeholders:\n- ' + stakeholderNames + '\n' +
      (plan.valueHypothesis && plan.valueHypothesis.executivePitch ? 'Value Pitch: ' + plan.valueHypothesis.executivePitch + '\n' : '') +
      '\nReturn JSON:\n' +
      '{\n' +
      '  "plan": {\n' +
      '    "day10": {\n' +
      '      "title": "Foundation & Intelligence Gathering",\n' +
      '      "actions": [\n' +
      '        {"day": "1-2", "action": "Specific action with stakeholder names", "owner": "AE|SE|Marketing|AE + SE", "deliverable": "What is produced"}\n' +
      '      ]\n' +
      '    },\n' +
      '    "day30": {\n' +
      '      "title": "Multi-Touch Outreach & Discovery",\n' +
      '      "actions": [\n' +
      '        {"day": "11-15", "action": "Specific action", "owner": "Role", "deliverable": "Output"}\n' +
      '      ]\n' +
      '    },\n' +
      '    "day60": {\n' +
      '      "title": "Qualification & Value Demonstration",\n' +
      '      "actions": [\n' +
      '        {"day": "31-35", "action": "Specific action", "owner": "Role", "deliverable": "Output"}\n' +
      '      ]\n' +
      '    }\n' +
      '  }\n' +
      '}\n\n' +
      'Each phase should have 5-7 actions. Reference specific stakeholder names, ' + sellerName + ' Skills, and concrete deliverables.\n' +
      'Frame as: Land (Day 10) → Expand (Day 30) → Platform (Day 60).';

    try {
      var r4 = await AP.ApiClient.call(systemBase, call4Message, { maxTokens: 6144, jsonMode: true });
      var p4 = parseJSON(r4.text);
      if (p4 && p4.plan) plan.plan = p4.plan;
    } catch (err) { console.error('[PlanGen] Call 4 error:', err.message); }

    if (!plan.plan) {
      plan.plan = {
        day10: { title: 'Foundation & Intelligence Gathering', actions: [
          { day: '1-2', action: 'Finalize account plan and validate org structure', owner: 'AE', deliverable: 'Completed account plan' },
          { day: '3-5', action: 'Research existing tech ecosystem and AI investments', owner: 'SE', deliverable: 'Tech landscape brief' },
          { day: '6-8', action: 'Map mutual connections for warm introductions', owner: 'AE', deliverable: 'Connection map' },
          { day: '9-10', action: 'Prepare personalized outreach sequences', owner: 'AE + Marketing', deliverable: 'Outreach drafts' }
        ]},
        day30: { title: 'Multi-Touch Outreach & Discovery', actions: [
          { day: '11-15', action: 'Launch LinkedIn outreach to key stakeholders', owner: 'AE', deliverable: 'Connection requests sent' },
          { day: '16-20', action: 'Send targeted thought leadership content', owner: 'Marketing', deliverable: 'Content delivered' },
          { day: '21-25', action: 'Secure first discovery call', owner: 'AE', deliverable: 'Meeting scheduled' },
          { day: '26-30', action: 'Debrief and refine value hypothesis', owner: 'AE + SE', deliverable: 'Updated value prop' }
        ]},
        day60: { title: 'Qualification & Value Demonstration', actions: [
          { day: '31-40', action: 'Deliver tailored demo/workshop', owner: 'SE + AE', deliverable: 'Demo delivered' },
          { day: '41-50', action: 'Develop business case with company-specific data', owner: 'AE + Value Engineering', deliverable: 'Business case doc' },
          { day: '51-55', action: 'Present POC proposal to leadership', owner: 'AE', deliverable: 'POC proposal' },
          { day: '56-60', action: 'Secure POC agreement and next steps', owner: 'AE', deliverable: 'Signed POC' }
        ]}
      };
    }

    // ===== CALL 5: Risks + Success Metrics =====
    AP.EventBus.emit('plan:progress', { current: 5, total: 5, phase: 'Assessing risks & defining success metrics...' });

    var call5Message = 'Create risk assessment and success metrics for selling ' + sellerName + ' to:\n\n' + companyCtx +
      overviewContext + '\n' +
      'Top Priorities: ' + topPriorities + '\n' +
      'Stakeholders: ' + plan.stakeholders.slice(0, 3).map(function(s) { return s.name + ' (' + s.title + ')'; }).join(', ') + '\n' +
      '\nReturn JSON:\n' +
      '{\n' +
      '  "risks": [\n' +
      '    {"risk": "Specific risk for THIS deal", "likelihood": "High|Medium|Low", "impact": "High|Medium|Low", "mitigation": "2-3 SENTENCES with concrete, actionable mitigation steps"}\n' +
      '  ],\n' +
      '  "successMetrics": [\n' +
      '    {"metric": "Discovery meetings secured", "target": "3+", "timeline": "30 days", "measurement": "How to track this"},\n' +
      '    {"metric": "Champion identified", "target": "1", "timeline": "30 days", "measurement": "Named sponsor with budget authority"},\n' +
      '    {"metric": "Demo/workshop delivered", "target": "1", "timeline": "45 days", "measurement": "Completed session with stakeholder feedback"},\n' +
      '    {"metric": "POC/pilot agreement", "target": "1", "timeline": "60 days", "measurement": "Signed SOW or LOI"},\n' +
      '    {"metric": "Pipeline value created", "target": "$1M+ ACV", "timeline": "60 days", "measurement": "Qualified opportunity in CRM"},\n' +
      '    {"metric": "Executive sponsor alignment", "target": "C-level", "timeline": "60 days", "measurement": "Named exec champion"}\n' +
      '  ]\n' +
      '}\n\n' +
      'Generate 5-6 risks specific to THIS account (not generic). Consider:\n' +
      '- Organizational disruption or change management risks\n' +
      '- "We already have AI" objection\n' +
      '- Budget/procurement complexity\n' +
      '- Competitive displacement challenges\n' +
      '- New leadership freezing vendor decisions\n\n' +
      'Success metrics should be realistic for a 60-day sales engagement with this account.';

    try {
      var r5 = await AP.ApiClient.call(systemBase, call5Message, { maxTokens: 4096, jsonMode: true });
      var p5 = parseJSON(r5.text);
      if (p5) {
        plan.risks = p5.risks || [];
        plan.successMetrics = p5.successMetrics || [];
      }
    } catch (err) { console.error('[PlanGen] Call 5 error:', err.message); }

    // Fallback success metrics
    if (!plan.successMetrics || plan.successMetrics.length === 0) {
      plan.successMetrics = [
        { metric: 'Discovery meetings secured', target: '3+', timeline: '30 days', measurement: 'Meetings with key stakeholders' },
        { metric: 'Champion identified', target: '1', timeline: '30 days', measurement: 'Named internal sponsor' },
        { metric: 'Demo/workshop delivered', target: '1', timeline: '45 days', measurement: 'Completed session' },
        { metric: 'POC/pilot agreement', target: '1', timeline: '60 days', measurement: 'Signed agreement' },
        { metric: 'Pipeline value created', target: '$1M+ ACV', timeline: '60 days', measurement: 'CRM opportunity' },
        { metric: 'Executive sponsor alignment', target: 'C-level', timeline: '60 days', measurement: 'Named exec champion' }
      ];
    }

    return plan;
  }

  return { generate: generate };
})();
