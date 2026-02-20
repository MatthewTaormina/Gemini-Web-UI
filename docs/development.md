# Development Guide

Welcome to the Gemini Web UI development guide. This document provides an overview of the project's codebase and contribution guidelines.

## 1. Project Structure

- **`src/client`**: React-based frontend components and layouts.
- **`src/server`**: Express-based backend API and services.
- **`src/shared`**: Shared types, utilities, and constants.
- **`src/apps`**: Modular sub-apps (Chat, Notes, etc.).

---

## 2. Build Commands

- **`npm run build:client`**: Compiles the React application using Vite.
- **`npm run build:server`**: Compiles the Express application using TypeScript.
- **`npm start`**: Starts the production build.
- **`npm run dev`**: Starts Vite (3000) and Express (3001) in development mode.

---

## 3. Contributing

1.  **Fork the Repository**: Create a fork of the Gemini-Web-UI repository.
2.  **Clone the Repository**: Clone your fork to your local machine.
3.  **Create a New Branch**: Create a new branch for your feature or bug fix.
4.  **Make Your Changes**: Implement your changes and ensure they follow the project's style and conventions.
5.  **Test Your Changes**: Run tests and verify your changes in the development environment.
6.  **Create a Pull Request**: Submit a pull request to the main repository.

---

## 4. Coding Standards

- **TypeScript**: Use strict TypeScript for all new code.
- **CSS**: Prefer Vanilla CSS for styling.
- **Indentation**: Use 2-space indentation for all files.
- **Naming Conventions**: Use PascalCase for React components and camelCase for variables and functions.
- **Documentation**: Document all new features and major architectural changes.
