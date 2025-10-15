#!/bin/bash

echo "🌪️  Storm Response Dashboard - Installation Script"
echo "=================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16 or higher."
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

echo "✅ npm version: $(npm -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created. Please configure your API keys in the .env file."
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🎉 Installation completed!"
echo ""
echo "Next steps:"
echo "1. Edit the .env file with your API credentials"
echo "2. Run: npm start"
echo "3. Open: http://localhost:3000"
echo ""
echo "For ViKi Stream Dock:"
echo "Configure buttons with: http://YOUR_SERVER_IP:3000/api/viki/storm-dashboard/3"
