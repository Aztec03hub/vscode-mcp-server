# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## System Message

You are working on an existing vscode workspace, `vscode-mcp-server`, it's a vscode project which you can access using your mcp tools. These code tools interact with the VS Code workspace. Your main tools should be used via the `vscode-mcp-server` mcp server, namely the `read_file_code` tool to read files, `apply_diff` to make single and/or multiple code changes to files (it will also create new, non-existing files if the search block is left empty), and `execute_shell_command_code` to execute shell commands in the vscode instance.

Before running code tools that will make any modification to code, always present a comprehensive and detailed plan to the user, including your confidence level (out of 10). When planning, use your tools to explore the codebase so that you understand the context of the project. If you are not confident in your plan because you require more information, use your tools, such as web search, to look for this information or ask the user.

IMPORTANT: Only run code tools that will modify code after presenting such a plan to the user, and receiving explicit approval. Approval must be given each time; prior approval for a change does not imply that subsequent changes are approved. You should always start by using the `get_workspace_context` tool, and use it whenever you need to update your own knowledge of the current workspace context (The tool will also tell you the current working directory). Break down large tasks into smaller tasks, thinking carefully about how to best accomplish them using elegant, modular code with sleek and maintainable style.
Always think carefully about how to proceed, especially if a tool fails. When making large changes to a source file, always try to check for syntax errors after making modifications. When many errors or syntax issues exist, your main pattern to fix should be to re-read the file in its entirety, think carefully about the changes you need to make to fix the issues, then use apply_diff to make those careful changes, then check for syntax issues, warnings and errors, and continue that cycle until all problems are fixed.

MUST-FOLLOW RULES:
(NON-NEGOTIABLE)
* ALWAYS read any source file in full the first time, using the`read_file_code` tool. If many changes are being made to a source file, or during debug>fix>test cycles, be sure to re-read the entire relevant source file in full, because sometimes errors or warnings will exist that you may not be aware of *unless* you read the file in full.
* ALWAYS after making modifications to a file with the `apply_diff` tool, check for source file warnings and/or errors using the `get_diagnostics_code` tool. You MUST fix any found issues first, before moving on to other tasks or files.
* ALWAYS run a linter or prettier (we use eslint and tslint for many projects) *after* source file warnings and/or errors are fixed.
* ALWAYS maintain a `MEMORY.md` file to keep track of important things you should remember across conversations and tasks - for example, if you tried a task a few times and had difficulty but finally figured out how to do it, create a concise memory in the `MEMORY.md` file about it. This is especially important for tool invocation and usage, and benefits you so you can complete tasks to the highest degree, quality, and with little time spent. It will also benefit you to create and maintain memories of stylistic decisions, flows, code patterns, testing patterns, and even instructional patterns (given from me to you about your task or tasks at-hand).
* ALWAYS manage any task list, plan, implementation guide, or other markdown format (*.md) file that you're told to leverage or use when interacting with a project, ESPECIALLY managing and updating any lists (ESPECIALLY TASK LISTS) by entering checkmark emojis `✅` to visually indicate a list entry has been completed.

## Common Development Commands

### Build & Test
```bash
npm run compile        # Compile TypeScript to JavaScript
npm run watch          # Auto-compile on changes
npm test               # Run all tests (includes lint)
npm run lint           # Run ESLint checks
npm run build          # Build .vsix extension package
```

### Quick Development Cycle
```bash
npm run rebuild-and-reload  # Build, install, and reload extension in one command
```

### Running Specific Tests
```bash
npm test -- --grep "TestName"     # Run specific test by name
npm run test:shell                # Run shell-specific tests
```

## Architecture Overview

This is a VS Code extension that implements an MCP (Model Context Protocol) server, exposing VS Code functionality to AI assistants.

### Key Components

1. **Extension Layer** (`src/extension.ts`)
   * Manages VS Code lifecycle and UI elements (status bar)
   * Handles server start/stop and auto-approval modes
   * Bridges VS Code commands with MCP server

2. **MCP Server** (`src/server.ts`)
   * Express.js-based HTTP server implementing MCP protocol
   * Registers and exposes tools to MCP clients
   * Manages client connections via StreamableHTTPServerTransport

3. **Tool Implementations** (`src/tools/`)
   * `file-tools.ts`: File operations (list_directory, read_file)
   * `edit-tools.ts`: File editing (create_or_overwrite, replace_lines, **apply_diff**)
   * `shell-tools.ts`: Execute shell commands with safety features
   * `diagnostics-tools.ts`: Get code errors/warnings
   * `symbol-tools.ts`: Search symbols and find definitions

### Special Focus: apply_diff Tool

The `apply_diff` tool is a major enhancement featuring:
* **Multiple diff sections** support in a single file
* **Fuzzy content matching** with multiple strategies (exact, normalized, contextual, similarity)
* **VS Code diff viewer** integration with status bar approval buttons
* **Atomic operations** - all changes applied or none
* Located in `src/tools/edit-tools.ts` starting around line 800+

## Testing Requirements

Before running tests, you must rebuild the extension after code changes:
```bash
npm run compile
npm run build
npm run install-extension
npm test
```

The test suite includes:
* Unit tests for individual components
* Integration tests for end-to-end workflows
* Specific apply_diff functionality tests with fuzzy matching scenarios
* Shell tool safety and output limiting tests

## apply_diff Tool Details

### Current Implementation Status
* ✅ Phase 1: Core functionality with fuzzy matching
* ✅ Phase 2: Enhanced UX with status bar buttons
* 🔲 Phase 3: Advanced features (partial application, conflict resolution)

### Key Features
1. **Fuzzy Matching System** - Handles whitespace variations and content drift
2. **Multiple Diff Support** - Apply multiple changes atomically
3. **Status Bar UI** - Clean approval interface (Apply/Reject/Info buttons)
4. **Comprehensive Validation** - Overlap detection, conflict resolution

### Data Structures
```typescript
interface DiffSection {
  startLine: number;     // 0-based
  endLine: number;       // 0-based, inclusive
  originalContent: string;
  newContent: string;
  description?: string;
}
```

## Memory Entries

### 2025-06-10: Shell Output File Path Reporting Improvement ✅
**Task:** Improve shell output file path reporting to show full workspace-relative paths instead of just filenames.

**Implementation:** Modified `src/tools/shell-tools.ts` to:
1. Enhanced `saveOutputToFile()` function to return both file path and base directory metadata
2. Updated `processCommandOutput()` function to format display paths as `<workspace_root>/.vscode-mcp-output/filename` or `<cwd>/.vscode-mcp-output/filename`
3. Used existing `ensureOutputDirectory()` logic to determine workspace root vs fallback directory
4. Added helper function `formatDisplayPath()` to consistently format paths for user display

**Key Insight:** Leveraged existing workspace detection logic in `ensureOutputDirectory()` instead of recalculating, which maintains consistency with how output directory is actually created.

**Status:** Code changes completed and compiled. May require VS Code extension reload to take effect.

**Files Modified:**
- `src/tools/shell-tools.ts`: Enhanced output path reporting throughout shell command execution

## Development Workflow Best Practices

1. Always run tests after making changes to ensure nothing breaks
2. Use `npm run watch` during development for auto-compilation
3. The apply_diff tool requires user approval via status bar buttons unless auto-approval is enabled
4. Check logs in VS Code Output panel (MCP Server channel) for debugging
