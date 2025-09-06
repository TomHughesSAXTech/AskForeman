#!/bin/bash

# ASK Foreman Local Test Launcher
# This script starts a local server and opens the site in your browser

echo "╔══════════════════════════════════════════╗"
echo "║     ASK Foreman Local Test Server        ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "🚀 Starting local server on http://localhost:8080"
echo ""
echo "Available pages:"
echo "  • http://localhost:8080/estimator.html - Enhanced Estimator with all fixes"
echo "  • http://localhost:8080/view-takeoffs.html - View-only Takeoff Tool"
echo "  • http://localhost:8080/projects.html - Projects Page"
echo "  • http://localhost:8080/admin.html - Admin Dashboard"
echo ""
echo "Press Ctrl+C to stop the server"
echo "─────────────────────────────────────────────"
echo ""

# Open browser after a short delay
(sleep 2 && open http://localhost:8080/estimator.html) &

# Start the server
python3 -m http.server 8080
