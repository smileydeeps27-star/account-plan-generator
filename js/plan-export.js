/* ===== Account Plan Generator — Export (Markdown + Word) ===== */

AP.PlanExport = (function() {

  function toMarkdown(plan) {
    var sp = AP.SellerProfile.get() || {};
    var sellerName = sp.companyName || 'Our Company';
    var o = plan.overview || {};
    var lines = [];

    lines.push('# Account Plan: ' + plan.companyName);
    lines.push('');
    lines.push('**Prepared by:** ' + sellerName);
    lines.push('**Date:** ' + AP.formatDate(plan.generatedAt));
    if (plan.userInputs && plan.userInputs.dealStage) lines.push('**Deal Stage:** ' + plan.userInputs.dealStage);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Module 1: Overview
    lines.push('## Account Overview');
    lines.push('');
    lines.push('| Field | Detail |');
    lines.push('|-------|--------|');
    if (plan.companyName) lines.push('| **Company** | ' + plan.companyName + ' |');
    if (o.hqLocation) lines.push('| **HQ** | ' + o.hqLocation + ' |');
    if (o.industry) lines.push('| **Industry** | ' + o.industry + ' |');
    if (o.employeeCount) lines.push('| **Employees** | ' + o.employeeCount + ' |');
    if (o.ticker) lines.push('| **Ticker** | ' + o.ticker + ' |');
    if (o.website) lines.push('| **Website** | ' + o.website + ' |');
    lines.push('');

    if (o.financialSnapshot && o.financialSnapshot.length > 0) {
      lines.push('### Financial Snapshot');
      lines.push('');
      lines.push('| Metric | Current Year | Prior Year | Notes |');
      lines.push('|--------|-------------|------------|-------|');
      o.financialSnapshot.forEach(function(row) {
        lines.push('| **' + (row.metric || '') + '** | ' + (row.currentYear || '') + ' | ' + (row.priorYear || '') + ' | ' + (row.notes || '') + ' |');
      });
      lines.push('');
    }

    if (o.businessGroups && o.businessGroups.length > 0) {
      lines.push('### Business Groups');
      lines.push('');
      o.businessGroups.forEach(function(bg, i) {
        var line = (i + 1) + '. **' + bg.name + '**';
        if (bg.revenueShare) line += ' (' + bg.revenueShare + ')';
        if (bg.description) line += ' — ' + bg.description;
        lines.push(line);
      });
      lines.push('');
    }

    if (o.strategicPriorities && o.strategicPriorities.length > 0) {
      lines.push('### Strategic Priorities');
      lines.push('');
      o.strategicPriorities.forEach(function(p, i) { lines.push((i + 1) + '. ' + p); });
      lines.push('');
    }

    lines.push('---');
    lines.push('');

    // Module 2: News
    lines.push('## News Highlights');
    lines.push('');
    if (plan.news && plan.news.length > 0) {
      plan.news.forEach(function(n, i) {
        lines.push('### ' + (i + 1) + '. ' + n.headline + (n.date ? ' (' + n.date + ')' : ''));
        if (n.detail) lines.push(n.detail);
        if (n.source) lines.push('*Source: ' + n.source + '*');
        lines.push('');
      });
    }
    lines.push('---');
    lines.push('');

    // Module 3: Technology Landscape
    var t = plan.technologyLandscape || {};
    if (t.knownSystems && t.knownSystems.length > 0) {
      lines.push('## Technology Landscape');
      lines.push('');
      lines.push('| Category | Vendor | Product | Evidence | Confidence |');
      lines.push('|----------|--------|---------|----------|------------|');
      t.knownSystems.forEach(function(s) {
        lines.push('| ' + (s.category || '') + ' | **' + (s.vendor || '') + '** | ' + (s.product || '') + ' | ' + (s.evidence || '') + ' | ' + (s.confidence || '') + ' |');
      });
      lines.push('');
      if (t.digitalStrategy) { lines.push('**Digital Strategy:** ' + t.digitalStrategy); lines.push(''); }
      if (t.itLeadership) { lines.push('**IT Leadership:** ' + t.itLeadership); lines.push(''); }
      if (t.techBudget) { lines.push('**IT Spend:** ' + t.techBudget); lines.push(''); }
      lines.push('---');
      lines.push('');
    }

    // Module 4: DI Priorities
    lines.push('## Decision Intelligence Priorities');
    lines.push('');
    if (plan.diPriorities && plan.diPriorities.length > 0) {
      plan.diPriorities.forEach(function(p, i) {
        lines.push('### Priority ' + (p.rank || (i + 1)) + ': ' + p.area + (p.urgency ? ' [' + p.urgency + ']' : ''));
        if (p.context) lines.push('**Context:** ' + p.context);
        lines.push('');
        if (p.sellerValueProp) lines.push('**Value Proposition:** ' + p.sellerValueProp);
        lines.push('');
        if (p.estimatedImpact) lines.push('**Estimated Impact:** ' + p.estimatedImpact);
        lines.push('');
      });
    }
    lines.push('---');
    lines.push('');

    // Module 5: Stakeholders
    lines.push('## Stakeholder Mapping');
    lines.push('');
    if (plan.stakeholders && plan.stakeholders.length > 0) {
      plan.stakeholders.forEach(function(s) {
        lines.push('### ' + (s.name || '') + ' — ' + (s.title || ''));
        lines.push('**Role:** ' + (s.roleInDeal || '') + ' | **Relevance:** ' + (s.relevance || '') + (s.confidence ? ' | **Confidence:** ' + s.confidence : ''));
        if (s.notes) lines.push(s.notes);
        if (s.engagementStrategy) lines.push('**Engagement Strategy:** ' + s.engagementStrategy);
        if (s.publicQuotes && s.publicQuotes.length > 0) {
          lines.push('');
          s.publicQuotes.forEach(function(q) {
            lines.push('> "' + q.quote + '"');
            lines.push('> — ' + (q.source || '') + (q.date ? ' (' + q.date + ')' : ''));
          });
        }
        lines.push('');
      });
    }
    lines.push('---');
    lines.push('');

    // Module 6: Competitive
    lines.push('## Competitive Landscape');
    lines.push('');
    var c = plan.competitive || {};
    if (c.positioning) { lines.push(c.positioning); lines.push(''); }
    if (c.landscape && c.landscape.length > 0) {
      c.landscape.forEach(function(comp) {
        lines.push('### ' + (comp.competitor || '') + (comp.presence ? ' (' + comp.presence + ')' : '') + (comp.userReported ? ' *User Reported*' : ''));
        if (comp.weakness) lines.push('**Weakness:** ' + comp.weakness);
        if (comp.sellerAdvantage || comp.aeraAdvantage) lines.push('**Our Advantage:** ' + (comp.sellerAdvantage || comp.aeraAdvantage));
        if (comp.battleCard) lines.push('**Talk Track:** ' + comp.battleCard);
        lines.push('');
      });
    }
    lines.push('---');
    lines.push('');

    // Module 7: Value Hypothesis
    lines.push('## Value Hypothesis');
    lines.push('');
    var v = plan.valueHypothesis || {};
    if (v.executivePitch) { lines.push('**Executive Pitch:** ' + v.executivePitch); lines.push(''); }
    if (v.whyNow) { lines.push('**Why Now:** ' + v.whyNow); lines.push(''); }
    if (v.metrics && v.metrics.length > 0) {
      lines.push('| Metric | Impact | Confidence | Basis |');
      lines.push('|--------|--------|------------|-------|');
      v.metrics.forEach(function(m) {
        lines.push('| **' + (m.metric || '') + '** | ' + (m.impact || '') + ' | ' + (m.confidence || '') + ' | ' + (m.basis || '') + ' |');
      });
      lines.push('');
    }
    lines.push('---');
    lines.push('');

    // Module 8: Account Strategy
    var strat = plan.accountStrategy || {};
    if (strat.positioning || strat.whyAera) {
      lines.push('## Account Strategy');
      lines.push('');
      if (strat.positioning) { lines.push('**Positioning:** ' + strat.positioning); lines.push(''); }
      if (strat.whyAera) { lines.push('**Why Aera:** ' + strat.whyAera); lines.push(''); }
      if (strat.whyNow) { lines.push('**Why Now:** ' + strat.whyNow); lines.push(''); }
      if (strat.landingZone) { lines.push('**Landing Zone:** ' + strat.landingZone); lines.push(''); }
      if (strat.keyMessages && strat.keyMessages.length > 0) {
        lines.push('### Key Messages');
        strat.keyMessages.forEach(function(m, i) { lines.push((i + 1) + '. ' + m); });
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    }

    // Module 9: 30-60-90 Day Plan
    lines.push('## 30-60-90 Day Engagement Plan');
    lines.push('');
    var dp = plan.dayPlan || {};
    var phases = [
      { key: 'day30', label: 'Days 1-30' },
      { key: 'day60', label: 'Days 31-60' },
      { key: 'day90', label: 'Days 61-90' }
    ];
    phases.forEach(function(phase) {
      var data = dp[phase.key];
      if (!data) return;
      lines.push('### ' + phase.label + ': ' + (data.title || ''));
      if (data.whatGoodLooksLike) lines.push('**What Good Looks Like:** ' + data.whatGoodLooksLike);
      lines.push('');
      if (data.actions && data.actions.length > 0 && typeof data.actions[0] === 'object') {
        lines.push('| Day | Action | Owner | Deliverable |');
        lines.push('|-----|--------|-------|-------------|');
        data.actions.forEach(function(a) {
          lines.push('| ' + (a.day || '') + ' | ' + (a.action || '') + ' | ' + (a.owner || '') + ' | ' + (a.deliverable || '') + ' |');
        });
        lines.push('');
      }
    });

    // Next 5 Steps
    if (plan.nextFiveSteps && plan.nextFiveSteps.length > 0) {
      lines.push('### Next 5 Steps');
      lines.push('');
      plan.nextFiveSteps.forEach(function(s, i) {
        lines.push((s.step || (i + 1)) + '. **' + s.action + '** — Owner: ' + (s.owner || '') + ' | By: ' + (s.by || '') + ' | Outcome: ' + (s.outcome || ''));
      });
      lines.push('');
    }

    // Action Tracker
    if (plan.actionTracker && plan.actionTracker.length > 0) {
      lines.push('### Action Tracker');
      lines.push('');
      lines.push('| Status | Action | Owner | Due Date |');
      lines.push('|--------|--------|-------|----------|');
      plan.actionTracker.forEach(function(a) {
        lines.push('| ' + (a.status || '') + ' | ' + (a.action || '') + ' | ' + (a.owner || '') + ' | ' + (a.dueDate || '') + ' |');
      });
      var atDone = plan.actionTracker.filter(function(a) { return a.status === 'Done'; }).length;
      lines.push('');
      lines.push('**Progress:** ' + atDone + '/' + plan.actionTracker.length + ' complete (' + Math.round(atDone / plan.actionTracker.length * 100) + '%)');
      lines.push('');
    }

    lines.push('---');
    lines.push('');

    // Module 10: Risks & Metrics
    lines.push('## Key Risks & Mitigations');
    lines.push('');
    if (plan.risks && plan.risks.length > 0) {
      plan.risks.forEach(function(r) {
        lines.push('### ' + (r.risk || '') + (r.category ? ' [' + r.category + ']' : '') + (r.userReported ? ' *User Reported*' : ''));
        lines.push('**Likelihood:** ' + (r.likelihood || '') + ' | **Impact:** ' + (r.impact || '') + (r.owner ? ' | **Owner:** ' + r.owner : ''));
        if (r.mitigation) lines.push('**Mitigation:** ' + r.mitigation);
        lines.push('');
      });
    }

    lines.push('## Success Metrics');
    lines.push('');
    if (plan.successMetrics && plan.successMetrics.length > 0) {
      lines.push('| Metric | Target | Timeline | Measurement |');
      lines.push('|--------|--------|----------|-------------|');
      plan.successMetrics.forEach(function(m) {
        lines.push('| ' + (m.metric || '') + ' | ' + (m.target || '') + ' | ' + (m.timeline || '') + ' | ' + (m.measurement || '') + ' |');
      });
      lines.push('');
    }

    lines.push('---');
    lines.push('*Generated by ' + sellerName + ' Account Plan Generator. ' + AP.formatDate(plan.generatedAt) + '.*');

    return lines.join('\n');
  }

  function toClipboard(plan) {
    var md = toMarkdown(plan);
    AP.copyToClipboard(md);
  }

  /* --- Word (.docx) Export --- */
  var docxLoaded = false;

  function loadDocxLib() {
    return new Promise(function(resolve, reject) {
      if (docxLoaded && window.docx) { resolve(); return; }
      var script = document.createElement('script');
      script.src = 'https://unpkg.com/docx@9.0.2/build/index.umd.js';
      script.onload = function() { docxLoaded = true; resolve(); };
      script.onerror = function() { reject(new Error('Failed to load docx library')); };
      document.head.appendChild(script);
    });
  }

  async function toDocx(plan) {
    try { await loadDocxLib(); } catch (err) { AP.showToast('Failed to load Word export library', 'error'); return; }

    var D = window.docx;
    var sp = AP.SellerProfile.get() || {};
    var sellerName = sp.companyName || 'Our Company';
    var o = plan.overview || {};
    var children = [];

    children.push(new D.Paragraph({ children: [new D.TextRun({ text: 'Account Plan: ' + plan.companyName, bold: true, size: 48 })], heading: D.HeadingLevel.TITLE, spacing: { after: 200 } }));
    children.push(new D.Paragraph({ children: [new D.TextRun({ text: 'Prepared by: ' + sellerName + '  |  ' + AP.formatDate(plan.generatedAt), color: '666666', size: 20 })], spacing: { after: 400 } }));

    function heading(text, level) {
      children.push(new D.Paragraph({ children: [new D.TextRun({ text: text, bold: true, size: level === 1 ? 32 : 26 })], heading: level === 1 ? D.HeadingLevel.HEADING_1 : D.HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }));
    }
    function para(text) {
      if (!text) return;
      children.push(new D.Paragraph({ children: [new D.TextRun({ text: text, size: 22 })], spacing: { after: 120 } }));
    }
    // US Letter with 1" margins = 9360 DXA content width
    var PAGE_W = 9360;
    var cellBorder = { style: D.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
    var cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
    var cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

    function addTable(headers, rows) {
      var colCount = headers.length;
      var colW = Math.floor(PAGE_W / colCount);
      var colWidths = headers.map(function() { return colW; });
      // Give remaining space to last column
      colWidths[colCount - 1] = PAGE_W - colW * (colCount - 1);

      var tableRows = [];
      tableRows.push(new D.TableRow({ children: headers.map(function(h, i) {
        return new D.TableCell({
          borders: cellBorders,
          width: { size: colWidths[i], type: D.WidthType.DXA },
          shading: { fill: 'D5E8F0', type: D.ShadingType ? D.ShadingType.CLEAR : 'clear' },
          margins: cellMargins,
          children: [new D.Paragraph({ children: [new D.TextRun({ text: h, bold: true, size: 18, font: 'Arial' })] })]
        });
      }) }));
      rows.forEach(function(row) {
        tableRows.push(new D.TableRow({ children: row.map(function(cell, i) {
          return new D.TableCell({
            borders: cellBorders,
            width: { size: colWidths[i], type: D.WidthType.DXA },
            margins: cellMargins,
            children: [new D.Paragraph({ children: [new D.TextRun({ text: String(cell || ''), size: 20, font: 'Arial' })] })]
          });
        }) }));
      });
      children.push(new D.Table({ rows: tableRows, width: { size: PAGE_W, type: D.WidthType.DXA }, columnWidths: colWidths }));
    }

    // Overview
    heading('Account Overview', 1);
    var profileRows = [];
    if (o.industry) profileRows.push(['Industry', o.industry]);
    if (o.hqLocation) profileRows.push(['HQ', o.hqLocation]);
    if (o.annualRevenue) profileRows.push(['Revenue', o.annualRevenue]);
    if (o.employeeCount) profileRows.push(['Employees', o.employeeCount]);
    if (o.ticker) profileRows.push(['Ticker', o.ticker]);
    if (profileRows.length) addTable(['Field', 'Detail'], profileRows);

    if (o.financialSnapshot && o.financialSnapshot.length) {
      heading('Financial Snapshot', 2);
      addTable(['Metric', 'Current Year', 'Prior Year', 'Notes'], o.financialSnapshot.map(function(r) { return [r.metric, r.currentYear, r.priorYear, r.notes]; }));
    }
    if (o.strategicPriorities && o.strategicPriorities.length) {
      heading('Strategic Priorities', 2);
      o.strategicPriorities.forEach(function(p, i) { para((i + 1) + '. ' + p); });
    }

    // News
    if (plan.news && plan.news.length) {
      heading('News Highlights', 1);
      plan.news.forEach(function(n, i) {
        children.push(new D.Paragraph({ children: [new D.TextRun({ text: (i + 1) + '. ' + n.headline, bold: true, size: 22 })], spacing: { before: 150, after: 60 } }));
        if (n.detail) para(n.detail);
      });
    }

    // Tech Landscape
    var t = plan.technologyLandscape || {};
    if (t.knownSystems && t.knownSystems.length) {
      heading('Technology Landscape', 1);
      addTable(['Category', 'Vendor', 'Product', 'Evidence', 'Confidence'], t.knownSystems.map(function(s) { return [s.category || '', s.vendor || '', s.product || '', s.evidence || '', s.confidence || '']; }));
      if (t.digitalStrategy) para('Digital Strategy: ' + t.digitalStrategy);
    }

    // DI Priorities
    if (plan.diPriorities && plan.diPriorities.length) {
      heading('Decision Intelligence Priorities', 1);
      plan.diPriorities.forEach(function(p, i) {
        children.push(new D.Paragraph({ children: [new D.TextRun({ text: 'Priority ' + (p.rank || (i + 1)) + ': ' + p.area + (p.urgency ? ' [' + p.urgency + ']' : ''), bold: true, size: 24 })], spacing: { before: 200, after: 80 } }));
        if (p.context) para('Context: ' + p.context);
        if (p.sellerValueProp) para('Value Proposition: ' + p.sellerValueProp);
        if (p.estimatedImpact) para('Estimated Impact: ' + p.estimatedImpact);
      });
    }

    // Stakeholders
    if (plan.stakeholders && plan.stakeholders.length) {
      heading('Stakeholder Mapping', 1);
      plan.stakeholders.forEach(function(s) {
        children.push(new D.Paragraph({ children: [new D.TextRun({ text: (s.name || '') + ' — ' + (s.title || ''), bold: true, size: 22 })], spacing: { before: 150, after: 60 } }));
        para('Role: ' + (s.roleInDeal || '') + ' | Relevance: ' + (s.relevance || ''));
        if (s.notes) para(s.notes);
        if (s.engagementStrategy) para('Engagement: ' + s.engagementStrategy);
      });
    }

    // Competitive
    var comp = plan.competitive || {};
    if (comp.positioning || (comp.landscape && comp.landscape.length)) {
      heading('Competitive Landscape', 1);
      if (comp.positioning) para(comp.positioning);
      if (comp.landscape && comp.landscape.length) {
        addTable(['Competitor', 'Presence', 'Weakness', 'Our Advantage', 'Talk Track'],
          comp.landscape.map(function(c) { return [c.competitor, c.presence || '', c.weakness, c.sellerAdvantage || c.aeraAdvantage || '', c.battleCard || '']; }));
      }
    }

    // Value Hypothesis
    var val = plan.valueHypothesis || {};
    if (val.executivePitch || (val.metrics && val.metrics.length)) {
      heading('Value Hypothesis', 1);
      if (val.executivePitch) para(val.executivePitch);
      if (val.whyNow) para('Why Now: ' + val.whyNow);
      if (val.metrics && val.metrics.length) {
        addTable(['Metric', 'Impact', 'Confidence', 'Basis'], val.metrics.map(function(m) { return [m.metric, m.impact, m.confidence, m.basis || '']; }));
      }
    }

    // Account Strategy
    var strat = plan.accountStrategy || {};
    if (strat.positioning || strat.whyAera) {
      heading('Account Strategy', 1);
      if (strat.positioning) para('Positioning: ' + strat.positioning);
      if (strat.whyAera) para('Why Aera: ' + strat.whyAera);
      if (strat.whyNow) para('Why Now: ' + strat.whyNow);
      if (strat.landingZone) para('Landing Zone: ' + strat.landingZone);
      if (strat.keyMessages && strat.keyMessages.length) {
        heading('Key Messages', 2);
        strat.keyMessages.forEach(function(m, i) { para((i + 1) + '. ' + m); });
      }
    }

    // 30-60-90 Day Plan
    var dp = plan.dayPlan || {};
    if (dp.day30 || dp.day60 || dp.day90) {
      heading('30-60-90 Day Engagement Plan', 1);
      [{ key: 'day30', label: 'Days 1-30' }, { key: 'day60', label: 'Days 31-60' }, { key: 'day90', label: 'Days 61-90' }].forEach(function(phase) {
        var data = dp[phase.key];
        if (!data) return;
        heading(phase.label + ': ' + (data.title || ''), 2);
        if (data.whatGoodLooksLike) para('What Good Looks Like: ' + data.whatGoodLooksLike);
        if (data.actions && data.actions.length && typeof data.actions[0] === 'object') {
          addTable(['Day', 'Action', 'Owner', 'Deliverable'], data.actions.map(function(a) { return [a.day || '', a.action || '', a.owner || '', a.deliverable || '']; }));
        }
      });
    }

    // Next 5 Steps
    if (plan.nextFiveSteps && plan.nextFiveSteps.length) {
      heading('Next 5 Steps', 2);
      plan.nextFiveSteps.forEach(function(s, i) {
        para((s.step || (i + 1)) + '. ' + s.action + ' — Owner: ' + (s.owner || '') + ' | By: ' + (s.by || ''));
      });
    }

    // Action Tracker
    if (plan.actionTracker && plan.actionTracker.length) {
      heading('Action Tracker', 1);
      addTable(['Status', 'Action', 'Owner', 'Due Date'],
        plan.actionTracker.map(function(a) { return [a.status || '', a.action || '', a.owner || '', a.dueDate || '']; }));
      var atDone = plan.actionTracker.filter(function(a) { return a.status === 'Done'; }).length;
      para('Progress: ' + atDone + '/' + plan.actionTracker.length + ' complete (' + Math.round(atDone / plan.actionTracker.length * 100) + '%)');
    }

    // Risks
    if (plan.risks && plan.risks.length) {
      heading('Key Risks & Mitigations', 1);
      addTable(['Risk', 'Category', 'Likelihood', 'Impact', 'Mitigation', 'Owner'],
        plan.risks.map(function(r) { return [r.risk, r.category || '', r.likelihood || '', r.impact || '', r.mitigation, r.owner || '']; }));
    }

    if (plan.successMetrics && plan.successMetrics.length) {
      heading('Success Metrics', 1);
      addTable(['Metric', 'Target', 'Timeline', 'Measurement'], plan.successMetrics.map(function(m) { return [m.metric, m.target, m.timeline, m.measurement || '']; }));
    }

    var doc = new D.Document({ sections: [{ children: children }] });
    var blob = await D.Packer.toBlob(doc);
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = AP.slugify(plan.companyName) + '-account-plan.docx';
    a.click();
    URL.revokeObjectURL(url);
    AP.showToast('Word document downloaded');
  }

  return { toMarkdown: toMarkdown, toClipboard: toClipboard, toDocx: toDocx };
})();
