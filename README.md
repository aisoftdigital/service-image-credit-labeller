# Credit Overlay API Documentation

## Sample .env file
```env
# Example .env file for Credit Overlay API
API_KEY={ "alice":"11111111111111111111111111111111", "bob":"22222222222222222222222222222222" }
# Add any other environment variables here if needed
```

This API allows you to add text overlay to credit with customizable styling.

## ENDPOINT
POST /credit-overlay
Content-Type: application/json

All parameters must be sent in the request body as JSON.

## REQUIRED PARAMETERS (in request body)
- **api_key**: Your API key for authentication
- **url**: Public URL of the image to process
- **text**: Text to overlay on the image (max 254 characters)

## CSS STYLING OPTIONS (in request body)
| Property         | Description                                      | Default                |
|------------------|--------------------------------------------------|------------------------|
| fontSize         | Font size in pixels                              | 22                     |
| fontWeight       | Font weight                                      | normal                 |
| fontFamily       | Font family                                      | sans-serif             |
| color            | Text color                                       | white                  |
| backgroundColor  | Background color                                 | black                  |
| opacity          | Background opacity (0-1)                         | 0.6                    |
| padding          | Padding in CSS format: 1, 2, 3, or 4 values      | 12px 25px 12px 15px    |
|                  | (top [right [bottom [left]]])                    |                        |
|                  | Examples: '20px' (all), '20px 30px' (T/B, R/L),  |                        |
|                  | '20px 30px 10px' (T, R/L, B),                    |                        |
|                  | '20px 30px 10px 40px' (T, R, B, L)               |                        |
| borderRadius     | Border radius in pixels                          | 0                      |
| textShadow       | Text shadow (x-offset y-offset blur color)        | 3px 3px 6px rgba(0,0,0,1) |
| boxShadow        | Box shadow (x-offset y-offset blur color)         | none                   |

## RICH TEXT SUPPORT
- **Bold**:   `**text**` or `__text__`
- *Italic*: `*text*` or `_text_`

## EXAMPLE REQUESTS

### 1. Basic Usage with Default Styling
```json
{
  "api_key": "your-api-key",
  "url": "https://example.com/image.jpg",
  "text": "Hello World!"
}
```

### 2. Custom Padding Example
```json
{
  "api_key": "your-api-key",
  "url": "https://example.com/image.jpg",
  "text": "Hello **World**!",
  "css": {
    "padding": "20px 40px 20px 10px"
  }
}
```

### 3. Complete Styling Example
```json
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
```

## RESPONSE FORMAT
**Success:**
- Content-Type: image/jpeg
- Returns the processed image directly

**Error:**
- Content-Type: application/json
- Format:
```json
{
  "error": "Error message",
  "details": "Detailed error information (if available)"
}
```

## ERROR CODES
- 400 - Bad Request: Missing required parameters or invalid URL format
- 400 - Bad Request: Text length exceeds maximum limit of 254 characters
- 403 - Unauthorized: Invalid API key
- 500 - Internal Server Error: Processing failed 