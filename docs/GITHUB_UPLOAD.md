# GitHub upload

```bash
git init
git add .
git commit -m "Add MUHAN web runner"
git branch -M main
```

With GitHub CLI:

```bash
gh repo create YOUR_ID/muhan-web-runner --public --source=. --remote=origin --push
```

Without GitHub CLI, create an empty repository on GitHub and then:

```bash
git remote add origin git@github.com:YOUR_ID/muhan-web-runner.git
git push -u origin main
```

## Vendored upstream warning

`vendor/muhan` is optional. Do not blindly commit vendored upstream source to a public repository unless you have reviewed the upstream rights and license terms.
