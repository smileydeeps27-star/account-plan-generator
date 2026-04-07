/* ===== Account Plan Generator — Outreach Email Generator ===== */

AP.PlanOutreach = (function() {

  function parseJSON(text) {
    if (!text) return null;
    var cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    try { return JSON.parse(cleaned); } catch (e) { /* continue */ }

    // Try to extract JSON object
    var start = cleaned.indexOf('{');
    if (start === -1) return null;
    var depth = 0, inStr = false, esc = false;
    var end = -1;
    for (var i = start; i < cleaned.length; i++) {
      var ch = cleaned[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    var jsonStr = end > -1 ? cleaned.substring(start, end + 1) : cleaned.substring(start);
    try { return JSON.parse(jsonStr); } catch (e2) { /* continue */ }

    // Basic repair: fix unescaped newlines in strings, trailing commas
    var repaired = '';
    var rInStr = false, rEsc = false;
    for (var j = 0; j < jsonStr.length; j++) {
      var c = jsonStr[j];
      if (rEsc) { repaired += c; rEsc = false; continue; }
      if (c === '\\') { repaired += c; rEsc = true; continue; }
      if (c === '"') { rInStr = !rInStr; repaired += c; continue; }
      if (rInStr) {
        if (c === '\n') { repaired += '\\n'; continue; }
        if (c === '\r') { continue; }
        if (c === '\t') { repaired += '\\t'; continue; }
      }
      repaired += c;
    }
    repaired = repaired.replace(/,\s*([}\]])/g, '$1');
    try { return JSON.parse(repaired); } catch (e3) {
      console.error('[PlanOutreach] All JSON parse attempts failed');
      return null;
    }
  }

  async function generateEmails(plan, selections) {
    var sp = AP.SellerProfile.get() || {};
    var sellerName = sp.companyName || 'Our Company';
    var sellerCtx = AP.SellerProfile.getContextString();

    var overview = plan.overview || {};
    var strategy = plan.accountStrategy || {};
    var valueHyp = plan.valueHypothesis || {};
    var techLandscape = plan.technologyLandscape || {};

    // Build context blocks
    var companyContext = 'Company: ' + plan.companyName + '\n';
    if (overview.industry) companyContext += 'Industry: ' + overview.industry + '\n';
    if (overview.annualRevenue) companyContext += 'Revenue: ' + overview.annualRevenue + '\n';
    if (overview.employeeCount) companyContext += 'Employees: ' + overview.employeeCount + '\n';
    if (overview.strategicPriorities && overview.strategicPriorities.length) {
      companyContext += 'Strategic Priorities: ' + overview.strategicPriorities.slice(0, 3).join('; ') + '\n';
    }

    var strategyContext = '';
    if (strategy.positioning) strategyContext += 'Positioning: ' + strategy.positioning + '\n';
    if (strategy.whyAera) strategyContext += 'Why Us: ' + strategy.whyAera + '\n';
    if (strategy.whyNow) strategyContext += 'Why Now: ' + strategy.whyNow + '\n';

    var valuePitch = '';
    if (valueHyp.executivePitch) valuePitch = 'Executive Pitch: ' + valueHyp.executivePitch + '\n';

    var diContext = '';
    if (plan.diPriorities && plan.diPriorities.length > 0) {
      diContext = 'Top DI Priorities:\n' + plan.diPriorities.slice(0, 3).map(function(p) {
        return '- ' + p.area + ': ' + (p.context || '').substring(0, 150);
      }).join('\n') + '\n';
    }

    var techContext = '';
    if (techLandscape.knownSystems && techLandscape.knownSystems.length > 0) {
      techContext = 'Tech Stack: ' + techLandscape.knownSystems.map(function(s) {
        return s.vendor + (s.product ? ' ' + s.product : '');
      }).join(', ') + '\n';
    }

    var newsContext = '';
    if (plan.news && plan.news.length > 0) {
      newsContext = 'Recent News Headlines:\n' + plan.news.slice(0, 3).map(function(n) {
        return '- ' + n.headline;
      }).join('\n') + '\n';
    }

    // Build selections block
    var selectionsBlock = '\n--- EMAILS TO GENERATE ---\n';
    selections.forEach(function(sel, i) {
      var s = sel.stakeholder;
      selectionsBlock += '\nEmail ' + (i + 1) + ':\n';
      selectionsBlock += 'Recipient: ' + s.name + ', ' + s.title + '\n';
      selectionsBlock += 'Role in Deal: ' + (s.roleInDeal || 'Unknown') + '\n';
      if (s.notes) selectionsBlock += 'Notes: ' + s.notes + '\n';
      if (s.engagementStrategy) selectionsBlock += 'Engagement Strategy: ' + s.engagementStrategy + '\n';
      if (s.publicQuotes && s.publicQuotes.length > 0) {
        selectionsBlock += 'Public Quotes:\n';
        s.publicQuotes.forEach(function(q) {
          selectionsBlock += '  - "' + q.quote + '" (' + (q.source || '') + ')\n';
        });
      }
      selectionsBlock += 'Email Type: ' + sel.emailType + '\n';
      if (sel.customContext) selectionsBlock += 'Custom Context: ' + sel.customContext + '\n';
    });

    var systemPrompt = 'You are a world-class B2B sales email copywriter at ' + sellerName + '. Write highly personalized outreach emails.\n\nReturn ONLY valid JSON — no markdown fences, no explanation outside the JSON.' + sellerCtx;

    var userMessage = companyContext + '\n' + strategyContext + '\n' + valuePitch + '\n' + diContext + '\n' + techContext + '\n' + newsContext + '\n' + selectionsBlock +
      '\n--- INSTRUCTIONS ---\n' +
      'Generate one email per recipient above. Follow these rules:\n' +
      '- Each email under 150 words\n' +
      '- Professional but warm tone\n' +
      '- Reference specific details about the person (their quotes, their role\'s priorities)\n' +
      '- Clear call-to-action at the end\n' +
      '- Subject line under 60 characters, compelling and specific\n' +
      '- For "Cold Intro": reference a trigger (news, quote, or industry trend)\n' +
      '- For "Insight Share": lead with a relevant insight, not a sales pitch\n' +
      '- For "Executive Briefing Request": propose specific topic aligned to their priorities\n' +
      '- For "Event Invite": reference a relevant upcoming event or webinar\n' +
      '- For "Follow-up": reference previous interaction and propose concrete next step\n\n' +
      'Return JSON:\n' +
      '{\n' +
      '  "emails": [\n' +
      '    {\n' +
      '      "to": "Full Name",\n' +
      '      "title": "Their Title",\n' +
      '      "type": "Email Type",\n' +
      '      "subject": "Subject line",\n' +
      '      "body": "Email body with paragraphs separated by \\n\\n"\n' +
      '    }\n' +
      '  ]\n' +
      '}';

    var response = await AP.ApiClient.call(systemPrompt, userMessage, { maxTokens: 8192, jsonMode: true });
    var parsed = parseJSON(response.text);

    if (!parsed || !parsed.emails) {
      throw new Error('Failed to parse email generation response');
    }

    plan.outreachEmails = parsed.emails;
    AP.AppStore.set('currentPlan', plan);
    return parsed.emails;
  }

  return { generateEmails: generateEmails };
})();
