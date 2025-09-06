#!/usr/bin/env python3
"""
Simple HTTP server for testing the ASK Foreman site locally
"""

import http.server
import socketserver
import os
import sys
from urllib.parse import urlparse

PORT = 8080

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers for local testing
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
    
    def log_message(self, format, *args):
        # Custom logging with colors
        message = format % args
        if "404" in message:
            print(f"\033[91m{message}\033[0m")
        elif "200" in message:
            print(f"\033[92m{message}\033[0m")
        else:
            print(message)

if __name__ == "__main__":
    # Change to the script directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    Handler = CustomHTTPRequestHandler
    
    print(f"\033[96m╔══════════════════════════════════════════╗\033[0m")
    print(f"\033[96m║     ASK Foreman Local Test Server        ║\033[0m")
    print(f"\033[96m╚══════════════════════════════════════════╝\033[0m")
    print(f"\n\033[93m🚀 Starting server on http://localhost:{PORT}\033[0m")
    print(f"\033[92m✓ Server directory: {os.getcwd()}\033[0m")
    print("\n\033[94mAvailable pages:\033[0m")
    print("  • http://localhost:8080/estimator.html - Main Estimator (with fixes)")
    print("  • http://localhost:8080/view-takeoffs.html - View-only Takeoff Tool")
    print("  • http://localhost:8080/projects.html - Projects Page")
    print("  • http://localhost:8080/admin.html - Admin Dashboard")
    print("\n\033[93mPress Ctrl+C to stop the server\033[0m")
    print("\033[90m" + "─" * 45 + "\033[0m\n")
    
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n\033[91m✋ Server stopped\033[0m")
        sys.exit(0)
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"\n\033[91m❌ Port {PORT} is already in use!\033[0m")
            print(f"\033[93mTry: lsof -i :{PORT} to see what's using it\033[0m")
        else:
            print(f"\n\033[91m❌ Error: {e}\033[0m")
        sys.exit(1)
