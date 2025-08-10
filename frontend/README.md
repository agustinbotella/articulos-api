# Frontend Server Setup

This frontend server acts as a secure proxy to the API, keeping the API key hidden from client-side code.

## How It Works

1. **Frontend Server** (Port 3001) - Serves static files and proxies API requests
2. **API Server** (Port 3000) - The actual API with authentication
3. **Proxy Pattern** - Frontend calls `/api/*` which gets proxied to the API with authentication

## Configuration

### 1. Set the API Key in the Frontend Server

Edit `server.js` and update the API key:

```javascript
const API_KEY = 'your-actual-api-key-here';
```

### 2. Start Both Servers

```bash
# Terminal 1: Start the API server
npm start

# Terminal 2: Start the frontend server  
cd frontend
node server.js
```

### 3. Access the Frontend

Open your browser to: `http://localhost:3001`

## API Proxy Routes

The frontend server automatically proxies these requests:

- `GET /api/articles` → `GET http://localhost:3000/articles` (with API key)
- `GET /api/aplicaciones` → `GET http://localhost:3000/aplicaciones` (with API key)  
- `GET /api/familias` → `GET http://localhost:3000/familias` (with API key)

## Security Benefits

✅ **API key never exposed** - Stays on the server side only
✅ **No CORS issues** - All requests go through same domain
✅ **Simple frontend code** - No authentication headers needed
✅ **Production ready** - Can easily add more security layers

## Frontend Code Example

```javascript
// Old way (API key exposed)
fetch('http://localhost:3000/articles?search=motor', {
    headers: { 'X-API-Key': 'secret-key' }
})

// New way (secure proxy)
fetch('/api/articles?search=motor')
```

## Production Deployment

For production:

1. Set API_KEY as environment variable
2. Use HTTPS
3. Add rate limiting  
4. Add authentication for admin users 