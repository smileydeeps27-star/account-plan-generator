/* ===== Account Plan Generator — Plan Renderer ===== */

AP.PlanRenderer = (function() {
  var e = AP.escapeHTML;

  function render(plan) {
    var container = document.getElementById('plan-container');
    if (!container) return;

    var sp = AP.SellerProfile.get() || {};
    var sellerName = e(sp.companyName || 'Our Company');

    var html = '';

    // Header
    html += '<div class="plan-header">';
    html += '<div class="plan-header-left">';
    html += '<h1>Account Plan: ' + e(plan.companyName) + '</h1>';
    html += '<div class="plan-header-meta">';
    html += '<span>Prepared by: ' + sellerName + '</span>';
    html += '<span>Generated: ' + AP.formatDate(plan.generatedAt) + '</span>';
    html += '</div>';
    html += '</div>';
    html += '<div class="plan-header-actions">';
    html += '<button class="btn btn-sm btn-secondary" id="btn-new-plan">&#8592; New Plan</button>';
    html += '<button class="btn btn-sm btn-secondary" id="btn-save-plan">Save</button>';
    html += '<button class="btn btn-sm btn-secondary" id="btn-copy-md">Copy Markdown</button>';
    html += '<button class="btn btn-sm btn-secondary" id="btn-export-docx">Export Word</button>';
    html += '<button class="btn btn-sm btn-secondary" id="btn-export-json">Export JSON</button>';
    html += '</div>';
    html += '</div>';

    // Tabs
    var tabs = [
      { id: 'overview', label: 'Overview' },
      { id: 'news', label: 'News' },
      { id: 'priorities', label: 'DI Priorities' },
      { id: 'stakeholders', label: 'Stakeholders' },
      { id: 'competitive', label: 'Competitive' },
      { id: 'value', label: 'Value Hypothesis' },
      { id: 'plan', label: '10-30-60 Plan' },
      { id: 'risks', label: 'Risks & Metrics' }
    ];

    html += '<div class="plan-tabs">';
    tabs.forEach(function(t, i) {
      html += '<button class="plan-tab' + (i === 0 ? ' active' : '') + '" data-tab="' + t.id + '">' + t.label + '</button>';
    });
    html += '</div>';

    // Panels
    html += renderOverview(plan);
    html += renderNews(plan);
    html += renderPriorities(plan);
    html += renderStakeholders(plan);
    html += renderCompetitive(plan);
    html += renderValue(plan);
    html += renderDayPlan(plan);
    html += renderRisksMetrics(plan);

    container.innerHTML = html;

    // Wire tabs
    container.querySelectorAll('.plan-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        container.querySelectorAll('.plan-tab').forEach(function(t) { t.classList.remove('active'); });
        container.querySelectorAll('.plan-panel').forEach(function(p) { p.classList.remove('active'); });
        tab.classList.add('active');
        var panel = container.querySelector('#panel-' + tab.dataset.tab);
        if (panel) panel.classList.add('active');
      });
    });

    // Wire action buttons
    wireActions(plan);
  }

  // ===== MODULE 1: Overview =====
  function renderOverview(plan) {
    var o = plan.overview || {};
    var html = '<div id="panel-overview" class="plan-panel active">';

    // Company Profile Grid
    html += '<h3 class="section-title">Company Profile</h3>';
    html += '<div class="overview-grid">';

    var fields = [
      { label: 'Company', value: plan.companyName },
      { label: 'Industry', value: o.industry },
      { label: 'HQ', value: o.hqLocation },
      { label: 'Revenue', value: o.annualRevenue },
      { label: 'Employees', value: o.employeeCount },
      { label: 'Ticker', value: o.ticker },
      { label: 'Website', value: o.website }
    ];

    fields.forEach(function(f) {
      if (f.value) {
        html += '<div class="overview-field">';
        html += '<div class="overview-field-label">' + e(f.label) + '</div>';
        html += '<div class="overview-field-value">' + e(f.value) + '</div>';
        html += '</div>';
      }
    });
    html += '</div>';

    // Financial Snapshot
    if (o.financialSnapshot && o.financialSnapshot.length > 0) {
      html += '<h3 class="section-title">Financial Snapshot</h3>';
      html += '<table class="plan-table">';
      html += '<thead><tr><th>Metric</th><th>Current Year</th><th>Prior Year</th><th>Notes</th></tr></thead>';
      html += '<tbody>';
      o.financialSnapshot.forEach(function(row) {
        html += '<tr>';
        html += '<td class="text-strong">' + e(row.metric) + '</td>';
        html += '<td>' + e(row.currentYear) + '</td>';
        html += '<td>' + e(row.priorYear) + '</td>';
        html += '<td>' + e(row.notes) + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
    }

    // Business Groups
    if (o.businessGroups && o.businessGroups.length > 0) {
      html += '<h3 class="section-title">Business Groups</h3>';
      o.businessGroups.forEach(function(bg, i) {
        html += '<div class="biz-group">';
        html += '<div class="biz-group-number">' + (i + 1) + '</div>';
        html += '<div>';
        html += '<div class="biz-group-name">' + e(bg.name);
        if (bg.revenueShare) html += ' <span class="text-muted" style="font-size:12px">(' + e(bg.revenueShare) + ')</span>';
        html += '</div>';
        if (bg.description) html += '<div class="biz-group-desc">' + e(bg.description) + '</div>';
        html += '</div>';
        html += '</div>';
      });
    }

    // Strategic Priorities
    if (o.strategicPriorities && o.strategicPriorities.length > 0) {
      html += '<h3 class="section-title mt-24">Strategic Priorities</h3>';
      html += '<ol class="priorities-list">';
      o.strategicPriorities.forEach(function(p) {
        html += '<li>' + e(p) + '</li>';
      });
      html += '</ol>';
    }

    // Technology Landscape
    if (o.technologyLandscape) {
      html += '<h3 class="section-title mt-24">Technology Landscape</h3>';
      html += '<p style="font-size:14px; color:var(--text-secondary); line-height:1.6;">' + e(o.technologyLandscape) + '</p>';
    }

    html += '</div>';
    return html;
  }

  // ===== MODULE 2: News =====
  function renderNews(plan) {
    var html = '<div id="panel-news" class="plan-panel">';
    html += '<h3 class="section-title">News Highlights</h3>';

    if (!plan.news || plan.news.length === 0) {
      html += '<p class="text-muted">No news items generated.</p>';
    } else {
      plan.news.forEach(function(n, i) {
        html += '<div class="news-item">';
        html += '<div class="news-item-header">';
        html += '<div class="news-item-headline">' + (i + 1) + '. ' + e(n.headline) + '</div>';
        if (n.date) html += '<div class="news-item-date">' + e(n.date) + '</div>';
        html += '</div>';
        if (n.detail) {
          html += '<div class="news-item-detail">' + e(n.detail) + '</div>';
        }
        html += '<div class="news-item-footer">';
        if (n.source) html += '<span>Source: ' + e(n.source) + '</span>';
        if (n.relevanceTag) html += '<span class="badge badge-blue">' + e(n.relevanceTag) + '</span>';
        html += '</div>';
        html += '</div>';
      });
    }

    html += '</div>';
    return html;
  }

  // ===== MODULE 3: DI Priorities =====
  function renderPriorities(plan) {
    var html = '<div id="panel-priorities" class="plan-panel">';
    html += '<h3 class="section-title">Decision Intelligence Priorities</h3>';

    if (!plan.diPriorities || plan.diPriorities.length === 0) {
      html += '<p class="text-muted">No priorities generated.</p>';
    } else {
      plan.diPriorities.forEach(function(p, i) {
        html += '<div class="priority-card">';
        html += '<div class="priority-rank' + (i === 0 ? ' top' : '') + '">' + (p.rank || (i + 1)) + '</div>';

        html += '<div class="priority-header">';
        html += '<div class="priority-area">' + e(p.area) + '</div>';
        if (p.urgency) {
          var urgencyClass = p.urgency === 'HIGHEST' ? 'badge-red' : (p.urgency === 'High' ? 'badge-amber' : 'badge-muted');
          html += '<span class="badge ' + urgencyClass + '">' + e(p.urgency) + '</span>';
        }
        html += '</div>';

        if (p.context) {
          html += '<div class="priority-section">';
          html += '<div class="priority-section-label">Context</div>';
          html += '<div class="priority-section-text">' + e(p.context) + '</div>';
          html += '</div>';
        }

        if (p.sellerValueProp) {
          html += '<div class="priority-section">';
          html += '<div class="priority-section-label">Value Proposition</div>';
          html += '<div class="priority-section-text">' + e(p.sellerValueProp) + '</div>';
          html += '</div>';
        }

        if (p.estimatedImpact) {
          html += '<div class="priority-footer">';
          html += '<span class="badge badge-green">Impact: ' + e(p.estimatedImpact) + '</span>';
          html += '</div>';
        }

        html += '</div>';
      });
    }

    html += '</div>';
    return html;
  }

  // ===== MODULE 4: Stakeholders =====
  function renderStakeholders(plan) {
    var html = '<div id="panel-stakeholders" class="plan-panel">';
    html += '<h3 class="section-title">Stakeholder Mapping</h3>';

    if (!plan.stakeholders || plan.stakeholders.length === 0) {
      html += '<p class="text-muted">No stakeholders generated.</p>';
    } else {
      html += '<table class="plan-table">';
      html += '<thead><tr><th>Name</th><th>Title</th><th>Role</th><th>Relevance</th><th>Engagement Strategy</th></tr></thead>';
      html += '<tbody>';
      plan.stakeholders.forEach(function(s) {
        var roleKey = (s.roleInDeal || '').toLowerCase().replace(/\s+/g, '');
        if (roleKey === 'executivesponsor') roleKey = 'sponsor';
        html += '<tr>';
        html += '<td class="text-strong">' + e(s.name) + '</td>';
        html += '<td>' + e(s.title) + '</td>';
        html += '<td><span class="role-badge ' + roleKey + '">' + e(s.roleInDeal) + '</span></td>';
        html += '<td>' + e(s.relevance) + '</td>';
        html += '<td style="max-width:300px;">' + e(s.engagementStrategy || s.notes || '') + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';

      // Engagement Strategy by Persona (if notes exist separately from engagement strategy)
      var hasNotes = plan.stakeholders.some(function(s) { return s.notes && s.engagementStrategy; });
      if (hasNotes) {
        html += '<h3 class="section-title mt-24">Engagement Notes</h3>';
        plan.stakeholders.forEach(function(s) {
          if (s.notes && s.engagementStrategy) {
            html += '<div style="margin-bottom:10px;">';
            html += '<strong style="color:var(--text-primary); font-size:13px;">' + e(s.name) + ' (' + e(s.title) + '):</strong> ';
            html += '<span style="font-size:13px; color:var(--text-secondary);">' + e(s.notes) + '</span>';
            html += '</div>';
          }
        });
      }
    }

    html += '</div>';
    return html;
  }

  // ===== MODULE 5: Competitive =====
  function renderCompetitive(plan) {
    var c = plan.competitive || {};
    var html = '<div id="panel-competitive" class="plan-panel">';
    html += '<h3 class="section-title">Competitive Landscape</h3>';

    if (c.positioning) {
      html += '<div class="competitive-positioning">' + e(c.positioning) + '</div>';
    }

    if (c.landscape && c.landscape.length > 0) {
      html += '<table class="plan-table">';
      html += '<thead><tr><th>Competitor</th><th>Weakness</th><th>Our Advantage</th></tr></thead>';
      html += '<tbody>';
      c.landscape.forEach(function(comp) {
        html += '<tr>';
        html += '<td class="text-strong">' + e(comp.competitor) + '</td>';
        html += '<td>' + e(comp.weakness) + '</td>';
        html += '<td>' + e(comp.sellerAdvantage || comp.aeraAdvantage || '') + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
    } else {
      html += '<p class="text-muted">No competitive data generated.</p>';
    }

    html += '</div>';
    return html;
  }

  // ===== MODULE 6: Value Hypothesis =====
  function renderValue(plan) {
    var v = plan.valueHypothesis || {};
    var html = '<div id="panel-value" class="plan-panel">';
    html += '<h3 class="section-title">Value Hypothesis</h3>';

    if (v.executivePitch) {
      html += '<h4 style="font-size:13px; color:var(--text-muted); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">Executive Pitch</h4>';
      html += '<div class="exec-pitch">"' + e(v.executivePitch) + '"</div>';
    }

    if (v.metrics && v.metrics.length > 0) {
      html += '<h4 style="font-size:13px; color:var(--text-muted); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">Quantified Value Metrics</h4>';
      html += '<table class="plan-table">';
      html += '<thead><tr><th>Metric</th><th>Impact</th><th>Confidence</th></tr></thead>';
      html += '<tbody>';
      v.metrics.forEach(function(m) {
        var confClass = m.confidence === 'High' ? 'badge-green' : (m.confidence === 'Medium' ? 'badge-amber' : 'badge-muted');
        html += '<tr>';
        html += '<td class="text-strong">' + e(m.metric) + '</td>';
        html += '<td>' + e(m.impact) + '</td>';
        html += '<td><span class="badge ' + confClass + '">' + e(m.confidence) + '</span></td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
    } else {
      html += '<p class="text-muted">No value metrics generated.</p>';
    }

    html += '</div>';
    return html;
  }

  // ===== MODULE 7: 10-30-60 Day Plan =====
  function renderDayPlan(plan) {
    var p = plan.plan || {};
    var html = '<div id="panel-plan" class="plan-panel">';
    html += '<h3 class="section-title">10-30-60 Day Engagement Plan</h3>';

    var phases = [
      { key: 'day10', badge: 'd10', label: 'Days 1-10' },
      { key: 'day30', badge: 'd30', label: 'Days 11-30' },
      { key: 'day60', badge: 'd60', label: 'Days 31-60' }
    ];

    phases.forEach(function(phase) {
      var data = p[phase.key];
      if (!data) return;

      html += '<div class="phase-block">';
      html += '<div class="phase-title">';
      html += '<span class="phase-badge ' + phase.badge + '">' + phase.label + '</span>';
      html += e(data.title || '');
      html += '</div>';

      if (data.actions && data.actions.length > 0) {
        // Check if actions are objects or strings
        if (typeof data.actions[0] === 'object') {
          html += '<table class="plan-table">';
          html += '<thead><tr><th>Day</th><th>Action</th><th>Owner</th><th>Deliverable</th></tr></thead>';
          html += '<tbody>';
          data.actions.forEach(function(a) {
            html += '<tr>';
            html += '<td class="text-strong" style="white-space:nowrap;">' + e(a.day || '') + '</td>';
            html += '<td>' + e(a.action || '') + '</td>';
            html += '<td style="white-space:nowrap;">' + e(a.owner || '') + '</td>';
            html += '<td>' + e(a.deliverable || '') + '</td>';
            html += '</tr>';
          });
          html += '</tbody></table>';
        } else {
          // String array fallback
          html += '<ul style="list-style:none; padding:0;">';
          data.actions.forEach(function(a) {
            html += '<li style="padding:6px 0; font-size:13px; color:var(--text-secondary); border-bottom:1px solid rgba(255,255,255,0.03);">&#8226; ' + e(a) + '</li>';
          });
          html += '</ul>';
        }
      }

      html += '</div>';
    });

    html += '</div>';
    return html;
  }

  // ===== MODULE 8: Risks & Success Metrics =====
  function renderRisksMetrics(plan) {
    var html = '<div id="panel-risks" class="plan-panel">';

    // Risks
    html += '<h3 class="section-title">Key Risks & Mitigations</h3>';

    if (plan.risks && plan.risks.length > 0) {
      html += '<table class="plan-table">';
      html += '<thead><tr><th>Risk</th><th>Likelihood</th><th>Impact</th><th>Mitigation</th></tr></thead>';
      html += '<tbody>';
      plan.risks.forEach(function(r) {
        var lClass = 'likelihood-' + (r.likelihood || 'medium').toLowerCase();
        var iClass = 'likelihood-' + (r.impact || 'medium').toLowerCase();
        html += '<tr>';
        html += '<td class="text-strong">' + e(r.risk) + '</td>';
        html += '<td class="' + lClass + '">' + e(r.likelihood || 'Medium') + '</td>';
        html += '<td class="' + iClass + '">' + e(r.impact || 'Medium') + '</td>';
        html += '<td>' + e(r.mitigation) + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
    } else {
      html += '<p class="text-muted">No risks generated.</p>';
    }

    // Success Metrics
    html += '<h3 class="section-title mt-32">Success Metrics</h3>';

    if (plan.successMetrics && plan.successMetrics.length > 0) {
      html += '<table class="plan-table">';
      html += '<thead><tr><th>Metric</th><th>Target</th><th>Timeline</th><th>Measurement</th></tr></thead>';
      html += '<tbody>';
      plan.successMetrics.forEach(function(m) {
        html += '<tr>';
        html += '<td class="text-strong">' + e(m.metric) + '</td>';
        html += '<td>' + e(m.target) + '</td>';
        html += '<td>' + e(m.timeline) + '</td>';
        html += '<td>' + e(m.measurement) + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
    } else {
      html += '<p class="text-muted">No success metrics generated.</p>';
    }

    html += '</div>';
    return html;
  }

  // ===== Wire Action Buttons =====
  function wireActions(plan) {
    // Save
    var saveBtn = document.getElementById('btn-save-plan');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        AP.PlanPersistence.saveLocal(plan);
        AP.showToast('Plan saved');
      });
    }

    // Copy Markdown
    var copyBtn = document.getElementById('btn-copy-md');
    if (copyBtn) {
      copyBtn.addEventListener('click', function() {
        var md = AP.PlanExport.toMarkdown(plan);
        AP.copyToClipboard(md);
      });
    }

    // Export Word
    var docxBtn = document.getElementById('btn-export-docx');
    if (docxBtn) {
      docxBtn.addEventListener('click', function() {
        AP.PlanExport.toDocx(plan);
      });
    }

    // Export JSON
    var jsonBtn = document.getElementById('btn-export-json');
    if (jsonBtn) {
      jsonBtn.addEventListener('click', function() {
        AP.PlanPersistence.downloadJSON(plan);
      });
    }
  }

  return { render: render };
})();
