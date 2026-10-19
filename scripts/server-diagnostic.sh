#!/bin/bash

# 🔍 Hetzner Server AI Analysis Diagnostic Script
# Run this on your snel-bot server to check AI analysis service

echo "🔍 Hetzner Server AI Analysis Diagnostic"
echo "========================================"
echo "Server: $(hostname)"
echo "Date: $(date)"
echo "User: $(whoami)"
echo ""

# Check if running as root or with sudo
if [[ $EUID -eq 0 ]]; then
    echo "⚠️  Running as root"
else
    echo "👤 Running as user: $(whoami)"
fi
echo ""

# 1. Check system resources
echo "📊 SYSTEM RESOURCES"
echo "==================="
echo "Memory usage:"
free -h
echo ""
echo "Disk usage:"
df -h
echo ""
echo "CPU load:"
uptime
echo ""

# 2. Check running services
echo "🔧 RUNNING SERVICES"
echo "==================="
echo "Python processes:"
ps aux | grep python | grep -v grep
echo ""
echo "FastAPI/Uvicorn processes:"
ps aux | grep uvicorn | grep -v grep
echo ""
echo "Port 8001 usage:"
netstat -tlnp | grep :8001 || ss -tlnp | grep :8001
echo ""

# 3. Check AI service specifically
echo "🤖 AI SERVICE CHECK"
echo "==================="

# Check if main.py or similar is running
if pgrep -f "main.py" > /dev/null; then
    echo "✅ main.py process is running"
    echo "Process details:"
    ps aux | grep main.py | grep -v grep
else
    echo "❌ main.py process not found"
fi
echo ""

# Check if the service is listening on port 8001
if netstat -tlnp 2>/dev/null | grep :8001 > /dev/null || ss -tlnp 2>/dev/null | grep :8001 > /dev/null; then
    echo "✅ Service is listening on port 8001"
else
    echo "❌ No service listening on port 8001"
fi
echo ""

# 4. Test local endpoints
echo "🌐 ENDPOINT TESTING"
echo "==================="

# Test health endpoint
echo "Testing /health endpoint:"
if command -v curl > /dev/null; then
    curl -s -w "Status: %{http_code}\nTime: %{time_total}s\n" http://localhost:8001/health || echo "❌ Health endpoint failed"
else
    echo "⚠️  curl not available"
fi
echo ""

# Test AI analysis endpoint
echo "Testing /api/ai-analysis endpoint:"
if command -v curl > /dev/null; then
    curl -s -w "Status: %{http_code}\nTime: %{time_total}s\n" \
         -H "Content-Type: application/json" \
         -d '{
           "provider": "openai",
           "session_data": {
             "patternName": "Test Pattern",
             "sessionDuration": 60,
             "breathHoldTime": 10,
             "restlessnessScore": 30
           },
           "analysis_type": "session"
         }' \
         http://localhost:8001/api/ai-analysis || echo "❌ AI analysis endpoint failed"
else
    echo "⚠️  curl not available"
fi
echo ""

# 5. Check logs
echo "📋 SERVICE LOGS"
echo "==============="

# Check if there are any log files
if [ -f "app.log" ]; then
    echo "Recent app.log entries:"
    tail -20 app.log
elif [ -f "main.log" ]; then
    echo "Recent main.log entries:"
    tail -20 main.log
elif [ -f "/var/log/brume.log" ]; then
    echo "Recent system log entries:"
    tail -20 /var/log/brume.log
else
    echo "No obvious log files found"
    echo "Checking systemd logs if available:"
    if command -v journalctl > /dev/null; then
        journalctl -u brume --no-pager -n 10 2>/dev/null || echo "No systemd service logs found"
    fi
fi
echo ""

# 6. Check environment and configuration
echo "🔧 ENVIRONMENT CHECK"
echo "===================="

# Check Python version
if command -v python3 > /dev/null; then
    echo "Python version: $(python3 --version)"
else
    echo "❌ Python3 not found"
fi

# Check pip packages
if command -v pip3 > /dev/null; then
    echo ""
    echo "Key Python packages:"
    pip3 list | grep -E "(fastapi|uvicorn|openai|anthropic|google)" 2>/dev/null || echo "Package info not available"
fi
echo ""

# Check environment variables
echo "Environment variables:"
env | grep -E "(API_KEY|OPENAI|ANTHROPIC|GOOGLE|HETZNER)" | sed 's/=.*/=***/' || echo "No relevant env vars found"
echo ""

# 7. Check firewall
echo "🔥 FIREWALL CHECK"
echo "================="
if command -v ufw > /dev/null; then
    echo "UFW status:"
    ufw status
elif command -v iptables > /dev/null; then
    echo "Iptables rules for port 8001:"
    iptables -L | grep 8001 || echo "No specific rules for port 8001"
else
    echo "No firewall tools found"
fi
echo ""

# 8. Network connectivity
echo "🌍 NETWORK CHECK"
echo "================"
echo "Testing external connectivity:"
if command -v curl > /dev/null; then
    echo "Google: $(curl -s -w '%{http_code}' -o /dev/null https://www.google.com --max-time 5)"
    echo "OpenAI: $(curl -s -w '%{http_code}' -o /dev/null https://api.openai.com --max-time 5)"
else
    echo "⚠️  curl not available for connectivity test"
fi
echo ""

# 9. Check working directory and files
echo "📁 FILE SYSTEM CHECK"
echo "===================="
echo "Current directory: $(pwd)"
echo "Files in current directory:"
ls -la
echo ""

if [ -f "main.py" ]; then
    echo "✅ main.py found"
    echo "File size: $(stat -c%s main.py 2>/dev/null || stat -f%z main.py 2>/dev/null) bytes"
    echo "Last modified: $(stat -c%y main.py 2>/dev/null || stat -f%Sm main.py 2>/dev/null)"
else
    echo "❌ main.py not found in current directory"
    echo "Searching for main.py:"
    find /home -name "main.py" 2>/dev/null | head -5
fi
echo ""

if [ -f "requirements.txt" ]; then
    echo "✅ requirements.txt found"
    echo "Contents:"
    cat requirements.txt
else
    echo "❌ requirements.txt not found"
fi
echo ""

# 10. Quick service restart test
echo "🔄 SERVICE RESTART TEST"
echo "======================="
echo "To restart the service, you can try:"
echo "1. If using systemd: sudo systemctl restart brume"
echo "2. If running manually: pkill -f main.py && python3 main.py &"
echo "3. If using screen/tmux: check running sessions"
echo ""

if command -v screen > /dev/null; then
    echo "Screen sessions:"
    screen -ls
fi

if command -v tmux > /dev/null; then
    echo "Tmux sessions:"
    tmux list-sessions 2>/dev/null || echo "No tmux sessions"
fi
echo ""

echo "🎯 DIAGNOSTIC COMPLETE"
echo "======================"
echo "Summary:"
echo "- Check if AI service is running on port 8001"
echo "- Verify endpoints respond correctly"
echo "- Check logs for errors"
echo "- Ensure environment variables are set"
echo "- Test network connectivity"
echo ""
echo "If issues found, check:"
echo "1. Service logs for error messages"
echo "2. Environment variables (API keys)"
echo "3. Network connectivity"
echo "4. Port availability"
echo ""
echo "Run this script with: bash server-diagnostic.sh"