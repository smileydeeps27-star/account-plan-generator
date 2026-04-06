/* ===== Account Plan Generator — App Bootstrap ===== */

document.addEventListener('DOMContentLoaded', function() {
  AP.SellerProfile.load();
  AP.Methodology.load();
  initHomeScreen();
  initGeneratingScreen();
  initPlanScreen();
  initSettingsScreen();
  checkApiKeys();
});

/* --- Home Screen --- */
function initHomeScreen() {
  var form = document.getElementById('plan-form');
  var btnGenerate = document.getElementById('btn-generate');

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var company = document.getElementById('input-company').value.trim();
    if (!company) return;

    var industry = document.getElementById('input-industry').value;
    var revenue = document.getElementById('input-revenue').value;

    var userInputs = {
      dealStage: document.getElementById('input-deal-stage').value,
      accountContext: document.getElementById('input-context').value.trim(),
      suspectedCompetitors: document.getElementById('input-competitors').value.trim(),
      goalsNext90Days: document.getElementById('input-goals').value.trim(),
      knownRisks: document.getElementById('input-risks').value.trim()
    };

    AP.AppStore.set('isGenerating', true);
    AP.navigateTo('generating');

    AP.PlanGenerator.generate(company, industry, revenue, userInputs).then(function(plan) {
      AP.AppStore.set('currentPlan', plan);
      AP.AppStore.set('isGenerating', false);
      AP.navigateTo('plan');
      AP.PlanRenderer.render(plan);
    }).catch(function(err) {
      AP.AppStore.set('isGenerating', false);
      AP.navigateTo('home');
      AP.showToast('Generation failed: ' + err.message, 'error');
      console.error('Plan generation error:', err);
    });
  });

  // Load saved plans list
  refreshSavedPlansList();
}

function refreshSavedPlansList() {
  var container = document.getElementById('saved-plans-list');
  if (!container) return;

  var plans = AP.PlanPersistence.listLocal();
  if (plans.length === 0) {
    container.innerHTML = '<p class="text-muted" style="font-size:13px; padding:8px 0;">No saved plans yet. Generate your first account plan above.</p>';
    return;
  }

  var html = '';
  plans.forEach(function(p) {
    html += '<div class="saved-plan-item" data-key="' + AP.escapeHTML(p.key) + '">' +
      '<div><div class="saved-plan-name">' + AP.escapeHTML(p.companyName) + '</div>' +
      '<div class="saved-plan-date">' + AP.formatDate(p.generatedAt) + '</div></div>' +
      '<div class="saved-plan-actions">' +
      '<button class="btn btn-xs btn-secondary load-plan-btn">Open</button>' +
      '<button class="btn btn-xs btn-secondary delete-plan-btn" style="color:var(--accent-red)">Delete</button>' +
      '</div></div>';
  });
  container.innerHTML = html;

  // Wire load buttons
  container.querySelectorAll('.load-plan-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var key = btn.closest('.saved-plan-item').dataset.key;
      var plan = AP.PlanPersistence.loadLocal(key);
      if (plan) {
        AP.AppStore.set('currentPlan', plan);
        AP.navigateTo('plan');
        AP.PlanRenderer.render(plan);
      }
    });
  });

  // Wire delete buttons
  container.querySelectorAll('.delete-plan-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var key = btn.closest('.saved-plan-item').dataset.key;
      AP.PlanPersistence.deleteLocal(key);
      refreshSavedPlansList();
      AP.showToast('Plan deleted');
    });
  });
}

/* --- Generating Screen --- */
function initGeneratingScreen() {
  AP.EventBus.on('plan:progress', function(data) {
    var fill = document.querySelector('.progress-fill');
    var phase = document.getElementById('generating-phase');
    var step = document.getElementById('generating-step');

    if (fill) fill.style.width = ((data.current / data.total) * 100) + '%';
    if (phase) phase.textContent = data.phase || 'Generating...';
    if (step) step.textContent = 'Step ' + data.current + ' of ' + data.total;
  });
}

/* --- Plan Screen --- */
function initPlanScreen() {
  // Back to home
  document.addEventListener('click', function(e) {
    if (e.target.id === 'btn-new-plan' || e.target.closest('#btn-new-plan')) {
      document.getElementById('input-company').value = '';
      AP.navigateTo('home');
    }
  });

  // Meeting notes modal
  var modal = document.getElementById('meeting-notes-modal');
  var notesInput = document.getElementById('meeting-notes-input');

  function openNotesModal() {
    if (modal) modal.classList.remove('hidden');
  }

  function closeNotesModal() {
    if (modal) modal.classList.add('hidden');
    if (notesInput) notesInput.value = '';
  }

  // Open modal when "Update from Meeting" button is clicked
  document.addEventListener('click', function(e) {
    if (e.target.id === 'btn-meeting-notes' || e.target.closest('#btn-meeting-notes')) {
      openNotesModal();
    }
  });

  // Close modal
  var btnClose = document.getElementById('btn-close-notes');
  var btnCancel = document.getElementById('btn-cancel-notes');
  if (btnClose) btnClose.addEventListener('click', closeNotesModal);
  if (btnCancel) btnCancel.addEventListener('click', closeNotesModal);

  // Close modal on backdrop click
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) closeNotesModal();
    });
  }

  // Refresh plan from meeting notes
  var btnRefresh = document.getElementById('btn-refresh-plan');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', function() {
      var notes = notesInput ? notesInput.value.trim() : '';
      if (!notes) {
        AP.showToast('Please enter meeting notes first.', 'error');
        return;
      }

      var plan = AP.AppStore.get('currentPlan');
      if (!plan) {
        AP.showToast('No plan loaded to refresh.', 'error');
        return;
      }

      btnRefresh.disabled = true;
      btnRefresh.textContent = 'Refreshing...';

      AP.PlanRefresh.refreshFromNotes(plan, notes).then(function(updatedPlan) {
        AP.AppStore.set('currentPlan', updatedPlan);
        AP.PlanRenderer.render(updatedPlan);
        closeNotesModal();
        AP.showToast('Plan updated from meeting notes!');
      }).catch(function(err) {
        AP.showToast('Refresh failed: ' + err.message, 'error');
        console.error('Plan refresh error:', err);
      }).finally(function() {
        btnRefresh.disabled = false;
        btnRefresh.innerHTML = '&#128260; Refresh Plan';
      });
    });
  }
}

/* --- Settings Screen --- */
function initSettingsScreen() {
  var settingsBtn = document.getElementById('btn-settings');
  var backBtn = document.getElementById('btn-settings-back');

  if (settingsBtn) {
    settingsBtn.addEventListener('click', function() {
      populateSettingsForm();
      AP.navigateTo('settings');
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', function() {
      AP.navigateTo('home');
    });
  }

  // Save settings
  var saveBtn = document.getElementById('btn-save-settings');
  if (saveBtn) {
    saveBtn.addEventListener('click', function() {
      saveSettingsForm();
      AP.showToast('Settings saved');
      AP.navigateTo('home');
    });
  }

  // Reset to defaults
  var resetBtn = document.getElementById('btn-reset-settings');
  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      AP.SellerProfile.reset();
      populateSettingsForm();
      AP.showToast('Reset to defaults');
    });
  }
}

function populateSettingsForm() {
  var sp = AP.SellerProfile.get();
  if (!sp) return;

  var field = function(id, val) {
    var el = document.getElementById(id);
    if (el) el.value = val || '';
  };

  field('setting-company', sp.companyName);
  field('setting-tagline', sp.tagline);
  field('setting-description', sp.description);
  field('setting-icp', sp.idealCustomerProfile);
  field('setting-differentiators', (sp.keyDifferentiators || []).join('\n'));
  field('setting-value-metrics', (sp.valueMetrics || []).join('\n'));

  var capText = (sp.capabilities || []).map(function(c) {
    return c.domain + ': ' + c.skills.join(', ');
  }).join('\n');
  field('setting-capabilities', capText);

  var compText = (sp.competitors || []).map(function(c) {
    return c.name + ' | ' + c.weakness;
  }).join('\n');
  field('setting-competitors', compText);
}

function saveSettingsForm() {
  var val = function(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  var capLines = val('setting-capabilities').split('\n').filter(Boolean);
  var capabilities = capLines.map(function(line) {
    var parts = line.split(':');
    var domain = (parts[0] || '').trim();
    var skills = (parts[1] || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    return { domain: domain, skills: skills };
  });

  var compLines = val('setting-competitors').split('\n').filter(Boolean);
  var competitors = compLines.map(function(line) {
    var parts = line.split('|');
    return { name: (parts[0] || '').trim(), weakness: (parts[1] || '').trim() };
  });

  var profile = {
    companyName: val('setting-company'),
    tagline: val('setting-tagline'),
    description: val('setting-description'),
    idealCustomerProfile: val('setting-icp'),
    keyDifferentiators: val('setting-differentiators').split('\n').filter(Boolean),
    valueMetrics: val('setting-value-metrics').split('\n').filter(Boolean),
    capabilities: capabilities,
    competitors: competitors
  };

  AP.SellerProfile.save(profile);
}

/* --- API Key Check --- */
function checkApiKeys() {
  AP.ApiClient.checkKeyStatus().then(function(status) {
    var banner = document.getElementById('key-banner');
    if (!banner) return;

    if (status.gemini) {
      banner.className = 'key-banner configured';
      banner.innerHTML = '&#10003; Gemini API key configured — ready to generate plans';
    } else {
      banner.className = 'key-banner';
      banner.innerHTML = '&#9888; Gemini API key not configured. Set GEMINI_API_KEY environment variable and restart the server.';
    }
  });
}
