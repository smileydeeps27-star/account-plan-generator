/* ===== Account Plan Generator — Utilities ===== */

var AP = AP || {};

AP.Config = {
  APP_NAME: 'Account Plan Generator',
  LS_KEY_SELLER: 'ap_seller_profile',
  LS_KEY_PLANS: 'ap_saved_plans',
  AI_ENDPOINT: '/api/ai'
};

/* --- EventBus --- */
AP.EventBus = (function() {
  var listeners = {};

  function on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
  }

  function off(event, fn) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(function(f) { return f !== fn; });
  }

  function emit(event, data) {
    if (!listeners[event]) return;
    listeners[event].forEach(function(fn) { fn(data); });
  }

  return { on: on, off: off, emit: emit };
})();

/* --- AppStore --- */
AP.AppStore = (function() {
  var state = {
    currentScreen: 'home',
    currentPlan: null,
    isGenerating: false,
    sellerProfile: null
  };

  function get(key) { return state[key]; }

  function set(key, value) {
    state[key] = value;
    AP.EventBus.emit('store:' + key, value);
  }

  return { get: get, set: set };
})();

/* --- Navigation --- */
AP.navigateTo = function(screenId) {
  var screens = document.querySelectorAll('.screen');
  screens.forEach(function(s) { s.classList.remove('active'); });

  var target = document.getElementById('screen-' + screenId);
  if (target) target.classList.add('active');

  AP.AppStore.set('currentScreen', screenId);
  window.scrollTo(0, 0);
};

/* --- Helpers --- */
AP.escapeHTML = function(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

AP.formatCurrency = function(num) {
  if (num >= 1000000000) return '$' + (num / 1000000000).toFixed(1) + 'B';
  if (num >= 1000000) return '$' + (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return '$' + (num / 1000).toFixed(0) + 'K';
  return '$' + num;
};

AP.showToast = function(message, type) {
  type = type || 'success';
  var container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = '0.3s ease';
    setTimeout(function() { toast.remove(); }, 300);
  }, 3000);
};

AP.copyToClipboard = function(text) {
  navigator.clipboard.writeText(text).then(function() {
    AP.showToast('Copied to clipboard');
  }).catch(function() {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    AP.showToast('Copied to clipboard');
  });
};

AP.slugify = function(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};

AP.formatDate = function(isoStr) {
  var d = new Date(isoStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
