#!/bin/bash

# Dialog System Setup Script
# Automates the installation and setup process

set -e  # Exit on error

echo "🎯 Dialog System Setup Script"
echo "=============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python 3 is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Python 3 found${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js found${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm found${NC}"

echo ""
echo -e "${BLUE}Setting up backend...${NC}"

# Create virtual environment
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo -e "${GREEN}✓ Created virtual environment${NC}"
else
    echo -e "${GREEN}✓ Virtual environment already exists${NC}"
fi

# Activate virtual environment
source venv/bin/activate

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

# Create data directory
mkdir -p ../data/recordings
echo -e "${GREEN}✓ Created data directories${NC}"

# Copy .env file if it doesn't exist
if [ ! -f "../.env" ]; then
    cp ../.env.example ../.env
    echo -e "${GREEN}✓ Created .env file${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

cd ..

echo ""
echo -e "${BLUE}Setting up frontend...${NC}"

cd frontend

# Install npm dependencies
echo "Installing npm dependencies..."
npm install
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"

cd ..

echo ""
echo -e "${GREEN}=============================="
echo "✓ Setup Complete!"
echo "==============================${NC}"
echo ""
echo "To start the system:"
echo ""
echo "1. Start the backend servers (in separate terminals):"
echo "   ${BLUE}cd backend && source venv/bin/activate && python multimodal_server.py${NC}"
echo "   ${BLUE}cd backend && source venv/bin/activate && python admin_panel.py${NC}"
echo ""
echo "2. Start the frontend:"
echo "   ${BLUE}cd frontend && npm run dev${NC}"
echo ""
echo "Or use Docker Compose:"
echo "   ${BLUE}docker-compose up${NC}"
echo ""
echo "Access points:"
echo "  - User Dialog:    http://localhost:5173"
echo "  - Operator Panel: http://localhost:5173/admin"
echo "  - Dialog API:     http://localhost:8000/api"
echo "  - Admin API:      http://localhost:8001/api/admin"
echo ""
echo "To run tests:"
echo "   ${BLUE}cd backend && source venv/bin/activate && pytest ../tests/${NC}"
echo ""
