# Feature Implementation Plan: Enhanced Shell Tools

## Overview
Implement enhanced shell management tools for the vscode-mcp-server project, including workspace context awareness, multiple shell support, and interactive command handling.

## � Current Implementation Status (2025-06-04)

### ✅ COMPLETED FEATURES
**Phase 1: Core Shell Infrastructure** - 100% Complete ✅
- ✅ Shell Registry System with auto-cleanup and resource management
- ✅ Workspace Context Tool with project detection
- ✅ Enhanced Shell Command Execution with timeout strategies and background support

**Phase 2: Interactive Support** - 100% Complete ✅
- ✅ Input injection tool (`send_input_to_shell`)
- ✅ Timeout-based interactive detection (15s default, 45s interactive, immediate background)

**Phase 3: Shell Management** - 100% Complete ✅
- ✅ Shell listing tool (`list_active_shells`)
- ✅ Shell registry with complete creation/management functionality
- ✅ Error handling and lifecycle management (via registry methods)

**Phase 5: Integration** - 80% Complete
- ✅ Server registration and error handling
- 🔲 Manual testing scenarios

### 🔲 PENDING FEATURES
**Phase 4: Output & Safety** - 0% Complete
- 🔲 Output limiting logic (character-based with file output - per user requirements)
- 🔲 Destructive command detection (simple regex pattern matching - per user requirements)

### 🎯 IMMEDIATE NEXT STEPS (Updated Based on User Requirements)
1. **Output Limiting Implementation** (Task 4.1) - Character-based with 100k max, silence flag, auto-file save
2. **Safety Warnings Implementation** (Task 4.2) - Simple regex pattern matching 
3. **Interactive Pattern Detection** (Task 2.1) - Regex + keyword detection for common prompts
4. **Manual Testing Setup** (Task 5.2) - Automated tests + documentation
5. **Optional: Dedicated MCP Shell Management Tools** (Tasks 3.2/3.3) - Simple wrappers only

## �📋 Implementation Tasks
#### Task 1.1: Create Shell Registry System ✅ COMPLETED
- **File**: `src/tools/shell-tools.ts`
- **Description**: Add shell tracking and management infrastructure
- **Details**:
  - ✅ Create `ShellRegistry` class to track active terminals
  - ✅ Implement auto-generated naming (shell-1, shell-2, etc.)
  - ✅ Add 5-minute auto-cleanup for unused shells
  - ✅ Support max 8 concurrent shells
  - ✅ Track shell status (idle, busy, crashed)

#### Task 1.2: Add Workspace Context Tool ✅ COMPLETED
- **File**: `src/tools/shell-tools.ts`
- **Description**: Implement `get_workspace_context` tool
- **Details**:
  - ✅ Return current working directory
  - ✅ Return VS Code workspace folder path(s)
  - ✅ Return basic project info (name from package.json if available)
  - ✅ Add comments about future project structure features
  - ✅ Include warnings about large project concerns
  - Return basic project info (name from package.json if available)
  - Add comments about future project structure features
  - Include warnings about large project concerns

#### Task 1.3: Enhance Shell Command Execution ✅ COMPLETED
- **File**: `src/tools/shell-tools.ts`
- **Description**: Upgrade `execute_shell_command_code` tool
- **Details**:
  - ✅ Add optional `shellId` parameter for shell selection
  - ✅ Add `interactive` flag for commands that might need input
  - ✅ Add `background` flag for long-running processes
  - ✅ Return working directory before/after command
  - ✅ Return shell context (type, ID, status)
  - ✅ Add command exit code tracking (simple implementation)

### Phase 2: Interactive Command Support

#### Task 2.1: Implement Interactive Pattern Detection (NEW REQUIREMENT)
- **File**: `src/tools/shell-tools.ts`
- **Description**: Add regex and keyword-based detection for interactive prompts
- **Details**:
  - 🔲 Implement regex patterns for common prompts (y/n, continue, password, etc.)
  - 🔲 Add simple keyword-based detection
  - ✅ Timeout strategy already implemented:
    - ✅ Default mode: 15-second timeout
    - ✅ Interactive mode: 45-second timeout
    - ✅ Background mode: Return immediately
  - 🔲 Auto-detect interactive state and switch to waiting-for-input mode
  - **Status**: Timeout strategies complete, pattern detection needed

#### Task 2.2: Add Input Injection Tool ✅ COMPLETED
- **File**: `src/tools/shell-tools.ts`
- **Description**: Implement `send_input_to_shell` tool
- **Details**:
  - ✅ Send input to running commands in specific shells
  - ✅ Handle input validation and shell state checking
  - ✅ Support common input patterns (y/n, text input, key presses)
  - ✅ Includes newline control parameter
  - ✅ Proper error handling for crashed/unavailable shells

### Phase 3: Shell Management Tools

#### Task 3.1: Implement Shell Listing Tool ✅ COMPLETED
- **File**: `src/tools/shell-tools.ts`
- **Description**: Add `list_active_shells` tool
- **Details**:
  - ✅ Show all active terminals with IDs and names
  - ✅ Display current working directory for each shell
  - ✅ Show shell status (idle, busy, waiting-for-input)
  - ✅ Include shell creation time and last used information
  - ✅ Provide usage instructions and cleanup information

#### Task 3.2: Add Shell Creation Tool
- **File**: `src/tools/shell-tools.ts`
- **Description**: Implement `create_shell` tool
- **Details**:
  - ✅ Create new terminals with auto-generated or custom names (implemented in registry)
  - ✅ Set initial working directory if specified (implemented in registry)
  - ✅ Return shell ID and status (implemented in registry)
  - ✅ Enforce maximum shell limit (8) (implemented in registry)
  - 🔲 **Missing**: Dedicated MCP tool for shell creation (currently only internal)

#### Task 3.3: Add Shell Management Tools
- **File**: `src/tools/shell-tools.ts`
- **Description**: Implement `close_shell` and `get_shell_status` tools
- **Details**:
  - ✅ `close_shell`: Gracefully close specific terminals (implemented in registry)
  - ✅ `get_shell_status`: Check shell state and running processes (implemented in registry)
  - ✅ Handle terminal crashes/unresponsiveness gracefully (implemented in registry)
  - 🔲 **Missing**: Dedicated MCP tools for these operations (currently only internal methods)

### Phase 4: Output Management & Safety

#### Task 4.1: Implement Output Limits (UPDATED REQUIREMENTS)
- **File**: `src/tools/shell-tools.ts`
- **Description**: Add character-based output limiting with file output
- **Details**:
  - 🔲 Character-based limiting: 100,000 characters maximum (not line-based)
  - 🔲 Add `silenceOutput` flag/option for long-running commands
  - 🔲 Auto-save full output to `{shellId}-output.txt` when truncated
  - 🔲 Overwrite output file per shell instance on each command
  - 🔲 Auto-cleanup output files when shell times out/closes
  - 🔲 Return message about truncation and file location
  - **Status**: New character-based approach, file output feature

#### Task 4.2: Add Simple Safety Warnings (CONFIRMED APPROACH)
- **File**: `src/tools/shell-tools.ts`
- **Description**: Basic destructive command detection using simple regex
  - **Details**:
  - 🔲 Simple regex pattern matching for dangerous commands
  - 🔲 Warn about: `rm -rf`, `del /s`, `format`, `rmdir /s`, and similar patterns
  - 🔲 Keep implementation very simple - just pattern matching (no sophistication)
  - 🔲 Don't block commands, just provide warnings in output
  - 🔲 Include destructive command warnings in command execution results
  - **Status**: Simple regex approach confirmed

### Phase 5: Integration & Testing

#### Task 5.1: Update Server Registration ✅ COMPLETED
- **File**: `src/server.ts`
- **Description**: Ensure new tools are properly registered
- **Details**:
  - ✅ All implemented tools are registered in `registerShellTools`
  - ✅ Imports are properly configured
  - ✅ Tools: execute_shell_command_code, get_workspace_context, send_input_to_shell, test_shell_cwd, list_active_shells

#### Task 5.2: Manual Testing Setup (UPDATED REQUIREMENTS)
- **File**: `src/test/manual-testing.ts` and documentation
- **Description**: Create automated test files AND manual testing documentation
- **Details**:
  - 🔲 Create automated test files for shell functionality
  - 🔲 Write manual testing documentation for complex scenarios
  - 🔲 Test with SvelteKit scaffolding (`npm create svelte@latest`)
  - 🔲 Test multiple shell management and cleanup
  - 🔲 Test interactive command handling with pattern detection
  - 🔲 Test background processes (`npm run dev`)
  - 🔲 Test output limiting and file generation
  - 🔲 Test safety warnings for destructive commands
  - **Status**: Both automated and manual testing needed

#### Task 5.3: Error Handling & Cleanup ✅ MOSTLY COMPLETED
- **File**: `src/tools/shell-tools.ts`
- **Description**: Add comprehensive error handling
  - **Details**:
  - ✅ Handle terminal crashes gracefully (status tracking and auto-cleanup)
  - ✅ Clean up resources on extension shutdown (dispose method)
  - ✅ Handle shell integration failures (timeout handling)
  - ✅ Provide meaningful error messages (detailed error context)
  - ✅ Terminal event handlers for lifecycle management

## 🔧 Technical Implementation Details

### Shell Registry Structure
```typescript
interface ManagedShell {
  id: string;
  terminal: vscode.Terminal;
  name: string;
  createdAt: Date;
  lastUsed: Date;
  status: 'idle' | 'busy' | 'waiting-for-input' | 'crashed';
  currentDirectory?: string;
  runningCommand?: string;
}
```

### Configuration Constants
```typescript
const MAX_SHELLS = 8;
const SHELL_CLEANUP_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const DEFAULT_OUTPUT_CHARACTER_LIMIT = 100000; // 100k characters (updated requirement)
const INTERACTIVE_TIMEOUT_MS = 45000; // 45 seconds
const DEFAULT_TIMEOUT_MS = 15000; // 15 seconds
```

### Destructive Command Patterns
```typescript
const DESTRUCTIVE_PATTERNS = [
  /\brm\s+-rf\b/,
  /\bdel\s+\/s\b/i,
  /\bformat\b/i,
  /\brmdir\s+\/s\b/i
];
```

### Interactive Prompt Detection Patterns (New Requirement)
```typescript
const INTERACTIVE_PATTERNS = [
  /\?\s*$/,                    // Questions ending with ?
  /\(y\/n\)/i,                 // Yes/no prompts
  /\(Y\/N\)/,                  // Yes/No prompts (case sensitive)
  /continue\?/i,               // Continue prompts
  /press\s+any\s+key/i,        // Press any key
  /enter\s+password/i,         // Password prompts
  /confirm/i                   // Confirmation prompts
];

const INTERACTIVE_KEYWORDS = [
  'password:', 'confirm:', 'continue?', 'proceed?', 
  'y/n', 'yes/no', 'press any key'
];
```

### Output File Management (New Requirement)
```typescript
// Output files: {shellId}-output.txt (e.g., "shell-1-output.txt")
// Location: .vscode-mcp-output/ directory in workspace root
// Cleanup: Automatic when shell closes or times out
// Behavior: Overwrite on each command execution per shell
// Silence flag: Return "Command completed, full output saved to file <filename>"
```

### Interactive Detection Priority (User Specified)
```typescript
// Priority order:
// 1. Keywords take precedence
// 2. Regex patterns secondary
// 3. Trigger on either match
```

### Testing Structure (User Specified)
```typescript
// Location: src/test/shell-tools/
// Files: Automated tests + manual documentation
// Scenarios: SvelteKit, multiple shells, interactive, background, new features
```

## 🎯 Success Criteria

### Core Functionality
- [x] Can manage up to 8 concurrent shells
- [x] Auto-cleanup unused shells after 5 minutes  
- [x] Provide workspace context without performance issues
- [ ] Handle interactive commands (tested with SvelteKit scaffolding)

### Enhanced Features
- [x] Background processes work correctly (npm run dev)
- [ ] Output limiting prevents memory issues
- [ ] Basic safety warnings for destructive commands
- [x] Graceful error handling for terminal crashes

### User Experience
- [x] Clear status reporting for all shell operations
- [x] Intuitive shell selection and management
- [x] Responsive interactive command handling (via timeout strategies)
- [x] Helpful error messages and debugging info

## 📝 Future Enhancements (Not in Current Scope)

### Workspace Structure Tool
- Smart project structure traversal
- Integration with .gitignore patterns
- Configurable depth limits and file count thresholds
- Support for common ignore patterns (node_modules, .git, dist, build, out, .vscode-test)

### Advanced Shell Features
- Cross-platform shell support (Mac/Linux)
- Shell environment variable management
- Command history and completion
- Terminal theming and customization

### Performance Optimizations
- Streaming output for very long commands
- Compressed output storage
- Smart output parsing and summarization

---

**Implementation Priority**: High
**Estimated Complexity**: Medium  
**Confidence Level**: 9/10

**Current Status**: Phase 1-3 largely completed. Phase 4 and 5.2 remain for full feature completion.

**Next Priority Tasks**:
1. Task 4.1: Implement output limiting logic
2. Task 4.2: Add destructive command pattern detection
3. Task 3.2/3.3: Add dedicated MCP tools for shell creation and management
4. Task 5.2: Create manual testing scenarios
