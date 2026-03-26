#!/bin/bash

set -e  # Exit immediately if any command fails

echo "----------- Git Push -----------"

# Detect current branch
branch_name=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: $branch_name"


# Protect main branch
if [ "$branch_name" = "main" ]; then
    echo "⚠ You are pushing to main."
    read -p "Type YES to confirm: " confirm
    if [ "$confirm" != "YES" ]; then
        echo "Push aborted."
        exit 1
    fi
fi

# Show current status
echo ""
echo "Current changes:"
git status
echo ""

# Ask commit message
read -p "Enter commit message: " commit_message

if [ -z "$commit_message" ]; then
    echo "Commit message cannot be empty."
    exit 1
fi

# Select commit type
echo ""
echo "Select commit type:"
echo "1) feat"
echo "2) fix"
echo "3) refactor"
echo "4) docs"
echo "5) chore"
read -p "Choice: " type_choice

case $type_choice in
  1) prefix="feat" ;;
  2) prefix="fix" ;;
  3) prefix="refactor" ;;
  4) prefix="docs" ;;
  5) prefix="chore" ;;
  *) echo "Invalid choice."; exit 1 ;;
esac

full_commit_message="$prefix: $commit_message"

# Stage changes
echo ""
echo "Adding changes..."
git add .

# Check if anything is staged
if git diff --cached --quiet; then
    echo "No changes staged. Nothing to commit."
    exit 0
fi

# Commit
echo "Committing..."
git commit -m "$full_commit_message"

# Run tests if package.json exists
if [ -f "package.json" ]; then
    echo ""
    echo "Running tests..."
    npm test
fi

# Push
echo ""
echo "Pushing to origin/$branch_name ..."
git push origin "$branch_name"

echo ""
echo "----------- Push Complete -----------"