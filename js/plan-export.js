/* ===== Account Plan Generator — Export (Markdown + Word) ===== */
/* Format: Concise, scannable, Aera-branded, max 4-5 pages */
/* Font: Calibri | Colors: Aera blue shades (#0693E3, #055A8C, #E8F4FD) */

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
    var sellerName = sp.companyName || 'Aera Technology';
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
      if (val.executivePitch) L.push('> ' + val.executivePitch);
      L.push('');
      if (strat.positioning) L.push(strat.positioning);
      L.push('');
      if (strat.whyNow) L.push('**Why Now:** ' + strat.whyNow);
      if (strat.landingZone) L.push('**Entry Point:** ' + strat.landingZone);
      L.push('');
    }

    // ---- KEY MESSAGES ----
    if (strat.keyMessages && strat.keyMessages.length) {
      L.push('**Key Messages:**');
      strat.keyMessages.forEach(function(m, i) { L.push((i + 1) + '. ' + m); });
      L.push('');
    }

    // ---- STAKEHOLDERS ----
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

    // ---- COMPETITIVE ----
    if (comp.landscape && comp.landscape.length) {
      L.push('## Competitive Landscape');
      L.push('');
      L.push('| Competitor | Status | Our Advantage |');
      L.push('|-----------|--------|---------------|');
      comp.landscape.forEach(function(c) {
        L.push('| **' + (c.competitor || '') + '** | ' + (c.presence || '') + ' | ' + trunc(c.sellerAdvantage || c.aeraAdvantage || '', 100) + ' |');
      });
      L.push('');
    }

    // ---- VALUE METRICS ----
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

    // ---- ACTION PLAN (consolidated, max 10) ----
    L.push('## Action Plan');
    L.push('');
    var actionItems = buildActionPlan(plan);
    L.push('| # | Action | Owner | Phase |');
    L.push('|---|--------|-------|-------|');
    actionItems.forEach(function(a, i) {
      L.push('| ' + (i + 1) + ' | ' + a.action + ' | ' + a.owner + ' | ' + a.phase + ' |');
    });
    L.push('');

    // ---- RISKS ----
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

    // ---- RECENT NEWS ----
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

  // ===================================================================
  // Build consolidated Action Plan — max 10 items from 30-60-90 + next steps
  // ===================================================================
  function buildActionPlan(plan) {
    var items = [];
    var dp = plan.dayPlan || {};

    // Pull top actions from each 30-60-90 phase
    [{ key: 'day30', phase: 'Day 1-30' }, { key: 'day60', phase: 'Day 31-60' }, { key: 'day90', phase: 'Day 61-90' }].forEach(function(p) {
      var data = dp[p.key];
      if (!data || !data.actions) return;
      data.actions.slice(0, 4).forEach(function(a) {
        items.push({
          action: a.action || '',
          owner: a.owner || 'CP',
          phase: p.phase,
          source: '30-60-90'
        });
      });
    });

    // Add next steps if not already covered
    if (plan.nextFiveSteps && plan.nextFiveSteps.length) {
      plan.nextFiveSteps.forEach(function(s) {
        var isDuplicate = items.some(function(existing) {
          return existing.action.toLowerCase().indexOf(s.action.toLowerCase().substring(0, 20)) >= 0;
        });
        if (!isDuplicate) {
          items.push({
            action: s.action || '',
            owner: s.owner || 'CP',
            phase: 'Immediate',
            source: 'next-steps'
          });
        }
      });
    }

    // Cap at 10 items, prioritize: Immediate first, then Day 1-30, etc.
    var phaseOrder = { 'Immediate': 0, 'Day 1-30': 1, 'Day 31-60': 2, 'Day 61-90': 3 };
    items.sort(function(a, b) { return (phaseOrder[a.phase] || 9) - (phaseOrder[b.phase] || 9); });
    return items.slice(0, 10);
  }

  function toClipboard(plan) {
    var md = toMarkdown(plan);
    AP.copyToClipboard(md);
  }

  // ===================================================================
  // WORD EXPORT — Aera SOW-style: logo header, branded footer, Calibri
  // ===================================================================
  var docxLoaded = false;
  var AERA_LOGO_B64 = null;

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

  function loadAeraLogo() {
    if (AERA_LOGO_B64) return Promise.resolve(AERA_LOGO_B64);
    return fetch('/images/aera-logo.png')
      .then(function(r) { return r.arrayBuffer(); })
      .then(function(buf) { AERA_LOGO_B64 = new Uint8Array(buf); return AERA_LOGO_B64; })
      .catch(function() { AERA_LOGO_B64 = null; return null; });
  }

  async function toDocx(plan) {
    try { await loadDocxLib(); } catch (err) { AP.showToast('Failed to load Word export library', 'error'); return; }
    var logoData = await loadAeraLogo();

    var D = window.docx;
    var sp = AP.SellerProfile.get() || {};
    var sellerName = sp.companyName || 'Aera Technology';
    var o = plan.overview || {};
    var strat = plan.accountStrategy || {};
    var val = plan.valueHypothesis || {};
    var comp = plan.competitive || {};
    var children = [];

    // ============== AERA BRAND CONSTANTS (from SOW template) ==============
    var FONT = 'Calibri';
    var PAGE_W = 9360;                      // US Letter usable width (1" margins)
    var H1_COLOR = '1F4E79';               // Dark navy — SOW Heading 1
    var H2_COLOR = '2E75B6';               // Medium blue — SOW Heading 2
    var ACCENT = '2E75B6';                 // Header/footer border color
    var TABLE_HEADER = '2E75B6';           // Table header bg
    var ALT_ROW = 'D6E4F0';               // Light blue alternating rows
    var TEXT_DARK = '1A1A2E';              // Near-black body text
    var TEXT_BODY = '333333';              // Standard body text
    var TEXT_MUTED = '888888';             // Footer/meta text
    var BORDER_CLR = 'B4C6E0';            // Table borders
    var WHITE = 'FFFFFF';

    var cellBorder = { style: D.BorderStyle.SINGLE, size: 1, color: BORDER_CLR };
    var cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
    var noBorders = { top: { style: D.BorderStyle.NONE }, bottom: { style: D.BorderStyle.NONE }, left: { style: D.BorderStyle.NONE }, right: { style: D.BorderStyle.NONE } };
    var cellPad = { top: 60, bottom: 60, left: 120, right: 120 };
    var shadingType = D.ShadingType ? D.ShadingType.CLEAR : 'clear';

    // ============== HEADER — Aera logo with blue underline ==============
    var headerChildren = [];
    if (logoData) {
      headerChildren.push(new D.ImageRun({
        type: 'png',
        data: logoData,
        transformation: { width: 76, height: 30 },
        altText: { title: 'Aera Technology', description: 'Aera Technology Logo', name: 'aera-logo' }
      }));
    }
    var docHeader = new D.Header({
      children: [new D.Paragraph({
        children: headerChildren,
        border: { bottom: { style: D.BorderStyle.SINGLE, size: 4, color: ACCENT, space: 4 } },
        spacing: { after: 200 }
      })]
    });

    // ============== FOOTER — "Aera Technology, Inc. Confidential" + Page # ==============
    var docFooter = new D.Footer({
      children: [new D.Paragraph({
        children: [
          new D.TextRun({ text: 'Aera Technology, Inc. Confidential', font: FONT, size: 16, color: TEXT_MUTED }),
          new D.TextRun({ text: '\t', font: FONT, size: 16 }),
          new D.TextRun({ text: 'Page ', font: FONT, size: 16, color: TEXT_MUTED }),
          new D.TextRun({ children: [D.PageNumber.CURRENT], font: FONT, size: 16, color: TEXT_MUTED })
        ],
        border: { top: { style: D.BorderStyle.SINGLE, size: 4, color: ACCENT, space: 4 } },
        tabStops: [{ type: D.TabStopType.RIGHT, position: 9360 }]
      })]
    });

    // ============== HELPER FUNCTIONS ==============
    function sectionHead(text) {
      children.push(new D.Paragraph({
        children: [new D.TextRun({ text: text.toUpperCase(), bold: true, size: 26, font: FONT, color: H1_COLOR })],
        spacing: { before: 400, after: 160 },
        border: { bottom: { style: D.BorderStyle.SINGLE, size: 4, color: ACCENT, space: 6 } }
      }));
    }

    function subHead(text) {
      children.push(new D.Paragraph({
        children: [new D.TextRun({ text: text, bold: true, size: 22, font: FONT, color: H2_COLOR })],
        spacing: { before: 280, after: 120 }
      }));
    }

    function bodyText(text, opts) {
      if (!text) return;
      opts = opts || {};
      children.push(new D.Paragraph({
        children: [new D.TextRun({ text: text, size: opts.size || 21, font: FONT, color: opts.color || TEXT_BODY, bold: opts.bold || false, italics: opts.italics || false })],
        spacing: { after: opts.after || 120, line: 276 },
        indent: opts.indent ? { left: opts.indent } : undefined
      }));
    }

    function labelValue(label, value) {
      if (!value) return;
      children.push(new D.Paragraph({
        children: [
          new D.TextRun({ text: label, bold: true, size: 21, font: FONT, color: H1_COLOR }),
          new D.TextRun({ text: value, size: 21, font: FONT, color: TEXT_BODY })
        ],
        spacing: { after: 120, line: 276 }
      }));
    }

    function makeTable(headers, rows, colWidthsArr, opts) {
      opts = opts || {};
      var colWidths = colWidthsArr || headers.map(function() { return Math.floor(PAGE_W / headers.length); });
      var sum = 0;
      for (var ci = 0; ci < colWidths.length - 1; ci++) sum += colWidths[ci];
      colWidths[colWidths.length - 1] = PAGE_W - sum;

      var headerBg = opts.headerColor || TABLE_HEADER;
      var altRowBg = opts.altRowColor || ALT_ROW;

      var tRows = [];
      // Header row
      tRows.push(new D.TableRow({ children: headers.map(function(h, i) {
        return new D.TableCell({
          borders: cellBorders, width: { size: colWidths[i], type: D.WidthType.DXA },
          shading: { fill: headerBg, type: shadingType }, margins: cellPad,
          children: [new D.Paragraph({ children: [new D.TextRun({ text: h, bold: true, size: 18, font: FONT, color: WHITE })] })]
        });
      }) }));
      // Data rows
      rows.forEach(function(row, ri) {
        tRows.push(new D.TableRow({ children: row.map(function(cell, i) {
          return new D.TableCell({
            borders: cellBorders, width: { size: colWidths[i], type: D.WidthType.DXA },
            shading: ri % 2 === 1 ? { fill: altRowBg, type: shadingType } : undefined,
            margins: cellPad,
            children: [new D.Paragraph({ children: [new D.TextRun({ text: String(cell || ''), size: 18, font: FONT, color: TEXT_DARK })] })]
          });
        }) }));
      });
      // Add spacing after table
      children.push(new D.Table({ rows: tRows, width: { size: PAGE_W, type: D.WidthType.DXA }, columnWidths: colWidths }));
      children.push(new D.Paragraph({ children: [], spacing: { after: 80 } }));
    }

    // Key-value snapshot table (borderless, clean)
    function makeSnapshotTable(kvPairs) {
      var tRows = [];
      kvPairs.forEach(function(kv, ri) {
        tRows.push(new D.TableRow({ children: [
          new D.TableCell({
            borders: noBorders, width: { size: 2600, type: D.WidthType.DXA },
            margins: { top: 50, bottom: 50, left: 0, right: 100 },
            children: [new D.Paragraph({ children: [new D.TextRun({ text: kv[0], bold: true, size: 21, font: FONT, color: H1_COLOR })] })]
          }),
          new D.TableCell({
            borders: noBorders, width: { size: 6760, type: D.WidthType.DXA },
            margins: { top: 50, bottom: 50, left: 120, right: 0 },
            shading: ri % 2 === 0 ? { fill: ALT_ROW, type: shadingType } : undefined,
            children: [new D.Paragraph({ children: [new D.TextRun({ text: kv[1], size: 21, font: FONT, color: TEXT_DARK })] })]
          })
        ] }));
      });
      children.push(new D.Table({ rows: tRows, width: { size: PAGE_W, type: D.WidthType.DXA }, columnWidths: [2600, 6760] }));
      children.push(new D.Paragraph({ children: [], spacing: { after: 80 } }));
    }

    // ============== TITLE BLOCK ==============
    // Company name — large
    children.push(new D.Paragraph({
      children: [new D.TextRun({ text: plan.companyName, bold: true, size: 48, font: FONT, color: H1_COLOR })],
      spacing: { before: 120, after: 60 }
    }));

    // Subtitle
    children.push(new D.Paragraph({
      children: [new D.TextRun({ text: 'ACCOUNT PLAN', size: 24, font: FONT, color: H2_COLOR, characterSpacing: 200 })],
      spacing: { after: 120 }
    }));

    // Meta line with bottom border
    var metaParts = [sellerName, AP.formatDate(plan.generatedAt)];
    if (plan.userInputs && plan.userInputs.dealStage) metaParts.push('Stage: ' + plan.userInputs.dealStage);
    children.push(new D.Paragraph({
      children: [new D.TextRun({ text: metaParts.join('  |  '), size: 18, font: FONT, color: TEXT_MUTED })],
      spacing: { after: 360 },
      border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: ACCENT, space: 8 } }
    }));

    // ============== 1. ACCOUNT SNAPSHOT ==============
    sectionHead('Account Snapshot');
    var snapPairs = [];
    if (o.industry) snapPairs.push(['Industry', o.industry]);
    if (o.hqLocation) snapPairs.push(['Headquarters', o.hqLocation]);
    if (o.annualRevenue) snapPairs.push(['Annual Revenue', o.annualRevenue]);
    if (o.employeeCount) snapPairs.push(['Employees', o.employeeCount]);
    if (o.strategicPriorities && o.strategicPriorities.length) {
      snapPairs.push(['Strategic Priorities', o.strategicPriorities.slice(0, 4).join('  \u2022  ')]);
    }
    if (snapPairs.length) makeSnapshotTable(snapPairs);

    // ============== 2. WHY THIS ACCOUNT ==============
    if (strat.positioning || val.executivePitch || strat.whyNow) {
      sectionHead('Why ' + plan.companyName);

      // Executive pitch as highlighted callout with left blue bar
      if (val.executivePitch) {
        children.push(new D.Paragraph({
          children: [new D.TextRun({ text: '\u201C' + val.executivePitch + '\u201D', size: 21, font: FONT, color: H1_COLOR, italics: true })],
          spacing: { before: 120, after: 200, line: 300 },
          indent: { left: 400, right: 400 },
          border: { left: { style: D.BorderStyle.SINGLE, size: 14, color: H2_COLOR, space: 10 } }
        }));
      }

      if (strat.positioning) labelValue('Positioning: ', strat.positioning);
      if (strat.whyNow) labelValue('Why Now: ', strat.whyNow);
      if (strat.landingZone) labelValue('Entry Point: ', strat.landingZone);

      if (strat.keyMessages && strat.keyMessages.length) {
        subHead('Key Messages');
        strat.keyMessages.slice(0, 3).forEach(function(m, i) {
          bodyText((i + 1) + '.  ' + m);
        });
      }
    }

    // ============== 3. KEY STAKEHOLDERS ==============
    if (plan.stakeholders && plan.stakeholders.length) {
      sectionHead('Key Stakeholders');
      makeTable(
        ['Name', 'Title', 'Role', 'Engagement Approach'],
        plan.stakeholders.slice(0, 8).map(function(s) {
          return [s.name || '', s.title || '', s.roleInDeal || '', trunc(s.engagementStrategy || s.notes || '', 120)];
        }),
        [1800, 2400, 1200, 3960]
      );
    }

    // ============== 4. COMPETITIVE LANDSCAPE ==============
    if (comp.landscape && comp.landscape.length) {
      sectionHead('Competitive Landscape');
      makeTable(
        ['Competitor', 'Presence', 'Aera Advantage'],
        comp.landscape.slice(0, 5).map(function(c) {
          return [c.competitor || '', c.presence || '', trunc(c.sellerAdvantage || c.aeraAdvantage || '', 140)];
        }),
        [1800, 1600, 5960]
      );
    }

    // ============== 5. VALUE POTENTIAL ==============
    if (val.metrics && val.metrics.length) {
      sectionHead('Value Potential');
      makeTable(
        ['Opportunity', 'Projected Impact', 'Confidence'],
        val.metrics.slice(0, 5).map(function(m) { return [m.metric || '', m.impact || '', m.confidence || '']; }),
        [4000, 3360, 2000]
      );
    }

    // ============== 6. ACTION PLAN (consolidated, max 10) ==============
    sectionHead('Action Plan');
    var actionItems = buildActionPlan(plan);
    if (actionItems.length) {
      makeTable(
        ['#', 'Action', 'Owner', 'Phase'],
        actionItems.map(function(a, i) {
          return [String(i + 1), a.action, a.owner, a.phase];
        }),
        [400, 6160, 1200, 1600],
        { headerColor: H1_COLOR }
      );
    }

    // ============== 7. KEY RISKS ==============
    if (plan.risks && plan.risks.length) {
      sectionHead('Key Risks');
      makeTable(
        ['Risk', 'L / I', 'Mitigation', 'Owner'],
        plan.risks.slice(0, 5).map(function(r) {
          return [trunc(r.risk || '', 100), (r.likelihood || '?')[0] + ' / ' + (r.impact || '?')[0], trunc(r.mitigation || '', 120), r.owner || ''];
        }),
        [2800, 800, 3960, 1800]
      );
    }

    // ============== 8. RECENT NEWS (compact) ==============
    if (plan.news && plan.news.length) {
      sectionHead('Recent News');
      plan.news.slice(0, 4).forEach(function(n) {
        children.push(new D.Paragraph({
          children: [
            new D.TextRun({ text: '\u25B8  ', size: 18, font: FONT, color: H2_COLOR }),
            new D.TextRun({ text: (n.headline || ''), bold: true, size: 18, font: FONT, color: TEXT_DARK }),
            new D.TextRun({ text: n.date ? '   (' + n.date + ')' : '', size: 18, font: FONT, color: TEXT_MUTED })
          ],
          spacing: { after: 80 }
        }));
      });
    }

    // ============== BUILD DOCUMENT ==============
    var doc = new D.Document({
      styles: {
        default: {
          document: { run: { font: FONT, size: 22 } }
        }
      },
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 },           // US Letter
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
          }
        },
        headers: { default: docHeader },
        footers: { default: docFooter },
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
