# GitHub setup

The local repository has a main branch. Install the GitHub CLI and sign in to the intended account. From the repository root, run:

```sh
gh auth login
gh repo create tilebook --private --source=. --remote=origin --push
```

Set the real team in .github/CODEOWNERS and enable branch protection and required checks. Actions workflows are included. The repository has not been pushed from this machine.
