# Contributing to Grocery Scanner AI

First off, thank you for considering contributing to Grocery Scanner! Getting started with Open Source can be daunting, but we want this repository to be a welcoming environment for all engineers, AI researchers, and designers.

## 🧠 Core Philosophy
This codebase strictly follows a **Specialized Multi-Agent architecture**. 

If you are expanding functionality, **do not build monolithic handlers**. Code logic should be separated by *responsibility*. Ask yourself: "Does this logic fit nicely into an existing Agent, or does it mean I need to create a new Agent?"

All AI-model logic and prompts exist in the `.agent/agents/` markdown files. **Never hardcode prompts inside the JavaScript strings.** 

## 🛠 How to Contribute

### 1. Find an Issue
Look through the existing issues to see what developers are working on. If you want to work on something new, please **open an issue first** so we can discuss the feature before you spend hours coding it!

### 2. Branch and Develop
Fork the repository, clone it locally, and create a branch for your feature:
```bash
git checkout -b feature/your-awesome-feature
```

### 3. Make Your Changes
Write your code, ensuring you follow these standards:
- Use clear variable names instead of complex one-liners.
- If you alter any AI prompts in `.agent/agents/`, you must thoroughly test them for regression.
- Validate any UI changes on Mobile screen sizes (specifically iPhone Safari layout dimensions).

### 4. Submit a Pull Request
Push the branch to your fork and submit a Pull Request (PR).
- Give your PR a clear title.
- Explain the "Why" and the "How".
- Add screenshots if there are UI changes!

## 🐞 Reporting Bugs

If you find a bug:
1. Check existing issues to see if it has already been reported.
2. If it hasn't, open a new issue.
3. Include your Device (e.g., iPhone 15 Pro), OS, and specific reproduction steps.

Happy Coding! 🛒🚀
