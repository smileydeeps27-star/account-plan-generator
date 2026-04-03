/* ===== Account Plan Generator — Inline Editor ===== */

AP.PlanEditor = (function() {

  var active = false;

  function enable(plan) {
    active = true;
    // Make text fields editable
    var editableSelectors = [
      '.overview-field-value',
      '.priority-section-text',
      '.competitive-positioning',
      '.exec-pitch',
      '.news-item-headline',
      '.news-item-detail'
    ];

    editableSelectors.forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(el) {
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('spellcheck', 'false');
      });
    });
  }

  function disable() {
    active = false;
    document.querySelectorAll('[contenteditable="true"]').forEach(function(el) {
      el.removeAttribute('contenteditable');
    });
  }

  function isActive() {
    return active;
  }

  return { enable: enable, disable: disable, isActive: isActive };
})();
