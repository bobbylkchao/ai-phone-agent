#!/bin/bash

set -e

BRANCH=$1

if [ -z "$BRANCH" ]; then
  echo "❌ Error: Branch name is required"
  echo "Usage: bash deploy.sh <branch-name>"
  exit 1
fi

echo "🚀 Starting deployment..."
echo "🌿 Branch: $BRANCH"

echo "🧹 Cleaning local changes to ensure pure git tree..."
git fetch origin

echo "🔄 Resetting all local changes..."
git reset --hard HEAD

echo "🗑️  Removing untracked files..."
git clean -fd

echo "📥 Checking out branch: $BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
git pull

echo "🔧 Installing dependencies..."
npm ci

echo "🔨 Building..."
npm run build

echo "🔄 Managing service via pm2..."

if pm2 list 2>/dev/null | grep -q "ai-phone-agent-service"; then
    echo "✅ Service exists, restarting..."
    pm2 restart ai-phone-agent-service || {
        echo "⚠️  Warning: Failed to restart, trying delete and start fresh..."
        pm2 delete ai-phone-agent-service 2>/dev/null || true
        pm2 start dist/index.js --name ai-phone-agent-service || {
          echo "⚠️  Warning: Failed to start with dist/index.js, trying npm start..."
          pm2 start npm --name ai-phone-agent-service -- start
        }
    }
else
    echo "🚀 Service not found, starting..."
    pm2 start dist/index.js --name ai-phone-agent-service || {
      echo "⚠️  Warning: Failed to start with dist/index.js, trying npm start..."
      pm2 start npm --name ai-phone-agent-service -- start
    }
fi

echo "📊 Verifying pm2 status..."
SERVICE_STATUS=$(pm2 list 2>/dev/null | grep "ai-phone-agent-service" || echo "")

if [ -z "$SERVICE_STATUS" ]; then
    echo "❌ Error: 'ai-phone-agent-service' not found in pm2"
    exit 1
fi

pm2 save

echo "📋 Service status:"
pm2 list 2>/dev/null | grep "ai-phone-agent-service"

if echo "$SERVICE_STATUS" | grep -q "online"; then
    echo "✅ Service is running"
else
    echo "❌ Error: Service is not online"
    echo "$SERVICE_STATUS"
    exit 1
fi
