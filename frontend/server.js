const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    // Remove query parameters for file path
    let requestPath = req.url.split('?')[0];
    
    // Default to index.html for root
    if (requestPath === '/') {
        requestPath = '/index.html';
    }
    
    const filePath = path.join(__dirname, 'public', requestPath);
    const ext = path.extname(filePath);
    
    // Determine content type
    let contentType = 'text/plain';
    switch (ext) {
        case '.html': contentType = 'text/html'; break;
        case '.js': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
        case '.json': contentType = 'application/json'; break;
        case '.png': contentType = 'image/png'; break;
        case '.jpg': 
        case '.jpeg': contentType = 'image/jpeg'; break;
        case '.svg': contentType = 'image/svg+xml'; break;
        case '.ico': contentType = 'image/x-icon'; break;
    }
    
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle OPTIONS requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    console.log(`${req.method} ${req.url} -> ${filePath}`);
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            console.error(`Error reading file ${filePath}:`, err.message);
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(`
                <!DOCTYPE html>
                <html>
                <head><title>404 - Not Found</title></head>
                <body>
                    <h1>404 - File Not Found</h1>
                    <p>The requested file <code>${requestPath}</code> was not found.</p>
                    <p><a href="/">Go back to home</a></p>
                </body>
                </html>
            `);
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        }
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`🚀 Frontend server running at http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${path.join(__dirname, 'public')}`);
    console.log(`🔗 Available pages:`);
    console.log(`   - http://localhost:${PORT}/ (Landing page)`);
    console.log(`   - http://localhost:${PORT}/articles.html (Articles search)`);
    console.log(`   - http://localhost:${PORT}/aplicaciones.html (Applications browser)`);
}); 