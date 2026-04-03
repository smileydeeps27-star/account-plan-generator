/* ===== Account Plan Generator — Seller Profile ===== */

AP.SellerProfile = (function() {

  var profile = null;
  var defaults = null;

  async function load() {
    // Try localStorage first
    var saved = localStorage.getItem(AP.Config.LS_KEY_SELLER);
    if (saved) {
      try {
        profile = JSON.parse(saved);
        AP.AppStore.set('sellerProfile', profile);
        return profile;
      } catch (e) { /* fall through */ }
    }

    // Load defaults from server
    try {
      var resp = await fetch('/data/default-seller.json');
      defaults = await resp.json();
      profile = JSON.parse(JSON.stringify(defaults));
      AP.AppStore.set('sellerProfile', profile);
      return profile;
    } catch (e) {
      console.error('Failed to load default seller profile:', e);
      profile = { companyName: 'Your Company', tagline: '', description: '', capabilities: [], keyDifferentiators: [], competitors: [], valueMetrics: [], idealCustomerProfile: '' };
      AP.AppStore.set('sellerProfile', profile);
      return profile;
    }
  }

  function save(p) {
    profile = p;
    localStorage.setItem(AP.Config.LS_KEY_SELLER, JSON.stringify(p));
    AP.AppStore.set('sellerProfile', p);
  }

  function get() {
    return profile;
  }

  async function reset() {
    localStorage.removeItem(AP.Config.LS_KEY_SELLER);
    if (!defaults) {
      try {
        var resp = await fetch('/data/default-seller.json');
        defaults = await resp.json();
      } catch (e) { return; }
    }
    profile = JSON.parse(JSON.stringify(defaults));
    AP.AppStore.set('sellerProfile', profile);
  }

  function getContextString() {
    var sp = profile;
    if (!sp) return '';

    var capText = (sp.capabilities || []).map(function(c) {
      return c.domain + ': ' + c.skills.join(', ');
    }).join('\n  ');

    var compText = (sp.competitors || []).map(function(c) {
      return c.name + ' — ' + c.weakness;
    }).join('\n  ');

    return '\n--- SELLER CONTEXT (Who We Are) ---\n' +
      'Company: ' + sp.companyName + ' — ' + sp.tagline + '\n' +
      'Description: ' + sp.description + '\n' +
      'Capabilities:\n  ' + capText + '\n' +
      'Key Differentiators:\n  - ' + (sp.keyDifferentiators || []).join('\n  - ') + '\n' +
      'Competitors:\n  ' + compText + '\n' +
      'Value Metrics: ' + (sp.valueMetrics || []).join('; ') + '\n' +
      'ICP: ' + sp.idealCustomerProfile + '\n' +
      '---\n';
  }

  return { load: load, save: save, get: get, reset: reset, getContextString: getContextString };
})();
