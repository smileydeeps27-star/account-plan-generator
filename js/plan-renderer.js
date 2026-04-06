/* ===== Account Plan Generator — Plan Renderer (10 Tabs) ===== */

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
    if (plan.userInputs && plan.userInputs.dealStage) html += '<span>Stage: ' + e(plan.userInputs.dealStage) + '</span>';
    html += '</div>';
    html += '</div>';
    html += '<div class="plan-header-actions">';
    html += '<button class="btn btn-sm btn-secondary" id="btn-new-plan">&#8592; Generate New Plan</button>';
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
      { id: 'techlandscape', label: 'Tech Stack' },
      { id: 'priorities', label: 'DI Priorities' },
      { id: 'stakeholders', label: 'Stakeholders' },
      { id: 'competitive', label: 'Competitive' },
      { id: 'value', label: 'Value' },
      { id: 'strategy', label: 'Strategy' },
      { id: 'plan', label: '30-60-90' },
      { id: 'risks', label: 'Risks' },
      { id: 'actions', label: 'Actions' },
      { id: 'meetingnotes', label: 'Notes' }
    ];

    html += '<div class="plan-tabs-wrapper">';
    html += '<div class="scroll-fade scroll-fade-left" style="opacity:0"></div>';
    html += '<div class="plan-tabs">';
    tabs.forEach(function(t, i) {
      html += '<button class="plan-tab' + (i === 0 ? ' active' : '') + '" data-tab="' + t.id + '">' + t.label + '</button>';
    });
    html += '</div>';
    html += '<div class="scroll-fade scroll-fade-right"></div>';
    html += '</div>';

    // Panels
    html += renderOverview(plan);
    html += renderNews(plan);
    html += renderTechLandscape(plan);
    html += renderPriorities(plan);
    html += renderStakeholders(plan);
    html += renderCompetitive(plan);
    html += renderValue(plan);
    html += renderStrategy(plan);
    html += renderDayPlan(plan);
    html += renderRisksMetrics(plan);
    html += renderActionTracker(plan);
    html += renderMeetingNotes(plan);

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

    // Wire scroll fade indicators
    var tabsEl = container.querySelector('.plan-tabs');
    var fadeLeft = container.querySelector('.scroll-fade-left');
    var fadeRight = container.querySelector('.scroll-fade-right');
    if (tabsEl && fadeLeft && fadeRight) {
      var updateFades = function() {
        var sl = tabsEl.scrollLeft;
        var maxScroll = tabsEl.scrollWidth - tabsEl.clientWidth;
        fadeLeft.style.opacity = sl > 5 ? '1' : '0';
        fadeRight.style.opacity = (maxScroll > 5 && sl < maxScroll - 5) ? '1' : '0';
      };
      tabsEl.addEventListener('scroll', updateFades);
      setTimeout(updateFades, 100);
      window.addEventListener('resize', updateFades);
    }

    wireActions(plan);
  }

  // ===== MODULE 1: Overview =====
  function renderOverview(plan) {
    var o = plan.overview || {};
    var html = '<div id="panel-overview" class="plan-panel active">';

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

    if (o.financialSnapshot && o.financialSnapshot.length > 0) {
      html += '<h3 class="section-title">Financial Snapshot</h3>';
      html += '<table class="plan-table"><thead><tr><th>Metric</th><th>Current Year</th><th>Prior Year</th><th>Notes</th></tr></thead><tbody>';
      o.financialSnapshot.forEach(function(row) {
        html += '<tr><td class="text-strong">' + e(row.metric) + '</td><td>' + e(row.currentYear) + '</td><td>' + e(row.priorYear) + '</td><td>' + e(row.notes) + '</td></tr>';
      });
      html += '</tbody></table>';
    }

    if (o.businessGroups && o.businessGroups.length > 0) {
      html += '<h3 class="section-title">Business Groups</h3>';
      o.businessGroups.forEach(function(bg, i) {
        html += '<div class="biz-group"><div class="biz-group-number">' + (i + 1) + '</div><div>';
        html += '<div class="biz-group-name">' + e(bg.name);
        if (bg.revenueShare) html += ' <span class="text-muted" style="font-size:12px">(' + e(bg.revenueShare) + ')</span>';
        html += '</div>';
        if (bg.description) html += '<div class="biz-group-desc">' + e(bg.description) + '</div>';
        html += '</div></div>';
      });
    }

    if (o.strategicPriorities && o.strategicPriorities.length > 0) {
      html += '<h3 class="section-title mt-24">Strategic Priorities</h3><ol class="priorities-list">';
      o.strategicPriorities.forEach(function(p) { html += '<li>' + e(p) + '</li>'; });
      html += '</ol>';
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
        html += '<div class="news-item-header"><div class="news-item-headline">' + (i + 1) + '. ' + e(n.headline) + '</div>';
        if (n.date) html += '<div class="news-item-date">' + e(n.date) + '</div>';
        html += '</div>';
        if (n.detail) html += '<div class="news-item-detail">' + e(n.detail) + '</div>';
        html += '<div class="news-item-footer">';
        if (n.source) html += '<span>Source: ' + e(n.source) + '</span>';
        if (n.relevanceTag) html += '<span class="badge badge-blue">' + e(n.relevanceTag) + '</span>';
        html += '</div></div>';
      });
    }
    html += '</div>';
    return html;
  }

  // ===== MODULE 3: Technology Landscape (NEW) =====
  function renderTechLandscape(plan) {
    var t = plan.technologyLandscape || {};
    var html = '<div id="panel-techlandscape" class="plan-panel">';
    html += '<h3 class="section-title">Technology Landscape</h3>';

    if (t.knownSystems && t.knownSystems.length > 0) {
      // Group by category
      var categories = {};
      t.knownSystems.forEach(function(sys) {
        var cat = sys.category || 'Other';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(sys);
      });

      Object.keys(categories).forEach(function(cat) {
        html += '<div class="tech-category">';
        html += '<h4 class="tech-category-title">' + e(cat) + '</h4>';
        html += '<div class="tech-cards">';
        categories[cat].forEach(function(sys) {
          var confClass = sys.confidence === 'Confirmed' ? 'badge-green' : (sys.confidence === 'Likely' ? 'badge-amber' : 'badge-muted');
          html += '<div class="tech-card">';
          html += '<div class="tech-card-header">';
          html += '<span class="tech-vendor">' + e(sys.vendor) + '</span>';
          html += '<span class="badge ' + confClass + '">' + e(sys.confidence || 'Unknown') + '</span>';
          html += '</div>';
          if (sys.product) html += '<div class="tech-product">' + e(sys.product) + '</div>';
          if (sys.evidence) html += '<div class="tech-evidence">' + e(sys.evidence) + '</div>';
          html += '</div>';
        });
        html += '</div></div>';
      });
    } else {
      html += '<p class="text-muted">No technology stack data found. Try generating again or check company name.</p>';
    }

    if (t.digitalStrategy) {
      html += '<h3 class="section-title mt-24">Digital Strategy</h3>';
      html += '<p class="section-text">' + e(t.digitalStrategy) + '</p>';
    }

    if (t.itLeadership) {
      html += '<h3 class="section-title mt-24">IT Leadership</h3>';
      html += '<p class="section-text">' + e(t.itLeadership) + '</p>';
    }

    if (t.techBudget) {
      html += '<div class="callout callout-info mt-16"><strong>IT Spend:</strong> ' + e(t.techBudget) + '</div>';
    }

    html += '</div>';
    return html;
  }

  // ===== MODULE 4: DI Priorities =====
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
        if (p.context) html += '<div class="priority-section"><div class="priority-section-label">Context</div><div class="priority-section-text">' + e(p.context) + '</div></div>';
        if (p.sellerValueProp) html += '<div class="priority-section"><div class="priority-section-label">Value Proposition</div><div class="priority-section-text">' + e(p.sellerValueProp) + '</div></div>';
        if (p.estimatedImpact) html += '<div class="priority-footer"><span class="badge badge-green">Impact: ' + e(p.estimatedImpact) + '</span></div>';
        html += '</div>';
      });
    }
    html += '</div>';
    return html;
  }

  // ===== MODULE 5: Stakeholders (Enhanced with quotes) =====
  function renderStakeholders(plan) {
    var html = '<div id="panel-stakeholders" class="plan-panel">';
    html += '<h3 class="section-title">Stakeholder Mapping</h3>';

    if (!plan.stakeholders || plan.stakeholders.length === 0) {
      html += '<p class="text-muted">No stakeholders generated.</p>';
    } else {
      // Card-based layout instead of table
      plan.stakeholders.forEach(function(s) {
        var roleKey = (s.roleInDeal || '').toLowerCase().replace(/\s+/g, '');
        if (roleKey === 'executivesponsor') roleKey = 'sponsor';
        var confBadge = '';
        if (s.confidence) {
          var cClass = s.confidence === 'Verified' ? 'badge-green' : (s.confidence === 'Likely' ? 'badge-amber' : 'badge-muted');
          confBadge = '<span class="badge ' + cClass + '">' + e(s.confidence) + '</span>';
        }

        html += '<div class="stakeholder-card">';
        html += '<div class="stakeholder-header">';
        html += '<div><span class="stakeholder-name">' + e(s.name) + '</span>';
        html += '<span class="stakeholder-title">' + e(s.title) + '</span></div>';
        html += '<div class="stakeholder-badges"><span class="role-badge ' + roleKey + '">' + e(s.roleInDeal) + '</span>';
        if (s.relevance) html += '<span class="badge badge-blue">' + e(s.relevance) + '</span>';
        html += confBadge + '</div>';
        html += '</div>';

        if (s.notes) html += '<div class="stakeholder-notes">' + e(s.notes) + '</div>';

        if (s.engagementStrategy) {
          html += '<div class="stakeholder-engagement"><div class="engagement-label">Engagement Strategy</div>';
          html += '<div class="engagement-text">' + e(s.engagementStrategy) + '</div></div>';
        }

        // Public quotes
        if (s.publicQuotes && s.publicQuotes.length > 0) {
          html += '<div class="stakeholder-quotes">';
          s.publicQuotes.forEach(function(q) {
            html += '<blockquote class="stakeholder-quote">';
            html += '<p>"' + e(q.quote) + '"</p>';
            html += '<cite>' + e(q.source || '') + (q.date ? ' (' + e(q.date) + ')' : '') + '</cite>';
            html += '</blockquote>';
          });
          html += '</div>';
        }

        html += '</div>';
      });
    }
    html += '</div>';
    return html;
  }

  // ===== MODULE 6: Competitive (Enhanced with user-reported) =====
  function renderCompetitive(plan) {
    var c = plan.competitive || {};
    var html = '<div id="panel-competitive" class="plan-panel">';
    html += '<h3 class="section-title">Competitive Landscape</h3>';

    // Show user input if present
    if (plan.userInputs && plan.userInputs.suspectedCompetitors) {
      html += '<div class="callout callout-info mb-16"><strong>Sales Team Intelligence:</strong> ' + e(plan.userInputs.suspectedCompetitors) + '</div>';
    }

    if (c.positioning) {
      html += '<div class="competitive-positioning">' + e(c.positioning) + '</div>';
    }

    if (c.landscape && c.landscape.length > 0) {
      c.landscape.forEach(function(comp) {
        var userBadge = comp.userReported ? '<span class="badge badge-amber">User Reported</span>' : '';
        var presenceBadge = comp.presence ? '<span class="badge badge-blue">' + e(comp.presence) + '</span>' : '';

        html += '<div class="competitor-card">';
        html += '<div class="competitor-header">';
        html += '<span class="competitor-name">' + e(comp.competitor) + '</span>';
        html += '<div class="competitor-badges">' + presenceBadge + userBadge + '</div>';
        html += '</div>';
        if (comp.weakness) html += '<div class="competitor-section"><div class="competitor-label">Weakness</div><div>' + e(comp.weakness) + '</div></div>';
        if (comp.sellerAdvantage || comp.aeraAdvantage) html += '<div class="competitor-section"><div class="competitor-label">Our Advantage</div><div>' + e(comp.sellerAdvantage || comp.aeraAdvantage) + '</div></div>';
        if (comp.battleCard) html += '<div class="competitor-battlecard"><strong>Talk Track:</strong> ' + e(comp.battleCard) + '</div>';
        html += '</div>';
      });
    } else {
      html += '<p class="text-muted">No competitive data generated.</p>';
    }
    html += '</div>';
    return html;
  }

  // ===== MODULE 7: Value Hypothesis =====
  function renderValue(plan) {
    var v = plan.valueHypothesis || {};
    var html = '<div id="panel-value" class="plan-panel">';
    html += '<h3 class="section-title">Value Hypothesis</h3>';

    if (v.executivePitch) {
      html += '<h4 class="subsection-label">Executive Pitch</h4>';
      html += '<div class="exec-pitch">"' + e(v.executivePitch) + '"</div>';
    }

    if (v.whyNow) {
      html += '<div class="callout callout-warn mt-16"><strong>Why Now:</strong> ' + e(v.whyNow) + '</div>';
    }

    if (v.metrics && v.metrics.length > 0) {
      html += '<h4 class="subsection-label mt-24">Quantified Value Metrics</h4>';
      html += '<table class="plan-table"><thead><tr><th>Metric</th><th>Impact</th><th>Confidence</th><th>Basis</th></tr></thead><tbody>';
      v.metrics.forEach(function(m) {
        var confClass = m.confidence === 'High' ? 'badge-green' : (m.confidence === 'Medium' ? 'badge-amber' : 'badge-muted');
        html += '<tr><td class="text-strong">' + e(m.metric) + '</td><td>' + e(m.impact) + '</td>';
        html += '<td><span class="badge ' + confClass + '">' + e(m.confidence) + '</span></td>';
        html += '<td>' + e(m.basis || '') + '</td></tr>';
      });
      html += '</tbody></table>';
    }
    html += '</div>';
    return html;
  }

  // ===== MODULE 8: Account Strategy (NEW) =====
  function renderStrategy(plan) {
    var s = plan.accountStrategy || {};
    var html = '<div id="panel-strategy" class="plan-panel">';
    html += '<h3 class="section-title">Account Strategy</h3>';

    if (!s.positioning && !s.whyAera) {
      html += '<p class="text-muted">No account strategy generated. Add account context for better results.</p>';
    } else {
      if (s.positioning) {
        html += '<div class="strategy-section"><h4 class="subsection-label">Strategic Positioning</h4>';
        html += '<p class="section-text">' + e(s.positioning) + '</p></div>';
      }

      if (s.whyAera) {
        html += '<div class="strategy-section"><h4 class="subsection-label">Why Aera</h4>';
        html += '<div class="callout callout-success">' + e(s.whyAera) + '</div></div>';
      }

      if (s.whyNow) {
        html += '<div class="strategy-section"><h4 class="subsection-label">Why Now</h4>';
        html += '<div class="callout callout-warn">' + e(s.whyNow) + '</div></div>';
      }

      if (s.landingZone) {
        html += '<div class="strategy-section"><h4 class="subsection-label">Landing Zone</h4>';
        html += '<p class="section-text">' + e(s.landingZone) + '</p></div>';
      }

      if (s.keyMessages && s.keyMessages.length > 0) {
        html += '<div class="strategy-section"><h4 class="subsection-label">Key Messages</h4><ol class="key-messages-list">';
        s.keyMessages.forEach(function(m) { html += '<li>' + e(m) + '</li>'; });
        html += '</ol></div>';
      }
    }
    html += '</div>';
    return html;
  }

  // ===== MODULE 9: 30-60-90 Day Plan + Next 5 Steps =====
  function renderDayPlan(plan) {
    var p = plan.dayPlan || {};
    var html = '<div id="panel-plan" class="plan-panel">';
    html += '<h3 class="section-title">30-60-90 Day Engagement Plan</h3>';

    var phases = [
      { key: 'day30', badge: 'd30', label: 'Days 1-30' },
      { key: 'day60', badge: 'd60', label: 'Days 31-60' },
      { key: 'day90', badge: 'd90', label: 'Days 61-90' }
    ];

    phases.forEach(function(phase) {
      var data = p[phase.key];
      if (!data) return;

      html += '<div class="phase-block">';
      html += '<div class="phase-title"><span class="phase-badge ' + phase.badge + '">' + phase.label + '</span>' + e(data.title || '') + '</div>';

      if (data.whatGoodLooksLike) {
        html += '<div class="callout callout-success wgll"><strong>What Good Looks Like:</strong> ' + e(data.whatGoodLooksLike) + '</div>';
      }

      if (data.actions && data.actions.length > 0 && typeof data.actions[0] === 'object') {
        html += '<table class="plan-table"><thead><tr><th>Day</th><th>Action</th><th>Owner</th><th>Deliverable</th></tr></thead><tbody>';
        data.actions.forEach(function(a) {
          html += '<tr><td class="text-strong" style="white-space:nowrap;">' + e(a.day || '') + '</td>';
          html += '<td>' + e(a.action || '') + '</td>';
          html += '<td style="white-space:nowrap;">' + e(a.owner || '') + '</td>';
          html += '<td>' + e(a.deliverable || '') + '</td></tr>';
        });
        html += '</tbody></table>';
      }
      html += '</div>';
    });

    // Next 5 Steps
    if (plan.nextFiveSteps && plan.nextFiveSteps.length > 0) {
      html += '<h3 class="section-title mt-32">Next 5 Steps</h3>';
      html += '<div class="next-steps-list">';
      plan.nextFiveSteps.forEach(function(s, i) {
        html += '<div class="next-step-item">';
        html += '<div class="next-step-number">' + (s.step || (i + 1)) + '</div>';
        html += '<div class="next-step-content">';
        html += '<div class="next-step-action">' + e(s.action) + '</div>';
        html += '<div class="next-step-meta">';
        if (s.owner) html += '<span><strong>Owner:</strong> ' + e(s.owner) + '</span>';
        if (s.by) html += '<span><strong>By:</strong> ' + e(s.by) + '</span>';
        if (s.outcome) html += '<span><strong>Outcome:</strong> ' + e(s.outcome) + '</span>';
        html += '</div></div></div>';
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  // ===== MODULE 10: Risks & Success Metrics (Enhanced) =====
  function renderRisksMetrics(plan) {
    var html = '<div id="panel-risks" class="plan-panel">';

    // Show user input if present
    if (plan.userInputs && plan.userInputs.knownRisks) {
      html += '<div class="callout callout-info mb-16"><strong>Sales Team Concerns:</strong> ' + e(plan.userInputs.knownRisks) + '</div>';
    }

    html += '<h3 class="section-title">Key Risks & Mitigations</h3>';

    if (plan.risks && plan.risks.length > 0) {
      plan.risks.forEach(function(r) {
        var lClass = (r.likelihood || 'Medium').toLowerCase();
        var iClass = (r.impact || 'Medium').toLowerCase();
        var userBadge = r.userReported ? '<span class="badge badge-amber">User Reported</span>' : '';
        var catBadge = r.category ? '<span class="badge badge-blue">' + e(r.category) + '</span>' : '';

        html += '<div class="risk-card">';
        html += '<div class="risk-header">';
        html += '<div class="risk-title">' + e(r.risk) + '</div>';
        html += '<div class="risk-badges">' + catBadge + userBadge + '</div>';
        html += '</div>';
        html += '<div class="risk-severity">';
        html += '<span class="risk-tag likelihood-' + lClass + '">Likelihood: ' + e(r.likelihood || 'Medium') + '</span>';
        html += '<span class="risk-tag likelihood-' + iClass + '">Impact: ' + e(r.impact || 'Medium') + '</span>';
        if (r.owner) html += '<span class="risk-tag">Owner: ' + e(r.owner) + '</span>';
        html += '</div>';
        if (r.mitigation) html += '<div class="risk-mitigation"><strong>Mitigation:</strong> ' + e(r.mitigation) + '</div>';
        html += '</div>';
      });
    } else {
      html += '<p class="text-muted">No risks generated.</p>';
    }

    // Success Metrics
    html += '<h3 class="section-title mt-32">Success Metrics</h3>';
    if (plan.successMetrics && plan.successMetrics.length > 0) {
      html += '<table class="plan-table"><thead><tr><th>Metric</th><th>Target</th><th>Timeline</th><th>Measurement</th></tr></thead><tbody>';
      plan.successMetrics.forEach(function(m) {
        html += '<tr><td class="text-strong">' + e(m.metric) + '</td><td>' + e(m.target) + '</td><td>' + e(m.timeline) + '</td><td>' + e(m.measurement) + '</td></tr>';
      });
      html += '</tbody></table>';
    } else {
      html += '<p class="text-muted">No success metrics generated.</p>';
    }

    html += '</div>';
    return html;
  }

  // ===== MODULE 11: Action Tracker =====
  function initActionTracker(plan) {
    if (plan.actionTracker) return;
    plan.actionTracker = [];
    var baseDate = plan.generatedAt ? new Date(plan.generatedAt) : new Date();
    var idx = 0;

    function addDays(d, n) { var r = new Date(d); r.setDate(r.getDate() + n); return r.toISOString().split('T')[0]; }
    function parseDayNum(str) {
      if (!str) return null;
      var m = String(str).match(/(\d+)/);
      return m ? parseInt(m[1], 10) : null;
    }

    var dp = plan.dayPlan || {};
    ['day30', 'day60', 'day90'].forEach(function(phase) {
      var data = dp[phase];
      if (!data || !data.actions) return;
      data.actions.forEach(function(a) {
        if (typeof a !== 'object') return;
        var dayNum = parseDayNum(a.day);
        plan.actionTracker.push({
          id: 'at_' + Date.now() + '_' + (idx++),
          source: phase,
          action: a.action || '',
          owner: a.owner || '',
          dueDate: dayNum ? addDays(baseDate, dayNum) : '',
          status: 'Not Started',
          deliverable: a.deliverable || ''
        });
      });
    });

    if (plan.nextFiveSteps && plan.nextFiveSteps.length) {
      plan.nextFiveSteps.forEach(function(s) {
        var dayNum = parseDayNum(s.by);
        plan.actionTracker.push({
          id: 'at_' + Date.now() + '_' + (idx++),
          source: 'next5',
          action: s.action || '',
          owner: s.owner || '',
          dueDate: dayNum ? addDays(baseDate, dayNum) : '',
          status: 'Not Started',
          deliverable: s.outcome || ''
        });
      });
    }
    AP.AppStore.set('currentPlan', plan);
  }

  function renderActionTracker(plan) {
    initActionTracker(plan);
    var actions = plan.actionTracker || [];
    var today = new Date().toISOString().split('T')[0];

    var html = '<div id="panel-actions" class="plan-panel">';
    html += '<h3 class="section-title">Action Tracker</h3>';

    // Progress
    var total = actions.length;
    var done = actions.filter(function(a) { return a.status === 'Done'; }).length;
    var pct = total > 0 ? Math.round(done / total * 100) : 0;
    var barClass = pct >= 75 ? 'high' : (pct >= 25 ? 'mid' : '');

    html += '<div class="action-progress">';
    html += '<div class="action-progress-text">' + done + ' of ' + total + ' actions complete (' + pct + '%)</div>';
    html += '<div class="progress-bar-track"><div class="progress-bar-fill ' + barClass + '" style="width:' + pct + '%"></div></div>';
    html += '</div>';

    // Filters + Add button
    var owners = [];
    actions.forEach(function(a) { if (a.owner && owners.indexOf(a.owner) === -1) owners.push(a.owner); });

    html += '<div class="action-tracker-filters">';
    html += '<select id="action-filter-status" class="form-select"><option value="all">All Status</option><option value="Not Started">Not Started</option><option value="In Progress">In Progress</option><option value="Done">Done</option><option value="overdue">Overdue</option></select>';
    html += '<select id="action-filter-owner" class="form-select"><option value="all">All Owners</option>';
    owners.forEach(function(o) { html += '<option value="' + e(o) + '">' + e(o) + '</option>'; });
    html += '</select>';
    html += '<button class="btn btn-sm btn-primary" id="btn-add-action">+ Add Action</button>';
    html += '</div>';

    // Add action form (hidden)
    html += '<div class="action-add-form" id="action-add-form">';
    html += '<div class="form-group"><label class="form-label">Action</label><input type="text" id="new-action-text" class="form-input" placeholder="What needs to be done?"></div>';
    html += '<div style="display:flex;gap:12px;flex-wrap:wrap;">';
    html += '<div class="form-group" style="flex:1;min-width:150px;"><label class="form-label">Owner</label><input type="text" id="new-action-owner" class="form-input" placeholder="Who owns this?"></div>';
    html += '<div class="form-group" style="flex:1;min-width:150px;"><label class="form-label">Due Date</label><input type="date" id="new-action-date" class="form-input"></div>';
    html += '</div>';
    html += '<button class="btn btn-sm btn-primary" id="btn-save-new-action">Save Action</button>';
    html += '</div>';

    // Action table
    if (actions.length > 0) {
      html += '<table class="plan-table action-tracker-table">';
      html += '<thead><tr><th style="width:130px">Status</th><th>Action</th><th style="width:120px">Owner</th><th style="width:140px">Due Date</th><th style="width:70px">Source</th><th style="width:40px"></th></tr></thead>';
      html += '<tbody>';

      actions.forEach(function(a) {
        var overdue = a.dueDate && a.dueDate < today && a.status !== 'Done';
        var rowClass = 'action-tracker-row';
        if (overdue) rowClass += ' action-overdue';
        if (a.status === 'Done') rowClass += ' action-done';

        html += '<tr class="' + rowClass + '" data-action-id="' + a.id + '" data-status="' + e(a.status) + '" data-owner="' + e(a.owner) + '">';

        // Status select
        html += '<td><select class="action-status-select" data-action-id="' + a.id + '">';
        ['Not Started', 'In Progress', 'Done'].forEach(function(s) {
          html += '<option value="' + s + '"' + (a.status === s ? ' selected' : '') + '>' + s + '</option>';
        });
        html += '</select></td>';

        // Action text (editable)
        html += '<td class="action-text-cell" contenteditable="true" data-action-id="' + a.id + '">' + e(a.action) + '</td>';

        // Owner (editable)
        html += '<td class="action-owner-cell" contenteditable="true" data-action-id="' + a.id + '">' + e(a.owner) + '</td>';

        // Due date
        html += '<td><input type="date" class="action-due-input" data-action-id="' + a.id + '" value="' + (a.dueDate || '') + '"></td>';

        // Source badge
        var sourceLabels = { day30: '30', day60: '60', day90: '90', next5: 'N5', custom: '+' };
        var sourceClass = a.source === 'custom' ? 'source-custom' : 'source-plan';
        html += '<td><span class="action-source-badge ' + sourceClass + '">' + (sourceLabels[a.source] || a.source) + '</span></td>';

        // Delete (custom only)
        html += '<td>';
        if (a.source === 'custom') html += '<button class="btn-icon action-delete-btn" data-action-id="' + a.id + '" title="Delete">&times;</button>';
        html += '</td>';

        html += '</tr>';
      });

      html += '</tbody></table>';
    } else {
      html += '<p class="text-muted">No actions yet. Actions will be populated from the 30-60-90 plan when generated.</p>';
    }

    html += '</div>';
    return html;
  }

  // ===== MODULE 12: Meeting Notes =====
  function renderMeetingNotes(plan) {
    var notes = plan.meetingNotes || [];
    var html = '<div id="panel-meetingnotes" class="plan-panel">';
    html += '<h3 class="section-title">Meeting Notes</h3>';
    html += '<p class="text-muted mb-16">Record notes from meetings and calls. Notes are saved with the plan for future reference.</p>';

    // Add new note form
    html += '<div class="meeting-note-form">';
    html += '<div class="form-group"><label class="form-label" for="note-date-input">Date</label>';
    html += '<input type="date" id="note-date-input" class="form-input" value="' + new Date().toISOString().split('T')[0] + '" style="max-width:200px;"></div>';
    html += '<div class="form-group"><label class="form-label" for="note-title-input">Subject / Meeting Title</label>';
    html += '<input type="text" id="note-title-input" class="form-input" placeholder="e.g. Discovery call with VP Supply Chain"></div>';
    html += '<div class="form-group"><label class="form-label" for="note-text-input">Notes</label>';
    html += '<textarea id="note-text-input" class="form-textarea" rows="8" placeholder="Paste or type meeting notes here..."></textarea></div>';
    html += '<button class="btn btn-primary" id="btn-save-note">Save Note</button>';
    html += '</div>';

    // Existing notes
    if (notes.length > 0) {
      html += '<h4 class="subsection-label mt-32">Saved Notes (' + notes.length + ')</h4>';
      // Show newest first
      for (var i = notes.length - 1; i >= 0; i--) {
        var n = notes[i];
        html += '<div class="meeting-note-card" data-note-index="' + i + '">';
        html += '<div class="meeting-note-header">';
        html += '<div><span class="meeting-note-title">' + e(n.title || 'Untitled') + '</span>';
        html += '<span class="meeting-note-date">' + e(n.date || '') + '</span></div>';
        html += '<button class="btn btn-xs btn-secondary meeting-note-delete" data-note-index="' + i + '" style="color:var(--accent-red)">Delete</button>';
        html += '</div>';
        html += '<div class="meeting-note-body">' + e(n.text || '').replace(/\n/g, '<br>') + '</div>';
        html += '</div>';
      }
    }

    html += '</div>';
    return html;
  }

  // ===== Wire Action Buttons =====
  function wireActions(plan) {
    var saveBtn = document.getElementById('btn-save-plan');
    if (saveBtn) saveBtn.addEventListener('click', function() { AP.PlanPersistence.saveLocal(plan); AP.showToast('Plan saved'); });

    var copyBtn = document.getElementById('btn-copy-md');
    if (copyBtn) copyBtn.addEventListener('click', function() { var md = AP.PlanExport.toMarkdown(plan); AP.copyToClipboard(md); });

    var docxBtn = document.getElementById('btn-export-docx');
    if (docxBtn) docxBtn.addEventListener('click', function() { AP.PlanExport.toDocx(plan); });

    var jsonBtn = document.getElementById('btn-export-json');
    if (jsonBtn) jsonBtn.addEventListener('click', function() { AP.PlanPersistence.downloadJSON(plan); });

    // New Plan button
    var newBtn = document.getElementById('btn-new-plan');
    if (newBtn) newBtn.addEventListener('click', function() { AP.navigateTo('home'); });

    // Meeting Notes — save
    var saveNoteBtn = document.getElementById('btn-save-note');
    if (saveNoteBtn) {
      saveNoteBtn.addEventListener('click', function() {
        var dateEl = document.getElementById('note-date-input');
        var titleEl = document.getElementById('note-title-input');
        var textEl = document.getElementById('note-text-input');
        var text = textEl ? textEl.value.trim() : '';
        if (!text) { AP.showToast('Please enter some notes first.', 'error'); return; }

        if (!plan.meetingNotes) plan.meetingNotes = [];
        plan.meetingNotes.push({
          date: dateEl ? dateEl.value : new Date().toISOString().split('T')[0],
          title: titleEl ? titleEl.value.trim() : '',
          text: text,
          addedAt: new Date().toISOString()
        });

        AP.AppStore.set('currentPlan', plan);
        AP.showToast('Meeting note saved!');
        render(plan);
        // Stay on Meeting Notes tab
        var mnTab = document.querySelector('.plan-tab[data-tab="meetingnotes"]');
        if (mnTab) mnTab.click();
      });
    }

    // Meeting Notes — delete
    document.querySelectorAll('.meeting-note-delete').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.dataset.noteIndex, 10);
        if (plan.meetingNotes && plan.meetingNotes[idx] !== undefined) {
          plan.meetingNotes.splice(idx, 1);
          AP.AppStore.set('currentPlan', plan);
          AP.showToast('Note deleted');
          render(plan);
          var mnTab = document.querySelector('.plan-tab[data-tab="meetingnotes"]');
          if (mnTab) mnTab.click();
        }
      });
    });

    // ===== Action Tracker Wiring =====
    function findAction(id) {
      if (!plan.actionTracker) return null;
      for (var i = 0; i < plan.actionTracker.length; i++) {
        if (plan.actionTracker[i].id === id) return plan.actionTracker[i];
      }
      return null;
    }

    function reRenderActions() {
      AP.AppStore.set('currentPlan', plan);
      render(plan);
      var tab = document.querySelector('.plan-tab[data-tab="actions"]');
      if (tab) tab.click();
    }

    // Status change
    document.querySelectorAll('.action-status-select').forEach(function(sel) {
      sel.addEventListener('change', function() {
        var a = findAction(sel.dataset.actionId);
        if (a) { a.status = sel.value; reRenderActions(); }
      });
    });

    // Inline edit — action text
    document.querySelectorAll('.action-text-cell').forEach(function(cell) {
      cell.addEventListener('blur', function() {
        var a = findAction(cell.dataset.actionId);
        if (a) { a.action = cell.textContent.trim(); AP.AppStore.set('currentPlan', plan); }
      });
    });

    // Inline edit — owner
    document.querySelectorAll('.action-owner-cell').forEach(function(cell) {
      cell.addEventListener('blur', function() {
        var a = findAction(cell.dataset.actionId);
        if (a) { a.owner = cell.textContent.trim(); AP.AppStore.set('currentPlan', plan); }
      });
    });

    // Due date change
    document.querySelectorAll('.action-due-input').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var a = findAction(inp.dataset.actionId);
        if (a) { a.dueDate = inp.value; reRenderActions(); }
      });
    });

    // Filters
    var filterStatus = document.getElementById('action-filter-status');
    var filterOwner = document.getElementById('action-filter-owner');
    function applyFilters() {
      var sv = filterStatus ? filterStatus.value : 'all';
      var ov = filterOwner ? filterOwner.value : 'all';
      var today = new Date().toISOString().split('T')[0];
      document.querySelectorAll('.action-tracker-row').forEach(function(row) {
        var status = row.dataset.status;
        var owner = row.dataset.owner;
        var dueDate = row.querySelector('.action-due-input');
        var isOverdue = dueDate && dueDate.value && dueDate.value < today && status !== 'Done';
        var showStatus = sv === 'all' || sv === status || (sv === 'overdue' && isOverdue);
        var showOwner = ov === 'all' || ov === owner;
        row.style.display = (showStatus && showOwner) ? '' : 'none';
      });
    }
    if (filterStatus) filterStatus.addEventListener('change', applyFilters);
    if (filterOwner) filterOwner.addEventListener('change', applyFilters);

    // Add action toggle
    var addBtn = document.getElementById('btn-add-action');
    var addForm = document.getElementById('action-add-form');
    if (addBtn && addForm) {
      addBtn.addEventListener('click', function() {
        addForm.classList.toggle('visible');
      });
    }

    // Save new action
    var saveNewBtn = document.getElementById('btn-save-new-action');
    if (saveNewBtn) {
      saveNewBtn.addEventListener('click', function() {
        var text = document.getElementById('new-action-text');
        var owner = document.getElementById('new-action-owner');
        var date = document.getElementById('new-action-date');
        if (!text || !text.value.trim()) { AP.showToast('Please enter an action', 'error'); return; }
        if (!plan.actionTracker) plan.actionTracker = [];
        plan.actionTracker.push({
          id: 'at_' + Date.now() + '_custom',
          source: 'custom',
          action: text.value.trim(),
          owner: owner ? owner.value.trim() : '',
          dueDate: date ? date.value : '',
          status: 'Not Started',
          deliverable: ''
        });
        AP.showToast('Action added');
        reRenderActions();
      });
    }

    // Delete custom action
    document.querySelectorAll('.action-delete-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.dataset.actionId;
        if (plan.actionTracker) {
          plan.actionTracker = plan.actionTracker.filter(function(a) { return a.id !== id; });
          AP.showToast('Action removed');
          reRenderActions();
        }
      });
    });
  }

  return { render: render };
})();
