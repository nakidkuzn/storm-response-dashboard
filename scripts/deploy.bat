@echo off
echo 🚀 Storm Response Dashboard - Windows Deployment
echo ==============================================

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js 16 or higher.
    pause
    exit /b 1
)

echo ✅ Node.js version:
node --version

:: Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm is not installed. Please install npm.
    pause
    exit /b 1
)

echo ✅ npm version:
npm --version

:: Install dependencies
echo 📦 Installing dependencies...
npm install

if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

:: Create .env file if it doesn't exist
if not exist ".env" (
    echo 📝 Creating .env file from template...
    copy .env.example .env >nul
    echo ✅ .env file created. Please configure your API keys in the .env file.
) else (
    echo ✅ .env file already exists
)

echo.
echo 🎉 Installation completed!
echo.
echo Next steps:
echo 1. Edit the .env file with your API credentials
echo 2. Run: npm start
echo 3. Open: http://localhost:3000
echo.
echo For ViKi Stream Dock:
echo Configure buttons with: http://YOUR_SERVER_IP:3000/api/viki/storm-dashboard/3
echo.
pause
