#!/bin/bash

# Deploy RevenueCat Configuration to Hetzner Backend
# This script updates the running Docker container with RevenueCat support

set -e

echo "🚀 Deploying RevenueCat configuration to Hetzner backend..."

# Copy files to server
echo "📁 Copying RevenueCat configuration files..."
scp revenuecat_config.py snel-bot:/tmp/revenuecat_config.py
scp main.py snel-bot:/tmp/main.py

# Update the running container
echo "🔄 Updating Docker container..."
ssh snel-bot << 'EOF'
# Stop the current container
docker stop vision-service_vision-service_1 || true

# Copy new files into the container
docker cp /tmp/revenuecat_config.py vision-service_vision-service_1:/app/revenuecat_config.py
docker cp /tmp/main.py vision-service_vision-service_1:/app/main.py

# Start the container
docker start vision-service_vision-service_1

# Wait for container to be ready
sleep 10

# Test the RevenueCat endpoint
echo "🧪 Testing RevenueCat endpoint..."
curl -s http://localhost:8001/api/config/revenuecat || echo "Endpoint not ready yet"

echo "✅ Deployment complete!"
EOF

echo "🎉 RevenueCat configuration deployed successfully!"
echo "🔗 Test endpoint: https://api.brume.trustfall.xyz/api/config/revenuecat"
