require('dotenv').config();
const express = require('express');
const sharp = require('sharp');
const axios = require('axios');

const app = express();
app.use(express.json());

// Parse API_KEY as JSON for multiple keys
let API_KEYS = {};
try {
  API_KEYS = JSON.parse(process.env.API_KEY);
} catch (e) {
  API_KEYS = { default: process.env.API_KEY };
}

const IMAGE_WIDTH = 1000;
const IMAGE_HEIGHT = Math.round((9 / 16) * IMAGE_WIDTH);

// API Documentation Route
app.get('/', (req, res) => {
  const docs = `CREDIT OVERLAY API DOCUMENTATION
=====================================

This API allows you to add text overlay to credit with customizable styling.

ENDPOINT
--------
POST /credit-overlay
Content-Type: application/json

All parameters must be sent in the request body as JSON.

REQUIRED PARAMETERS (in request body)
-----------------------------------
api_key    : Your API key for authentication
url        : Public URL of the image to process
text       : Text to overlay on the image (max 254 characters)

CSS STYLING OPTIONS (in request body)
-----------------------------------
Property           Description                                    Default
---------          -----------                                    -------
fontSize           Font size in pixels                            22
fontWeight         Font weight                                    normal
fontFamily         Font family                                    sans-serif
color              Text color                                     white
backgroundColor    Background color                               black
opacity            Background opacity (0-1)                       0.6
padding            Padding in CSS format: 1, 2, 3, or 4 values    12px 25px 12px 15px
                   (top [right [bottom [left]]])
                   Examples: '20px' (all), '20px 30px' (T/B, R/L), '20px 30px 10px' (T, R/L, B), '20px 30px 10px 40px' (T, R, B, L)
borderRadius       Border radius in pixels                        0
textShadow         Text shadow (x-offset y-offset blur color)     3px 3px 6px rgba(0,0,0,1)
boxShadow          Box shadow (x-offset y-offset blur color)      none

RICH TEXT SUPPORT
-----------------
- Bold:   **text** or __text__
- Italic: *text* or _text_

EXAMPLE REQUESTS
---------------

1. Basic Usage with Default Styling:
Request Body:
{
  "api_key": "your-api-key",
  "url": "https://example.com/image.jpg",
  "text": "Hello World!"
}

2. Custom Padding Example:
Request Body:
{
  "api_key": "your-api-key",
  "url": "https://example.com/image.jpg",
  "text": "Hello **World**!",
  "css": {
    "padding": "20px 40px 20px 10px"
  }
}

3. Complete Styling Example:
Request Body:
{
  "api_key": "your-api-key",
  "url": "https://example.com/image.jpg",
  "text": "Hello *World*!",
  "css": {
    "fontSize": "28",
    "fontWeight": "bold",
    "fontFamily": "Arial",
    "color": "#FFFFFF",
    "backgroundColor": "#000000",
    "opacity": 0.7,
    "padding": "12px 25px 12px 15px",
    "borderRadius": "4",
    "textShadow": "3px 3px 6px rgba(0,0,0,1)",
    "boxShadow": "2px 2px 4px rgba(0,0,0,0.5)"
  }
}

RESPONSE FORMAT
--------------
Success:
- Content-Type: image/jpeg
- Returns the processed image directly

Error:
- Content-Type: application/json
- Format:
{
  "error": "Error message",
  "details": "Detailed error information (if available)"
}

ERROR CODES
----------
400 - Bad Request: Missing required parameters or invalid URL format
400 - Bad Request: Text length exceeds maximum limit of 254 characters
403 - Unauthorized: Invalid API key
500 - Internal Server Error: Processing failed
`;

  res.set('Content-Type', 'text/plain');
  res.send(docs);
});

// URL validation function
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Helper: Parse text for bold, italic and return SVG tspans (no underline)
function parseRichTextToTspans(text, baseStyle = {}) {
  // Regex for **bold** or __bold__
  const boldRegex = /\*\*(.*?)\*\*|__(.*?)__/g;
  // Regex for *italic* or _italic_
  const italicRegex = /\*(.*?)\*|_(.*?)_/g;

  // Remove <u> tags if present (treat as plain text)
  text = text.replace(/<u>(.*?)<\/u>/g, '$1');

  // Replace bold with a unique marker (no underscore)
  let boldMap = [];
  text = text.replace(boldRegex, (m, b1, b2) => {
    const b = b1 || b2;
    boldMap.push(b);
    return `[[BOLD${boldMap.length - 1}]]`;
  });

  // Replace italic with a unique marker (no underscore)
  let italicMap = [];
  text = text.replace(italicRegex, (m, i1, i2) => {
    const i = i1 || i2;
    italicMap.push(i);
    return `[[ITALIC${italicMap.length - 1}]]`;
  });

  // Split by markers, but preserve all text (including spaces)
  const parts = text.split(/(\[\[(?:BOLD|ITALIC)\d+\]\])/g).filter(part => part !== undefined);
  const tspans = [];
  for (const part of parts) {
    let style = { ...baseStyle };
    let content = part;
    if (/\[\[BOLD\d+\]\]/.test(part)) {
      const idx = parseInt(part.match(/\d+/)[0]);
      style.fontWeight = 'bold';
      content = boldMap[idx];
    } else if (/\[\[ITALIC\d+\]\]/.test(part)) {
      const idx = parseInt(part.match(/\d+/)[0]);
      style.fontStyle = 'italic';
      content = italicMap[idx];
    }
    // SVG style string
    let styleStr = '';
    if (style.fontWeight) styleStr += `font-weight:${style.fontWeight};`;
    if (style.fontStyle) styleStr += `font-style:${style.fontStyle};`;
    tspans.push(`<tspan style="${styleStr}" xml:space="preserve">${content}</tspan>`);
  }
  return tspans.join('');
}

// Generate SVG label with accurate text measurement
async function generateMeasuredSvg(text, css = {}) {
  const fontSize = parseInt(css.fontSize || '20');
  const fontWeight = css.fontWeight || 'normal';
  const fontFamily = css.fontFamily || 'sans-serif';
  const textColor = css.color || 'white';
  const bgColor = css.backgroundColor || 'black';
  const opacity = css.opacity ?? 0.6;

  // Parse up to 4 padding values (CSS style: T R B L)
  const paddingValues = (css.padding || '12px 25px 12px 15px').split(' ').map(p => parseInt(p));
  let [pt, pr, pb, pl] = [12, 15, 12, 15]; // defaults
  if (paddingValues.length === 1) {
    pt = pr = pb = pl = paddingValues[0];
  } else if (paddingValues.length === 2) {
    pt = pb = paddingValues[0];
    pr = pl = paddingValues[1];
  } else if (paddingValues.length === 3) {
    pt = paddingValues[0];
    pr = pl = paddingValues[1];
    pb = paddingValues[2];
  } else if (paddingValues.length === 4) {
    [pt, pr, pb, pl] = paddingValues;
  }

  const borderRadius = css.borderRadius || 0;
  const margin = 0;
  const position = 'bottom-right';

  // Shadow properties
  const textShadow = css.textShadow || '3px 3px 6px rgba(0,0,0,1)';
  const boxShadow = css.boxShadow || 'none';

  // Parse text shadow values
  let shadowValues = {};
  if (textShadow !== 'none') {
    const shadowMatch = textShadow.match(/(-?\d+)px\s+(-?\d+)px\s+(\d+)px\s+(.+)/);
    if (shadowMatch) {
      shadowValues = {
        dx: parseInt(shadowMatch[1]),
        dy: parseInt(shadowMatch[2]),
        blur: parseInt(shadowMatch[3]),
        color: shadowMatch[4]
      };
    }
  }

  // Step 1: Measure text width via Sharp (strip markup for measurement)
  const plainText = text
    .replace(/<u>(.*?)<\/u>/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1');
  const rawSvg = `
    <svg xmlns="http://www.w3.org/2000/svg">
      <style>
        .label {
          font-size: ${fontSize}px;
          font-family: ${fontFamily};
          font-weight: ${fontWeight};
        }
      </style>
      <text class="label">${plainText}</text>
    </svg>
  `;
  const textBuffer = Buffer.from(rawSvg);
  const { width: textWidth, height: textHeight } = await sharp(textBuffer).png().metadata();

  const rectWidth = textWidth + pl + pr;
  const rectHeight = textHeight + pt + pb;

  const x = IMAGE_WIDTH - rectWidth;
  const y = IMAGE_HEIGHT - rectHeight;

  // Rich text SVG tspans
  const tspans = parseRichTextToTspans(text, { fontWeight });

  const finalSvg = `
    <svg width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="textShadow" x="-50%" y="-50%" width="200%" height="200%">
          ${textShadow !== 'none' ? `
          <feDropShadow 
            dx="${shadowValues.dx || 0}"
            dy="${shadowValues.dy || 0}"
            stdDeviation="${shadowValues.blur ? shadowValues.blur/2 : 0}"
            flood-color="${shadowValues.color || 'black'}"
            flood-opacity="1"
          />` : ''}
        </filter>
        <filter id="boxShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow ${boxShadow !== 'none' ? `dx="2" dy="2" stdDeviation="2" flood-color="black" flood-opacity="0.5"` : ''}/>
        </filter>
      </defs>
      <style>
        .label {
          fill: ${textColor};
          font-size: ${fontSize}px;
          font-family: ${fontFamily};
          font-weight: ${fontWeight};
          filter: ${textShadow !== 'none' ? 'url(#textShadow)' : 'none'};
        }
        .bg {
          fill: ${bgColor};
          opacity: ${opacity};
          filter: ${boxShadow !== 'none' ? 'url(#boxShadow)' : 'none'};
        }
      </style>
      <rect x="${x}" y="${y}" width="${rectWidth}" height="${rectHeight}" rx="${borderRadius}" class="bg"/>
      <text x="${x + pl}" y="${y + rectHeight - pb}" class="label">${tspans}</text>
    </svg>
  `;

  return Buffer.from(finalSvg);
}

// Main API
app.post('/credit-overlay', async (req, res) => {
  const { api_key, url, text, css } = req.body;

  // Find caller name by API key
  const callerName = Object.keys(API_KEYS).find(name => API_KEYS[name] === api_key);
  if (!callerName) return res.status(403).json({ error: 'Unauthorized' });

  if (!url || !text) return res.status(400).json({ error: 'Missing url or text' });
  if (!isValidUrl(url)) return res.status(400).json({ error: 'Invalid URL format' });
  if (text.length > 254) return res.status(400).json({ error: 'Text length exceeds maximum limit of 254 characters' });

  const now = new Date();
  console.log(`\n[credit-overlay] Request received:`);
  console.log(`  Date:   ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`);
  console.log(`  ISO:    ${now.toISOString()}`);
  console.log(`  Caller: ${callerName}`);
  console.log(`  URL:    ${url}`);
  console.log(`  Text:   ${text}`);
  console.log(`  CSS:    ${JSON.stringify(css)}`);

  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const inputBuffer = Buffer.from(response.data);

    const labelBuffer = await generateMeasuredSvg(text, css);

    const outputBuffer = await sharp(inputBuffer)
      .resize(IMAGE_WIDTH, IMAGE_HEIGHT)
      .composite([{ input: labelBuffer, top: 0, left: 0 }])
      .jpeg()
      .toBuffer();

    // Return the processed image buffer directly
    res.set('Content-Type', 'image/jpeg');
    res.send(outputBuffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Processing failed', details: err.message });
  }
});

// Catch-all for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: 'Path not found' });
});

app.listen(3000, () => {
  console.log('Image service running on port 3000');
});