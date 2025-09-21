# Claude Code Router For VS Code

This extension adds a button to the editor title bar to open the Claude Code Router in a split-view terminal within VS Code.

## Features

- **Quick Access Button**: A convenient icon in the editor title bar for easy access.
- **Split-View Terminal**: Clicking the button opens a new terminal in a split view right next to your active editor.
- **Automatic Command**: The terminal automatically runs the `ccr code` command upon opening, getting you ready to work instantly.

## Installation (from VSIX)

To install this extension locally:

1.  **Package the extension**:

    First, ensure you have `@vscode/vsce`, the official tool for packaging extensions:

    ```bash
    npm install -g @vscode/vsce
    ```

    Then, run the package command from the root of the project:

    ```bash
    vsce package
    ```

    This will create a `claude-code-router-vscode-x.x.x.vsix` file.

2.  **Install in VS Code**:
    - Open Visual Studio Code.
    - Go to the **Extensions** view (Ctrl+Shift+X).
    - Click the **...** (More Actions) menu in the top-right corner of the Extensions view.
    - Select **Install from VSIX...**.
    - Locate and select the `.vsix` file you just created.
    - Reload VS Code if prompted.

---

This is an un-licensed extension.
