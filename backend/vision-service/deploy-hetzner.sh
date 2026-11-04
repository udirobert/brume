#!/bin/bash
set -e

echo "🚀 Deploying Vision Service to Hetzner Server"

# Configuration
SERVER_HOST="${HETZNER_SERVER_HOST:-your-server.com}"
SERVER_USER="${HETZNER_SERVER_USER:-root}"
DEPLOY_PATH="/opt/vision-service"
SERVICE_NAME="vision-service"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check required environment variables
if [ -z "$SERVER_HOST" ] || [ -z "$SERVER_USER" ]; then
    print_error "Please set HETZNER_SERVER_HOST and HETZNER_SERVER_USER environment variables"
    exit 1
fi

print_status "Deploying to $SERVER_USER@$SERVER_HOST"

# Create deployment package
print_status "Creating deployment package..."
tar -czf vision-service.tar.gz \
    main.py \
    webhook_handler.py \
    cerebras_client.py \
    gemini_client.py \
    openai_client.py \
    siwe_endpoints.py \
    revenuecat_config.py \
    requirements.txt \
    Dockerfile \
    docker-compose.yml \
    deploy-hetzner.sh

# Upload files to server
print_status "Uploading files to server..."
scp vision-service.tar.gz $SERVER_USER@$SERVER_HOST:/tmp/

# Execute deployment on server
print_status "Executing deployment on server..."
ssh $SERVER_USER@$SERVER_HOST << 'DEPLOY_SCRIPT'
set -e

# Configuration
DEPLOY_PATH="/opt/vision-service"
SERVICE_NAME="vision-service"

# Create deployment directory
sudo mkdir -p $DEPLOY_PATH
cd $DEPLOY_PATH

# Extract new version
sudo tar -xzf /tmp/vision-service.tar.gz
sudo chown -R root:root $DEPLOY_PATH

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo systemctl enable docker
    sudo systemctl start docker
fi

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Stop existing service
if sudo docker-compose ps | grep -q $SERVICE_NAME; then
    echo "Stopping existing service..."
    sudo docker-compose down
fi

# Build and start new service
echo "Building and starting new service..."
sudo docker-compose build --no-cache
sudo docker-compose up -d

# Create systemd service for auto-restart
sudo tee /etc/systemd/system/vision-service.service > /dev/null << EOF
[Unit]
Description=Vision Service
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$DEPLOY_PATH
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

# Enable and start systemd service
sudo systemctl daemon-reload
sudo systemctl enable vision-service
sudo systemctl start vision-service

# Wait for service to be healthy
echo "Waiting for service to be healthy..."
for i in {1..30}; do
    if curl -f http://localhost:8001/health &> /dev/null; then
        echo "✅ Service is healthy!"
        break
    fi
    echo "Waiting for service... ($i/30)"
    sleep 5
done

# Show service status
echo "📊 Service Status:"
sudo docker-compose ps
echo ""
echo "🔍 Health Check:"
curl -s http://localhost:8001/health | python3 -m json.tool || echo "Health check failed"

# Cleanup
rm -f /tmp/vision-service.tar.gz

echo "🎉 Deployment complete!"
echo "📋 Service endpoints:"
echo "   Health: http://$HOSTNAME:8001/health"
echo "   API Docs: http://$HOSTNAME:8001/docs"
echo ""
echo "📝 Management commands:"
echo "   View logs: sudo docker-compose logs -f"
echo "   Restart: sudo systemctl restart vision-service"
echo "   Stop: sudo systemctl stop vision-service"

DEPLOY_SCRIPT

# Cleanup local files
rm -f vision-service.tar.gz

print_status "Deployment completed successfully! 🎉"
print_status "Your vision service is now running on http://$SERVER_HOST:8001"

# Test the deployment
print_status "Testing deployment..."
if curl -f "http://$SERVER_HOST:8001/health" &> /dev/null; then
    print_status "✅ Service is responding correctly!"
else
    print_warning "⚠️ Service might still be starting up. Check logs with:"
    echo "ssh $SERVER_USER@$SERVER_HOST 'cd /opt/vision-service && sudo docker-compose logs -f'"
fi
