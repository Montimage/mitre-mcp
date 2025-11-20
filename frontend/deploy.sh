#!/bin/bash
# Netlify Deployment Script for MITRE ATT&CK Intelligence Assistant
#
# This script builds and deploys the application to Netlify

set -e  # Exit on error

echo "========================================="
echo "MITRE ATT&CK Intelligence Assistant"
echo "Netlify Deployment Script"
echo "========================================="
echo ""

# Check if we're in the frontend directory
if [ ! -f "package.json" ]; then
    echo "Error: Must be run from the frontend directory"
    exit 1
fi

# Check if Netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo "Netlify CLI not found. Installing..."
    npm install -g netlify-cli
fi

# Clean previous build
echo "Cleaning previous build..."
rm -rf dist

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the project
echo "Building production bundle..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "Error: Build failed - dist directory not found"
    exit 1
fi

echo ""
echo "Build successful!"
echo "Bundle size:"
du -sh dist

echo ""
echo "========================================="
echo "Deployment Options:"
echo "========================================="
echo ""
echo "1. Deploy to Netlify (Production)"
echo "   Command: netlify deploy --prod --dir=dist"
echo ""
echo "2. Deploy to Netlify (Draft/Preview)"
echo "   Command: netlify deploy --dir=dist"
echo ""
echo "3. Auto-deploy (if site already linked)"
echo "   Command: netlify deploy --prod"
echo ""
echo "========================================="
echo ""

# Ask user which deployment method
read -p "Deploy to production now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Deploying to production..."
    netlify deploy --prod --dir=dist
else
    echo "Build complete. Deploy manually when ready:"
    echo "  netlify deploy --prod --dir=dist"
fi
