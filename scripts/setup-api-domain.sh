#!/bin/bash
set -e

# API Domain Setup Script for Brume
# Sets up api.brume.trustfall.xyz with SSL for the vision service

echo "🌐 Setting up api.brume.trustfall.xyz for Brume"
echo "======================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Configuration
API_DOMAIN="api.brume.trustfall.xyz"
SERVER_HOST="157.180.36.156"
SERVER_USER="root"
EMAIL="admin@trustfall.xyz"  # Using domain email for Let's Encrypt

print_info "This script will set up: $API_DOMAIN"
print_info "Server: $SERVER_HOST"
print_warning "Make sure you've updated the EMAIL variable in this script!"

echo ""
echo "📋 Prerequisites Checklist:"
echo "=========================="
echo "1. ✅ Vision service is running on server"
echo "2. ⚠️  DNS record added: api.brume.trustfall.xyz → 157.180.36.156"
echo "3. ⚠️  Email updated in script for Let's Encrypt"
echo "4. ✅ SSH access to server configured"
echo ""

read -p "Have you completed the DNS setup in GoDaddy? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    print_warning "Please complete DNS setup first:"
    echo "1. Go to GoDaddy DNS Management for trustfall.xyz"
    echo "2. Add A record: api → 157.180.36.156"
    echo "3. Wait 5-10 minutes for DNS propagation"
    echo "4. Run this script again"
    exit 1
fi

# Check DNS propagation
print_info "Checking DNS propagation..."
API_IP=$(dig +short $API_DOMAIN)
if [ "$API_IP" = "$SERVER_HOST" ]; then
    print_status "DNS correctly configured: $API_DOMAIN → $SERVER_HOST"
else
    print_error "DNS not propagated yet. Current IP: $API_IP"
    print_warning "Please wait a few more minutes and try again"
    exit 1
fi

# Test SSH connection
print_info "Testing SSH connection..."
if ! ssh -o ConnectTimeout=10 "$SERVER_USER@$SERVER_HOST" "echo 'SSH OK'" >/dev/null 2>&1; then
    print_error "Cannot connect to server via SSH"
    exit 1
fi
print_status "SSH connection successful"

# Check if vision service is running
print_info "Checking vision service status..."
SERVICE_STATUS=$(ssh "$SERVER_USER@$SERVER_HOST" "cd /opt/vision-service && sudo docker-compose ps --format table" 2>/dev/null)
if echo "$SERVICE_STATUS" | grep -q "vision-service.*Up"; then
    print_status "Vision service is running"
else
    print_error "Vision service is not running!"
    echo "Please start the vision service first:"
    echo "ssh $SERVER_USER@$SERVER_HOST 'cd /opt/vision-service && sudo docker-compose up -d'"
    exit 1
fi

# Install certbot if not present
print_info "Installing/updating certbot..."
ssh "$SERVER_USER@$SERVER_HOST" << 'EOF'
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
EOF

# Stop nginx temporarily for certificate generation
print_info "Preparing for SSL certificate generation..."
ssh "$SERVER_USER@$SERVER_HOST" "cd /opt/vision-service && sudo docker-compose stop nginx || echo 'Nginx not running'"

# Generate SSL certificate
print_info "Generating SSL certificate for $API_DOMAIN..."
ssh "$SERVER_USER@$SERVER_HOST" << EOF
    certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --email $EMAIL \
        -d $API_DOMAIN \
        --force-renewal
EOF

# Check if certificate was generated
CERT_CHECK=$(ssh "$SERVER_USER@$SERVER_HOST" "ls /etc/letsencrypt/live/$API_DOMAIN/fullchain.pem 2>/dev/null || echo 'NOT_FOUND'")

if [ "$CERT_CHECK" = "NOT_FOUND" ]; then
    print_error "SSL certificate generation failed"
    exit 1
fi

print_status "SSL certificate generated successfully!"

# Create SSL-enabled nginx configuration
print_info "Creating SSL nginx configuration..."

cat > /tmp/nginx-ssl.conf << EOF
events {
    worker_connections 1024;
}

http {
    upstream vision_service {
        server vision-service:8001;
    }

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone \$binary_remote_addr zone=health:10m rate=1r/s;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name $API_DOMAIN;
        return 301 https://\$server_name\$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name $API_DOMAIN;

        # SSL configuration
        ssl_certificate /etc/letsencrypt/live/$API_DOMAIN/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/$API_DOMAIN/privkey.pem;
        
        # SSL security settings
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Health check endpoint
        location /health {
            limit_req zone=health burst=5 nodelay;
            proxy_pass http://vision_service/health;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        # API endpoints
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            # CORS headers for your domains
            add_header Access-Control-Allow-Origin "https://trustfall.xyz, https://api.brume.trustfall.xyz, https://*.netlify.app, http://localhost:4567" always;
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
            add_header Access-Control-Max-Age 86400 always;

            # Handle preflight requests
            if (\$request_method = 'OPTIONS') {
                return 204;
            }

            proxy_pass http://vision_service;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            
            # Increase timeouts for vision processing
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Root endpoint - API info
        location / {
            return 200 '{"service":"Brume API","version":"1.0","endpoints":["/health","/api/"],"domain":"$API_DOMAIN"}';
            add_header Content-Type application/json;
        }
    }
}
EOF

# Upload SSL config to server
scp /tmp/nginx-ssl.conf "$SERVER_USER@$SERVER_HOST:/opt/vision-service/nginx-ssl.conf"

# Update docker-compose to mount SSL certificates
print_info "Updating docker-compose for SSL..."
ssh "$SERVER_USER@$SERVER_HOST" << 'EOF'
cd /opt/vision-service

# Backup current config
cp docker-compose.yml docker-compose.yml.backup

# Update nginx service to mount SSL certificates
sed -i 's|./nginx.conf:/etc/nginx/nginx.conf:ro|./nginx-ssl.conf:/etc/nginx/nginx.conf:ro|g' docker-compose.yml

# Add SSL certificate mount if not present
if ! grep -q "/etc/letsencrypt" docker-compose.yml; then
    sed -i '/nginx-ssl.conf:\/etc\/nginx\/nginx.conf:ro/a\      - /etc/letsencrypt:/etc/letsencrypt:ro' docker-compose.yml
fi
EOF

# Start services with SSL
print_info "Starting services with SSL configuration..."
ssh "$SERVER_USER@$SERVER_HOST" "cd /opt/vision-service && sudo docker-compose up -d"

# Wait for services to start
print_info "Waiting for services to start..."
sleep 30

# Test HTTPS endpoint
print_info "Testing HTTPS endpoint..."
if curl -f -s "https://$API_DOMAIN/health" >/dev/null 2>&1; then
    print_status "✅ HTTPS endpoint is working!"
    HEALTH_RESPONSE=$(curl -s "https://$API_DOMAIN/health")
    echo "Response: $HEALTH_RESPONSE"
else
    print_warning "HTTPS test failed, checking service status..."
    ssh "$SERVER_USER@$SERVER_HOST" "cd /opt/vision-service && sudo docker-compose logs nginx"
fi

# Set up automatic certificate renewal
print_info "Setting up automatic certificate renewal..."
ssh "$SERVER_USER@$SERVER_HOST" << 'EOF'
# Add cron job for certificate renewal
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --deploy-hook 'cd /opt/vision-service && docker-compose restart nginx'") | crontab -
EOF

print_status "✅ API domain setup completed!"

echo ""
echo "🎉 Success! Your Brume API is now available at:"
echo "========================================================="
echo ""
echo "  🔗 https://$API_DOMAIN/health"
echo "  🔗 https://$API_DOMAIN/api/"
echo ""
echo "📝 Next steps:"
echo "1. Update your frontend environment:"
echo "   VITE_HETZNER_SERVICE_URL=https://$API_DOMAIN"
echo ""
echo "2. Test the API:"
echo "   curl https://$API_DOMAIN/health"
echo ""
echo "3. Your existing trustfall.xyz project is unaffected"
echo ""
echo "🔄 Certificate auto-renewal is configured"

# Clean up
rm -f /tmp/nginx-ssl.conf