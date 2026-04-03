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
    lines.push('');
    lines.push('---');
    lines.push('');

    // Module 1: Overview
    lines.push('## Module 1: Account Overview');
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

    // Financial Snapshot
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

    // Business Groups
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

    // Strategic Priorities
    if (o.strategicPriorities && o.strategicPriorities.length > 0) {
      lines.push('### Strategic Priorities');
      lines.push('');
      o.strategicPriorities.forEach(function(p, i) {
        lines.push((i + 1) + '. ' + p);
      });
      lines.push('');
    }

    lines.push('---');
    lines.push('');

    // Module 2: News
    lines.push('## Module 2: News Highlights');
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

    // Module 3: DI Priorities
    lines.push('## Module 3: Decision Intelligence Priorities');
    lines.push('');
    if (plan.diPriorities && plan.diPriorities.length > 0) {
      plan.diPriorities.forEach(function(p, i) {
        var urgencyLabel = p.urgency ? ' ' + p.urgency.toUpperCase() : '';
        lines.push('### Priority ' + (p.rank || (i + 1)) + ': ' + p.area + (urgencyLabel ? ' ⭐ ' + urgencyLabel : ''));
        if (p.context) lines.push('**Context:** ' + p.context);
        lines.push('');
        if (p.sellerValueProp) lines.push('**' + sellerName + ' Value Proposition:** ' + p.sellerValueProp);
        lines.push('');
        if (p.estimatedImpact) lines.push('**Estimated Impact:** ' + p.estimatedImpact);
        lines.push('');
      });
    }

    lines.push('---');
    lines.push('');

    // Module 4: Stakeholders
    lines.push('## Module 4: Stakeholder Mapping');
    lines.push('');
    if (plan.stakeholders && plan.stakeholders.length > 0) {
      lines.push('| Name | Title | Role | Relevance | Engagement Strategy |');
      lines.push('|------|-------|------|-----------|-------------------|');
      plan.stakeholders.forEach(function(s) {
        lines.push('| **' + (s.name || '') + '** | ' + (s.title || '') + ' | ' + (s.roleInDeal || '') + ' | ' + (s.relevance || '') + ' | ' + (s.engagementStrategy || s.notes || '') + ' |');
      });
      lines.push('');
    }

    lines.push('---');
    lines.push('');

    // Module 5: Competitive
    lines.push('## Module 5: Competitive Landscape');
    lines.push('');
    var c = plan.competitive || {};
    if (c.positioning) {
      lines.push(c.positioning);
      lines.push('');
    }
    if (c.landscape && c.landscape.length > 0) {
      lines.push('| Competitor | Weakness | Our Advantage |');
      lines.push('|-----------|----------|---------------|');
      c.landscape.forEach(function(comp) {
        lines.push('| **' + (comp.competitor || '') + '** | ' + (comp.weakness || '') + ' | ' + (comp.sellerAdvantage || comp.aeraAdvantage || '') + ' |');
      });
      lines.push('');
    }

    lines.push('---');
    lines.push('');

    // Module 6: Value Hypothesis
    lines.push('## Module 6: Value Hypothesis');
    lines.push('');
    var v = plan.valueHypothesis || {};
    if (v.executivePitch) {
      lines.push('**Executive Pitch:** ' + v.executivePitch);
      lines.push('');
    }
    if (v.metrics && v.metrics.length > 0) {
      lines.push('| Metric | Impact | Confidence |');
      lines.push('|--------|--------|------------|');
      v.metrics.forEach(function(m) {
        lines.push('| **' + (m.metric || '') + '** | ' + (m.impact || '') + ' | ' + (m.confidence || '') + ' |');
      });
      lines.push('');
    }

    lines.push('---');
    lines.push('');

    // Module 7: 10-30-60 Day Plan
    lines.push('## Module 7: 10-30-60 Day Plan');
    lines.push('');
    var p = plan.plan || {};
    var phases = [
      { key: 'day10', label: 'Days 1-10' },
      { key: 'day30', label: 'Days 11-30' },
      { key: 'day60', label: 'Days 31-60' }
    ];
    phases.forEach(function(phase) {
      var data = p[phase.key];
      if (!data) return;
      lines.push('### ' + phase.label + ': ' + (data.title || ''));
      lines.push('');
      if (data.actions && data.actions.length > 0) {
        if (typeof data.actions[0] === 'object') {
          lines.push('| Day | Action | Owner | Deliverable |');
          lines.push('|-----|--------|-------|-------------|');
          data.actions.forEach(function(a) {
            lines.push('| ' + (a.day || '') + ' | ' + (a.action || '') + ' | ' + (a.owner || '') + ' | ' + (a.deliverable || '') + ' |');
          });
        } else {
          data.actions.forEach(function(a) {
            lines.push('- ' + a);
          });
        }
        lines.push('');
      }
    });

    lines.push('---');
    lines.push('');

    // Module 8: Risks & Success Metrics
    lines.push('## Module 8: Key Risks & Mitigations');
    lines.push('');
    if (plan.risks && plan.risks.length > 0) {
      lines.push('| Risk | Likelihood | Impact | Mitigation |');
      lines.push('|------|-----------|--------|------------|');
      plan.risks.forEach(function(r) {
        lines.push('| ' + (r.risk || '') + ' | ' + (r.likelihood || '') + ' | ' + (r.impact || '') + ' | ' + (r.mitigation || '') + ' |');
      });
      lines.push('');
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
    lines.push('');
    lines.push('*Generated by ' + sellerName + ' Account Plan Generator. ' + AP.formatDate(plan.generatedAt) + '.*');

    return lines.join('\n');
  }

  function toClipboard(plan) {
    var md = toMarkdown(plan);
    AP.copyToClipboard(md);
  }

  /* --- Word (.docx) Export via docx library (lazy-loaded) --- */
  var docxLoaded = false;

  function loadDocxLib() {
    return new Promise(function(resolve, reject) {
      if (docxLoaded && window.docx) { resolve(); return; }
      var script = document.createElement('script');
      script.src = 'https://unpkg.com/docx@9.0.2/build/index.umd.min.js';
      script.onload = function() { docxLoaded = true; resolve(); };
      script.onerror = function() { reject(new Error('Failed to load docx library')); };
      document.head.appendChild(script);
    });
  }

  async function toDocx(plan) {
    try {
      await loadDocxLib();
    } catch (err) {
      AP.showToast('Failed to load Word export library', 'error');
      return;
    }

    var D = window.docx;
    var sp = AP.SellerProfile.get() || {};
    var sellerName = sp.companyName || 'Our Company';
    var o = plan.overview || {};

    var children = [];

    // Title
    children.push(new D.Paragraph({
      children: [new D.TextRun({ text: 'Account Plan: ' + plan.companyName, bold: true, size: 48 })],
      heading: D.HeadingLevel.TITLE,
      spacing: { after: 200 }
    }));

    children.push(new D.Paragraph({
      children: [
        new D.TextRun({ text: 'Prepared by: ' + sellerName + '  |  ' + AP.formatDate(plan.generatedAt), color: '666666', size: 20 })
      ],
      spacing: { after: 400 }
    }));

    // Helper: add heading
    function heading(text, level) {
      children.push(new D.Paragraph({
        children: [new D.TextRun({ text: text, bold: true, size: level === 1 ? 32 : 26 })],
        heading: level === 1 ? D.HeadingLevel.HEADING_1 : D.HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 }
      }));
    }

    // Helper: add paragraph
    function para(text) {
      if (!text) return;
      children.push(new D.Paragraph({
        children: [new D.TextRun({ text: text, size: 22 })],
        spacing: { after: 120 }
      }));
    }

    // Helper: add table
    function addTable(headers, rows) {
      var tableRows = [];
      // Header row
      tableRows.push(new D.TableRow({
        children: headers.map(function(h) {
          return new D.TableCell({
            children: [new D.Paragraph({ children: [new D.TextRun({ text: h, bold: true, size: 18 })] })],
            shading: { fill: 'E8E8E8' }
          });
        })
      }));
      // Data rows
      rows.forEach(function(row) {
        tableRows.push(new D.TableRow({
          children: row.map(function(cell) {
            return new D.TableCell({
              children: [new D.Paragraph({ children: [new D.TextRun({ text: String(cell || ''), size: 20 })] })]
            });
          })
        }));
      });
      children.push(new D.Table({
        rows: tableRows,
        width: { size: 100, type: D.WidthType.PERCENTAGE }
      }));
    }

    // Module 1: Overview
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
      addTable(['Metric', 'Current Year', 'Prior Year', 'Notes'],
        o.financialSnapshot.map(function(r) { return [r.metric, r.currentYear, r.priorYear, r.notes]; }));
    }

    if (o.strategicPriorities && o.strategicPriorities.length) {
      heading('Strategic Priorities', 2);
      o.strategicPriorities.forEach(function(p, i) { para((i + 1) + '. ' + p); });
    }

    // Module 2: News
    if (plan.news && plan.news.length) {
      heading('News Highlights', 1);
      plan.news.forEach(function(n, i) {
        children.push(new D.Paragraph({
          children: [new D.TextRun({ text: (i + 1) + '. ' + n.headline, bold: true, size: 22 })],
          spacing: { before: 150, after: 60 }
        }));
        if (n.detail) para(n.detail);
      });
    }

    // Module 3: DI Priorities
    if (plan.diPriorities && plan.diPriorities.length) {
      heading('Decision Intelligence Priorities', 1);
      plan.diPriorities.forEach(function(p, i) {
        children.push(new D.Paragraph({
          children: [new D.TextRun({ text: 'Priority ' + (p.rank || (i + 1)) + ': ' + p.area + (p.urgency ? ' [' + p.urgency + ']' : ''), bold: true, size: 24 })],
          spacing: { before: 200, after: 80 }
        }));
        if (p.context) para('Context: ' + p.context);
        if (p.sellerValueProp) para(sellerName + ' Value Proposition: ' + p.sellerValueProp);
        if (p.estimatedImpact) para('Estimated Impact: ' + p.estimatedImpact);
      });
    }

    // Module 4: Stakeholders
    if (plan.stakeholders && plan.stakeholders.length) {
      heading('Stakeholder Mapping', 1);
      addTable(['Name', 'Title', 'Role', 'Relevance', 'Engagement Strategy'],
        plan.stakeholders.map(function(s) { return [s.name, s.title, s.roleInDeal, s.relevance, s.engagementStrategy || s.notes || '']; }));
    }

    // Module 5: Competitive
    var comp = plan.competitive || {};
    if (comp.positioning || (comp.landscape && comp.landscape.length)) {
      heading('Competitive Landscape', 1);
      if (comp.positioning) para(comp.positioning);
      if (comp.landscape && comp.landscape.length) {
        addTable(['Competitor', 'Weakness', 'Our Advantage'],
          comp.landscape.map(function(c) { return [c.competitor, c.weakness, c.sellerAdvantage || c.aeraAdvantage || '']; }));
      }
    }

    // Module 6: Value
    var val = plan.valueHypothesis || {};
    if (val.executivePitch || (val.metrics && val.metrics.length)) {
      heading('Value Hypothesis', 1);
      if (val.executivePitch) para(val.executivePitch);
      if (val.metrics && val.metrics.length) {
        addTable(['Metric', 'Impact', 'Confidence'],
          val.metrics.map(function(m) { return [m.metric, m.impact, m.confidence]; }));
      }
    }

    // Module 7: Day Plan
    var dp = plan.plan || {};
    if (dp.day10 || dp.day30 || dp.day60) {
      heading('10-30-60 Day Engagement Plan', 1);
      [{ key: 'day10', label: 'Days 1-10' }, { key: 'day30', label: 'Days 11-30' }, { key: 'day60', label: 'Days 31-60' }].forEach(function(phase) {
        var data = dp[phase.key];
        if (!data) return;
        heading(phase.label + ': ' + (data.title || ''), 2);
        if (data.actions && data.actions.length) {
          if (typeof data.actions[0] === 'object') {
            addTable(['Day', 'Action', 'Owner', 'Deliverable'],
              data.actions.map(function(a) { return [a.day || '', a.action || '', a.owner || '', a.deliverable || '']; }));
          } else {
            data.actions.forEach(function(a) { para('- ' + a); });
          }
        }
      });
    }

    // Module 8: Risks
    if (plan.risks && plan.risks.length) {
      heading('Key Risks & Mitigations', 1);
      addTable(['Risk', 'Likelihood', 'Impact', 'Mitigation'],
        plan.risks.map(function(r) { return [r.risk, r.likelihood || '', r.impact || '', r.mitigation]; }));
    }

    if (plan.successMetrics && plan.successMetrics.length) {
      heading('Success Metrics', 1);
      addTable(['Metric', 'Target', 'Timeline', 'Measurement'],
        plan.successMetrics.map(function(m) { return [m.metric, m.target, m.timeline, m.measurement || '']; }));
    }

    // Build and download
    var doc = new D.Document({
      sections: [{ children: children }]
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
