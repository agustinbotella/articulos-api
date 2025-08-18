const express = require('express');
const path = require('path');

const app = express();
const PORT = 3001;

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname)));

// Serve the test SPA at the root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-spa.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🌐 Frontend Test Server running at http://localhost:${PORT}`);
  console.log(`📋 Test Dashboard: http://localhost:${PORT}`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
}); 