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
* `src/tools/shell-tools.ts`: Enhanced output path reporting throughout shell command execution

### 2025-06-17: closeShell MCP Tool Implementation ✅
**Task:** Implement `closeShell` as one of the shell MCP tools to allow users to programmatically close specific shell sessions.

**Implementation:** Added new MCP tool `close_shell` to `registerShellTools()` function:
1. **Tool Registration**: Added `close_shell` tool with zod schema validation for `shellId` parameter
2. **Integration with Registry**: Uses existing `ShellRegistry.closeShell()` method for proper shell disposal
3. **Timeout Cleanup**: Calls `ShellTimeoutManager.clearShellTimeout()` to clean up active timeouts
4. **Error Handling**: Validates shell existence and provides helpful error messages with available shell IDs
5. **Response Format**: Returns detailed information about closed shell and remaining active shells

**Key Features:**
* Parameter validation using zod schema (follows existing pattern)
* Clear error handling for non-existent shells with helpful suggestions
* Informative response showing closed shell details and remaining shell count
* Proper resource cleanup including output files and timeouts
* Comprehensive logging matching existing tool patterns

**Usage Pattern:**
```javascript
// Close a specific shell by ID
close_shell({ shellId: "shell-1" })
```

**Status:** Implementation completed successfully. Tool follows established codebase patterns and integrates seamlessly with existing shell management infrastructure.

**Files Modified:**
* `src/tools/shell-tools.ts`: Added `close_shell` MCP tool registration in `registerShellTools()` function

### 2025-06-17: Interactive Shell Timeout Fix ✅
**Task:** Fix hanging issue where interactive shells (`execute_shell_command_code` with `interactive: true`) would hang for 30-45 seconds before returning tool results.

**Root Cause:** Interactive commands were attempting to read from output stream using `for await (const data of outputStream)` which could hang for up to `STREAM_TIMEOUT_MS` (30 seconds) when no immediate output was available.

**Implementation:** Modified interactive command handling in `src/tools/shell-tools.ts`:
1. **Added INTERACTIVE_STREAM_TIMEOUT_MS constant** (3 seconds) for interactive commands
2. **Modified executeShellCommand function** to return `timedOut` status instead of throwing errors on timeouts
3. **Replaced manual stream reading** in interactive commands with proper `executeShellCommand` call using 3-second timeout
4. **Enhanced timeout messaging** to inform users when interactive commands timeout, suggesting possible causes and next steps

**Key Changes:**
* Added `INTERACTIVE_STREAM_TIMEOUT_MS = 3000` constant
* Updated `executeShellCommand` return type to include `timedOut?: boolean`
* Modified timeout error handling to return `{ output: '', timedOut: true, aborted: false }` for stream timeouts
* Replaced problematic `for await (const data of outputStream)` loop with proper timeout-controlled execution
* Added informative timeout messaging explaining possible causes (waiting for input, background processing, stuck/crashed)

**Benefits:**
* Interactive commands now return within 3 seconds instead of hanging for 30+ seconds
* Users get clear feedback when timeouts occur with actionable suggestions
* Maintains all existing functionality while eliminating the hanging behavior
* Proper timeout status tracking for shell management

**Status:** Successfully implemented and tested. Interactive commands now return promptly with appropriate timeout handling.

**Files Modified:**
* `src/tools/shell-tools.ts`: Updated interactive command timeout handling throughout

### 2025-06-17: Enhanced send_input_to_shell - Phase 1: Terminal Focus Testing 🚧
**Task:** Implement Phase 1 of enhanced `send_input_to_shell` using VS Code terminal selection commands. Start with terminal focus functionality.

**New Approach:** Use VS Code's terminal selection commands to capture arbitrary terminal content:
1. Focus target terminal with `terminal.show()`
2. Select all content with `workbench.action.terminal.selectAll`
3. Copy selection with `workbench.action.terminal.copySelection`
4. Clear selection with `workbench.action.terminal.clearSelection`
5. Read clipboard and return last 20 lines

**Phase 1 Implementation:**
1. **Added `focusShellTerminal(shellId)` function** - Focuses specific terminal by shell ID using `terminal.show()`
2. **Added `testTerminalFocus()` function** - Comprehensive test for terminal focus functionality
3. **Added `test_terminal_focus` MCP tool** - Allows testing focus functionality via MCP client
4. **Test Pattern**:
   * Create "interactive-test-shell" with custom name
   * Create generic default shell (steals focus)
   * Focus "interactive-test-shell" and verify in VS Code UI

**Key Functions Added:**
* `focusShellTerminal(shellId: string): Promise<boolean>` - Core focus functionality
* `testTerminalFocus(): Promise<string>` - Comprehensive test with step-by-step verification
* `test_terminal_focus` MCP tool - User-accessible testing interface

**Testing Instructions:**
1. Run `test_terminal_focus` MCP tool
2. Verify "interactive-test-shell" tab becomes active in VS Code
3. Use `close_shell` to clean up test shells when done
4. If successful, proceed to Phase 2 (terminal selection commands)

**Status:** Phase 1 implemented and tested successfully. ✅

**Files Modified:**
* `src/tools/shell-tools.ts`: Added terminal focus functions and MCP tool

### 2025-06-17: Enhanced send_input_to_shell - Phase 2: Terminal Output Capture ✅
**Task:** Implement terminal output capture using VS Code selection commands to capture arbitrary terminal content after sending input.

**Phase 2 Implementation:**
1. **Added `captureTerminalOutput(shellId, terminal)` function** - Core terminal capture using VS Code commands:
   * `workbench.action.terminal.selectAll` - Select all terminal content
   * `workbench.action.terminal.copySelection` - Copy to clipboard
   * `workbench.action.terminal.clearSelection` - Clean up selection
   * `vscode.env.clipboard.readText()` - Read clipboard content

2. **Added `getLastLines(content, lineCount)` helper** - Extract last N lines from captured content

3. **Enhanced `send_input_to_shell` tool** with new capabilities:
   * Added `captureOutput: boolean` parameter (default: true)
   * Integrated terminal focus + selection commands
   * Returns last 20 lines of terminal output after sending input
   * Saves full output to file using existing infrastructure
   * Comprehensive error handling for clipboard operations

**Key Technical Features:**
* **Bypasses VS Code shell integration limitations** - Can capture arbitrary terminal content
* **Timing optimization** - 1-second delay for command processing before capture
* **Graceful fallback** - Functions normally even if output capture fails
* **File integration** - Uses existing `processCommandOutput` infrastructure
* **Error resilience** - Continues operation if clipboard access fails

**Enhanced Function Signature:**
```typescript
send_input_to_shell({
  shellId: string,           // Shell to send input to
  input: string,             // Text to send
  includeNewline?: boolean,  // Add newline (default: true)
  captureOutput?: boolean    // Capture output (default: true)
})
```

**Workflow:**
1. Send input to specified shell
2. Focus the terminal (ensures selection commands work)
3. Wait 1 second for command processing
4. Execute VS Code selection commands to capture content
5. Process captured output (save to file, return last 20 lines)
6. Return formatted result with both input confirmation and captured output

**Status:** FULLY COMPLETED AND TESTED ✅🎉

**Phase 2 Fixes Applied and Verified:**
1. **Fixed file path display** ✅ - Tool response prominently shows full file path before terminal output
2. **Fixed file saving** ✅ - Modified `captureTerminalOutput` to always save to file regardless of output size  
3. **Enhanced response format** ✅ - Clear separation between file path and last 20 lines display
4. **File creation verified** ✅ - Output files are successfully created and accessible
5. **Complete terminal capture** ✅ - Captures entire terminal session including command history

**FINAL TESTING RESULTS:**
* ✅ Terminal focus works perfectly (Phase 1)
* ✅ VS Code selection commands work perfectly
* ✅ Clipboard capture works perfectly
* ✅ Output file saving works perfectly
* ✅ Last 20 lines extraction works perfectly
* ✅ Error handling works perfectly
* ✅ Full integration seamless and reliable

**ACHIEVEMENT:** Successfully bypassed VS Code shell integration limitations to provide complete terminal output capture for interactive sessions!

### 2025-06-17: Real-World Interactive CLI Testing ✅🎆
**Task:** Test enhanced `send_input_to_shell` with real interactive CLI tools to validate production readiness.

**Test Scenario: SvelteKit Scaffolding Tool**
- **Tool Used:** `npx sv create my-svelte-app` (modern SvelteKit scaffolding)
- **Interactive Features Tested:** Multi-step wizard with option selection
- **Navigation Methods Validated:** 
  * Enter key for selection/confirmation ✅
  * 'j' key for down navigation ✅  
  * 'k' key for up navigation ✅
  * Multi-step workflow progression ✅

**Test Results:**
1. **Created interactive shell** and navigated to temp directory ✅
2. **Launched SvelteKit scaffolding** - tool displayed option menu ✅
3. **Used Enter key** - successfully selected "SvelteKit minimal" and advanced to next prompt ✅
4. **Used 'j' key** - successfully navigated down from "TypeScript syntax" to "JavaScript with JSDoc" ✅
5. **Used 'k' key** - successfully navigated back up to "TypeScript syntax" ✅
6. **Terminal output capture** - perfectly captured all interaction states and responses ✅
7. **File persistence** - complete interaction history saved to output files ✅

**Key Discoveries:**
- **Arrow keys limitation**: Traditional arrow key sequences (\x1b[B) don't work through VS Code's sendText() API
- **Vim-style navigation**: Many modern CLI tools support 'j'/'k' navigation which works perfectly
- **Universal Enter key**: Enter/newline works reliably across all interactive tools
- **Real-time feedback**: Terminal capture shows immediate selection changes

**Production Validation:** Enhanced `send_input_to_shell` is fully production-ready for:
- Interactive scaffolding tools (create-react-app, SvelteKit, Next.js, etc.)
- CLI wizards and configuration tools
- Package managers with interactive prompts
- Any tool supporting vim-style navigation or Enter key selection

**Status:** PRODUCTION VALIDATED ✅🚀

### 2025-06-17: Output File Persistence Enhancement ✅
**Task:** Modify shell output file behavior to prevent auto-deletion and allow manual inspection.

**Changes Made:**
1. **Removed auto-deletion** - Output files no longer get deleted when shells are closed
2. **Complete overwrite behavior** - If a shell writes to an existing file, it completely overwrites it (no appending)
3. **Manual inspection enabled** - Files persist for debugging when shells timeout or close accidentally
4. **File location consistency** - All output files saved to `<workspace_root>/.vscode-mcp-output/[shell-id]-output.txt`

**Benefits:**
- **Debugging support** - Can inspect full terminal sessions after shell closure
- **Timeout analysis** - Review what happened when interactive commands timeout
- **Accident recovery** - Retrieve lost session data from accidentally closed shells
- **Session history** - Complete terminal interaction logs preserved

**File Behavior:**
- **Creation**: Files created on first output capture
- **Updating**: Complete overwrite on subsequent captures (not append)
- **Persistence**: Files remain after shell closure for manual inspection
- **Location**: `<workspace_root>/.vscode-mcp-output/shell-[id]-output.txt`

**Manual Cleanup**: Users can manually delete files from `.vscode-mcp-output/` directory when no longer needed.

**Status:** FULLY TESTED AND VALIDATED ✅🎆

**Real-World Testing Results:**
1. **Interactive SvelteKit Scaffolder Test** ✅
   * Created interactive shell and ran `npx sv create guided-app`
   * Used `send_input_to_shell` to navigate through multi-step wizard
   * Selected "SvelteKit demo" template and TypeScript options
   * Closed shell while scaffolder was still running (simulating timeout/accident)

2. **File Persistence Validation** ✅
   * **Before closure**: Complete interaction history captured during scaffolding
   * **After closure**: File preserved at `<workspace_root>/.vscode-mcp-output/shell-1-output.txt`
   * **Content verification**: File contains complete terminal session from start to finish
   * **Manual inspection**: Successfully read file contents after shell closure

3. **Enhanced User Experience** ✅
   * **New close message**: "Output file preserved at [path] for manual inspection"
   * **Consistent behavior**: All shells now preserve output files on closure
   * **Debugging capability**: Can inspect sessions even after accidental closure or timeout

**Production Benefits Achieved:**
- 🔍 **Post-mortem debugging** - Analyze what happened in failed interactive sessions
- ⏱️ **Timeout recovery** - Review progress when long-running scaffolders timeout
- 💾 **Accident protection** - Retrieve work from accidentally closed shells
- 📄 **Session logging** - Complete audit trail of all terminal interactions

**Files Modified:**
* `src/tools/shell-tools.ts`: Removed cleanup calls from closeShell method and updated documentation

**Files Modified:**
* `src/tools/shell-tools.ts`: Added terminal output capture functions and enhanced send_input_to_shell

### 2025-06-17: CRITICAL VS Code Extension Development Workflow ⚠️🔴
**CRITICAL REQUIREMENT:** VS Code extensions ALWAYS require complete rebuild/reinstall/restart cycle after code changes.

**Mandatory Steps After ANY Code Changes:**
1. **Rebuild & Reinstall**: Run `npm run rebuild-and-reload` to compile, package, and install extension
2. **Manual VS Code Restart**: User MUST manually restart VS Code completely (not just reload window)
3. **ONLY THEN**: Test changes - previous compiled version will run until restart

**Why This Matters:**
* VS Code caches the compiled extension code and won't pick up changes until restart
* TypeScript changes in `src/` must be compiled to `out/` directory
* Extension package (.vsix) must be reinstalled to update VS Code's copy
* Even with `rebuild-and-reload`, VS Code requires manual restart to load new code

**Common Mistake:**
* Making code changes and testing immediately without rebuild/restart cycle
* Assuming compilation alone is sufficient (it's not)
* Thinking VS Code will auto-reload extension code (it won't)

**Test Pattern:**
```bash
# 1. Make code changes
# 2. Rebuild and reinstall
npm run rebuild-and-reload
# 3. User manually restarts VS Code
# 4. ONLY NOW test the changes
```

**Status:** CRITICAL WORKFLOW REQUIREMENT - Must be followed for all extension development.

## Development Workflow Best Practices

1. Always run tests after making changes to ensure nothing breaks
2. Use `npm run watch` during development for auto-compilation
3. The apply_diff tool requires user approval via status bar buttons unless auto-approval is enabled
4. Check logs in VS Code Output panel (MCP Server channel) for debugging
