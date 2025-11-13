#!/bin/bash

# Git repository initialization and first commit

cd /mnt/user-data/outputs/dialog-system

# Configure git
git config user.email "univerx@diggi.io"
git config user.name "UniverX"

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Complete multimodal dialog system with TTL-based configuration

Features:
- 5 TTL ontologies (golden source, no hardcoded values)
- 3 Python backend services (dialog, admin, manager)
- 2 React frontend components (user dialog, operator panel)
- Multi-factor confidence scoring
- Automatic audio recording for low-confidence answers
- Operator review queue with priority sorting
- WebSocket real-time notifications
- SKOS controlled vocabularies
- SHACL validation rules
- TTL-based lifecycle management
- Docker support
- Comprehensive tests
- Complete documentation"

echo ""
echo "✅ Git repository initialized and committed!"
echo ""
echo "📊 Repository stats:"
git log --oneline
echo ""
git show --stat
echo ""
echo "To push to GitHub:"
echo "  git remote add origin https://github.com/YOUR_USERNAME/dialog-system.git"
echo "  git branch -M main"
echo "  git push -u origin main"
