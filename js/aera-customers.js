/* ===== Account Plan Generator — Aera Customer Registry =====
 * Shared list of named Aera customers for cross-referencing throughout
 * the plan. When a competitor, news mention, or peer reference matches a
 * customer, the app can badge it so the CP knows a warm reference exists.
 *
 * Keep this list in sync with the actual Aera customer roster.
 * TODO: move to data/aera-content.json if it needs UI-editable admin.
 */

AP.AeraCustomers = (function() {

  // Canonical customer list (26). Order preserved from original spec.
  var CUSTOMERS = [
    { name: 'KraftHeinz', aliases: ['Kraft Heinz', 'Kraft-Heinz', 'The Kraft Heinz Company'] },
    { name: 'Unilever', aliases: ['Unilever plc', 'Unilever PLC'] },
    { name: 'Dell Technologies', aliases: ['Dell', 'Dell Inc'] },
    { name: 'GSK', aliases: ['GlaxoSmithKline'] },
    { name: 'Estee Lauder', aliases: ['Estée Lauder', 'The Estée Lauder Companies', 'ELC'] },
    { name: 'Rio Tinto', aliases: ['Rio Tinto Group', 'Rio Tinto plc'] },
    { name: 'Kerry Foods', aliases: ['Kerry Group'] },
    { name: 'Viva Energy', aliases: ['Viva Energy Group', 'Viva Energy Australia'] },
    { name: 'Viatris', aliases: [] },
    { name: 'Gallo', aliases: ['E&J Gallo Winery', 'E. & J. Gallo Winery'] },
    { name: 'Lipton', aliases: ['Lipton Teas and Infusions'] },
    { name: 'Bristol Myers Squibb', aliases: ['BMS', 'Bristol-Myers Squibb'] },
    { name: 'Diageo', aliases: ['Diageo plc'] },
    { name: 'Alcon', aliases: ['Alcon Inc'] },
    { name: 'WGU University', aliases: ['Western Governors University', 'WGU'] },
    { name: 'Mars', aliases: ['Mars Inc', 'Mars Incorporated', 'Mars, Incorporated'] },
    { name: 'Irving', aliases: ['J.D. Irving', 'JD Irving', 'Irving Oil'] },
    { name: 'ExxonMobil', aliases: ['Exxon Mobil', 'Exxon', 'Mobil'] },
    { name: 'Philip Morris International', aliases: ['PMI', 'Philip Morris'] },
    { name: 'BP Castrol', aliases: ['Castrol', 'BP'] },
    { name: 'Hershey', aliases: ['The Hershey Company', 'Hershey Co'] },
    { name: 'Diacero', aliases: [] },
    { name: 'Merck', aliases: ['Merck & Co', 'Merck & Co.', 'Merck KGaA'] },
    { name: 'AstraZeneca', aliases: ['AstraZeneca plc', 'AZN'] },
    { name: 'BAT', aliases: ['British American Tobacco'] },
    { name: 'Mitsubishi Chemical Group', aliases: ['Mitsubishi Chemical', 'MCG'] }
  ];

  // Comma-separated string form used by AI prompts.
  var listString = CUSTOMERS.map(function(c) { return c.name; }).join(', ');

  // Normalise for matching — lowercase, strip punctuation and whitespace.
  function normalise(str) {
    return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // Build a lookup of normalised name → canonical entry for fast match.
  var normLookup = {};
  CUSTOMERS.forEach(function(c) {
    normLookup[normalise(c.name)] = c;
    c.aliases.forEach(function(a) { normLookup[normalise(a)] = c; });
  });

  // Is this string an Aera customer? Matches canonical name or any alias.
  function isCustomer(companyName) {
    if (!companyName) return false;
    var norm = normalise(companyName);
    if (normLookup[norm]) return true;
    // Fuzzy contains-check as fallback: does the input contain a customer name (or vice-versa)?
    // Only for names ≥6 chars to avoid false positives on short names like "Mars", "BAT".
    for (var i = 0; i < CUSTOMERS.length; i++) {
      var canonNorm = normalise(CUSTOMERS[i].name);
      if (canonNorm.length >= 6 && (norm.indexOf(canonNorm) >= 0 || canonNorm.indexOf(norm) >= 0)) return true;
    }
    return false;
  }

  // Return the canonical customer entry matched, or null.
  function matchCustomer(companyName) {
    if (!companyName) return null;
    var norm = normalise(companyName);
    if (normLookup[norm]) return normLookup[norm];
    for (var i = 0; i < CUSTOMERS.length; i++) {
      var canonNorm = normalise(CUSTOMERS[i].name);
      if (canonNorm.length >= 6 && (norm.indexOf(canonNorm) >= 0 || canonNorm.indexOf(norm) >= 0)) return CUSTOMERS[i];
    }
    return null;
  }

  // Scan a text string and return the canonical customer names mentioned.
  // Uses word-boundary matching against the canonical + alias names (5+ chars only,
  // to avoid false positives on short generic terms).
  function findMentions(text) {
    if (!text) return [];
    var mentions = {};
    var raw = String(text);
    CUSTOMERS.forEach(function(c) {
      var candidates = [c.name].concat(c.aliases);
      candidates.forEach(function(cand) {
        if (cand.length < 5) return;
        // Case-insensitive word-boundary match. Escape regex specials.
        var escaped = cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var re = new RegExp('\\b' + escaped + '\\b', 'i');
        if (re.test(raw)) mentions[c.name] = c;
      });
    });
    return Object.values(mentions);
  }

  return {
    list: CUSTOMERS,
    listString: listString,
    isCustomer: isCustomer,
    matchCustomer: matchCustomer,
    findMentions: findMentions
  };
})();
