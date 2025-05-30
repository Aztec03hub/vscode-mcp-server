# Feature Implementation Plan: Enhanced Shell Tools

## Overview
Implement enhanced shell management tools for the vscode-mcp-server project, including workspace context awareness, multiple shell support, and interactive command handling.

## 📋 Implementation Tasks
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

#### Task 2.1: Implement Output Pattern Detection
- **File**: `src/tools/shell-tools.ts`
- **Description**: Add smart detection for interactive prompts
- **Details**:
  - Detect common interactive patterns (`?`, `(y/n)`, `Press any key`, etc.)
  - Implement timeout strategy:
    - Default mode: 15-second timeout
    - Interactive mode: 45-second timeout
    - Background mode: Return immediately
  - Return special status for "waiting-for-input" state

#### Task 2.2: Add Input Injection Tool
- **File**: `src/tools/shell-tools.ts`
- **Description**: Implement `send_input_to_shell` tool
- **Details**:
  - Send input to running commands in specific shells
  - Handle input validation and shell state checking
  - Support common input patterns (y/n, text input, key presses)

### Phase 3: Shell Management Tools

#### Task 3.1: Implement Shell Listing Tool
- **File**: `src/tools/shell-tools.ts`
- **Description**: Add `list_active_shells` tool
- **Details**:
  - Show all active terminals with IDs and names
  - Display current working directory for each shell
  - Show shell status (idle, busy, waiting-for-input)
  - Include shell type information

#### Task 3.2: Add Shell Creation Tool
- **File**: `src/tools/shell-tools.ts`
- **Description**: Implement `create_shell` tool
- **Details**:
  - Create new terminals with auto-generated or custom names
  - Set initial working directory if specified
  - Return shell ID and status
  - Enforce maximum shell limit (8)

#### Task 3.3: Add Shell Management Tools
- **File**: `src/tools/shell-tools.ts`
- **Description**: Implement `close_shell` and `get_shell_status` tools
- **Details**:
  - `close_shell`: Gracefully close specific terminals
  - `get_shell_status`: Check shell state and running processes
  - Handle terminal crashes/unresponsiveness gracefully

### Phase 4: Output Management & Safety

#### Task 4.1: Implement Output Limits
- **File**: `src/tools/shell-tools.ts`
- **Description**: Add line-based output limiting
- **Details**:
  - Default limit: 1000 lines per command output
  - Make limit configurable via tool parameter
  - Add option to disable limits entirely
  - Truncate output gracefully with clear indicators

#### Task 4.2: Add Simple Safety Warnings
- **File**: `src/tools/shell-tools.ts`
- **Description**: Basic destructive command detection
- **Details**:
  - Simple pattern matching for dangerous commands
  - Warn about: `rm -rf`, `del /s`, `format`, `rmdir /s`
  - Keep implementation very simple - just pattern matching
  - Don't block commands, just warn

### Phase 5: Integration & Testing

#### Task 5.1: Update Server Registration
- **File**: `src/server.ts`
- **Description**: Ensure new tools are properly registered
- **Details**:
  - Verify all new tools are registered in `registerShellTools`
  - Update any necessary imports
  - Test tool registration process

#### Task 5.2: Manual Testing Setup
- **File**: `src/test/manual-testing.ts` (if needed)
- **Description**: Create manual testing scenarios
- **Details**:
  - Test with SvelteKit scaffolding (`npm create svelte@latest`)
  - Test multiple shell management
  - Test interactive command handling
  - Test background processes (`npm run dev`)

#### Task 5.3: Error Handling & Cleanup
- **File**: `src/tools/shell-tools.ts`
- **Description**: Add comprehensive error handling
- **Details**:
  - Handle terminal crashes gracefully
  - Clean up resources on extension shutdown
  - Handle shell integration failures
  - Provide meaningful error messages

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
const DEFAULT_OUTPUT_LINE_LIMIT = 1000;
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

## 🎯 Success Criteria

### Core Functionality
- [ ] Can manage up to 8 concurrent shells
- [ ] Auto-cleanup unused shells after 5 minutes
- [ ] Provide workspace context without performance issues
- [ ] Handle interactive commands (tested with SvelteKit scaffolding)

### Enhanced Features
- [ ] Background processes work correctly (npm run dev)
- [ ] Output limiting prevents memory issues
- [ ] Basic safety warnings for destructive commands
- [ ] Graceful error handling for terminal crashes

### User Experience
- [ ] Clear status reporting for all shell operations
- [ ] Intuitive shell selection and management
- [ ] Responsive interactive command handling
- [ ] Helpful error messages and debugging info

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

**Next Steps**: Begin with Phase 1, Task 1.1 - implementing the core shell registry system.
