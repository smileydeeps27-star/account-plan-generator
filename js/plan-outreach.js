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

    // Enhancement 2a: value chain hot-spots — the highest-signal anchors for a cold-touch email
    var valueChainContext = '';
    if (plan.valueChain && plan.valueChain.aeraHotSpots && plan.valueChain.aeraHotSpots.length > 0) {
      valueChainContext = 'Value Chain Hot-Spots (specific execution gaps where Aera lands hardest):\n' +
        plan.valueChain.aeraHotSpots.slice(0, 3).map(function(h) {
          return '- [' + (h.location || '') + '] ' + (h.pain || '') +
            (h.estimatedImpact ? ' | Impact: ' + h.estimatedImpact : '');
        }).join('\n') + '\n';
    }

    // Enhancement 2b: biggest KPI gaps — quantifiable anchors ("OTIF 5.5pp below world-class")
    var kpiGapContext = '';
    if (plan.kpiBenchmarks && plan.kpiBenchmarks.supplyChainKpis) {
      var gapsBelow = plan.kpiBenchmarks.supplyChainKpis.filter(function(k) {
        return /below/i.test(k.gapToBenchmark || '');
      });
      if (gapsBelow.length > 0) {
        kpiGapContext = 'Biggest KPI Gaps vs Benchmark (quantifiable anchors for opening lines):\n' +
          gapsBelow.slice(0, 3).map(function(k) {
            return '- ' + k.kpi + ': ' + (k.companyPerformance || 'company perf') + ' — ' + (k.gapToBenchmark || '') +
              (k.aeraLever ? ' | Aera lever: ' + k.aeraLever : '');
          }).join('\n') + '\n';
      }
    }

    // Enhancement 1: Aera customer list — hard guardrail against fabricating customers
    var aeraCustomerList = (AP.AeraCustomers && AP.AeraCustomers.listString) || '';
    var customerGuardBlock = aeraCustomerList ?
      '\n--- APPROVED AERA CUSTOMER LIST (cite ONLY these — never invent others) ---\n' + aeraCustomerList + '\n' : '';

    var aeraContent = AP.AeraContent ? AP.AeraContent.getContextString() : '';

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

    var aeraContentBlock = '';
    if (aeraContent) {
      aeraContentBlock = '\nAERA CONTENT & EVENTS (use these in emails — include real URLs):\n' + aeraContent + '\n\n' +
        'IMPORTANT CONTENT RULES:\n' +
        '- For "Event Invite" emails: Reference a specific upcoming event with its date, location, and registration URL\n' +
        '- For "Insight Share" emails: Reference a specific whitepaper or blog with its URL\n' +
        '- For "Cold Intro" emails: Mention Gartner Leader status and include a relevant customer story URL\n' +
        '- For "Executive Briefing Request" emails: Reference relevant analyst recognition with URL and propose a specific topic\n' +
        '- For "Follow-up" emails: Include a relevant whitepaper or blog link as a value-add\n' +
        '- EVERY email type MUST include at least one relevant Aera URL from the content above\n' +
        '- Put each URL on its OWN line in the email body so it is clearly visible and clickable\n' +
        '- Pick the MOST RELEVANT content for each stakeholder\'s role and industry\n';
    }

    var userMessage = companyContext + '\n' + strategyContext + '\n' + valuePitch + '\n' + diContext + '\n' +
      techContext + '\n' + newsContext + '\n' + valueChainContext + '\n' + kpiGapContext + '\n' +
      customerGuardBlock + '\n' + aeraContentBlock + '\n' + selectionsBlock +
      '\n--- INSTRUCTIONS ---\n' +
      'Generate one email per recipient above. Follow these rules:\n\n' +
      'LENGTH & TONE:\n' +
      '- Aim for 150-200 words per email — scannable in 20 seconds, but do NOT strip substance to hit a word count.\n' +
      '- Professional but warm; direct, not fluffy. Zero cliché ("in today\'s fast-moving landscape…").\n' +
      '- Subject line under 60 characters, compelling and specific to the recipient — never generic.\n\n' +
      'PERSONALISATION (mandatory):\n' +
      '- Open with a genuine specific — their public quote, a recent initiative in their remit, or a role-relevant observation. Never open with "I hope this finds you well".\n' +
      '- Reference at least one concrete signal from the plan context above (a value-chain hot-spot, a KPI benchmark gap, a news item, or a strategic priority). Do not open a generic template.\n\n' +
      'DIAGNOSTIC HYPOTHESIS PATTERN (Cold Intro + Executive Briefing Request):\n' +
      '- After the specific anchor, offer a diagnostic hypothesis in the form: "I\'d guess the challenge isn\'t X, but Y" — where X is the obvious/surface issue and Y is the real execution-gap problem Aera addresses. This shows insight and invites confirmation without presuming to know their org.\n' +
      '- Then land the Aera play in 1-2 short sentences using plain-English URAL: senses/recommends/executes/learns — never use the term "URAL" itself.\n\n' +
      'PROOF POINTS — HARD RULE (anti-hallucination):\n' +
      '- When citing Aera customers, use ONLY companies from the APPROVED AERA CUSTOMER LIST above.\n' +
      '- Prefer 1-2 customers whose industry/segment matches the recipient\'s (e.g., Dell for data-centre supply chains, Mars/KraftHeinz for CPG, Rio Tinto for industrial commodities, ExxonMobil for energy, AstraZeneca/GSK/Merck for pharma).\n' +
      '- Never invent customer names or claim customers not on the approved list. If no listed customer fits, drop the proof-point rather than fabricating.\n\n' +
      'CALL-TO-ACTION:\n' +
      '- Prefer QUESTION-BASED CTAs over meeting-asks (question CTAs get much higher reply rates). Examples: "Curious — is [company] already treating X as a distinct planning stream, or still running it through the [status-quo] cadence?" | "Worth 15 minutes on how [company] is handling [specific challenge]?"\n' +
      '- The question should reference a specific detail from the email body — never a generic "let\'s connect?"\n\n' +
      'EMAIL-TYPE-SPECIFIC RULES:\n' +
      '- "Cold Intro": open with the anchor, use the diagnostic hypothesis pattern, close with a question CTA. Include at least one Aera customer reference from the approved list.\n' +
      '- "Insight Share": lead with a hard insight (KPI benchmark, industry data point, or hot-spot), not a sales pitch. Include a whitepaper/blog URL from Aera content.\n' +
      '- "Executive Briefing Request": propose a specific topic aligned to their DI Priority. Reference analyst recognition (Gartner Leader, etc.) with URL. Use diagnostic hypothesis.\n' +
      '- "Event Invite": reference a specific upcoming event with date, location, and registration URL from Aera content.\n' +
      '- "Follow-up": reference previous interaction and propose a concrete next step. Include a value-add link (whitepaper/blog) from Aera content.\n\n' +
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
