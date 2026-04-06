/* ===== Account Plan Generator — Aera Way Methodology ===== */

AP.Methodology = (function() {

  var methodology = null;

  async function load() {
    try {
      var resp = await fetch('/data/aera-way-methodology.json');
      methodology = await resp.json();
      AP.AppStore.set('methodology', methodology);
      return methodology;
    } catch (e) {
      console.error('Failed to load Aera Way methodology:', e);
      methodology = null;
      return null;
    }
  }

  function get() {
    return methodology;
  }

  function getContextString() {
    var m = methodology;
    if (!m || !m.salesMethodology) return '';

    var sm = m.salesMethodology;

    // Deal stages summary
    var stagesText = (sm.dealStages || []).map(function(s) {
      return s.stage + ': ' + s.description +
        '\n    Exit Criteria: ' + s.exitCriteria +
        '\n    Key Activities: ' + s.keyActivities.join('; ');
    }).join('\n  ');

    // WGLL summary
    var wgllText = '';
    if (sm.whatGoodLooksLike) {
      var wgll = sm.whatGoodLooksLike;
      wgllText = 'Day 30 — ' + wgll.day30.focus + ': ' + wgll.day30.outcomes.join('; ') +
        '\n  Day 60 — ' + wgll.day60.focus + ': ' + wgll.day60.outcomes.join('; ') +
        '\n  Day 90 — ' + wgll.day90.focus + ': ' + wgll.day90.outcomes.join('; ');
    }

    // Engagement principles
    var principlesText = (sm.engagementPrinciples || []).map(function(p) {
      return '- ' + p;
    }).join('\n  ');

    // Key milestones
    var milestonesText = (sm.keyMilestones || []).map(function(ms) {
      return ms.milestone + ' (' + ms.typical_timing + '): ' + ms.validation;
    }).join('\n  ');

    // Risk framework summary
    var riskText = '';
    if (m.riskFramework && m.riskFramework.categories) {
      riskText = m.riskFramework.categories.map(function(cat) {
        var risksStr = cat.risks.map(function(r) {
          return r.risk + ' [' + r.severity + ']: ' + r.aeraMitigation;
        }).join('\n    ');
        return cat.category + ':\n    ' + risksStr;
      }).join('\n  ');
    }

    // Objection handling summary
    var objectionsText = '';
    if (m.objectionHandling) {
      objectionsText = m.objectionHandling.map(function(o) {
        return '"' + o.objection + '" → ' + o.response;
      }).join('\n  ');
    }

    // Competitive positioning summary
    var compText = '';
    if (m.competitivePositioning) {
      var cp = m.competitivePositioning;
      compText = 'vs Point Solutions: ' + cp.vsPointSolutions +
        '\n  vs Big Consulting: ' + cp.vsBigConsulting +
        '\n  vs Build Your Own: ' + cp.vsBuildYourOwn +
        '\n  vs ERP Vendor AI: ' + (cp.vsERPVendorAI || '') +
        '\n  Key Differentiators: ' + (cp.keyDifferentiators || []).join('; ');
    }

    return '\n--- SALES METHODOLOGY (The Aera Way) ---\n' +
      'Philosophy: ' + sm.philosophy + '\n' +
      'Deal Stages:\n  ' + stagesText + '\n' +
      'What Good Looks Like:\n  ' + wgllText + '\n' +
      'Engagement Principles:\n  ' + principlesText + '\n' +
      'Key Milestones:\n  ' + milestonesText + '\n' +
      'Risk Framework:\n  ' + riskText + '\n' +
      'Objection Handling:\n  ' + objectionsText + '\n' +
      'Competitive Positioning:\n  ' + compText + '\n' +
      '---\n';
  }

  return { load: load, get: get, getContextString: getContextString };
})();
