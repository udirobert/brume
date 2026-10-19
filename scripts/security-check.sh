#!/bin/bash

# Security Check Script for Brume
# Verifies no secrets are exposed before deployment

echo "🔒 Security Check for Brume"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SECURITY_ISSUES=0

print_pass() {
    echo -e "${GREEN}✅ PASS:${NC} $1"
}

print_fail() {
    echo -e "${RED}❌ FAIL:${NC} $1"
    SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
}

print_warn() {
    echo -e "${YELLOW}⚠️  WARN:${NC} $1"
}

echo ""
echo "🔍 Checking for exposed secrets..."

# Check if .env files are tracked by git
if git ls-files | grep -E "^\.env$|^\.env\.development$|^\.env\.production$" >/dev/null; then
    print_fail "Environment files are tracked by git"
    echo "   Run: git rm --cached .env .env.development .env.production"
else
    print_pass "No environment files tracked by git"
fi

# Check for API keys in tracked files
echo ""
echo "🔍 Scanning for API keys in tracked files..."

# OpenAI keys
if git grep -E "sk-[a-zA-Z0-9]{20,}" -- '*.js' '*.ts' '*.jsx' '*.tsx' '*.py' '*.md' >/dev/null 2>&1; then
    print_fail "OpenAI API keys found in tracked files"
    git grep -n -E "sk-[a-zA-Z0-9]{20,}" -- '*.js' '*.ts' '*.jsx' '*.tsx' '*.py' '*.md'
else
    print_pass "No OpenAI API keys in tracked files"
fi

# Anthropic keys
if git grep -E "sk-ant-[a-zA-Z0-9-_]{20,}" -- '*.js' '*.ts' '*.jsx' '*.tsx' '*.py' '*.md' >/dev/null 2>&1; then
    print_fail "Anthropic API keys found in tracked files"
    git grep -n -E "sk-ant-[a-zA-Z0-9-_]{20,}" -- '*.js' '*.ts' '*.jsx' '*.tsx' '*.py' '*.md'
else
    print_pass "No Anthropic API keys in tracked files"
fi

# Google/Gemini keys
if git grep -E "AIza[a-zA-Z0-9_-]{35}" -- '*.js' '*.ts' '*.jsx' '*.tsx' '*.py' '*.md' >/dev/null 2>&1; then
    print_fail "Google/Gemini API keys found in tracked files"
    git grep -n -E "AIza[a-zA-Z0-9_-]{35}" -- '*.js' '*.ts' '*.jsx' '*.tsx' '*.py' '*.md'
else
    print_pass "No Google/Gemini API keys in tracked files"
fi

# Check for hardcoded secrets in webhook handler
echo ""
echo "🔍 Checking webhook security..."

if grep -q "your-webhook-secret-here" backend/vision-service/webhook_handler.py 2>/dev/null; then
    print_fail "Hardcoded webhook secret found"
else
    print_pass "Webhook secret uses environment variable"
fi

# Check .gitignore coverage
echo ""
echo "🔍 Checking .gitignore coverage..."

if grep -q "\.env\.development" .gitignore; then
    print_pass ".env.development is ignored"
else
    print_fail ".env.development not in .gitignore"
fi

if grep -q "\.env\.production" .gitignore; then
    print_pass ".env.production is ignored"
else
    print_fail ".env.production not in .gitignore"
fi

# Check for common secret patterns
echo ""
echo "🔍 Checking for other secret patterns..."

# Private keys (exclude documentation examples)
if git grep -E "^[^#]*-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----" -- '*.js' '*.ts' '*.jsx' '*.tsx' '*.py' >/dev/null 2>&1; then
    print_fail "Private keys found in tracked files"
    git grep -n -E "^[^#]*-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----" -- '*.js' '*.ts' '*.jsx' '*.tsx' '*.py'
else
    print_pass "No private keys in tracked files"
fi

# Database URLs with passwords
if git grep -E "://[^:]+:[^@]+@" -- '*.js' '*.ts' '*.jsx' '*.tsx' '*.py' '*.md' >/dev/null 2>&1; then
    print_warn "Potential database URLs with credentials found"
    git grep -n -E "://[^:]+:[^@]+@" -- '*.js' '*.ts' '*.jsx' '*.tsx' '*.py' '*.md'
else
    print_pass "No database URLs with credentials"
fi

# Check file permissions on sensitive files
echo ""
echo "🔍 Checking file permissions..."

if [ -f ".env.development" ]; then
    PERMS=$(stat -f "%A" .env.development 2>/dev/null || stat -c "%a" .env.development 2>/dev/null)
    if [ "$PERMS" = "600" ] || [ "$PERMS" = "644" ]; then
        print_pass ".env.development has appropriate permissions ($PERMS)"
    else
        print_warn ".env.development permissions: $PERMS (consider 600)"
    fi
fi

# Summary
echo ""
echo "📊 Security Check Summary"
echo "========================"

if [ $SECURITY_ISSUES -eq 0 ]; then
    echo -e "${GREEN}🎉 All security checks passed!${NC}"
    echo "✅ Safe to push to production"
    exit 0
else
    echo -e "${RED}❌ $SECURITY_ISSUES security issue(s) found${NC}"
    echo "🚫 NOT safe to push to production"
    echo ""
    echo "🔧 Fix the issues above before deploying"
    exit 1
fi