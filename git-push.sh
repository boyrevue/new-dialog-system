#!/bin/bash

# Automated Git Push Script for Dialog System
# Run this after downloading the files to your local machine

set -e

echo "🚀 Dialog System - Git Push Script"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    echo "Please run this script from the dialog-system directory"
    exit 1
fi

echo -e "${BLUE}Current repository status:${NC}"
git status
echo ""

# Check if remote exists
if git remote | grep -q "origin"; then
    echo -e "${GREEN}✓ Remote 'origin' already configured${NC}"
    git remote -v
    echo ""
else
    echo -e "${YELLOW}No remote configured yet.${NC}"
    echo ""
    echo "Please enter your GitHub repository URL:"
    echo "Example: https://github.com/YOUR_USERNAME/dialog-system.git"
    echo "Or: git@github.com:YOUR_USERNAME/dialog-system.git"
    echo ""
    read -p "Repository URL: " repo_url
    
    if [ -z "$repo_url" ]; then
        echo -e "${RED}Error: No URL provided${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${BLUE}Adding remote...${NC}"
    git remote add origin "$repo_url"
    echo -e "${GREEN}✓ Remote added${NC}"
    echo ""
fi

# Ask about branch name
echo "Which branch name would you like to use?"
echo "  1) main (recommended)"
echo "  2) master"
echo "  3) custom"
read -p "Enter choice (1-3) [1]: " branch_choice
branch_choice=${branch_choice:-1}

case $branch_choice in
    1)
        branch_name="main"
        ;;
    2)
        branch_name="master"
        ;;
    3)
        read -p "Enter branch name: " branch_name
        ;;
    *)
        branch_name="main"
        ;;
esac

echo ""
echo -e "${BLUE}Renaming branch to ${branch_name}...${NC}"
git branch -M $branch_name
echo -e "${GREEN}✓ Branch renamed${NC}"
echo ""

# Show what will be pushed
echo -e "${BLUE}Files to be pushed:${NC}"
git log --oneline -1
git show --stat --oneline HEAD
echo ""

# Confirm push
read -p "Push to GitHub now? (y/n) [y]: " confirm
confirm=${confirm:-y}

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo -e "${YELLOW}Push cancelled${NC}"
    echo ""
    echo "To push manually later, run:"
    echo "  git push -u origin $branch_name"
    exit 0
fi

echo ""
echo -e "${BLUE}Pushing to GitHub...${NC}"

# Push to GitHub
if git push -u origin $branch_name; then
    echo ""
    echo -e "${GREEN}=====================================${NC}"
    echo -e "${GREEN}✓ Successfully pushed to GitHub!${NC}"
    echo -e "${GREEN}=====================================${NC}"
    echo ""
    
    # Extract repository URL for display
    remote_url=$(git remote get-url origin)
    if [[ $remote_url == git@github.com:* ]]; then
        # SSH URL
        repo_path=${remote_url#git@github.com:}
        repo_path=${repo_path%.git}
        web_url="https://github.com/$repo_path"
    elif [[ $remote_url == https://github.com/* ]]; then
        # HTTPS URL
        web_url=${remote_url%.git}
    else
        web_url=$remote_url
    fi
    
    echo "🎉 Your repository is now live at:"
    echo "   $web_url"
    echo ""
    echo "Next steps:"
    echo "  1. View your repository: $web_url"
    echo "  2. Add topics/description in GitHub settings"
    echo "  3. Enable GitHub Actions (optional)"
    echo "  4. Set up branch protection (optional)"
    echo ""
    echo "To create a release tag:"
    echo "  git tag -a v1.0.0 -m 'Initial release'"
    echo "  git push origin v1.0.0"
    echo ""
else
    echo ""
    echo -e "${RED}Push failed!${NC}"
    echo ""
    echo "Common issues:"
    echo "  1. Authentication failed:"
    echo "     - For HTTPS: Check your GitHub password/token"
    echo "     - For SSH: Run 'ssh -T git@github.com' to test"
    echo ""
    echo "  2. Repository doesn't exist:"
    echo "     - Create it first at https://github.com/new"
    echo "     - Don't initialize with README, .gitignore, or license"
    echo ""
    echo "  3. Permission denied:"
    echo "     - Ensure you have push access to the repository"
    echo ""
    echo "To try again:"
    echo "  ./git-push.sh"
    echo ""
    exit 1
fi
