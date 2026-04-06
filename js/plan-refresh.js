/* ===== Account Plan Generator — Plan Refresh from Meeting Notes ===== */

AP.PlanRefresh = (function() {

  // ===== JSON Repair Utilities (duplicated from plan-generator for module isolation) =====

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
    try { return JSON.parse(repaired); } catch (e3) {
      console.error('[PlanRefresh] Parse failed after repair:', e3.message);
    }
    return null;
  }

  // ===== Context helpers =====

  function stakeholdersSummary(stakeholders) {
    if (!stakeholders || !stakeholders.length) return 'No existing stakeholders.';
    return stakeholders.map(function(s) {
      return '- ' + (s.name || 'Unknown') + ' (' + (s.title || '') + '): ' +
        (s.engagementStrategy || s.notes || '');
    }).join('\n');
  }

  function risksSummary(risks) {
    if (!risks || !risks.length) return 'No existing risks documented.';
    return risks.map(function(r) {
      return '- [' + (r.severity || 'Medium') + '] ' + (r.risk || r.description || '') +
        (r.mitigation ? ' | Mitigation: ' + r.mitigation : '');
    }).join('\n');
  }

  function strategySummary(strategy) {
    if (!strategy) return 'No existing account strategy.';
    var parts = [];
    if (strategy.approachSummary) parts.push('Approach: ' + strategy.approachSummary);
    if (strategy.landingPlay) parts.push('Landing Play: ' + strategy.landingPlay);
    if (strategy.expandPlays && strategy.expandPlays.length) {
      parts.push('Expand Plays: ' + strategy.expandPlays.join('; '));
    }
    return parts.length ? parts.join('\n') : JSON.stringify(strategy).substring(0, 500);
  }

  function nextStepsSummary(steps) {
    if (!steps || !steps.length) return 'No existing next steps.';
    return steps.map(function(s, i) {
      return (i + 1) + '. ' + (s.action || s.step || JSON.stringify(s));
    }).join('\n');
  }

  // ===== MAIN REFRESH FUNCTION =====

  async function refreshFromNotes(plan, meetingNotes) {
    var sellerCtx = AP.SellerProfile.getContextString();
    var sp = AP.SellerProfile.get() || {};
    var sellerName = sp.companyName || 'Our Company';
    var TOTAL_STEPS = 2;

    var systemPrompt = 'You are a world-class B2B enterprise sales strategist at ' + sellerName +
      '. You are updating an existing account plan based on new meeting notes. ' +
      'Preserve existing information that is still valid. Add new information from the meeting. ' +
      'Update engagement strategies and assessments where the meeting provides new insight.\n\n' +
      'Return ONLY valid JSON — no markdown fences, no explanation outside the JSON.' + sellerCtx;

    // ===== CALL A: Refresh stakeholders + next steps =====
    AP.EventBus.emit('plan:progress', {
      current: 1, total: TOTAL_STEPS,
      phase: 'Updating stakeholders & next steps...'
    });

    var callAMsg = 'ACCOUNT: ' + (plan.companyName || 'Unknown') + '\n\n' +
      '--- MEETING NOTES ---\n' + meetingNotes + '\n---\n\n' +
      '--- CURRENT STAKEHOLDERS ---\n' + stakeholdersSummary(plan.stakeholders) + '\n---\n\n' +
      '--- CURRENT NEXT STEPS ---\n' + nextStepsSummary(plan.nextFiveSteps) + '\n---\n\n' +
      'Based on the meeting notes, UPDATE the stakeholders list and next steps.\n\n' +
      'For stakeholders:\n' +
      '- Keep existing stakeholders that are still relevant\n' +
      '- Add any new people mentioned in the meeting\n' +
      '- Update engagement strategies based on what was discussed\n' +
      '- Update sentiment/relationship status if the meeting reveals changes\n\n' +
      'For next steps:\n' +
      '- Replace next steps that are now completed or outdated\n' +
      '- Add new action items from the meeting\n' +
      '- Keep existing steps that are still pending and relevant\n\n' +
      'Return JSON:\n' +
      '{\n' +
      '  "stakeholders": [\n' +
      '    {"name": "Full Name", "title": "Job Title", "role": "Decision Maker|Champion|Influencer|Blocker|End User", "sentiment": "Positive|Neutral|Skeptical|Negative", "engagementStrategy": "Specific strategy based on meeting insights", "notes": "Key observations from meeting"}\n' +
      '  ],\n' +
      '  "nextFiveSteps": [\n' +
      '    {"action": "Specific action item", "owner": "Who is responsible", "deadline": "Timeframe", "priority": "High|Medium|Low"}\n' +
      '  ]\n' +
      '}';

    var resultA = null;
    try {
      var rA = await AP.ApiClient.call(systemPrompt, callAMsg, { jsonMode: true, maxTokens: 4096 });
      resultA = parseJSON(rA.text);
      if (!resultA) console.warn('[PlanRefresh] Call A: failed to parse JSON');
    } catch (err) {
      console.error('[PlanRefresh] Call A error:', err.message);
    }

    // ===== CALL B: Refresh risks + account strategy =====
    AP.EventBus.emit('plan:progress', {
      current: 2, total: TOTAL_STEPS,
      phase: 'Updating risks & account strategy...'
    });

    var callBMsg = 'ACCOUNT: ' + (plan.companyName || 'Unknown') + '\n\n' +
      '--- MEETING NOTES ---\n' + meetingNotes + '\n---\n\n' +
      '--- CURRENT RISKS ---\n' + risksSummary(plan.risks) + '\n---\n\n' +
      '--- CURRENT ACCOUNT STRATEGY ---\n' + strategySummary(plan.accountStrategy) + '\n---\n\n' +
      'Based on the meeting notes, UPDATE the risks and account strategy.\n\n' +
      'For risks:\n' +
      '- Keep existing risks that are still relevant\n' +
      '- Add new risks surfaced in the meeting\n' +
      '- Remove or downgrade risks that the meeting resolved\n' +
      '- Update mitigations based on new information\n\n' +
      'For account strategy:\n' +
      '- Refine the approach based on meeting learnings\n' +
      '- Update landing/expand plays if the meeting changes the strategy\n' +
      '- Keep what still applies, adjust what the meeting impacts\n\n' +
      'Return JSON:\n' +
      '{\n' +
      '  "risks": [\n' +
      '    {"risk": "Description of risk", "severity": "High|Medium|Low", "likelihood": "High|Medium|Low", "mitigation": "Mitigation strategy", "notes": "Context from meeting"}\n' +
      '  ],\n' +
      '  "accountStrategy": {\n' +
      '    "approachSummary": "Updated overall approach",\n' +
      '    "landingPlay": "Updated initial engagement strategy",\n' +
      '    "expandPlays": ["Updated expand strategies"],\n' +
      '    "keyMessages": ["Updated key messages for stakeholders"],\n' +
      '    "competitivePositioning": "Updated positioning based on meeting intel"\n' +
      '  }\n' +
      '}';

    var resultB = null;
    try {
      var rB = await AP.ApiClient.call(systemPrompt, callBMsg, { jsonMode: true, maxTokens: 4096 });
      resultB = parseJSON(rB.text);
      if (!resultB) console.warn('[PlanRefresh] Call B: failed to parse JSON');
    } catch (err) {
      console.error('[PlanRefresh] Call B error:', err.message);
    }

    // ===== Merge results into plan =====
    if (resultA) {
      if (resultA.stakeholders && resultA.stakeholders.length) {
        plan.stakeholders = resultA.stakeholders;
      }
      if (resultA.nextFiveSteps && resultA.nextFiveSteps.length) {
        plan.nextFiveSteps = resultA.nextFiveSteps;
      }
    }

    if (resultB) {
      if (resultB.risks && resultB.risks.length) {
        plan.risks = resultB.risks;
      }
      if (resultB.accountStrategy) {
        plan.accountStrategy = resultB.accountStrategy;
      }
    }

    plan.lastRefreshedAt = new Date().toISOString();
    return plan;
  }

  return { refreshFromNotes: refreshFromNotes };
})();
