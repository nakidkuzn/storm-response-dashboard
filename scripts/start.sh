#!/bin/bash

echo "🚀 Starting Storm Response Dashboard..."
echo "======================================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please run install.sh first or copy .env.example to .env"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 node_modules not found. Installing dependencies..."
    npm install
fi

echo "✅ Starting server..."
npm start
