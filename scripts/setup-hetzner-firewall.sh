#!/bin/bash
set -e

# Hetzner Cloud Firewall Configuration Script
# This script helps configure the cloud firewall for the vision service

echo "🔥 Hetzner Cloud Firewall Configuration"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check if hcloud CLI is installed
if ! command -v hcloud &> /dev/null; then
    print_error "Hetzner Cloud CLI (hcloud) is not installed."
    echo ""
    echo "To install hcloud CLI:"
    echo "1. Download from: https://github.com/hetznercloud/cli/releases"
    echo "2. Or use package manager:"
    echo "   - macOS: brew install hcloud"
    echo "   - Linux: Download binary and add to PATH"
    echo ""
    echo "3. Configure with your API token:"
    echo "   hcloud context create brume"
    exit 1
fi

# Check if context is configured
if ! hcloud context list | grep -q "brume"; then
    print_warning "No 'brume' context found."
    echo ""
    echo "Please create a context first:"
    echo "  hcloud context create brume"
    echo ""
    echo "Then set your API token when prompted."
    echo "You can get your API token from: https://console.hetzner.cloud/"
    exit 1
fi

# Use the brume context
hcloud context use brume

print_status "Using Hetzner Cloud context: brume"

# Get server information
print_info "Fetching server information..."
SERVER_INFO=$(hcloud server list -o json | jq -r '.[] | select(.public_net.ipv4.ip == "157.180.36.156")')

if [ -z "$SERVER_INFO" ]; then
    print_error "Could not find server with IP 157.180.36.156"
    echo ""
    echo "Available servers:"
    hcloud server list
    exit 1
fi

SERVER_ID=$(echo "$SERVER_INFO" | jq -r '.id')
SERVER_NAME=$(echo "$SERVER_INFO" | jq -r '.name')

print_status "Found server: $SERVER_NAME (ID: $SERVER_ID)"

# Check if firewall exists
FIREWALL_NAME="brume-firewall"
FIREWALL_ID=$(hcloud firewall list -o json | jq -r ".[] | select(.name == \"$FIREWALL_NAME\") | .id")

if [ -z "$FIREWALL_ID" ]; then
    print_info "Creating new firewall: $FIREWALL_NAME"
    
    # Create firewall with basic rules
    hcloud firewall create \
        --name "$FIREWALL_NAME" \
        --rule "direction=in,source-ips=0.0.0.0/0,::/0,port=22,protocol=tcp" \
        --rule "direction=in,source-ips=0.0.0.0/0,::/0,port=80,protocol=tcp" \
        --rule "direction=in,source-ips=0.0.0.0/0,::/0,port=443,protocol=tcp" \
        --rule "direction=in,source-ips=0.0.0.0/0,::/0,port=8001,protocol=tcp"
    
    FIREWALL_ID=$(hcloud firewall list -o json | jq -r ".[] | select(.name == \"$FIREWALL_NAME\") | .id")
    print_status "Created firewall with ID: $FIREWALL_ID"
else
    print_status "Using existing firewall: $FIREWALL_NAME (ID: $FIREWALL_ID)"
    
    # Add port 8001 rule if it doesn't exist
    print_info "Adding port 8001 rule to existing firewall..."
    hcloud firewall add-rule "$FIREWALL_ID" \
        --direction in \
        --source-ips 0.0.0.0/0 \
        --source-ips ::/0 \
        --port 8001 \
        --protocol tcp || print_warning "Port 8001 rule might already exist"
fi

# Apply firewall to server
print_info "Applying firewall to server..."
hcloud firewall apply-to-resource "$FIREWALL_ID" --type server --server "$SERVER_ID"

print_status "Firewall configuration completed!"

# Show current firewall rules
echo ""
print_info "Current firewall rules:"
hcloud firewall describe "$FIREWALL_ID"

echo ""
print_status "✅ Hetzner Cloud Firewall Setup Complete!"
echo ""
echo "Your vision service should now be accessible at:"
echo "  🔗 http://157.180.36.156:8001/health"
echo "  🔗 http://157.180.36.156/health (via nginx)"
echo ""
echo "Test the connection:"
echo "  curl http://157.180.36.156:8001/health"
echo "  curl http://157.180.36.156/health"