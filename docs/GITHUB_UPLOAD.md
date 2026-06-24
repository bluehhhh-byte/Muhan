# GitHub Upload Guide

## 1. Create the repository locally

```bash
git init
git add .
git commit -m "Initial MUHAN web runner"
git branch -M main
```

## 2. Create a remote repository

With GitHub CLI:

```bash
gh repo create YOUR_ID/muhan-web-runner --public --source=. --remote=origin --push
```

Without GitHub CLI:

1. Create an empty repository on GitHub.
2. Copy its SSH or HTTPS URL.
3. Push manually:

```bash
git remote add origin git@github.com:YOUR_ID/muhan-web-runner.git
git push -u origin main
```

## 3. Pin upstream for reproducibility

After confirming a working build, edit `.env` or your deployment environment:

```env
MUHAN_REF=<known-working-commit-sha>
```

Using a fixed commit protects your deployment from future upstream changes.
