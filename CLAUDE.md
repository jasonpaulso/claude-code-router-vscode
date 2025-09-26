# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VS Code extension that integrates Claude Code with MCP (Model Context Protocol) server configurations. The extension adds a toolbar button that launches Claude Code in a split terminal, optionally with selected MCP server configurations.

## Build and Development Commands

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

# Lint the codebase
npm run lint

# Run tests
npm test

# Build extension package (.vsix)
npm run vscode:prepublish
vsce package  # requires vsce to be installed globally
```

## Architecture

### Core Components

**Extension Entry Point** (`src/extension.ts`):
- `activate()`: Registers commands and initializes the extension
- `selectMcpServers()`: Main workflow for MCP server selection
- `McpServersContentProvider`: Virtual document provider for MCP server configurations

### MCP Server Configuration Workflow

1. **Discovery**: Scans `.vscode/` directory for `*mcp.json` files
2. **Parsing**: Reads and merges all MCP server configurations from found JSON files
3. **Selection**: Shows multi-select QuickPick UI for server selection
4. **Temporary File**: Creates temporary JSON file with selected servers in OS temp directory
5. **Command Execution**: Runs `claude` command with `--mcp-servers` flag pointing to temp file

### Key Paths and Patterns

- MCP configuration files: `.vscode/*mcp.json`
- Expected JSON structure: `{ "servers": { "serverName": { "command": "...", "args": [...] } } }`
- Terminal command: `claude --mcp-servers <temp-file-path>`

### VS Code Integration Points

- **Command**: `claude-code-configured.runClaudeCodeConfigured` - Main command that triggers the workflow
- **Editor Title Button**: Icon button in editor toolbar for quick access
- **Terminal**: Creates split-view terminal with custom icon
- **QuickPick**: Multi-select UI for MCP server selection

## TypeScript Configuration

- Target: ES2022
- Module: Node16
- Strict mode enabled
- Source maps enabled for debugging