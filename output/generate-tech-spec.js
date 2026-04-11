#!/usr/bin/env node
/* Generate Technical Specification Document for Account Plan Generator */

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, HeadingLevel, BorderStyle,
  WidthType, ShadingType, PageBreak, PageNumber, LevelFormat, TabStopType
} = require('docx');

const FONT = 'Calibri';
const PAGE_W = 9360;
const H1_COLOR = '1F4E79';
const H2_COLOR = '2E75B6';
const ACCENT = '2E75B6';
const TABLE_HEADER = '2E75B6';
const ALT_ROW = 'D6E4F0';
const TEXT_DARK = '1A1A2E';
const TEXT_BODY = '333333';
const TEXT_MUTED = '888888';
const BORDER_CLR = 'B4C6E0';
const WHITE = 'FFFFFF';

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: BORDER_CLR };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
const cellPad = { top: 60, bottom: 60, left: 120, right: 120 };
const noBorders = { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } };

// Load logo
let logoData = null;
try {
  logoData = fs.readFileSync(path.join(__dirname, '..', 'images', 'aera-logo.png'));
} catch(e) { console.log('Logo not found, skipping'); }

// Helpers
function heading1(text) {
  return new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 28, font: FONT, color: H1_COLOR })],
    spacing: { before: 480, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 6 } }
  });
}

function heading2(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, font: FONT, color: H2_COLOR })],
    spacing: { before: 360, after: 160 }
  });
}

function heading3(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, font: FONT, color: H1_COLOR })],
    spacing: { before: 280, after: 120 }
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: opts.size || 20, font: FONT, color: opts.color || TEXT_BODY, bold: opts.bold || false, italics: opts.italics || false })],
    spacing: { after: opts.after || 140, line: 300 },
    indent: opts.indent ? { left: opts.indent } : undefined
  });
}

function bulletItem(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'bullets', level },
    children: [new TextRun({ text, size: 20, font: FONT, color: TEXT_BODY })],
    spacing: { after: 80, line: 300 }
  });
}

function numberItem(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'numbers', level },
    children: [new TextRun({ text, size: 20, font: FONT, color: TEXT_BODY })],
    spacing: { after: 80, line: 300 }
  });
}

function codeBlock(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 18, font: 'Consolas', color: '2D2D2D' })],
    spacing: { after: 60, line: 276 },
    indent: { left: 400 },
    shading: { fill: 'F5F5F5', type: ShadingType.CLEAR }
  });
}

function labelValue(label, value) {
  return new Paragraph({
    children: [
      new TextRun({ text: label, bold: true, size: 20, font: FONT, color: H1_COLOR }),
      new TextRun({ text: value, size: 20, font: FONT, color: TEXT_BODY })
    ],
    spacing: { before: 40, after: 120, line: 300 }
  });
}

function makeTable(headers, rows, colWidths) {
  const sum = colWidths.reduce((a, b) => a + b, 0);
  // Adjust last column if needed
  if (sum !== PAGE_W) colWidths[colWidths.length - 1] += (PAGE_W - sum);

  const tRows = [];
  tRows.push(new TableRow({ children: headers.map((h, i) =>
    new TableCell({
      borders: cellBorders,
      width: { size: colWidths[i], type: WidthType.DXA },
      shading: { fill: TABLE_HEADER, type: ShadingType.CLEAR },
      margins: cellPad,
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18, font: FONT, color: WHITE })] })]
    })
  )}));
  rows.forEach((row, ri) => {
    tRows.push(new TableRow({ children: row.map((cell, i) =>
      new TableCell({
        borders: cellBorders,
        width: { size: colWidths[i], type: WidthType.DXA },
        shading: ri % 2 === 1 ? { fill: ALT_ROW, type: ShadingType.CLEAR } : undefined,
        margins: cellPad,
        children: [new Paragraph({ children: [new TextRun({ text: String(cell || ''), size: 18, font: FONT, color: TEXT_DARK })] })]
      })
    )}));
  });
  return new Table({ rows: tRows, width: { size: PAGE_W, type: WidthType.DXA }, columnWidths: colWidths });
}

function spacer(after = 80) {
  return new Paragraph({ children: [], spacing: { after } });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// ===================== BUILD DOCUMENT =====================

const children = [];

// ===== COVER PAGE =====
children.push(spacer(2000));
if (logoData) {
  children.push(new Paragraph({
    children: [new ImageRun({
      type: 'png', data: logoData,
      transformation: { width: 180, height: 70 },
      altText: { title: 'Aera Technology', description: 'Aera Technology Logo', name: 'aera-logo' }
    })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 }
  }));
}
children.push(new Paragraph({
  children: [new TextRun({ text: 'Account Plan Generator', bold: true, size: 56, font: FONT, color: H1_COLOR })],
  alignment: AlignmentType.CENTER, spacing: { after: 200 }
}));
children.push(new Paragraph({
  children: [new TextRun({ text: 'Technical Specification', size: 36, font: FONT, color: H2_COLOR })],
  alignment: AlignmentType.CENTER, spacing: { after: 600 }
}));
children.push(new Paragraph({
  children: [new TextRun({ text: 'Aera Technology, Inc.', size: 24, font: FONT, color: TEXT_BODY })],
  alignment: AlignmentType.CENTER, spacing: { after: 100 }
}));
children.push(new Paragraph({
  children: [new TextRun({ text: 'April 2026', size: 24, font: FONT, color: TEXT_BODY })],
  alignment: AlignmentType.CENTER, spacing: { after: 100 }
}));
children.push(new Paragraph({
  children: [new TextRun({ text: 'CONFIDENTIAL', bold: true, size: 22, font: FONT, color: 'CC0000' })],
  alignment: AlignmentType.CENTER, spacing: { after: 200 }
}));
children.push(new Paragraph({
  children: [new TextRun({ text: 'Version 1.0  |  Author: Deepshikha Agarwal', size: 20, font: FONT, color: TEXT_MUTED })],
  alignment: AlignmentType.CENTER, spacing: { after: 400 }
}));

children.push(pageBreak());

// ===== TABLE OF CONTENTS =====
children.push(heading1('Table of Contents'));
const tocItems = [
  ['1.', 'Executive Summary'],
  ['2.', 'System Architecture Overview'],
  ['3.', 'Technology Stack'],
  ['4.', 'File Structure & Module Map'],
  ['5.', 'AI Engine & Prompt Architecture'],
  ['6.', 'Data Flow & API Endpoints'],
  ['7.', 'Word Export Template Specification'],
  ['8.', 'Batch Processing Pipeline'],
  ['9.', 'Output Structure & File Organization'],
  ['10.', 'UI Components & Screens'],
  ['11.', 'Configuration & Data Files'],
  ['12.', 'Key Design Decisions'],
];
tocItems.forEach(([num, title]) => {
  children.push(new Paragraph({
    children: [
      new TextRun({ text: num + '  ', bold: true, size: 22, font: FONT, color: H2_COLOR }),
      new TextRun({ text: title, size: 22, font: FONT, color: TEXT_BODY })
    ],
    spacing: { after: 100 },
    indent: { left: 200 }
  }));
});

children.push(pageBreak());

// ===== 1. EXECUTIVE SUMMARY =====
children.push(heading1('1. Executive Summary'));
children.push(body('The Account Plan Generator is an AI-powered web application built for Aera Technology\'s sales organization. It automates the creation of executive-ready account plans by combining real-time web intelligence (via Google Search grounding) with structured sales methodology.'));
children.push(body('The system generates comprehensive, data-driven account plans in under 2 minutes per account, covering company research, stakeholder identification, competitive analysis, value hypothesis, 30-60-90 day engagement strategy, and risk assessment.'));

children.push(heading2('Key Capabilities'));
children.push(bulletItem('AI-powered account research using Gemini 2.5 Flash with Google Search grounding'));
children.push(bulletItem('7 sequential AI calls per plan, each building on prior context'));
children.push(bulletItem('Real stakeholder identification from web search (LinkedIn, earnings calls, press)'));
children.push(bulletItem('Branded Word document export with Aera SOW-style formatting'));
children.push(bulletItem('Batch processing pipeline for 383+ accounts with auto-save'));
children.push(bulletItem('Executive Review Tracker (Excel) with merged cells and stakeholder rows'));
children.push(bulletItem('Plan refresh from meeting notes (2-call update cycle)'));
children.push(bulletItem('Personalized outreach email generation per stakeholder'));
children.push(bulletItem('Configurable seller profile and Aera Way sales methodology integration'));

children.push(heading2('Scale'));
children.push(makeTable(
  ['Metric', 'Value'],
  [
    ['Total accounts in pipeline', '383 (Key: 91, Target: 276, Other: 16)'],
    ['Generation time per plan', '60-120 seconds (7 sequential AI calls)'],
    ['AI model', 'Gemini 2.5 Flash (gemini-2.5-flash)'],
    ['Grounded calls per plan', '3 of 7 (Calls 1, 2, 4 use Google Search)'],
    ['Total codebase', '5,719 lines across 18 files'],
    ['Word export size', '4-5 pages, branded Aera format'],
  ],
  [4000, 5360]
));
children.push(spacer());

children.push(pageBreak());

// ===== 2. SYSTEM ARCHITECTURE =====
children.push(heading1('2. System Architecture Overview'));
children.push(body('The application follows a client-server architecture with a thin Node.js proxy server and a rich browser-based frontend.'));

children.push(heading2('Architecture Diagram'));
children.push(new Paragraph({
  children: [new TextRun({ text: '[Browser Client]  <-->  [Node.js Server :3000]  <-->  [Gemini API]', size: 20, font: 'Consolas', color: H2_COLOR, bold: true })],
  alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 },
  shading: { fill: 'F0F4F8', type: ShadingType.CLEAR },
  border: { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder }
}));

children.push(heading2('Component Roles'));
children.push(makeTable(
  ['Component', 'Role', 'Key Responsibility'],
  [
    ['Browser Client', 'Frontend SPA', 'Form input, AI orchestration, plan rendering, Word export (docx.js)'],
    ['Node.js Server', 'API Proxy + Static Server', 'Gemini API proxy, file save, API key management, static file serving'],
    ['Gemini API', 'AI Engine', 'Content generation, web search grounding, JSON-mode responses'],
    ['Google Search', 'Data Source', 'Real-time company data via Gemini grounding tool'],
    ['localStorage', 'Client Storage', 'Saved plans, seller profile, application state'],
    ['File System', 'Server Storage', 'Auto-saved Word documents in CP folder structure'],
  ],
  [1800, 1800, 5760]
));
children.push(spacer());

children.push(heading2('Request Flow'));
children.push(numberItem('User enters company name and optional context in browser form'));
children.push(numberItem('Browser\'s PlanGenerator.generate() orchestrates 7 sequential AI calls'));
children.push(numberItem('Each call sends POST to /api/ai on the Node.js server'));
children.push(numberItem('Server proxies to Gemini API (with API key), returns response'));
children.push(numberItem('Browser parses JSON response, builds cumulative plan object'));
children.push(numberItem('Plan rendered in 12-tab UI; Word export generates .docx client-side'));
children.push(numberItem('Optional: .docx blob sent to /api/save-docx for server-side file save'));

children.push(pageBreak());

// ===== 3. TECHNOLOGY STACK =====
children.push(heading1('3. Technology Stack'));

children.push(heading2('Frontend'));
children.push(makeTable(
  ['Technology', 'Version', 'Purpose'],
  [
    ['Vanilla JavaScript (ES5+)', 'N/A', 'All client logic, no framework dependency'],
    ['HTML5 / CSS3', 'N/A', 'Single-page application with 4 screens'],
    ['docx.js', '9.0.2', 'Client-side Word document generation (loaded from CDN)'],
    ['Google Fonts (Inter)', '400-800', 'UI typography'],
    ['CSS Custom Properties', 'N/A', 'Theme colors, spacing, responsive design'],
  ],
  [3000, 1200, 5160]
));
children.push(spacer());

children.push(heading2('Backend'));
children.push(makeTable(
  ['Technology', 'Version', 'Purpose'],
  [
    ['Node.js', '18+', 'Server runtime'],
    ['http (built-in)', 'N/A', 'HTTP server, no Express dependency'],
    ['https (built-in)', 'N/A', 'Outbound Gemini API calls'],
    ['fs (built-in)', 'N/A', 'File system operations for auto-save'],
  ],
  [3000, 1200, 5160]
));
children.push(spacer());

children.push(heading2('AI / ML'));
children.push(makeTable(
  ['Technology', 'Details', 'Purpose'],
  [
    ['Google Gemini 2.5 Flash', 'generativelanguage.googleapis.com', 'Primary AI model for all generation'],
    ['Google Search Grounding', 'tools: [{ googleSearch: {} }]', 'Real-time web data for calls 1, 2, 4'],
    ['JSON Mode', 'responseMimeType: application/json', 'Structured output for calls 3, 5, 6, 7'],
  ],
  [3000, 3000, 3360]
));
children.push(spacer());

children.push(heading2('Batch & Analytics'));
children.push(makeTable(
  ['Technology', 'Purpose'],
  [
    ['Python 3 + openpyxl', 'Excel tracker management (Executive Review Tracker, Batch Status)'],
    ['Browser-based orchestration', 'Sequential batch plan generation via preview_eval'],
  ],
  [3000, 6360]
));
children.push(spacer());

children.push(pageBreak());

// ===== 4. FILE STRUCTURE =====
children.push(heading1('4. File Structure & Module Map'));

children.push(heading2('Directory Layout'));
const fileStructure = [
  ['/', 'index.html', '255 lines', 'Single-page HTML with 4 screens'],
  ['/', 'server.js', '294 lines', 'Node.js server: Gemini proxy, file save, static serving'],
  ['/js/', 'utils.js', '125 lines', 'Global AP namespace, EventBus, AppStore, navigation, helpers'],
  ['/js/', 'api-client.js', '40 lines', 'Gemini API client wrapper (POST /api/ai)'],
  ['/js/', 'seller-profile.js', '80 lines', 'Seller profile CRUD + context string builder'],
  ['/js/', 'methodology.js', '99 lines', 'Aera Way sales methodology loader + context builder'],
  ['/js/', 'aera-content.js', '199 lines', 'Content library (events, whitepapers, blogs) loader'],
  ['/js/', 'plan-generator.js', '513 lines', 'AI orchestrator: 7 sequential calls, JSON repair, retry logic'],
  ['/js/', 'plan-renderer.js', '1,071 lines', '12-tab plan viewer with interactive UI'],
  ['/js/', 'plan-export.js', '568 lines', 'Markdown + Word export (Aera SOW branding)'],
  ['/js/', 'plan-refresh.js', '215 lines', 'Plan update from meeting notes (2 AI calls)'],
  ['/js/', 'plan-outreach.js', '173 lines', 'Personalized outreach email generator'],
  ['/js/', 'plan-editor.js', '39 lines', 'Inline contenteditable field editing'],
  ['/js/', 'plan-persistence.js', '70 lines', 'localStorage save/load/delete/export'],
  ['/js/', 'app.js', '244 lines', 'Bootstrap, screen init, settings form, API key check'],
  ['/css/', 'base.css', '284 lines', 'CSS reset, variables, typography, layout'],
  ['/css/', 'components.css', '449 lines', 'Buttons, cards, forms, toasts, modals'],
  ['/css/', 'plan.css', '1,001 lines', 'Plan viewer tabs, panels, tables, responsive'],
  ['/data/', 'default-seller.json', '', 'Aera Technology seller profile defaults'],
  ['/data/', 'aera-way-methodology.json', '', 'Sales methodology stages, milestones, risk framework'],
  ['/data/', 'aera-content.json', '', 'Events, whitepapers, blogs, analyst recognition'],
];

children.push(makeTable(
  ['Path', 'File', 'Size', 'Description'],
  fileStructure,
  [800, 2400, 1200, 4960]
));
children.push(spacer());

children.push(heading2('Module Dependency Graph'));
children.push(body('All modules attach to the global AP namespace. Load order matters (defined in index.html):'));
children.push(codeBlock('utils.js -> api-client.js -> seller-profile.js -> methodology.js'));
children.push(codeBlock('  -> aera-content.js -> plan-generator.js -> plan-refresh.js'));
children.push(codeBlock('  -> plan-outreach.js -> plan-renderer.js -> plan-editor.js'));
children.push(codeBlock('  -> plan-export.js -> plan-persistence.js -> app.js'));
children.push(body('The AP.EventBus provides loose coupling between modules (e.g., plan:progress events).'));

children.push(pageBreak());

// ===== 5. AI ENGINE & PROMPTS =====
children.push(heading1('5. AI Engine & Prompt Architecture'));

children.push(body('The AI engine makes 7 sequential API calls per account plan. Each call builds on context from previous calls, creating a progressive enrichment pipeline. Three calls use Google Search grounding for real-time data; four use JSON mode for structured output.'));

children.push(heading2('Call Pipeline Overview'));
children.push(makeTable(
  ['#', 'Call Name', 'Mode', 'Max Tokens', 'Inputs', 'Outputs'],
  [
    ['1', 'Account Overview + News', 'Grounded', '16,384', 'Company name, industry, revenue', 'overview{}, news[]'],
    ['2', 'Technology Landscape', 'Grounded', '4,096', 'Company + overview context', 'technologyLandscape{}'],
    ['3', 'DI Priorities', 'JSON Mode', '8,192', 'Overview + tech + news + user context', 'diPriorities[]'],
    ['4', 'Key Stakeholders', 'Grounded', '12,288', 'Overview + priorities + user context', 'stakeholders[]'],
    ['5', 'Competitive + Value', 'JSON Mode', '8,192', 'All prior context + competitors', 'competitive{}, valueHypothesis{}'],
    ['6', 'Strategy + 30-60-90', 'JSON Mode', '10,240', 'All prior context + methodology', 'accountStrategy{}, dayPlan{}, nextFiveSteps[]'],
    ['7', 'Risks + Metrics', 'JSON Mode', '6,144', 'All prior context + risks', 'risks[], successMetrics[]'],
  ],
  [360, 2000, 1100, 1100, 2600, 2200]
));
children.push(spacer());

children.push(heading2('System Prompt (Base)'));
children.push(body('Every call shares this base system prompt, with the seller profile context appended:'));
children.push(codeBlock('"You are a world-class B2B enterprise sales strategist at'));
children.push(codeBlock('{sellerName}. You have deep knowledge of every major company.'));
children.push(codeBlock('Your job is to build account plans that are so insightful they'));
children.push(codeBlock('could be presented to a Chief Revenue Officer.'));
children.push(codeBlock(''));
children.push(codeBlock('Be specific, not generic. Reference real business context,'));
children.push(codeBlock('actual initiatives, and concrete data.'));
children.push(codeBlock(''));
children.push(codeBlock('Return ONLY valid JSON - no markdown fences, no explanation'));
children.push(codeBlock('outside the JSON."'));
children.push(codeBlock(''));
children.push(codeBlock('+ {Seller Profile Context Block}'));

// ---- CALL 1 ----
children.push(heading2('Call 1: Account Overview + News (Grounded)'));
children.push(body('Purpose: Research the target company using real-time web search. Returns structured company profile with financial data, business divisions, strategic priorities, and recent news.'));
children.push(heading3('Prompt'));
children.push(codeBlock('"Build a deeply researched account profile for:'));
children.push(codeBlock('{companyContext}'));
children.push(codeBlock(''));
children.push(codeBlock('Search the web for the latest information about this company.'));
children.push(codeBlock('Use real, current data."'));
children.push(heading3('JSON Schema'));
children.push(codeBlock('{'));
children.push(codeBlock('  "overview": {'));
children.push(codeBlock('    "industry", "hqLocation", "annualRevenue", "employeeCount",'));
children.push(codeBlock('    "ticker", "website",'));
children.push(codeBlock('    "businessGroups": [{ "name", "description", "revenueShare" }],'));
children.push(codeBlock('    "financialSnapshot": [{ "metric", "currentYear", "priorYear", "notes" }],'));
children.push(codeBlock('    "strategicPriorities": ["Priority 1 - description"]'));
children.push(codeBlock('  },'));
children.push(codeBlock('  "news": [{ "date", "headline", "detail", "source", "relevanceTag" }]'));
children.push(codeBlock('}'));
children.push(body('Constraints: 5-7 news items, 4-6 financial rows, real business groups. Token limit: 16,384.'));

// ---- CALL 2 ----
children.push(heading2('Call 2: Technology Landscape (Grounded)'));
children.push(body('Purpose: Research the company\'s technology stack as a CUSTOMER of vendors. Identifies ERP, planning, CRM, cloud, and AI/ML investments with confidence levels.'));
children.push(heading3('JSON Schema'));
children.push(codeBlock('{'));
children.push(codeBlock('  "technologyLandscape": {'));
children.push(codeBlock('    "knownSystems": [{ "category", "vendor", "product",'));
children.push(codeBlock('      "evidence", "confidence": "Confirmed|Likely|Rumored" }],'));
children.push(codeBlock('    "digitalStrategy", "itLeadership", "techBudget"'));
children.push(codeBlock('  }'));
children.push(codeBlock('}'));
children.push(body('Key rule: "Only report systems you find EVIDENCE for. Mark confidence level honestly. Do NOT guess."'));

// ---- CALL 3 ----
children.push(heading2('Call 3: Decision Intelligence Priorities (JSON Mode)'));
children.push(body('Purpose: Analyze DI opportunities specific to the target company, leveraging all prior context (overview, tech stack, news, user intelligence).'));
children.push(heading3('JSON Schema'));
children.push(codeBlock('{'));
children.push(codeBlock('  "diPriorities": [{'));
children.push(codeBlock('    "rank", "area", "context" (3-4 sentences),'));
children.push(codeBlock('    "sellerValueProp" (2-3 sentences with Aera Skills),'));
children.push(codeBlock('    "estimatedImpact" (dollar/percentage), "urgency"'));
children.push(codeBlock('  }]'));
children.push(codeBlock('}'));
children.push(body('Generates 5 DI priorities ranked by importance.'));

children.push(pageBreak());

// ---- CALL 4 ----
children.push(heading2('Call 4: Key Stakeholders (Grounded)'));
children.push(body('Purpose: Research and identify REAL executives using web search. Looks for C-suite, VP/SVP level across Supply Chain, Operations, Digital, IT, AI, Data Science. Includes direct quotes from earnings calls, conferences, and interviews.'));
children.push(heading3('Key Prompt Constraints'));
children.push(bulletItem('"ONLY include people you found in search results. Do NOT invent names."'));
children.push(bulletItem('"engagementStrategy": "1-2 SHORT SENTENCES max 40 words"'));
children.push(bulletItem('"If no quote found, omit publicQuotes array for that person"'));
children.push(bulletItem('"confidence": "Verified|Likely|Unverified"'));
children.push(bulletItem('Target 5-8 stakeholders, token limit: 12,288'));
children.push(heading3('JSON Schema'));
children.push(codeBlock('{'));
children.push(codeBlock('  "stakeholders": [{'));
children.push(codeBlock('    "name", "title", "roleInDeal", "relevance", "notes",'));
children.push(codeBlock('    "engagementStrategy", "confidence",'));
children.push(codeBlock('    "publicQuotes": [{ "quote", "source", "date" }]'));
children.push(codeBlock('  }]'));
children.push(codeBlock('}'));

// ---- CALL 5 ----
children.push(heading2('Call 5: Competitive Analysis + Value Hypothesis (JSON Mode)'));
children.push(body('Purpose: Build competitive landscape and quantified value case. Incorporates user-reported competitors with "userReported: true" flag.'));
children.push(heading3('Key Prompt Constraints'));
children.push(bulletItem('"sellerAdvantage": "1-2 SHORT SENTENCES max 30 words"'));
children.push(bulletItem('"executivePitch": "2-3 POWERFUL SENTENCES max 60 words"'));
children.push(bulletItem('4-6 competitors, 4-6 value metrics'));
children.push(heading3('JSON Schema'));
children.push(codeBlock('{'));
children.push(codeBlock('  "competitive": {'));
children.push(codeBlock('    "positioning", "landscape": [{ "competitor", "presence",'));
children.push(codeBlock('      "weakness", "sellerAdvantage", "battleCard", "userReported" }]'));
children.push(codeBlock('  },'));
children.push(codeBlock('  "valueHypothesis": {'));
children.push(codeBlock('    "executivePitch", "whyNow",'));
children.push(codeBlock('    "metrics": [{ "metric", "impact", "confidence", "basis" }]'));
children.push(codeBlock('  }'));
children.push(codeBlock('}'));

// ---- CALL 6 ----
children.push(heading2('Call 6: Account Strategy + 30-60-90 Day Plan (JSON Mode)'));
children.push(body('Purpose: Create the tactical engagement plan with all accumulated intelligence. Integrates Aera Way methodology milestones and user-provided 90-day goals.'));
children.push(heading3('Key Prompt Constraints'));
children.push(bulletItem('"action": "1 SHORT SENTENCE max 20 words"'));
children.push(bulletItem('5-7 actions per phase, reference specific stakeholder names'));
children.push(bulletItem('"What Good Looks Like" must be concrete and measurable'));
children.push(bulletItem('Token limit: 10,240'));
children.push(heading3('JSON Schema'));
children.push(codeBlock('{'));
children.push(codeBlock('  "accountStrategy": {'));
children.push(codeBlock('    "positioning", "whyAera", "whyNow", "keyMessages": [],'));
children.push(codeBlock('    "landingZone"'));
children.push(codeBlock('  },'));
children.push(codeBlock('  "dayPlan": {'));
children.push(codeBlock('    "day30": { "title", "whatGoodLooksLike", "actions": ['));
children.push(codeBlock('      { "day", "action", "owner", "deliverable" }'));
children.push(codeBlock('    ]},'));
children.push(codeBlock('    "day60": { ... }, "day90": { ... }'));
children.push(codeBlock('  },'));
children.push(codeBlock('  "nextFiveSteps": [{ "step", "action", "owner", "by", "outcome" }]'));
children.push(codeBlock('}'));

// ---- CALL 7 ----
children.push(heading2('Call 7: Risks + Success Metrics (JSON Mode)'));
children.push(body('Purpose: Risk assessment and measurable success criteria. Incorporates user-flagged risks with specific Aera mitigations.'));
children.push(heading3('Key Prompt Constraints'));
children.push(bulletItem('"risk": "1 SHORT SENTENCE"'));
children.push(bulletItem('"mitigation": "1-2 SHORT SENTENCES max 40 words with concrete Aera-specific mitigation"'));
children.push(bulletItem('5 risks, 5 success metrics aligned to 30-60-90 phases'));
children.push(heading3('JSON Schema'));
children.push(codeBlock('{'));
children.push(codeBlock('  "risks": [{ "risk", "category", "likelihood", "impact",'));
children.push(codeBlock('    "mitigation", "owner", "userReported" }],'));
children.push(codeBlock('  "successMetrics": [{ "metric", "target", "timeline",'));
children.push(codeBlock('    "measurement" }]'));
children.push(codeBlock('}'));

children.push(pageBreak());

// ===== RELIABILITY =====
children.push(heading2('Reliability & Error Handling'));

children.push(heading3('Grounded Call Retry Logic'));
children.push(body('Grounded calls (1, 2, 4) use a 4-attempt retry loop with exponential backoff:'));
children.push(codeBlock('Attempt 1: immediate'));
children.push(codeBlock('Attempt 2: wait 2 seconds'));
children.push(codeBlock('Attempt 3: wait 4 seconds'));
children.push(codeBlock('Attempt 4: wait 6 seconds (final, throw on failure)'));
children.push(body('Server-side retry: additional 3 attempts for HTTP 429/5xx with 2s/4s/8s delays.'));

children.push(heading3('JSON Repair Pipeline'));
children.push(body('AI responses go through a 4-stage parse pipeline:'));
children.push(numberItem('Direct JSON.parse() on cleaned text (remove markdown fences)'));
children.push(numberItem('Extract JSON object via brace-depth scanning'));
children.push(numberItem('Repair: fix unescaped newlines/tabs in strings, remove trailing commas'));
children.push(numberItem('Truncation repair: on parse error, truncate at error position, close open brackets'));

children.push(heading3('Fallback Data'));
children.push(body('If calls fail, the system provides sensible defaults:'));
children.push(bulletItem('Call 1 failure: empty overview with user-provided industry/revenue'));
children.push(bulletItem('Call 6 failure: generic 30-60-90 day plan template'));
children.push(bulletItem('Call 7 failure: 6 standard success metrics'));

children.push(pageBreak());

// ===== 6. DATA FLOW & API =====
children.push(heading1('6. Data Flow & API Endpoints'));

children.push(heading2('API Endpoints'));
children.push(makeTable(
  ['Method', 'Path', 'Purpose', 'Auth'],
  [
    ['POST', '/api/ai', 'Gemini API proxy with grounding + JSON mode support', 'Server-side API key'],
    ['GET', '/api/key-status', 'Check if GEMINI_API_KEY is configured', 'None'],
    ['POST', '/api/save-docx', 'Save Word document binary to CP folder structure', 'None'],
    ['GET', '/*', 'Static file server (HTML, CSS, JS, images, data JSON)', 'None'],
  ],
  [1000, 1800, 4760, 1800]
));
children.push(spacer());

children.push(heading2('POST /api/ai - Request Format'));
children.push(codeBlock('{'));
children.push(codeBlock('  "system": "System prompt string",'));
children.push(codeBlock('  "messages": [{ "role": "user", "content": "User message" }],'));
children.push(codeBlock('  "max_tokens": 8192,'));
children.push(codeBlock('  "temperature": 0.7,'));
children.push(codeBlock('  "useGrounding": false,'));
children.push(codeBlock('  "jsonMode": false'));
children.push(codeBlock('}'));

children.push(heading2('POST /api/ai - Response Format'));
children.push(codeBlock('{'));
children.push(codeBlock('  "text": "AI-generated text content",'));
children.push(codeBlock('  "sources": [{ "title": "Web page title", "url": "https://..." }]'));
children.push(codeBlock('}'));

children.push(heading2('POST /api/save-docx'));
children.push(body('Receives binary .docx blob with metadata in headers:'));
children.push(makeTable(
  ['Header', 'Purpose', 'Example'],
  [
    ['Content-Type', 'Binary body type', 'application/octet-stream'],
    ['X-Company-Name', 'Account name (URL-encoded)', 'Unilever'],
    ['X-CP-Name', 'CP / Owner name', 'Arvind%20Behera'],
    ['X-Account-Type', 'Key Account | Target Account | Other', 'Key%20Account'],
  ],
  [2500, 3500, 3360]
));
children.push(spacer());

children.push(heading2('Server Configuration'));
children.push(makeTable(
  ['Setting', 'Value', 'Purpose'],
  [
    ['server.timeout', '300,000 ms (5 min)', 'Long Gemini grounding calls'],
    ['server.keepAliveTimeout', '300,000 ms', 'Keep connections alive during generation'],
    ['apiReq.setTimeout', '120,000 ms (2 min)', 'Per-request Gemini timeout'],
    ['Cache-Control', 'no-cache, must-revalidate', 'Ensure fresh JS on every load'],
    ['Gemini model', 'gemini-2.5-flash', 'Latest Flash model'],
  ],
  [2800, 2800, 3760]
));
children.push(spacer());

children.push(pageBreak());

// ===== 7. WORD EXPORT =====
children.push(heading1('7. Word Export Template Specification'));

children.push(body('The Word export generates a 4-5 page branded document using the docx.js library (v9.0.2) loaded from CDN at runtime. The design mirrors Aera\'s Statement of Work (SOW) template.'));

children.push(heading2('Branding Constants'));
children.push(makeTable(
  ['Element', 'Value', 'Usage'],
  [
    ['Font', 'Calibri', 'All text throughout document'],
    ['Page Size', 'US Letter (12240 x 15840 DXA)', '8.5" x 11" with 1" margins'],
    ['Heading 1 Color', '#1F4E79 (Dark Navy)', 'Section headings, labels'],
    ['Heading 2 Color', '#2E75B6 (Medium Blue)', 'Subheadings, borders, accents'],
    ['Table Header BG', '#2E75B6', 'White text on blue header row'],
    ['Alternating Row', '#D6E4F0 (Light Blue)', 'Every other data row'],
    ['Body Text', '#333333', 'Standard paragraph text'],
    ['Border Color', '#B4C6E0', 'Table cell borders'],
  ],
  [2500, 3500, 3360]
));
children.push(spacer());

children.push(heading2('Document Sections'));
children.push(makeTable(
  ['#', 'Section', 'Content Source', 'Layout'],
  [
    ['1', 'Title Block', 'Company name, date, stage', 'Large heading + meta line'],
    ['2', 'Account Snapshot', 'overview{}', 'Borderless key-value table'],
    ['3', 'Why This Account', 'accountStrategy{}, valueHypothesis{}', 'Executive pitch callout + labels'],
    ['4', 'Key Stakeholders', 'stakeholders[]', '4-col table: Name/Title/Role/Approach'],
    ['5', 'Competitive Landscape', 'competitive.landscape[]', '3-col table: Competitor/Status/Advantage'],
    ['6', 'Value Potential', 'valueHypothesis.metrics[]', '3-col table: Opportunity/Impact/Confidence'],
    ['7', 'Action Plan', 'Consolidated from dayPlan + nextSteps', '4-col table: #/Action/Owner/Phase (max 10)'],
    ['8', 'Key Risks', 'risks[]', '4-col table: Risk/L-I/Mitigation/Owner'],
    ['9', 'Recent News', 'news[]', 'Bullet list with dates (max 4)'],
  ],
  [360, 2000, 3200, 3800]
));
children.push(spacer());

children.push(heading2('Table Column Widths (DXA)'));
children.push(body('Optimized for concise AI output without overflow:'));
children.push(makeTable(
  ['Table', 'Column 1', 'Column 2', 'Column 3', 'Column 4'],
  [
    ['Stakeholders', 'Name: 1600', 'Title: 2200', 'Role: 1360', 'Approach: 4200'],
    ['Competitive', 'Competitor: 1600', 'Status: 1400', 'Advantage: 6360', ''],
    ['Value', 'Opportunity: 4200', 'Impact: 3560', 'Confidence: 1600', ''],
    ['Actions', '#: 360', 'Action: 6400', 'Owner: 1200', 'Phase: 1400'],
    ['Risks', 'Risk: 2800', 'L/I: 600', 'Mitigation: 4960', 'Owner: 1000'],
  ],
  [1800, 2000, 2000, 2000, 1560]
));
children.push(spacer());

children.push(heading2('Export Flow'));
children.push(numberItem('Load docx.js library from CDN (if not cached)'));
children.push(numberItem('Load Aera logo from /images/aera-logo.png'));
children.push(numberItem('Build Document object with all sections'));
children.push(numberItem('Packer.toBlob() generates binary .docx'));
children.push(numberItem('Browser download via createObjectURL + anchor click'));
children.push(numberItem('If CP name present: silent POST to /api/save-docx for server filing'));

children.push(pageBreak());

// ===== 8. BATCH PROCESSING =====
children.push(heading1('8. Batch Processing Pipeline'));

children.push(body('The batch processing system generates account plans at scale, processing 383 accounts organized by CP (Customer Partner) owner and account type.'));

children.push(heading2('Pipeline Architecture'));
children.push(numberItem('Territory planning data loaded from Excel (Account Name, CP, Account Type)'));
children.push(numberItem('Accounts grouped into batches of 5-10 per CP'));
children.push(numberItem('Browser-based orchestration: sequential generation via preview_eval'));
children.push(numberItem('Each account: generate() -> autoSave() -> update batch tracker'));
children.push(numberItem('Word docs auto-saved to CP/Account Type folder hierarchy'));
children.push(numberItem('Post-batch: Python scripts update Executive Review Tracker'));

children.push(heading2('Batch Orchestration Code Pattern'));
children.push(codeBlock('for (const account of batch) {'));
children.push(codeBlock('  // Fill form fields'));
children.push(codeBlock('  document.getElementById("input-company").value = account.name;'));
children.push(codeBlock('  document.getElementById("input-cp-name").value = account.cp;'));
children.push(codeBlock('  document.getElementById("input-account-type").value = account.type;'));
children.push(codeBlock('  '));
children.push(codeBlock('  // Generate plan'));
children.push(codeBlock('  const plan = await AP.PlanGenerator.generate('));
children.push(codeBlock('    account.name, account.industry, account.revenue, userInputs'));
children.push(codeBlock('  );'));
children.push(codeBlock('  '));
children.push(codeBlock('  // Auto-save Word doc'));
children.push(codeBlock('  await AP.PlanExport.autoSave(plan, account.cp, account.type);'));
children.push(codeBlock('}'));

children.push(heading2('Output Folder Structure'));
children.push(codeBlock('output/'));
children.push(codeBlock('  FY27 Account Plans/'));
children.push(codeBlock('    Arvind Behera/'));
children.push(codeBlock('      1. Key Accounts/'));
children.push(codeBlock('        Unilever - Account Plan.docx'));
children.push(codeBlock('        PepsiCo - Account Plan.docx'));
children.push(codeBlock('      2. Target Accounts/'));
children.push(codeBlock('        General Mills - Account Plan.docx'));
children.push(codeBlock('    Charles Carter/'));
children.push(codeBlock('      1. Key Accounts/'));
children.push(codeBlock('        ...'));

children.push(heading2('Batch Progress (as of April 2026)'));
children.push(makeTable(
  ['Batch', 'CP Owner', 'Accounts', 'Status'],
  [
    ['1', 'Arvind Behera', '7 Key Accounts', 'Complete'],
    ['2', 'Charles Carter', '4 Key Accounts', 'Complete'],
    ['3', 'Duncan Micklem', '3 Key Accounts', 'Complete'],
    ['4', 'Gregory Lara', '5 Key Accounts', 'Complete'],
    ['5', 'Juliana Giraldo + Jerome Feltracco', '9 Key Accounts', 'Complete'],
    ['6-18', 'Remaining CPs', '63 Key Accounts', 'Pending'],
    ['19+', 'All CPs', '276 Target + 16 Other', 'Pending'],
  ],
  [1000, 3500, 2500, 2360]
));
children.push(spacer());

children.push(pageBreak());

// ===== 9. OUTPUT STRUCTURE =====
children.push(heading1('9. Output Structure & File Organization'));

children.push(heading2('Plan Data Object'));
children.push(body('Each generated plan is a JavaScript object with the following top-level structure:'));
children.push(codeBlock('{'));
children.push(codeBlock('  companyName: "Unilever",'));
children.push(codeBlock('  generatedAt: "2026-04-08T...",'));
children.push(codeBlock('  userInputs: { dealStage, accountContext, cpName, accountType, ... },'));
children.push(codeBlock('  overview: { industry, hqLocation, annualRevenue, businessGroups, ... },'));
children.push(codeBlock('  news: [{ date, headline, detail, source, relevanceTag }],'));
children.push(codeBlock('  technologyLandscape: { knownSystems, digitalStrategy, itLeadership },'));
children.push(codeBlock('  diPriorities: [{ rank, area, context, sellerValueProp, estimatedImpact }],'));
children.push(codeBlock('  stakeholders: [{ name, title, roleInDeal, engagementStrategy, ... }],'));
children.push(codeBlock('  competitive: { positioning, landscape: [{ competitor, presence, ... }] },'));
children.push(codeBlock('  valueHypothesis: { executivePitch, whyNow, metrics: [...] },'));
children.push(codeBlock('  accountStrategy: { positioning, whyAera, whyNow, keyMessages, landingZone },'));
children.push(codeBlock('  dayPlan: { day30: {...}, day60: {...}, day90: {...} },'));
children.push(codeBlock('  nextFiveSteps: [{ step, action, owner, by, outcome }],'));
children.push(codeBlock('  risks: [{ risk, category, likelihood, impact, mitigation, owner }],'));
children.push(codeBlock('  successMetrics: [{ metric, target, timeline, measurement }],'));
children.push(codeBlock('  _sources: [{ title, url }]'));
children.push(codeBlock('}'));

children.push(heading2('Executive Review Tracker (Excel)'));
children.push(body('Post-processed Excel workbook with merged cells. Each account spans 7 rows (one per stakeholder). Account-level columns (A-K, W-Y) are merged across all 7 rows.'));
children.push(makeTable(
  ['Column Group', 'Columns', 'Scope'],
  [
    ['Account Info (merged)', 'A-K', 'Account Name, Industry, Revenue, HQ, Strategic Priorities, etc.'],
    ['Stakeholder Detail (per row)', 'L-V', 'Stakeholder #, Name, Title, Role, Engagement Status, Notes, Strategy'],
    ['Deal Summary (merged)', 'W-Y', 'Executive Pitch, Top Competitor, Deal Risk Level'],
  ],
  [2500, 1500, 5360]
));
children.push(spacer());

children.push(pageBreak());

// ===== 10. UI COMPONENTS =====
children.push(heading1('10. UI Components & Screens'));

children.push(heading2('Screen Architecture'));
children.push(body('The application uses a single-page architecture with 4 screens, navigated via AP.navigateTo():'));
children.push(makeTable(
  ['Screen', 'Element ID', 'Purpose'],
  [
    ['Home', 'screen-home', 'Company input form, saved plans list, API key status banner'],
    ['Generating', 'screen-generating', 'Progress bar with phase/step indicators'],
    ['Plan View', 'screen-plan', '12-tab plan viewer with export actions'],
    ['Settings', 'screen-settings', 'Seller profile configuration form'],
  ],
  [1800, 2200, 5360]
));
children.push(spacer());

children.push(heading2('Plan Viewer Tabs (12)'));
children.push(makeTable(
  ['Tab', 'Content', 'Interactive Features'],
  [
    ['Overview', 'Company snapshot, business groups, financials', 'Inline edit'],
    ['News', 'Recent news with relevance tags', 'Expandable detail'],
    ['Tech Stack', 'Known systems with confidence badges', 'Category filtering'],
    ['DI Priorities', 'Ranked priorities with impact estimates', 'Inline edit'],
    ['Stakeholders', 'People cards with quotes and engagement plans', 'Status badges'],
    ['Competitive', 'Positioning + competitor landscape table', 'Battle cards'],
    ['Value', 'Executive pitch + quantified metrics', 'Inline edit'],
    ['Strategy', 'Account strategy sections', 'Key messages list'],
    ['30-60-90', 'Three-phase plan with actions per phase', 'Phase cards'],
    ['Risks', 'Risk table + success metrics', 'Severity badges'],
    ['Actions', 'Consolidated action tracker', 'Phase sorting'],
    ['Notes', 'Meeting notes input + plan refresh', 'AI-powered refresh'],
  ],
  [1800, 3600, 3960]
));
children.push(spacer());

children.push(heading2('Form Inputs'));
children.push(makeTable(
  ['Field', 'Type', 'Required', 'Notes'],
  [
    ['Company Name', 'text', 'Yes', 'Primary input for plan generation'],
    ['Industry', 'select (12 options)', 'No', 'Auto-detect if not specified'],
    ['Revenue Range', 'select (5 ranges)', 'No', 'Auto-detect if not specified'],
    ['CP / Owner', 'text', 'No', 'Used for file save folder routing'],
    ['Account Type', 'select (3 types)', 'No', 'Key/Target/Other for folder routing'],
    ['Deal Stage', 'select (7 stages)', 'No', 'Affects strategy recommendations'],
    ['Account Context', 'textarea', 'No', 'Free-text existing knowledge'],
    ['Suspected Competitors', 'textarea', 'No', 'Forces specific competitor coverage'],
    ['Goals Next 90 Days', 'textarea', 'No', 'Aligns 30-60-90 plan to goals'],
    ['Known Risks', 'textarea', 'No', 'Forces specific risk mitigations'],
  ],
  [2200, 2000, 1000, 4160]
));
children.push(spacer());

children.push(pageBreak());

// ===== 11. CONFIGURATION =====
children.push(heading1('11. Configuration & Data Files'));

children.push(heading2('Environment Variables'));
children.push(makeTable(
  ['Variable', 'Default', 'Purpose'],
  [
    ['GEMINI_API_KEY', '(none)', 'Required. Google Gemini API key for AI generation'],
    ['PORT', '3000', 'HTTP server port'],
  ],
  [3000, 1800, 4560]
));
children.push(spacer());

children.push(heading2('Seller Profile (default-seller.json)'));
children.push(body('Pre-configured for Aera Technology. Editable via Settings screen. Includes:'));
children.push(bulletItem('Company name, tagline, description'));
children.push(bulletItem('Capabilities by domain (Supply Chain, Finance, Procurement, etc.)'));
children.push(bulletItem('Key differentiators (real-time decisioning, closed-loop execution, etc.)'));
children.push(bulletItem('Competitor profiles with weaknesses (Kinaxis, SAP IBP, o9, Blue Yonder, etc.)'));
children.push(bulletItem('Value metrics (inventory cost reduction, forecast accuracy improvement, etc.)'));
children.push(bulletItem('Ideal Customer Profile definition'));

children.push(heading2('Aera Way Methodology (aera-way-methodology.json)'));
children.push(body('Sales methodology framework injected into strategy and risk prompts:'));
children.push(bulletItem('Deal stages: New/Cold through Negotiation with exit criteria'));
children.push(bulletItem('What Good Looks Like: Day 30/60/90 outcomes'));
children.push(bulletItem('Engagement principles'));
children.push(bulletItem('Key milestones with validation criteria'));
children.push(bulletItem('Risk framework by category (Organizational, Technical, Competitive, Commercial)'));
children.push(bulletItem('Objection handling playbook'));
children.push(bulletItem('Competitive positioning vs point solutions, consulting, build-your-own, ERP vendor AI'));

children.push(heading2('Aera Content Library (aera-content.json)'));
children.push(body('Content assets used in outreach email generation:'));
children.push(bulletItem('Upcoming events (dates, locations, registration URLs)'));
children.push(bulletItem('Analyst recognition (Gartner, Forrester reports)'));
children.push(bulletItem('Customer success stories with use cases'));
children.push(bulletItem('Whitepapers filtered by industry'));
children.push(bulletItem('Blog posts filtered by topic'));
children.push(bulletItem('Demo scheduling URL'));

children.push(pageBreak());

// ===== 12. KEY DESIGN DECISIONS =====
children.push(heading1('12. Key Design Decisions'));

children.push(heading2('Why Vanilla JavaScript (No Framework)?'));
children.push(bulletItem('Zero build step: edit and reload instantly'));
children.push(bulletItem('No dependency management or version conflicts'));
children.push(bulletItem('Entire codebase is 5,719 lines across 18 files - manageable without a framework'));
children.push(bulletItem('All modules use the AP namespace pattern for clean encapsulation'));
children.push(bulletItem('Priority was rapid iteration over architectural purity'));

children.push(heading2('Why Gemini 2.5 Flash (Not GPT-4 or Claude)?'));
children.push(bulletItem('Native Google Search grounding: real-time company data without separate API'));
children.push(bulletItem('JSON mode with responseMimeType ensures structured output'));
children.push(bulletItem('Fast inference speed critical for 7-call pipeline (~2 min total)'));
children.push(bulletItem('Cost-effective for batch processing of 383+ accounts'));
children.push(bulletItem('Generous token limits (up to 16K output) for comprehensive plans'));

children.push(heading2('Why Client-Side Word Generation?'));
children.push(bulletItem('No server-side office dependencies (no LibreOffice, no Python)'));
children.push(bulletItem('docx.js runs entirely in browser, works on any deployment'));
children.push(bulletItem('Full control over formatting, branding, and table layouts'));
children.push(bulletItem('Same code path for UI and batch exports ensures consistency'));

children.push(heading2('Why Sequential (Not Parallel) AI Calls?'));
children.push(bulletItem('Each call builds on prior context (stakeholders need overview, strategy needs everything)'));
children.push(bulletItem('Progressive enrichment produces more coherent plans'));
children.push(bulletItem('Grounded calls cannot share context - must run sequentially'));
children.push(bulletItem('Token limits would be exceeded if all context sent in one call'));

children.push(heading2('Why Browser-Based Batch Orchestration?'));
children.push(bulletItem('Reuses exact same generation + export code as UI'));
children.push(bulletItem('No separate batch script to maintain'));
children.push(bulletItem('Visual progress monitoring in real-time'));
children.push(bulletItem('Can pause/resume at any point'));

children.push(heading2('Concise AI Output Strategy'));
children.push(body('All prompts enforce strict word limits per field to ensure Word export tables render cleanly:'));
children.push(makeTable(
  ['Field', 'Constraint', 'Rationale'],
  [
    ['Engagement Strategy', '1-2 sentences, max 40 words', 'Fits Approach column (4200 DXA)'],
    ['Seller Advantage', '1-2 sentences, max 30 words', 'Fits Advantage column (6360 DXA)'],
    ['Risk Description', '1 short sentence', 'Fits Risk column (2800 DXA)'],
    ['Risk Mitigation', '1-2 sentences, max 40 words', 'Fits Mitigation column (4960 DXA)'],
    ['Action Items', '1 sentence, max 20 words', 'Fits Action column (6400 DXA)'],
    ['Executive Pitch', '2-3 sentences, max 60 words', 'Callout block with left blue border'],
  ],
  [2200, 3200, 3960]
));
children.push(spacer());

// ===== FOOTER NOTE =====
children.push(spacer(400));
children.push(new Paragraph({
  children: [new TextRun({ text: 'End of Technical Specification', italics: true, size: 20, font: FONT, color: TEXT_MUTED })],
  alignment: AlignmentType.CENTER,
  border: { top: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 8 } },
  spacing: { before: 200, after: 200 }
}));
children.push(new Paragraph({
  children: [new TextRun({ text: 'Aera Technology, Inc. Confidential | April 2026', size: 18, font: FONT, color: TEXT_MUTED })],
  alignment: AlignmentType.CENTER
}));

// ===================== ASSEMBLE =====================

const headerChildren = [];
if (logoData) {
  headerChildren.push(new ImageRun({
    type: 'png', data: logoData,
    transformation: { width: 76, height: 30 },
    altText: { title: 'Aera Technology', description: 'Aera Technology Logo', name: 'aera-logo' }
  }));
}

const doc = new Document({
  numbering: {
    config: [
      { reference: 'bullets',
        levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: '\u25E6', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1080, hanging: 360 } } } }
        ]
      },
      { reference: 'numbers',
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
      }
    ]
  },
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } }
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          children: headerChildren,
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 4 } },
          spacing: { after: 200 }
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          children: [
            new TextRun({ text: 'Aera Technology, Inc. Confidential', font: FONT, size: 16, color: TEXT_MUTED }),
            new TextRun({ text: '\t', font: FONT, size: 16 }),
            new TextRun({ text: 'Page ', font: FONT, size: 16, color: TEXT_MUTED }),
            new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: TEXT_MUTED })
          ],
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 4 } },
          tabStops: [{ type: TabStopType.RIGHT, position: 9360 }]
        })]
      })
    },
    children
  }]
});

const outPath = path.join(__dirname, 'Account Plan Generator - Technical Specification.docx');
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outPath, buffer);
  console.log('Technical Specification created at:', outPath);
  console.log('Size:', Math.round(buffer.length / 1024), 'KB');
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
