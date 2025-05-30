# MEMORY - VS Code MCP Server Project

## Purpose
This file tracks important learnings, patterns, and decisions made during the development of the vscode-mcp-server project, especially focusing on the apply_diff tool improvements.

## Key Learnings

### 1. Apply Diff Tool Architecture
- The `apply_diff` tool has been significantly improved with a hierarchical validation system
- Uses a `ValidationHierarchy` class that manages progressive fallback strategies
- Implements three levels of matching: Strict → Permissive → Fuzzy
- Each level has multiple strategies that are tried in order

### 2. Parameter Migration Pattern
- Successfully implemented backward compatibility for parameter name changes
- `originalContent` → `search` and `newContent` → `replace`
- Uses `normalizeDiffSections()` function to handle both old and new parameter names
- Emits deprecation warnings when old parameters are used

### 3. File Creation Integration
- The tool now automatically creates files if they don't exist
- Uses VS Code's `WorkspaceEdit` API for atomic file operations
- Handles empty file edge cases gracefully

### 4. Error Handling Approach
- Implemented `ApplyDiffError` class with progressive error disclosure
- Three error levels: SIMPLE, DETAILED, FULL
- Includes diagnostic information with best matches and validation attempts

### 5. VS Code Integration Patterns
- Use `vscode.window.withProgress` for long-running operations
- Status bar buttons for user approval/rejection of changes
- Proper cleanup of UI elements and temporary files
- Tab management for diff views

## Code Patterns

### Progress Reporting
```typescript
vscode.window.withProgress({
    location: vscode.ProgressLocation.Window,
    title: "Apply Diff",
    cancellable: false
}, async (progress) => {
    progress.report({ increment: 10, message: "Validating..." });
    // ... work ...
});
```

### Status Bar Approval Pattern
```typescript
// Create unique command IDs to avoid conflicts
const commandId = Date.now().toString();
const approveCommandId = `mcp.apply-diff.approve.${commandId}`;
// Register commands and create status bar items
// Always cleanup in finally block
```

### File Operations
- Always check workspace folders exist before file operations
- Use `vscode.Uri.joinPath()` for path construction
- Handle file non-existence gracefully

## Testing Insights
- The tool has auto-approval mode (`isAutoApprovalEnabled()`) for testing
- Comprehensive validation before applying changes prevents data loss
- Multiple matching strategies ensure robustness against code drift

## Future Considerations
- Performance optimization for large files still needed
- Structural integrity checks (Task 5) not yet implemented
- Could benefit from caching during multi-diff operations

## Tool Usage Best Practices
1. Always read files in full before making changes
2. Check for diagnostics after modifications
3. Run linters after fixing errors
4. Maintain this MEMORY.md file for important learnings
5. Update task lists with checkmarks (✅) as items are completed

## Common Issues and Solutions
- **Issue**: Diff tab not closing properly
  - **Solution**: Enhanced tab detection with multiple label patterns
  
- **Issue**: Parameter compatibility
  - **Solution**: Normalize parameters early, support both old and new names

- **Issue**: File creation failures
  - **Solution**: Check parent directory exists, use WorkspaceEdit API

## Architecture Decisions
1. **Hierarchical Validation**: Provides robustness without sacrificing precision
2. **Progressive Error Disclosure**: Helps users understand issues at appropriate detail level
3. **Atomic Operations**: All-or-nothing approach prevents partial file corruption
4. **User Approval Required**: Ensures safety for production use (unless auto-approval enabled)