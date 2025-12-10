# Git Workflow Guide

This project uses a **two-branch workflow** with `production` and `dev` branches.

## Branch Strategy

### Branches

- **`production`** - Stable, production-ready code
- **`dev`** - Development branch for ongoing work
- **`feature/*`** - Feature branches created from `dev`
- **`hotfix/*`** - Hotfix branches created from `production`

## Workflow

### Daily Development

1. **Start a new feature:**
   ```bash
   ./scripts/git-workflow.sh start-feature my-feature-name
   ```
   This will:
   - Switch to `dev`
   - Pull latest changes
   - Create and switch to `feature/my-feature-name`

2. **Make your changes:**
   ```bash
   # Edit files, test, etc.
   git add .
   git commit -m "feat: Add new feature"
   ```

3. **Finish the feature:**
   ```bash
   ./scripts/git-workflow.sh finish-feature
   ```
   This will:
   - Merge your feature branch into `dev`
   - Push to remote
   - Delete the feature branch

### Promoting to Production

When `dev` is stable and ready:

```bash
./scripts/git-workflow.sh promote-to-prod
```

This will:
- Merge `dev` into `production`
- Push to remote
- Production is now updated

### Hotfixes

For critical production fixes:

1. **Start hotfix:**
   ```bash
   ./scripts/git-workflow.sh hotfix critical-bug-fix
   ```

2. **Fix the issue and commit:**
   ```bash
   git add .
   git commit -m "fix: Critical bug fix"
   ```

3. **Finish hotfix:**
   ```bash
   ./scripts/git-workflow.sh finish-hotfix
   ```
   This merges the hotfix to both `production` AND `dev`

## Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting (no code change)
- `refactor` - Code restructuring
- `perf` - Performance improvement
- `test` - Adding tests
- `chore` - Maintenance tasks

### Examples

```bash
git commit -m "feat(inventory): Add lot lifecycle sheet component"
git commit -m "fix(auth): Resolve password reset issue"
git commit -m "refactor(actions): Consolidate inventory actions"
git commit -m "chore(deps): Update Prisma to 6.19.0"
```

## Manual Commands

If you prefer manual commands:

### Feature Workflow

```bash
# Start feature
git checkout dev
git pull origin dev
git checkout -b feature/my-feature
# ... make changes ...
git add .
git commit -m "feat: Description"
git checkout dev
git merge feature/my-feature
git branch -d feature/my-feature
```

### Promote to Production

```bash
git checkout dev
git pull origin dev
git checkout production
git merge dev
git push origin production
```

### Hotfix Workflow

```bash
# Start hotfix
git checkout production
git checkout -b hotfix/critical-fix
# ... fix issue ...
git add .
git commit -m "fix: Critical fix"
# Merge to production
git checkout production
git merge hotfix/critical-fix
# Merge to dev
git checkout dev
git merge hotfix/critical-fix
git branch -d hotfix/critical-fix
```

## Best Practices

1. **Always work on feature branches**, never directly on `dev` or `production`
2. **Test thoroughly** before promoting to production
3. **Write descriptive commit messages**
4. **Keep commits focused** - one logical change per commit
5. **Pull before pushing** to avoid conflicts
6. **Use the helper script** for consistency

## Status Check

Check your current git status:

```bash
./scripts/git-workflow.sh status
```

## Troubleshooting

### Merge Conflicts

If you encounter merge conflicts:

```bash
# Resolve conflicts in your editor
git add .
git commit -m "Merge: Resolve conflicts"
```

### Undo Last Commit (Keep Changes)

```bash
git reset --soft HEAD~1
```

### Discard Local Changes

```bash
git restore <file>
# or
git restore .
```

### View Branch Differences

```bash
git diff dev..production
```

## Remote Setup

If you have a remote repository:

```bash
# Push branches
git push origin production
git push origin dev

# Set upstream
git push -u origin production
git push -u origin dev
```

## Release Tags

When promoting to production, consider creating a tag:

```bash
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```


