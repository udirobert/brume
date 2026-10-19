#!/bin/bash

echo "🔍 Production Backend Diagnostic for api.brume.trustfall.xyz"
echo "=========================================================="

# Test the current frontend URL
echo "1. Testing Frontend URL (HTTPS):"
curl -v -X OPTIONS \
  -H "Origin: https://brumeapp.netlify.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  https://api.brume.trustfall.xyz/api/ai-analysis 2>&1 | head -20

echo -e "\n2. Testing HTTP version:"
curl -v -X OPTIONS \
  -H "Origin: https://brumeapp.netlify.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  http://api.brume.trustfall.xyz/api/ai-analysis 2>&1 | head -20

echo -e "\n3. Testing Direct Port Access:"
curl -v -X OPTIONS \
  -H "Origin: https://brumeapp.netlify.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  http://157.180.36.156:8001/api/ai-analysis 2>&1 | head -20

echo -e "\n4. Testing Health Endpoints:"
echo "HTTPS Health:"
curl -s https://api.brume.trustfall.xyz/health || echo "HTTPS health failed"

echo "HTTP Health:"
curl -s http://api.brume.trustfall.xyz/health || echo "HTTP health failed"

echo "Direct Port Health:"
curl -s http://157.180.36.156:8001/health || echo "Direct port health failed"

echo -e "\n5. DNS Resolution:"
nslookup api.brume.trustfall.xyz

echo -e "\n🎯 Run this script to diagnose the current state"