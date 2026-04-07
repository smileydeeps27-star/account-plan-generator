/* ===== Account Plan Generator — Export (Markdown + Word) ===== */
/* Format: Concise, scannable, designed for a sales leader review */

AP.PlanExport = (function() {

  // Helper: truncate text
  function trunc(text, max) {
    if (!text) return '';
    return text.length > max ? text.substring(0, max - 3) + '...' : text;
  }

  // ===================================================================
  // MARKDOWN EXPORT — crisp, copy-paste-friendly
  // ===================================================================
  function toMarkdown(plan) {
    var sp = AP.SellerProfile.get() || {};
    var sellerName = sp.companyName || 'Our Company';
    var o = plan.overview || {};
    var strat = plan.accountStrategy || {};
    var val = plan.valueHypothesis || {};
    var comp = plan.competitive || {};
    var dp = plan.dayPlan || {};
    var L = [];

    // ---- HEADER ----
    L.push('# ' + plan.companyName + ' — Account Plan');
    L.push(sellerName + ' | ' + AP.formatDate(plan.generatedAt) + (plan.userInputs && plan.userInputs.dealStage ? ' | Stage: ' + plan.userInputs.dealStage : ''));
    L.push('');

    // ---- ACCOUNT SNAPSHOT ----
    L.push('## Account Snapshot');
    L.push('');
    L.push('| | |');
    L.push('|---|---|');
    if (o.industry) L.push('| **Industry** | ' + o.industry + ' |');
    if (o.hqLocation) L.push('| **HQ** | ' + o.hqLocation + ' |');
    if (o.annualRevenue) L.push('| **Revenue** | ' + o.annualRevenue + ' |');
    if (o.employeeCount) L.push('| **Employees** | ' + o.employeeCount + ' |');
    L.push('');
    if (o.strategicPriorities && o.strategicPriorities.length > 0) {
      L.push('**Strategic Priorities:** ' + o.strategicPriorities.slice(0, 4).join(' • '));
      L.push('');
    }

    // ---- WHY THIS ACCOUNT ----
    if (strat.positioning || val.executivePitch) {
      L.push('## Why ' + plan.companyName);
      L.push('');
      if (strat.positioning) L.push(strat.positioning);
      L.push('');
      if (strat.whyNow) L.push('**Why Now:** ' + strat.whyNow);
      L.push('');
      if (strat.landingZone) L.push('**Entry Point:** ' + strat.landingZone);
      L.push('');
    }

    // ---- EXECUTIVE PITCH ----
    if (val.executivePitch) {
      L.push('> **Elevator Pitch:** ' + val.executivePitch);
      L.push('');
    }

    // ---- KEY MESSAGES ----
    if (strat.keyMessages && strat.keyMessages.length) {
      L.push('**Key Messages:**');
      strat.keyMessages.forEach(function(m, i) { L.push((i + 1) + '. ' + m); });
      L.push('');
    }

    // ---- TECH STACK (compact) ----
    var t = plan.technologyLandscape || {};
    if (t.knownSystems && t.knownSystems.length) {
      L.push('## Known Tech Stack');
      L.push('');
      L.push('| System | Vendor | Confidence |');
      L.push('|--------|--------|-----------|');
      t.knownSystems.forEach(function(s) {
        L.push('| ' + (s.category || '') + ' | **' + (s.vendor || '') + '** ' + (s.product || '') + ' | ' + (s.confidence || '') + ' |');
      });
      L.push('');
    }

    // ---- STAKEHOLDERS (table, not paragraphs) ----
    if (plan.stakeholders && plan.stakeholders.length) {
      L.push('## Key Stakeholders');
      L.push('');
      L.push('| Name | Title | Role | Approach |');
      L.push('|------|-------|------|----------|');
      plan.stakeholders.forEach(function(s) {
        L.push('| **' + (s.name || '') + '** | ' + (s.title || '') + ' | ' + (s.roleInDeal || '') + ' | ' + trunc(s.engagementStrategy || s.notes || '', 100) + ' |');
      });
      L.push('');
    }

    // ---- COMPETITIVE (table) ----
    if (comp.landscape && comp.landscape.length) {
      L.push('## Competitive Landscape');
      L.push('');
      L.push('| Competitor | Status | Our Advantage | Talk Track |');
      L.push('|-----------|--------|---------------|-----------|');
      comp.landscape.forEach(function(c) {
        L.push('| **' + (c.competitor || '') + '** | ' + (c.presence || '') + ' | ' + trunc(c.sellerAdvantage || c.aeraAdvantage || '', 80) + ' | ' + trunc(c.battleCard || '', 80) + ' |');
      });
      L.push('');
    }

    // ---- VALUE METRICS (compact) ----
    if (val.metrics && val.metrics.length) {
      L.push('## Value Potential');
      L.push('');
      L.push('| Opportunity | Impact | Confidence |');
      L.push('|------------|--------|-----------|');
      val.metrics.forEach(function(m) {
        L.push('| ' + (m.metric || '') + ' | **' + (m.impact || '') + '** | ' + (m.confidence || '') + ' |');
      });
      L.push('');
    }

    // ---- 30-60-90 (condensed — goals only, not every action) ----
    L.push('## 30-60-90 Day Plan');
    L.push('');
    [{ key: 'day30', label: 'Day 1-30' }, { key: 'day60', label: 'Day 31-60' }, { key: 'day90', label: 'Day 61-90' }].forEach(function(phase) {
      var data = dp[phase.key];
      if (!data) return;
      L.push('**' + phase.label + ': ' + (data.title || '') + '**');
      if (data.whatGoodLooksLike) L.push('Success = ' + data.whatGoodLooksLike);
      if (data.actions && data.actions.length) {
        data.actions.slice(0, 3).forEach(function(a) {
          L.push('- ' + (a.action || '') + ' → _' + (a.owner || '') + '_');
        });
      }
      L.push('');
    });

    // ---- NEXT 5 STEPS ----
    if (plan.nextFiveSteps && plan.nextFiveSteps.length) {
      L.push('## Immediate Next Steps');
      L.push('');
      plan.nextFiveSteps.forEach(function(s, i) {
        L.push((i + 1) + '. **' + (s.action || '') + '** → ' + (s.owner || '') + ' by ' + (s.by || 'TBD'));
      });
      L.push('');
    }

    // ---- ACTION TRACKER (if populated) ----
    if (plan.actionTracker && plan.actionTracker.length) {
      var atDone = plan.actionTracker.filter(function(a) { return a.status === 'Done'; }).length;
      L.push('## Action Tracker (' + atDone + '/' + plan.actionTracker.length + ' done)');
      L.push('');
      L.push('| Status | Action | Owner | Due |');
      L.push('|--------|--------|-------|-----|');
      plan.actionTracker.forEach(function(a) {
        var mark = a.status === 'Done' ? '✅' : a.status === 'In Progress' ? '🔄' : '⬜';
        L.push('| ' + mark + ' ' + (a.status || '') + ' | ' + trunc(a.action || '', 60) + ' | ' + (a.owner || '') + ' | ' + (a.dueDate || '') + ' |');
      });
      L.push('');
    }

    // ---- TOP RISKS (table, not paragraphs) ----
    if (plan.risks && plan.risks.length) {
      L.push('## Key Risks');
      L.push('');
      L.push('| Risk | L/I | Mitigation |');
      L.push('|------|-----|-----------|');
      plan.risks.slice(0, 5).forEach(function(r) {
        L.push('| ' + trunc(r.risk || '', 60) + ' | ' + (r.likelihood || '?')[0] + '/' + (r.impact || '?')[0] + ' | ' + trunc(r.mitigation || '', 80) + ' |');
      });
      L.push('');
    }

    // ---- RECENT NEWS (bullets only) ----
    if (plan.news && plan.news.length) {
      L.push('## Recent News');
      L.push('');
      plan.news.slice(0, 5).forEach(function(n) {
        L.push('- **' + (n.headline || '') + '** ' + (n.date ? '(' + n.date + ')' : ''));
      });
      L.push('');
    }

    L.push('---');
    L.push('_' + sellerName + ' Account Plan Generator | ' + AP.formatDate(plan.generatedAt) + '_');

    return L.join('\n');
  }

  function toClipboard(plan) {
    var md = toMarkdown(plan);
    AP.copyToClipboard(md);
  }

  // ===================================================================
  // WORD EXPORT — concise, executive-ready format
  // ===================================================================
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
    var strat = plan.accountStrategy || {};
    var val = plan.valueHypothesis || {};
    var comp = plan.competitive || {};
    var dp = plan.dayPlan || {};
    var children = [];

    // Page constants
    var PAGE_W = 9360;
    var ACCENT = '2E5090';
    var LIGHT_BG = 'EDF2F7';
    var cellBorder = { style: D.BorderStyle.SINGLE, size: 1, color: 'D1D5DB' };
    var cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
    var cellPad = { top: 50, bottom: 50, left: 100, right: 100 };
    var shadingType = D.ShadingType ? D.ShadingType.CLEAR : 'clear';

    // Helpers
    function h1(text) {
      children.push(new D.Paragraph({
        children: [new D.TextRun({ text: text, bold: true, size: 28, font: 'Arial', color: ACCENT })],
        heading: D.HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 120 },
        border: { bottom: { style: D.BorderStyle.SINGLE, size: 4, color: ACCENT, space: 4 } }
      }));
    }
    function h2(text) {
      children.push(new D.Paragraph({
        children: [new D.TextRun({ text: text, bold: true, size: 24, font: 'Arial', color: '374151' })],
        heading: D.HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 80 }
      }));
    }
    function p(text, opts) {
      if (!text) return;
      opts = opts || {};
      children.push(new D.Paragraph({
        children: [new D.TextRun({ text: text, size: opts.size || 20, font: 'Arial', color: opts.color || '4B5563', bold: opts.bold || false, italics: opts.italics || false })],
        spacing: { after: opts.after || 80 }
      }));
    }
    function richP(runs) {
      children.push(new D.Paragraph({ children: runs, spacing: { after: 80 } }));
    }
    function boldLabel(label, value) {
      if (!value) return;
      richP([
        new D.TextRun({ text: label, bold: true, size: 20, font: 'Arial', color: '374151' }),
        new D.TextRun({ text: value, size: 20, font: 'Arial', color: '4B5563' })
      ]);
    }

    function makeTable(headers, rows, colWidthsArr) {
      var colWidths = colWidthsArr || headers.map(function() { return Math.floor(PAGE_W / headers.length); });
      // Fix last column to absorb rounding
      var sum = 0;
      for (var ci = 0; ci < colWidths.length - 1; ci++) sum += colWidths[ci];
      colWidths[colWidths.length - 1] = PAGE_W - sum;

      var tRows = [];
      tRows.push(new D.TableRow({ children: headers.map(function(h, i) {
        return new D.TableCell({
          borders: cellBorders, width: { size: colWidths[i], type: D.WidthType.DXA },
          shading: { fill: ACCENT, type: shadingType }, margins: cellPad,
          children: [new D.Paragraph({ children: [new D.TextRun({ text: h, bold: true, size: 17, font: 'Arial', color: 'FFFFFF' })] })]
        });
      }) }));
      rows.forEach(function(row, ri) {
        tRows.push(new D.TableRow({ children: row.map(function(cell, i) {
          return new D.TableCell({
            borders: cellBorders, width: { size: colWidths[i], type: D.WidthType.DXA },
            shading: ri % 2 === 1 ? { fill: LIGHT_BG, type: shadingType } : undefined,
            margins: cellPad,
            children: [new D.Paragraph({ children: [new D.TextRun({ text: String(cell || ''), size: 18, font: 'Arial', color: '374151' })] })]
          });
        }) }));
      });
      children.push(new D.Table({ rows: tRows, width: { size: PAGE_W, type: D.WidthType.DXA }, columnWidths: colWidths }));
    }

    // ============== TITLE ==============
    children.push(new D.Paragraph({
      children: [new D.TextRun({ text: plan.companyName, bold: true, size: 44, font: 'Arial', color: ACCENT })],
      spacing: { after: 60 }
    }));
    children.push(new D.Paragraph({
      children: [new D.TextRun({ text: 'Account Plan', size: 28, font: 'Arial', color: '6B7280' })],
      spacing: { after: 120 }
    }));
    var metaLine = sellerName + '  |  ' + AP.formatDate(plan.generatedAt);
    if (plan.userInputs && plan.userInputs.dealStage) metaLine += '  |  Stage: ' + plan.userInputs.dealStage;
    children.push(new D.Paragraph({
      children: [new D.TextRun({ text: metaLine, size: 18, font: 'Arial', color: '9CA3AF' })],
      spacing: { after: 200 },
      border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: ACCENT, space: 8 } }
    }));

    // ============== ACCOUNT SNAPSHOT ==============
    h1('Account Snapshot');
    var snapRows = [];
    if (o.industry) snapRows.push(['Industry', o.industry]);
    if (o.hqLocation) snapRows.push(['HQ', o.hqLocation]);
    if (o.annualRevenue) snapRows.push(['Revenue', o.annualRevenue]);
    if (o.employeeCount) snapRows.push(['Employees', o.employeeCount]);
    if (snapRows.length) makeTable(['', ''], snapRows, [2400, 6960]);

    if (o.strategicPriorities && o.strategicPriorities.length) {
      p('Strategic Priorities: ' + o.strategicPriorities.slice(0, 4).join(' • '), { bold: true, after: 120 });
    }

    // ============== STRATEGY ON A PAGE ==============
    h1('Strategy');
    if (strat.positioning) boldLabel('Positioning: ', strat.positioning);
    if (strat.whyAera) boldLabel('Why Aera: ', strat.whyAera);
    if (strat.whyNow) boldLabel('Why Now: ', strat.whyNow);
    if (strat.landingZone) boldLabel('Entry Point: ', strat.landingZone);
    if (strat.keyMessages && strat.keyMessages.length) {
      h2('Key Messages');
      strat.keyMessages.forEach(function(m, i) { p((i + 1) + '. ' + m); });
    }

    // ============== EXECUTIVE PITCH (callout) ==============
    if (val.executivePitch) {
      children.push(new D.Paragraph({
        children: [new D.TextRun({ text: '"' + val.executivePitch + '"', size: 20, font: 'Arial', color: ACCENT, italics: true })],
        spacing: { before: 120, after: 120 },
        indent: { left: 400, right: 400 }
      }));
    }

    // ============== STAKEHOLDERS ==============
    if (plan.stakeholders && plan.stakeholders.length) {
      h1('Key Stakeholders');
      makeTable(
        ['Name', 'Title', 'Role', 'Engagement Approach'],
        plan.stakeholders.map(function(s) {
          return [s.name || '', s.title || '', s.roleInDeal || '', trunc(s.engagementStrategy || s.notes || '', 120)];
        }),
        [1800, 2200, 1400, 3960]
      );
    }

    // ============== COMPETITIVE ==============
    if (comp.landscape && comp.landscape.length) {
      h1('Competitive Landscape');
      makeTable(
        ['Competitor', 'Status', 'Our Advantage', 'Talk Track'],
        comp.landscape.map(function(c) {
          return [c.competitor || '', c.presence || '', trunc(c.sellerAdvantage || c.aeraAdvantage || '', 100), trunc(c.battleCard || '', 80)];
        }),
        [1600, 1200, 3400, 3160]
      );
    }

    // ============== VALUE POTENTIAL ==============
    if (val.metrics && val.metrics.length) {
      h1('Value Potential');
      makeTable(
        ['Opportunity', 'Impact', 'Confidence'],
        val.metrics.map(function(m) { return [m.metric || '', m.impact || '', m.confidence || '']; }),
        [4000, 3360, 2000]
      );
    }

    // ============== TECH STACK ==============
    var tech = plan.technologyLandscape || {};
    if (tech.knownSystems && tech.knownSystems.length) {
      h1('Known Tech Stack');
      makeTable(
        ['Category', 'Vendor / Product', 'Confidence'],
        tech.knownSystems.map(function(s) {
          return [s.category || '', (s.vendor || '') + (s.product ? ' — ' + s.product : ''), s.confidence || ''];
        }),
        [2000, 5360, 2000]
      );
    }

    // ============== 30-60-90 (condensed) ==============
    h1('30-60-90 Day Plan');
    [{ key: 'day30', label: 'Day 1-30' }, { key: 'day60', label: 'Day 31-60' }, { key: 'day90', label: 'Day 61-90' }].forEach(function(phase) {
      var data = dp[phase.key];
      if (!data) return;
      h2(phase.label + ': ' + (data.title || ''));
      if (data.whatGoodLooksLike) p('Success = ' + data.whatGoodLooksLike, { italics: true, color: ACCENT });
      if (data.actions && data.actions.length) {
        makeTable(
          ['Action', 'Owner', 'Deliverable'],
          data.actions.slice(0, 5).map(function(a) { return [a.action || '', a.owner || '', a.deliverable || '']; }),
          [5000, 1600, 2760]
        );
      }
    });

    // ============== NEXT STEPS ==============
    if (plan.nextFiveSteps && plan.nextFiveSteps.length) {
      h1('Immediate Next Steps');
      makeTable(
        ['#', 'Action', 'Owner', 'By'],
        plan.nextFiveSteps.map(function(s, i) { return [String(s.step || (i + 1)), s.action || '', s.owner || '', s.by || 'TBD']; }),
        [400, 5560, 1600, 1800]
      );
    }

    // ============== ACTION TRACKER ==============
    if (plan.actionTracker && plan.actionTracker.length) {
      var atDone = plan.actionTracker.filter(function(a) { return a.status === 'Done'; }).length;
      h1('Action Tracker (' + atDone + '/' + plan.actionTracker.length + ' complete)');
      makeTable(
        ['Status', 'Action', 'Owner', 'Due'],
        plan.actionTracker.map(function(a) { return [a.status || '', trunc(a.action || '', 60), a.owner || '', a.dueDate || '']; }),
        [1400, 4560, 1600, 1800]
      );
    }

    // ============== RISKS ==============
    if (plan.risks && plan.risks.length) {
      h1('Key Risks');
      makeTable(
        ['Risk', 'L / I', 'Mitigation', 'Owner'],
        plan.risks.slice(0, 6).map(function(r) {
          return [trunc(r.risk || '', 80), (r.likelihood || '?')[0] + ' / ' + (r.impact || '?')[0], trunc(r.mitigation || '', 100), r.owner || ''];
        }),
        [2600, 800, 4160, 1800]
      );
    }

    // ============== NEWS (compact) ==============
    if (plan.news && plan.news.length) {
      h1('Recent News');
      plan.news.slice(0, 5).forEach(function(n) {
        richP([
          new D.TextRun({ text: (n.headline || ''), bold: true, size: 18, font: 'Arial', color: '374151' }),
          new D.TextRun({ text: n.date ? '  (' + n.date + ')' : '', size: 18, font: 'Arial', color: '9CA3AF' })
        ]);
      });
    }

    // ============== FOOTER ==============
    children.push(new D.Paragraph({
      children: [new D.TextRun({ text: 'Generated by ' + sellerName + ' Account Plan Generator | ' + AP.formatDate(plan.generatedAt), size: 16, font: 'Arial', color: '9CA3AF', italics: true })],
      spacing: { before: 400 },
      border: { top: { style: D.BorderStyle.SINGLE, size: 2, color: 'D1D5DB', space: 8 } }
    }));

    // ============== BUILD DOC ==============
    var doc = new D.Document({
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1440, bottom: 1080, left: 1440 }
          }
        },
        children: children
      }]
    });

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
