const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

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

/* --- POST /api/save-docx — Save Word doc directly to output folder --- */
async function handleSaveDocx(req, res) {
  try {
    // Read binary body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);

    // Extract metadata from headers
    const companyName = decodeURIComponent(req.headers['x-company-name'] || 'Unknown');
    const cpName = decodeURIComponent(req.headers['x-cp-name'] || '');
    const accountType = decodeURIComponent(req.headers['x-account-type'] || '');

    // Determine save path
    const outputBase = path.join(__dirname, 'output', 'FY27 Account Plans');
    let saveDir = outputBase;

    if (cpName) {
      saveDir = path.join(outputBase, cpName);
      if (accountType) {
        const typeFolder = accountType.toLowerCase().includes('key') ? '1. Key Accounts' :
                          accountType.toLowerCase().includes('target') ? '2. Target Accounts' : '3. Other Accounts';
        saveDir = path.join(saveDir, typeFolder);
      }
    }

    // Ensure directory exists
    fs.mkdirSync(saveDir, { recursive: true });

    const fileName = companyName.replace(/[\/\\:*?"<>|]/g, '-') + ' - Account Plan.docx';
    const filePath = path.join(saveDir, fileName);

    fs.writeFileSync(filePath, body);
    const relativePath = path.relative(outputBase, filePath);

    console.log(`[Save] ${fileName} → ${relativePath}`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, path: relativePath, fullPath: filePath }));
  } catch (err) {
    console.error('[Save] Error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to save: ' + err.message }));
  }
}

/* --- GET /api/key-status --- */
function handleKeyStatus(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ gemini: !!GEMINI_API_KEY }));
}

/* --- Helper: run a Python script and pipe its stdout JSON back --- */
function runPython(scriptRelPath, args, cb) {
  const py = spawn('python3', [path.join(__dirname, scriptRelPath), ...args], {
    cwd: __dirname,
    env: process.env
  });
  let stdout = '';
  let stderr = '';
  py.stdout.on('data', d => { stdout += d.toString(); });
  py.stderr.on('data', d => { stderr += d.toString(); });
  py.on('error', err => cb(err, null, null));
  py.on('close', code => cb(null, code, { stdout, stderr }));
}

/* --- GET /api/batch-queue?size=10&cp=&type= --- */
function handleBatchQueue(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const args = ['--size', url.searchParams.get('size') || '10'];
  const cp = url.searchParams.get('cp');
  const type = url.searchParams.get('type');
  if (cp) args.push('--cp', cp);
  if (type) args.push('--type', type);

  runPython('output/list-pending.py', args, (err, code, out) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to spawn python: ' + err.message }));
      return;
    }
    if (code !== 0) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'list-pending.py exited ' + code, stderr: out.stderr }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(out.stdout);
  });
}

/* --- POST /api/update-trackers — body: {"batchNum": N} --- */
async function handleUpdateTrackers(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk.toString();
  let parsed = {};
  try { parsed = body ? JSON.parse(body) : {}; } catch (e) { /* ignore */ }
  const batchNum = String(parsed.batchNum || 1);

  const env = Object.assign({}, process.env, { BATCH_NUM: batchNum });
  const py = spawn('python3', [path.join(__dirname, 'output/update-trackers.py')], {
    cwd: __dirname,
    env: env
  });
  let stdout = '';
  let stderr = '';
  py.stdout.on('data', d => { stdout += d.toString(); });
  py.stderr.on('data', d => { stderr += d.toString(); });
  py.on('error', err => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });
  py.on('close', code => {
    res.writeHead(code === 0 ? 200 : 500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: code === 0, batchNum: batchNum, stdout: stdout, stderr: stderr }));
  });
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
  if (req.method === 'POST' && req.url === '/api/save-docx') {
    return handleSaveDocx(req, res);
  }
  if (req.method === 'GET' && req.url.startsWith('/api/batch-queue')) {
    return handleBatchQueue(req, res);
  }
  if (req.method === 'POST' && req.url === '/api/update-trackers') {
    return handleUpdateTrackers(req, res);
  }

  // Static files
  let filePath = req.url.split('?')[0];
  if (filePath === '/' || filePath === '') filePath = '/index.html';
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
