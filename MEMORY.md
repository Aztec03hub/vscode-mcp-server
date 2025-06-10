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
