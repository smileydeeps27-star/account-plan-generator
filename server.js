const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load .env file if present
try {
  const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  envFile.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#') && line.includes('=')) {
      const [key, ...rest] = line.split('=');
      if (!process.env[key.trim()]) process.env[key.trim()] = rest.join('=').trim();
    }
  });
} catch (e) { /* no .env file */ }

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/* --- Gemini API call with retry --- */
async function callGemini(payload, attempt) {
  attempt = attempt || 1;
  const maxAttempts = 3;

  return new Promise((resolve, reject) => {
    const payloadStr = JSON.stringify(payload);
    const model = 'gemini-2.5-flash';
    const apiPath = `/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: apiPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadStr)
      }
    };

    const apiReq = https.request(options, (apiRes) => {
      let responseData = '';
      apiRes.on('data', chunk => { responseData += chunk; });
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (apiRes.statusCode === 429 || apiRes.statusCode >= 500) {
            if (attempt < maxAttempts) {
              const delay = Math.pow(2, attempt) * 1000;
              console.log(`Gemini ${apiRes.statusCode}, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
              setTimeout(() => {
                callGemini(payload, attempt + 1).then(resolve).catch(reject);
              }, delay);
              return;
            }
          }
          resolve({ statusCode: apiRes.statusCode, body: parsed });
        } catch (e) {
          reject(new Error('Failed to parse Gemini response'));
        }
      });
    });

    apiReq.setTimeout(120000, () => {
      apiReq.destroy(new Error('Gemini request timed out after 120s'));
    });

    apiReq.on('error', (err) => {
      if (attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[Gemini] Error: ${err.message}, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
        setTimeout(() => {
          callGemini(payload, attempt + 1).then(resolve).catch(reject);
        }, delay);
      } else {
        reject(err);
      }
    });

    apiReq.write(payloadStr);
    apiReq.end();
  });
}

/* --- POST /api/ai — Gemini proxy with optional grounding --- */
async function handleGeminiProxy(req, res) {
  if (!GEMINI_API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'GEMINI_API_KEY not configured on server' }));
    return;
  }

  try {
    const body = await readBody(req);
    const parsed = JSON.parse(body);

    const systemPrompt = parsed.system || '';
    const userMessage = (parsed.messages && parsed.messages[0] && parsed.messages[0].content) || '';
    const useGrounding = parsed.useGrounding || false;
    const jsonMode = parsed.jsonMode || false;

    const geminiPayload = {
      contents: [
        { role: 'user', parts: [{ text: useGrounding ? (systemPrompt + '\n\n' + userMessage) : userMessage }] }
      ],
      generationConfig: {
        maxOutputTokens: parsed.max_tokens || 8192,
        temperature: parsed.temperature || 0.7
      }
    };

    // Only use systemInstruction for non-grounding calls
    // (gemini-2.5-flash can return empty content when systemInstruction + tools are combined)
    if (!useGrounding) {
      geminiPayload.systemInstruction = {
        parts: [{ text: systemPrompt }]
      };
    }

    // Enable Google Search grounding
    if (useGrounding) {
      geminiPayload.tools = [{ googleSearch: {} }];
    }

    // Enable JSON response mode
    if (jsonMode && !useGrounding) {
      geminiPayload.generationConfig.responseMimeType = 'application/json';
    }

    console.log('[Gemini] Request: system_len=' + systemPrompt.length + ' user_len=' + userMessage.length + ' grounding=' + useGrounding + ' jsonMode=' + jsonMode);

    const result = await callGemini(geminiPayload);

    if (result.statusCode !== 200) {
      const errMsg = (result.body.error && result.body.error.message) || 'Gemini API error (' + result.statusCode + ')';
      res.writeHead(result.statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: errMsg }));
      return;
    }

    // Extract text
    let text = '';
    const candidate = result.body.candidates && result.body.candidates[0];
    if (candidate && candidate.content && candidate.content.parts) {
      text = candidate.content.parts.map(p => p.text || '').join('');
    }

    // Debug: log when text is empty
    if (!text) {
      console.log('[Gemini] Empty text response. Full candidate:', JSON.stringify(candidate || {}).substring(0, 2000));
      const usage = result.body.usageMetadata || {};
      console.log('[Gemini] Usage: prompt=' + (usage.promptTokenCount || 0) + ' output=' + (usage.candidatesTokenCount || 0) + ' thinking=' + (usage.thoughtsTokenCount || 0));
      if (result.body.promptFeedback) console.log('[Gemini] promptFeedback:', JSON.stringify(result.body.promptFeedback));
    } else {
      console.log('[Gemini] Response OK, text length:', text.length, 'grounding:', useGrounding);
    }

    // Extract grounding sources if available
    let sources = [];
    if (candidate && candidate.groundingMetadata && candidate.groundingMetadata.groundingChunks) {
      sources = candidate.groundingMetadata.groundingChunks
        .filter(c => c.web)
        .map(c => ({ title: c.web.title || '', url: c.web.uri || '' }));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ text, sources }));
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Gemini request failed: ' + err.message }));
  }
}

/* --- GET /api/key-status --- */
function handleKeyStatus(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ gemini: !!GEMINI_API_KEY }));
}

/* --- Server --- */
const server = http.createServer(async (req, res) => {
  // API routes
  if (req.method === 'POST' && req.url === '/api/ai') {
    return handleGeminiProxy(req, res);
  }
  if (req.method === 'GET' && req.url === '/api/key-status') {
    return handleKeyStatus(req, res);
  }

  // Static files
  let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  filePath = decodeURIComponent(filePath);
  filePath = path.join(__dirname, filePath);

  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(__dirname, 'index.html'), (e, c) => {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(c);
        });
      } else {
        res.writeHead(500);
        res.end('Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache, must-revalidate' });
      res.end(content);
    }
  });
});

// Increase timeouts for long-running Gemini grounding calls
server.timeout = 300000;         // 5 minutes — total request lifecycle
server.keepAliveTimeout = 300000;
server.headersTimeout = 310000;

server.listen(PORT, () => {
  console.log(`Account Plan Generator running on http://localhost:${PORT}`);
  console.log(`Gemini API key: ${GEMINI_API_KEY ? 'configured' : 'NOT configured (set GEMINI_API_KEY env var)'}`);
});
