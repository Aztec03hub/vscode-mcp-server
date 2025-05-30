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
- Could benefit from caching during multi-diff operations
- Test coverage for structural validation edge cases

## Tool Usage Best Practices
1. Always read files in full before making changes
2. Check for diagnostics after modifications
3. Run linters after fixing errors
4. Maintain this MEMORY.md file for important learnings
5. Update task lists with checkmarks (✅) as items are completed

## CRITICAL: Extension Testing Workflow
**EXTREMELY IMPORTANT**: After making ANY code changes, and before running ANY tests, you MUST rebuild and reload the extension:

```bash
npm run compile
vsce package
code --install-extension vscode-mcp-server-0.0.4.vsix --force
code -r .
```

This sequence:
1. **npm run compile** - Compiles TypeScript to JavaScript
2. **vsce package** - Creates the .vsix extension package
3. **code --install-extension** - Installs the updated extension (--force overwrites existing)
4. **code -r .** - Reloads VS Code in the current directory

**Why this is critical**: VS Code extensions run in a separate extension host process. Changes to the code are NOT reflected until the extension is recompiled, repackaged, and reinstalled. Running tests without this process will test the OLD code, not your changes!

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
5. **Non-Blocking Structural Validation**: Warnings don't prevent changes, respecting user intent

## Structural Validation Implementation (Task 5)

### Key Design Decisions
1. **Non-blocking warnings**: Structural issues are reported as warnings, not errors
2. **Language-aware validation**: Different rules for JSON, TypeScript/JavaScript
3. **Context-aware parsing**: Ignores delimiters inside strings and comments
4. **Comprehensive analysis**: Reports what changed structurally, not just problems

### Implementation Details
- `StructuralValidator` class handles all structural integrity checks
- Counts delimiters before and after changes to detect imbalances
- Properly handles escape sequences and nested structures
- Validates JSON files by attempting to parse them
- Basic TypeScript/JavaScript validation for common patterns

### Structural Elements Tracked
- Braces: `{` `}`
- Parentheses: `(` `)`
- Brackets: `[` `]`
- Quotes: `'` `"` `` ` ``
- Block comments: `/*` `*/`

### Warning Severity Levels
- **High**: Unbalanced delimiters, invalid JSON, unclosed comments
- **Medium**: Odd number of quotes (possible unclosed string)
- **Low**: Style issues like trailing commas, incomplete function declarations

## Task 8: User Experience Improvements (Completed)

### Match Confidence Display Implementation

#### Key Features
1. **Status Bar Button**: Displays average match confidence with icon
   - Green check ($(check-all)) for high confidence (≥90%)
   - Yellow warning ($(warning)) for medium confidence (80-90%)
   - Orange alert ($(alert)) for low confidence (<80%)

2. **Detailed Tooltip**: Shows per-diff confidence details
   - Individual confidence percentages for each diff
   - Strategy used for matching (formatted for readability)
   - Any issues encountered during matching
   - Clear indication of failed matches

3. **Integration Points**
   - Added `matchResults` parameter to `showDiffAndGetApproval`
   - Passed validation matches from `applyDiff` function
   - Proper cleanup of UI elements in finally block

### Implementation Details
- Confidence button appears at priority 997 (after other buttons)
- Only shown when match results are available
- Calculates average confidence from all valid matches
- Tooltips use newline characters for multi-line display
- Strategy names are formatted from kebab-case to Title Case

## Task 9: Integration and Testing Strategy (Completed)

### Test Files Created

1. **validation-hierarchy.test.ts**
   - Tests all validation levels (exact, permissive, fuzzy)
   - Tests early termination for performance
   - Tests line hint disambiguation for multiple matches
   - Tests failed match handling

2. **structural-validator.test.ts**
   - Tests unbalanced delimiter detection
   - Tests JSON validation
   - Tests quote and comment handling
   - Tests that warnings don't block changes

3. **cache-performance.test.ts**
   - Tests file content caching behavior
   - Tests partial success mode
   - Tests early termination performance
   - Tests performance tracking

4. **backward-compatibility.test.ts**
   - Tests old parameter names (originalContent/newContent)
   - Tests mixed old and new parameters
   - Tests file creation behavior
   - Tests multi-diff behavior preservation

5. **edge-cases.test.ts**
   - Tests empty file handling
   - Tests single line files
   - Tests files without trailing newlines
   - Tests very long lines
   - Tests Unicode and special characters

6. **integration.test.ts**
   - Tests complete TypeScript refactoring workflow
   - Tests JSON configuration updates
   - Tests multi-file refactoring
   - Tests error recovery with partial success

### Testing Patterns Established

1. **Test Structure**
   ```typescript
   suite('Component Tests', () => {
       let workspaceFolder: vscode.WorkspaceFolder;
       let testFileUri: vscode.Uri;
       
       before(async () => { /* setup */ });
       after(async () => { /* cleanup */ });
       
       test('specific behavior', async () => {
           // arrange, act, assert
       });
   });
   ```

2. **Command Execution Pattern**
   ```typescript
   await vscode.commands.executeCommand('mcp.applyDiff', {
       filePath: testFileName,
       diffs: [/* ... */]
   });
   ```

3. **File Operations**
   - Use vscode.workspace.fs for all file operations
   - Always cleanup test files in after() hooks
   - Handle file creation/deletion errors gracefully

### Key Testing Insights

1. **Template Literal Escaping**: When using template literals in search/replace strings within test code, escape nested template literals with backslashes
2. **Async/Await**: All VS Code operations are async and must be awaited
3. **Error Testing**: Use try/catch blocks to test expected failures
4. **Performance Testing**: Use Date.now() to measure operation duration
5. **Unicode Testing**: JavaScript string literals handle Unicode correctly
6. **CRITICAL - Extension Rebuild**: Before running tests, ALWAYS rebuild the extension:
   ```bash
   npm run compile && vsce package && code --install-extension vscode-mcp-server-0.0.4.vsix --force && code -r .
   ```

## Test Suite Fixes Summary

### Issues Found and Fixed:
1. ✅ TypeScript compilation error due to test files in output directory - Fixed by excluding `out/**/*` in tsconfig.json
2. ✅ Tests were not creating fresh files between test runs - Added helper functions in all test suites
3. ✅ Tests were using cached file content from previous tests - Fixed by exporting and using `clearFileCache` function

### Test Infrastructure Improvements:
- Added `clearFileCache` import to all test files
- Updated all `createTestFile` helper functions to clear cache before writing new content
- Ensured editors are closed and cache is cleared between tests

### Test Fix Progress:

#### Fixed Issues:
1. ✅ Extension Test Suite (5/5 tests passing)
   - Added configuration change listener to fix test expectations
   - All extension tests now pass correctly

2. ✅ Auto-approval mode is working for most tests
   - Test mode detection is functioning
   - Most Apply Diff tests are running without timeouts

#### Remaining Issues:
1. Some ValidationHierarchy tests failing due to test data issues
2. A few Apply Diff Functional tests still have issues with error message expectations
3. Some tests are looking for content that doesn't exist in their test files

### Remaining Work:
Waiting for test results to see if all 20 failing tests are now fixed

### Root Cause:
The tests are modifying shared test files and subsequent tests expect the original content but find modified content from previous tests. Even with the helper function, files are being reused across tests.

### Solution:
Each test needs to work with completely isolated file content, either by:
1. Using unique filenames for each test
2. Properly resetting file content before each test
3. Making tests independent of previous test state

## Test Infrastructure Fixes

### Test File Creation Pattern
When writing tests that create and modify files, always use a helper function to ensure clean state:
```typescript
async function createTestFile(content: string) {
    await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(content));
    await new Promise(resolve => setTimeout(resolve, 50)); // Give VS Code time to process
}
```

**Issue**: Tests were failing because files weren't being reset between tests
**Solution**: Create fresh file content before each test using the helper function

## Whitespace Preservation Implementation (Task 6.1)

### Key Features
1. **Line ending detection**: Automatically detects CRLF vs LF from original file
2. **Indentation preservation**: Maintains original indentation patterns
3. **Smart indentation application**: Only applies indentation where appropriate
4. **Empty line handling**: Preserves empty lines without adding unwanted indentation

### Implementation Details
- Detects line endings by counting occurrences of `\r\n` vs `\n`
- Extracts leading whitespace from lines being replaced
- Applies original indentation to new lines intelligently
- Preserves exact formatting of the original file

### Edge Cases Handled
- New files default to LF line endings
- Lines that already have indentation are not double-indented
- Empty lines remain empty (no whitespace added)
- Mixed indentation (tabs vs spaces) is preserved as-is

## Performance Optimizations (Task 7)

### Implemented Optimizations

#### 1. File Content Caching
- Global cache with 5-second TTL for file content
- Prevents redundant file reads during multi-diff operations
- Automatic cache cleanup for expired entries
- Cache key based on file URI for uniqueness

#### 2. Early Termination in Validation
- Stops validation once confidence >= 0.95 (configurable)
- Reduces unnecessary validation attempts
- Significantly faster for exact matches
- Optional parameter to control termination threshold

#### 3. Partial Success Handling
- New `partialSuccess` flag in ApplyDiffArgs
- Applies successful diffs even if some fail
- Detailed logging of which diffs succeeded/failed
- Warnings added to inform user of partial application

#### 4. Structured Logging
- `StructuredLogger` class for consistent logging
- JSON-exportable log entries with timestamps
- Log levels: DEBUG, INFO, WARN, ERROR
- Filterable by component, level, or time range
- Performance metrics included (duration tracking)

### Performance Patterns
```typescript
// Cache usage
const { content, lines } = await getCachedFileContent(fileUri);

// Early termination
const result = await validationHierarchy.executeHierarchy(
    matcher, lines, targetContent, startHint,
    { earlyTerminationConfidence: 0.95 }
);

// Structured logging
StructuredLogger.log(
    LogLevel.INFO,
    'applyDiff',
    'Validation complete',
    { diffsCount: diffs.length },
    duration
);
```
