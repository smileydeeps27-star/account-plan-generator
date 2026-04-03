/* ===== Account Plan Generator — API Client ===== */

AP.ApiClient = (function() {

  async function call(systemPrompt, userMessage, options) {
    options = options || {};
    var payload = {
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      max_tokens: options.maxTokens || 8192,
      temperature: options.temperature || 0.7,
      useGrounding: options.useGrounding || false,
      jsonMode: options.jsonMode || false
    };

    var resp = await fetch(AP.Config.AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    var data = await resp.json();
    if (!resp.ok || data.error) {
      throw new Error(data.error || 'AI request failed (' + resp.status + ')');
    }

    return { text: data.text || '', sources: data.sources || [] };
  }

  async function checkKeyStatus() {
    try {
      var resp = await fetch('/api/key-status');
      return await resp.json();
    } catch (e) {
      return { gemini: false };
    }
  }

  return { call: call, checkKeyStatus: checkKeyStatus };
})();
