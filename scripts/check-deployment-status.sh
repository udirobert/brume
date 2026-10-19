#!/bin/bash

# Deployment Status Check Script
# This script checks the status of all services and provides a comprehensive overview

echo "🚀 Brume - Deployment Status Dashboard"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ️${NC} $1"
}

# Configuration
SERVER_HOST="157.180.36.156"
SERVER_USER="root"
VISION_PORT="8001"
NGINX_PORT="80"

echo ""
echo "🔍 Checking Local Environment..."
echo "================================"

# Check if SSH key exists
if [ -f ~/.ssh/github_actions_key ]; then
    print_status "GitHub Actions SSH key found"
else
    print_warning "GitHub Actions SSH key not found at ~/.ssh/github_actions_key"
fi

# Check if .env files are configured
if [ -f .env.development ]; then
    if grep -q "VITE_HETZNER_SERVICE_URL" .env.development; then
        print_status ".env.development configured with Hetzner service URL"
    else
        print_warning ".env.development missing Hetzner service URL"
    fi
else
    print_warning ".env.development file not found"
fi

echo ""
echo "🌐 Checking Server Connectivity..."
echo "=================================="

# Test SSH connection
if ssh -o ConnectTimeout=10 -o BatchMode=yes "$SERVER_USER@$SERVER_HOST" "echo 'SSH connection successful'" 2>/dev/null; then
    print_status "SSH connection to $SERVER_HOST successful"
else
    print_error "Cannot connect to $SERVER_HOST via SSH"
    echo "  Please check:"
    echo "  - Server is running"
    echo "  - SSH key is properly configured"
    echo "  - Network connectivity"
    exit 1
fi

echo ""
echo "🐳 Checking Docker Services..."
echo "=============================="

# Check Docker services on server
DOCKER_STATUS=$(ssh "$SERVER_USER@$SERVER_HOST" "cd /opt/vision-service && sudo docker-compose ps --format table" 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "$DOCKER_STATUS"
    
    # Check if vision service is running
    if echo "$DOCKER_STATUS" | grep -q "vision-service.*Up"; then
        print_status "Vision service container is running"
    else
        print_error "Vision service container is not running"
    fi
    
    # Check if nginx is running
    if echo "$DOCKER_STATUS" | grep -q "nginx.*Up"; then
        print_status "Nginx container is running"
    else
        print_warning "Nginx container is not running (this is okay if using direct access)"
    fi
else
    print_error "Could not check Docker services"
fi

echo ""
echo "🏥 Checking Service Health..."
echo "============================="

# Test internal health endpoint
INTERNAL_HEALTH=$(ssh "$SERVER_USER@$SERVER_HOST" "curl -s -f http://localhost:$VISION_PORT/health" 2>/dev/null)

if [ $? -eq 0 ]; then
    print_status "Internal health check passed"
    echo "  Response: $INTERNAL_HEALTH"
else
    print_error "Internal health check failed"
fi

# Test external health endpoint (direct)
echo ""
print_info "Testing external access (direct)..."
EXTERNAL_HEALTH=$(curl -s -f --connect-timeout 10 "http://$SERVER_HOST:$VISION_PORT/health" 2>/dev/null)

if [ $? -eq 0 ]; then
    print_status "External health check (direct) passed"
    echo "  URL: http://$SERVER_HOST:$VISION_PORT/health"
    echo "  Response: $EXTERNAL_HEALTH"
else
    print_warning "External health check (direct) failed - likely due to cloud firewall"
    echo "  URL: http://$SERVER_HOST:$VISION_PORT/health"
    echo "  This is expected if Hetzner Cloud Firewall is not configured"
fi

# Test external health endpoint (via nginx)
print_info "Testing external access (via nginx)..."
NGINX_HEALTH=$(curl -s -f --connect-timeout 10 "http://$SERVER_HOST/health" 2>/dev/null)

if [ $? -eq 0 ]; then
    print_status "External health check (via nginx) passed"
    echo "  URL: http://$SERVER_HOST/health"
    echo "  Response: $NGINX_HEALTH"
else
    print_warning "External health check (via nginx) failed"
    echo "  URL: http://$SERVER_HOST/health"
fi

echo ""
echo "🔥 Checking Firewall Configuration..."
echo "====================================="

# Check local firewall
UFW_STATUS=$(ssh "$SERVER_USER@$SERVER_HOST" "sudo ufw status | grep $VISION_PORT" 2>/dev/null)

if echo "$UFW_STATUS" | grep -q "ALLOW"; then
    print_status "Local firewall allows port $VISION_PORT"
else
    print_warning "Local firewall may not allow port $VISION_PORT"
fi

# Check if port is listening
PORT_LISTEN=$(ssh "$SERVER_USER@$SERVER_HOST" "sudo netstat -tlnp | grep :$VISION_PORT" 2>/dev/null)

if [ -n "$PORT_LISTEN" ]; then
    print_status "Port $VISION_PORT is listening"
    echo "  $PORT_LISTEN"
else
    print_error "Port $VISION_PORT is not listening"
fi

echo ""
echo "📊 Summary & Recommendations"
echo "============================"

# Determine overall status
OVERALL_STATUS="unknown"

if [ -n "$INTERNAL_HEALTH" ]; then
    if [ -n "$EXTERNAL_HEALTH" ]; then
        OVERALL_STATUS="fully_operational"
    else
        OVERALL_STATUS="internal_only"
    fi
else
    OVERALL_STATUS="service_down"
fi

case $OVERALL_STATUS in
    "fully_operational")
        print_status "🎉 All systems operational!"
        echo ""
        echo "✅ Your vision service is fully accessible:"
        echo "   🔗 Internal: http://localhost:$VISION_PORT/health"
        echo "   🔗 External: http://$SERVER_HOST:$VISION_PORT/health"
        if [ -n "$NGINX_HEALTH" ]; then
            echo "   🔗 Via Nginx: http://$SERVER_HOST/health"
        fi
        echo ""
        echo "🚀 Ready for production use!"
        ;;
    "internal_only")
        print_warning "Service running but external access blocked"
        echo ""
        echo "✅ Vision service is healthy internally"
        echo "❌ External access is blocked (likely cloud firewall)"
        echo ""
        echo "🔧 To fix external access:"
        echo "   1. Run: ./scripts/setup-hetzner-firewall.sh"
        echo "   2. Or configure Hetzner Cloud Firewall manually"
        echo "   3. Allow port $VISION_PORT in cloud firewall"
        ;;
    "service_down")
        print_error "Service is not responding"
        echo ""
        echo "🔧 Troubleshooting steps:"
        echo "   1. Check Docker containers: ssh $SERVER_USER@$SERVER_HOST 'cd /opt/vision-service && sudo docker-compose ps'"
        echo "   2. Check logs: ssh $SERVER_USER@$SERVER_HOST 'cd /opt/vision-service && sudo docker-compose logs'"
        echo "   3. Restart service: ssh $SERVER_USER@$SERVER_HOST 'cd /opt/vision-service && sudo docker-compose restart'"
        echo "   4. Redeploy: cd backend/vision-service && ./deploy-hetzner.sh"
        ;;
esac

echo ""
echo "📋 Quick Commands:"
echo "=================="
echo "🔄 Restart service:    ssh $SERVER_USER@$SERVER_HOST 'cd /opt/vision-service && sudo docker-compose restart'"
echo "📜 View logs:          ssh $SERVER_USER@$SERVER_HOST 'cd /opt/vision-service && sudo docker-compose logs -f'"
echo "🚀 Redeploy:           cd backend/vision-service && ./deploy-hetzner.sh"
echo "🔥 Setup firewall:     ./scripts/setup-hetzner-firewall.sh"
echo "🧪 Test health:        curl http://$SERVER_HOST:$VISION_PORT/health"

echo ""
echo "📅 Status check completed at $(date)"