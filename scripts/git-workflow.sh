#!/bin/bash

# Git Workflow Helper Script for WMS
# Usage: ./scripts/git-workflow.sh <command> [args]

set -e

case "$1" in
  "start-feature")
    if [ -z "$2" ]; then
      echo "❌ Error: Feature name required"
      echo "Usage: ./scripts/git-workflow.sh start-feature <feature-name>"
      exit 1
    fi
    echo "🔄 Switching to dev branch..."
    git checkout dev
    echo "📥 Pulling latest dev changes..."
    git pull origin dev 2>/dev/null || echo "⚠️  No remote dev branch, continuing..."
    echo "🌿 Creating feature branch: feature/$2"
    git checkout -b "feature/$2"
    echo "✅ Created and switched to feature/$2"
    echo ""
    echo "💡 Next steps:"
    echo "   1. Make your changes"
    echo "   2. git add ."
    echo "   3. git commit -m 'feat: Description'"
    echo "   4. ./scripts/git-workflow.sh finish-feature"
    ;;
    
  "finish-feature")
    CURRENT_BRANCH=$(git branch --show-current)
    if [[ $CURRENT_BRANCH != feature/* ]]; then
      echo "❌ Error: Not on a feature branch (current: $CURRENT_BRANCH)"
      echo "Usage: Run this command from a feature branch"
      exit 1
    fi
    echo "🔄 Switching to dev branch..."
    git checkout dev
    echo "📥 Pulling latest dev changes..."
    git pull origin dev 2>/dev/null || echo "⚠️  No remote dev branch, continuing..."
    echo "🔀 Merging $CURRENT_BRANCH into dev..."
    git merge "$CURRENT_BRANCH" --no-ff -m "Merge $CURRENT_BRANCH into dev"
    echo "📤 Pushing dev to remote..."
    git push origin dev 2>/dev/null || echo "⚠️  No remote configured, skipping push"
    echo "🗑️  Deleting local feature branch..."
    git branch -d "$CURRENT_BRANCH"
    echo "✅ Merged $CURRENT_BRANCH into dev and deleted branch"
    echo ""
    echo "💡 Next steps:"
    echo "   - Test your changes on dev"
    echo "   - When ready: ./scripts/git-workflow.sh promote-to-prod"
    ;;
    
  "promote-to-prod")
    echo "🔄 Switching to dev branch..."
    git checkout dev
    echo "📥 Pulling latest dev changes..."
    git pull origin dev 2>/dev/null || echo "⚠️  No remote dev branch, continuing..."
    echo "🔄 Switching to production branch..."
    git checkout production
    echo "📥 Pulling latest production changes..."
    git pull origin production 2>/dev/null || echo "⚠️  No remote production branch, continuing..."
    echo "🔀 Merging dev into production..."
    git merge dev --no-ff -m "chore: Promote dev to production"
    echo "📤 Pushing production to remote..."
    git push origin production 2>/dev/null || echo "⚠️  No remote configured, skipping push"
    echo "✅ Promoted dev to production"
    echo ""
    echo "💡 Consider creating a release tag:"
    echo "   git tag -a v1.0.0 -m 'Release version 1.0.0'"
    echo "   git push origin v1.0.0"
    ;;
    
  "hotfix")
    if [ -z "$2" ]; then
      echo "❌ Error: Hotfix name required"
      echo "Usage: ./scripts/git-workflow.sh hotfix <hotfix-name>"
      exit 1
    fi
    echo "🔄 Switching to production branch..."
    git checkout production
    echo "📥 Pulling latest production changes..."
    git pull origin production 2>/dev/null || echo "⚠️  No remote production branch, continuing..."
    echo "🔧 Creating hotfix branch: hotfix/$2"
    git checkout -b "hotfix/$2"
    echo "✅ Created hotfix/$2 from production"
    echo ""
    echo "💡 Next steps:"
    echo "   1. Fix the issue"
    echo "   2. git add ."
    echo "   3. git commit -m 'fix: Description'"
    echo "   4. ./scripts/git-workflow.sh finish-hotfix"
    ;;
    
  "finish-hotfix")
    CURRENT_BRANCH=$(git branch --show-current)
    if [[ $CURRENT_BRANCH != hotfix/* ]]; then
      echo "❌ Error: Not on a hotfix branch (current: $CURRENT_BRANCH)"
      exit 1
    fi
    echo "🔄 Merging hotfix to production..."
    git checkout production
    git merge "$CURRENT_BRANCH" --no-ff -m "fix: Merge $CURRENT_BRANCH to production"
    git push origin production 2>/dev/null || echo "⚠️  No remote configured, skipping push"
    
    echo "🔄 Merging hotfix to dev..."
    git checkout dev
    git merge "$CURRENT_BRANCH" --no-ff -m "fix: Merge $CURRENT_BRANCH to dev"
    git push origin dev 2>/dev/null || echo "⚠️  No remote configured, skipping push"
    
    echo "🗑️  Deleting hotfix branch..."
    git branch -d "$CURRENT_BRANCH"
    echo "✅ Hotfix merged to both production and dev"
    ;;
    
  "status")
    echo "📊 Git Workflow Status"
    echo "======================"
    echo ""
    echo "Current branch: $(git branch --show-current)"
    echo ""
    echo "Branch status:"
    git branch -vv
    echo ""
    echo "Uncommitted changes:"
    git status --short
    ;;
    
  *)
    echo "Git Workflow Helper for WMS"
    echo "============================"
    echo ""
    echo "Commands:"
    echo "  start-feature <name>    - Start new feature branch from dev"
    echo "  finish-feature          - Merge current feature branch to dev"
    echo "  promote-to-prod         - Promote dev to production"
    echo "  hotfix <name>           - Start hotfix branch from production"
    echo "  finish-hotfix           - Merge hotfix to production and dev"
    echo "  status                  - Show current git status"
    echo ""
    echo "Examples:"
    echo "  ./scripts/git-workflow.sh start-feature lot-lifecycle"
    echo "  ./scripts/git-workflow.sh finish-feature"
    echo "  ./scripts/git-workflow.sh promote-to-prod"
    echo "  ./scripts/git-workflow.sh hotfix critical-bug"
    ;;
esac


