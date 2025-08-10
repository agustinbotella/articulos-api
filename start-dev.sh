#!/bin/bash

# Development startup script for Articulos API
echo "🚀 Starting Articulos API Development Environment..."

# Function to kill background processes on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $API_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set up trap to cleanup on exit
trap cleanup INT TERM

# Start API server in background
echo "📡 Starting API server on port 3000..."
node index.js &
API_PID=$!

# Wait a moment for API to start
sleep 2

# Start frontend server in background
echo "🌐 Starting frontend server on port 3001..."
cd frontend
node server.js &
FRONTEND_PID=$!
cd ..

# Wait a moment for frontend to start
sleep 2

echo ""
echo "✅ Both servers are running!"
echo "🔗 Frontend: http://localhost:3001"
echo "📡 API: http://localhost:3000"
echo "🔐 API Key is securely managed by the frontend server"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user interrupt
wait 