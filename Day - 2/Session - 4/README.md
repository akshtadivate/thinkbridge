# Web Playground

This repository is for practicing web development and Git fundamentals.  
Each session builds on the previous one with clear deliverables.

---

## Session 1: VS Code Fundamentals and Extensions

- Explored VS Code interface, Command Palette, and Settings Sync.  
- Installed and configured essential extensions:
  - Prettier – Code Formatter
  - Live Server
  - ESLint  
- Configured Prettier as default formatter with format on save.  

### Deliverables
- `.vscode/settings.json` with Prettier and ESLint configuration.  
- README with installed extensions and setup notes.  

---

## Session 2: Git Basics – Local Workflow

- Initialized Git repo and set default branch to `main`.  
- Configured `user.name` and `user.email`.  
- Created `.gitignore` for common files.  
- Practiced:
  - `git add`, `git commit`
  - `git log --oneline`
  - `git diff`, `git diff --cached`
  - `git restore` and `git restore --staged`  

### Deliverables
- Repository `web-playground` initialized.  
- `.gitignore` committed.  
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).  

---

## Session 3: HTML Foundations – Semantic Structure

- Built semantic HTML profile page with header, nav, main, article, aside, and footer.  
- Used Live Server to preview in browser.  
- Validated HTML with [W3C Validator](https://validator.w3.org/nu/).  

### Deliverables
- `index.html` with semantic structure and placeholder content.  
- Screenshot of validator results saved at `screenshots/validator-result.png`.  
- Multiple meaningful commits documenting progress.  

---

## Session 4: Push to Private GitHub Repo

- Created **private GitHub repository** named `web-playground`.  
- Linked local repo and pushed changes:
  ```bash
  git remote add origin https://github.com/akshtadivate/web-playground.git
  git branch -M main
  git push -u origin main
