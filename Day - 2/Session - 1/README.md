# Session 1: VS Code Fundamentals and Extensions

This session covers the basics of Visual Studio Code (VS Code), including the user interface, command palette, settings sync, and installing and using essential extensions.

---

## VS Code Fundamentals

### User Interface
Explorer, Search, Source Control, Run and Debug, Extensions  
Side Bar: Displays contents of the selected activity  
Editor Area: Where files are opened and edited  
Status Bar: Shows Git branch, language mode, errors or warnings, line and column number  
Panel: Terminal, Debug Console, Problems, Output  

---

## Installed Extensions

### 1. Prettier – Code Formatter
  Purpose of prettier is to ensures consistent code formatting  
  It is used for Formats code automatically on save  

### 2. Live Server

  Purpose of Live server is to runs a local development server with live reload for HTML, CSS, JavaScript  
  To used this - Right-click an HTML file and select Open with Live Server  
  It is mainly used for immediate preview of changes in browser  

### 3. ESLint
  
  Purpose of this is to detects syntax errors and enforces coding standards in JavaScript and TypeScript  
  Used for Highlights issues in editor and provides quick fixes   

---


### .vscode/settings.json

```json
{
  "editor.defaultFormatter"; "esbenp.prettier-vscode",
  "editor.formatOnSave"; true,
  "files.autoSave"; "afterDelay",
  "files.autoSaveDelay"; 1000,
  "eslint.enable"; true
}
```
