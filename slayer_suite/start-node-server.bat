@echo off
echo Starting local web server for Slayer Suite using Node.js...
echo.
echo If this fails, install http-server globally with: npm install -g http-server
echo.
echo Server will run at: http://localhost:8080
echo Press Ctrl+C to stop the server
echo.
npx http-server -p 8080 -c-1