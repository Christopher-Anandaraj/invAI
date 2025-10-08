# Security Guidelines

## API Key Management

### Best Practices
1. **Never commit API keys or secrets to the repository**
   - Use `.env` files for local development
   - Add `.env` to `.gitignore`
   - Use environment variables in production

2. **Server-side vs Client-side**
   - **NEVER** use `NEXT_PUBLIC_` prefix for API keys or secrets
   - `NEXT_PUBLIC_` variables are bundled in client-side JavaScript and exposed to browsers
   - All sensitive API calls must go through server-side routes (e.g., `/api/*`)

3. **Logging**
   - Do not log API responses that may contain sensitive information
   - Do not log URLs that contain API keys
   - Be careful with error messages that might expose credentials

4. **URL Parameters**
   - While some APIs (like Google's Gemini API) require API keys in URL parameters, this is acceptable when:
     - The request is made from server-side code only
     - The URL is not logged
     - The response is not logged in full

## Current Implementation

### Client-side Code
- ✅ No API keys are exposed to the browser
- ✅ All Gemini API calls are routed through `/api/asset-insights`
- ✅ Client code uses server-side endpoints only

### Server-side Code
- ✅ API keys are loaded from environment variables
- ✅ No credentials are printed or logged
- ✅ API responses are not logged in full

## Environment Variables

Required environment variables are documented in `.env.example`. Copy this file to `.env` and fill in your credentials:

```bash
cp .env.example .env
# Edit .env with your credentials
```

## Reporting Security Issues

If you discover a security vulnerability, please report it to the repository maintainers immediately.
