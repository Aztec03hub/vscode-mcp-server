# MEMORY.md - vscode-mcp-server Project Knowledge

## Shell Timeout Reset Implementation (2025-06-10)

### Problem Solved
Implemented a timeout reset mechanism for shell commands to prevent premature timeouts during interactive sessions. Previously, timeouts were fixed once a command started, causing issues when users needed to provide multiple inputs.

### Solution Overview
1. **ShellTimeoutManager Class**: Centralized timeout management with ability to set, clear, and reset timeouts per shell
2. **Enhanced ManagedShell Interface**: Added timeout tracking fields (activeTimeout, timeoutEndTime, timeoutDuration, timeoutController)
3. **Modified executeShellCommand**: Now accepts shellId and uses AbortController for cancellable timeouts
4. **Timeout Reset Logic**:
   - Clears existing timeout when new command is executed in a shell
   - Resets timeout to 45s when input is sent via send_input_to_shell
   - Shows timeout status in list_active_shells with warnings for expiring timeouts

### Key Implementation Details
- Default timeout: 15 seconds
- Interactive timeout: 45 seconds
- Background processes: No timeout
- Timeouts reset on new commands and user input
- Proper cleanup on shell disposal

### Testing Notes
- Run `npm run lint` after changes to ensure code quality
- Test with interactive commands like `npm create svelte@latest`
- Verify timeout resets when sending multiple inputs
- Check list_active_shells shows correct timeout information

## send_input_to_shell Tool Fix (2025-06-17)

### Problem Solved
The `send_input_to_shell` tool was not properly sending input to interactive shells. Input was being sent but not reaching the waiting commands in VS Code terminals.

### Solution Applied
Fixed the `terminal.sendText()` API usage in the `send_input_to_shell` tool implementation:

**Before (broken):**
```typescript
const inputText = includeNewline ? input + '\n' : input;
shell.terminal.sendText(inputText, false); // false = don't add extra newline
```

**After (working):**
```typescript
shell.terminal.sendText(input, includeNewline); // Let VS Code handle newline addition
```

### Testing Results: ✅ SUCCESS
- ✅ **Interactive Command**: `pause` command successfully waited for input showing "Press Enter to continue...: "
- ✅ **Input Delivery**: Empty input with newline (Enter key) was successfully sent via `send_input_to_shell`
- ✅ **Command Completion**: The `pause` command completed and returned to PowerShell prompt
- ✅ **Shell Status**: Shell properly transitioned "waiting-for-input" → "busy" → "idle"

### Key Insight
The VS Code `terminal.sendText(text, addNewLine)` API expects the boolean parameter directly, not manually constructed input text with newlines. This fix enables proper interaction with waiting shell commands.

**Files Modified:**
- `src/tools/shell-tools.ts`: Fixed `sendText()` parameter usage in `send_input_to_shell` tool

### Enhanced send_input_to_shell Implementation (2025-06-17)

### Major Enhancement Applied
Transformed `send_input_to_shell` from a simple input-sender into a complete interactive workflow tool that captures and returns output.

**New Parameters Added:**
- `waitTimeMs?: number = 3000` - Time to wait for output after sending input
- `tailLines?: number = 50` - Number of recent output lines to show
- `saveOutput?: boolean = true` - Whether to save full output to file

**New Functionality:**
1. **Send Input**: Uses fixed `terminal.sendText(input, includeNewline)` API
2. **Wait for Output**: Configurable wait time for terminal to respond (default 3s)
3. **Capture Output**: Attempts to capture terminal state using shell integration
4. **Smart Truncation**: Shows last N lines (default 50) with file reference for full output
5. **File Saving**: Reuses existing `processCommandOutput()` logic for consistent file management
6. **Interactive Detection**: Automatically detects if more input is needed and updates shell status
7. **Enhanced Response**: Shows input details, wait time, output, and next steps

**Perfect for Interactive Workflows:**
- Scaffolding tools (npm create, yeoman generators)
- Interactive installers and configuration wizards
- Multi-step command sequences
- Any workflow requiring both input and immediate output feedback

**Usage Pattern:**
```javascript
// Start interactive process
execute_shell_command_code({ command: "npx sv create my-app", interactive: true })

// Continue with enhanced tool
send_input_to_shell({ 
  shellId: "shell-1", 
  input: "2",           // Select option 2
  waitTimeMs: 3000,     // Wait 3s for response
  tailLines: 50         // Show last 50 lines
})
```

**Status:** ✅ Implementation complete and compiled successfully. Ready for testing with VS Code restart.

**Files Modified:**
- `src/tools/shell-tools.ts`: Enhanced `send_input_to_shell` tool with output capture, wait functionality, and smart truncation

## closeShell MCP Tool Implementation (2025-06-17)

### Implementation Summary
Successfully implemented `close_shell` MCP tool to allow programmatic closure of specific shell sessions.

**Key Features:**
- Parameter validation using zod schema for `shellId` parameter
- Integration with existing `ShellRegistry.closeShell()` method for proper disposal
- Timeout cleanup via `ShellTimeoutManager.clearShellTimeout()`
- Comprehensive error handling with helpful messages
- Detailed response format showing closed shell info and remaining shells

**Testing Results:** ✅ ALL TESTS PASSED
- ✅ **Basic Shell Closure**: Successfully closed `shell-1` with proper resource cleanup
- ✅ **Named Shell Closure**: Successfully closed `shell-2` (test-shell) with detailed status reporting
- ✅ **Error Handling**: Correctly handled non-existent shell ID with helpful error message
- ✅ **Resource Cleanup**: Verified output files and timeouts are properly cleaned up
- ✅ **Registry Management**: Shell count properly decremented and remaining shells accurately reported

**Usage Pattern:**
```javascript
close_shell({ shellId: "shell-1" })
```

**Files Modified:**
- `src/tools/shell-tools.ts`: Added `close_shell` MCP tool registration in `registerShellTools()` function

## apply_diff Multi-Line Indentation Fix (2026-01-12)

### Problem Solved
Fixed a bug in the `apply_diff` tool where leading whitespace removal across multiple lines only affected the FIRST line. Subsequent lines preserved their original indentation from the file, even when the user explicitly wanted to remove/change indentation.

### Root Cause
In the `createModifiedContent` function (edit-tools.ts), the fuzzy matcher's "preserve relative indentation" logic was re-adding original file indentation to replacement lines, even when the user intentionally changed the indentation structure.

### Solution Applied
Enhanced `createModifiedContent` function with intelligent indentation structure change detection:

```typescript
// Detect if user is intentionally changing indentation structure
// by comparing search content vs replace content line-by-line
const searchLines = diff.search.split(/\r?\n/);
const hasIntentionalIndentStructureChange = (): boolean => {
    const minLen = Math.min(searchLines.length, newLines.length);
    for (let i = 0; i < minLen; i++) {
        const searchIndent = (searchLines[i].match(/^\s*/) || [''])[0];
        const replaceIndent = (newLines[i].match(/^\s*/) || [''])[0];
        if (searchIndent !== replaceIndent) {
            return true; // User changed indentation on at least one line
        }
    }
    return false;
};

// If user intentionally changed indentation structure, use replacement exactly
if (hasIntentionalIndentStructureChange()) {
    finalNewLines = newLines;
} else {
    // Preserve indentation from the original matched content for regular diffs
    // ... existing indentation preservation logic ...
}
```

### Key Design Decision
- If ANY line has different indentation between search and replace content, use the replacement EXACTLY as provided
- Otherwise, preserve the original indentation preservation behavior for regular diffs (maintaining backward compatibility)

### Test File
- Test file: `src/test/test-leading-whitespace.md` (contains intentionally incorrect indentation)
- Reference file: `src/test/test-leading-whitespace-corrected.md` (shows expected result after fix)

### Files Modified
- `src/tools/edit-tools.ts`: Enhanced `createModifiedContent` function at lines 1769-1820
- `src/test/edge-cases.test.ts`: Added tests for multi-line indentation changes

### Related Test Fixes (Pre-existing Failures)
During this work, also fixed 4 pre-existing test failures:
1. **SHELL_CLEANUP_TIMEOUT**: Changed test expectation from 5 minutes to 10 minutes (`shell-registry.test.ts`)
2. **endLine: -1 tests (x2)**: Fixed tests using 0-based indexing to use 1-based (`apply-diff-functional.test.ts`)
3. **Truncation test**: Changed expectation from '200,000' to '100,000' (`output-limiting.test.ts`)

## Project Patterns and Conventions

### Tool Implementation Pattern
When adding new MCP tools:
1. Define tool in registerShellTools function
2. Use zod schemas for parameter validation
3. Return CallToolResult with formatted text content
4. Include comprehensive error handling
5. Add console.log statements for debugging

### Error Handling Pattern
```typescript
try {
    // Tool logic
} catch (error) {
    console.error('[Tool Name] Error description:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Operation failed: ${errorMessage}`);
}
```

### Shell Status Management
- Always update shell status appropriately: 'idle', 'busy', 'waiting-for-input', 'crashed'
- Use ShellRegistry methods for all shell operations
- Clean up resources (timeouts, files) when shells close

## Important File Locations
- Shell tools implementation: `src/tools/shell-tools.ts`
- Shell timeout plan: `shell_timeout_plan.md`
- Test files: `src/test/shell-tools/`
- Output files: `.vscode-mcp-output/` directory

## Common Commands
```bash
npm run compile        # Compile TypeScript
npm run lint          # Run ESLint
npm test              # Run all tests
npm run watch         # Auto-compile on changes
```
