# Claude Implementation Plan: apply_diff Tool

## Project Overview
Implementation of an enhanced `apply_diff` tool for the vscode-mcp-server project, inspired by Block's `create_diff` functionality but with enhanced support for multiple diff sections in a single file.

## Reference Analysis
Based on analysis of Block's vscode-mcp repository at `remote_reference/vscode-mcp`, we identified the following key components:
- Server-side MCP tool that creates temporary files and manages diff workflow
- VS Code extension integration via socket communication
- User approval workflow with status bar buttons
- Atomic file operations with proper cleanup

## Enhanced Features Plan

### Core Enhancement: Multiple Diff Support
Unlike Block's implementation which handles single file changes, our `apply_diff` tool will support:
- **Multiple diff sections** in a single file operation
- **Unified diff view** showing all proposed changes at once
- **Single accept/reject decision** for all changes
- **Intelligent conflict detection** between diff sections
- **Clear visual separation** between different change sections

## Implementation Phases

### Phase 1: Core `apply_diff` Implementation ⭐ (Current Phase)

#### Data Structures
```typescript
interface DiffSection {
  startLine: number;     // 0-based line number
  endLine: number;       // 0-based line number (inclusive)
  originalContent: string;
  newContent: string;
  description?: string;  // Optional description for this section
}

interface ApplyDiffArgs {
  filePath: string;
  diffs: DiffSection[];  // Array of diff sections
  description?: string;  // Overall description
}
```

#### Implementation Strategy
1. **Validation Phase**:
   - Ensure file exists (only works on existing files)
   - Validate all diff sections don't overlap
   - Sort diff sections by line number
   - **Fuzzy content matching** with intelligent error handling

2. **Fuzzy Matching & Issue Handling** ⭐:
   - **Whitespace normalization** for content comparison
   - **Smart search algorithms** for approximate content matching
   - **Line number adjustment** when exact matches aren't found
   - **Contextual search** using surrounding lines
   - **Multiple matching strategies** with fallback options

3. **Diff Generation**:
   - Apply all diffs to create a complete modified version
   - Generate unified diff showing all changes
   - Create temporary file with all changes applied

4. **User Approval**:
   - Show unified diff in VS Code's diff viewer
   - Use status bar buttons or quick pick for accept/reject
   - Apply all changes atomically if accepted

5. **Conflict Detection**:
   - Check for overlapping line ranges
   - Detect if changes would interfere with each other
   - Provide clear error messages for conflicts

#### Files to Modify
- `src/tools/edit-tools.ts` - Add the new `apply_diff` tool
- `src/server.ts` - Register the new tool

### Phase 2: VS Code Integration Enhancement

1. **Enhanced Diff Visualization**:
   - Add section markers in the diff view
   - Include descriptions as comments in the temporary file
   - Use clear visual separators between different changes

2. **Smart Merging**:
   - Handle adjacent diff sections intelligently
   - Optimize line number calculations after each change
   - Provide preview of final result

### Phase 3: Advanced Features (Future)

1. **Partial Application**:
   - Option to apply individual diff sections
   - Interactive selection of which changes to apply

2. **Diff Statistics**:
   - Show summary of changes (lines added/removed per section)
   - Provide overview of total impact

## Technical Implementation Details

### Fuzzy Matching & Issue Handling ⭐

#### Whitespace Normalization
```typescript
interface MatchingOptions {
  ignoreLeadingWhitespace?: boolean;     // Default: true
  ignoreTrailingWhitespace?: boolean;    // Default: true
  normalizeIndentation?: boolean;        // Default: true
  ignoreEmptyLines?: boolean;           // Default: false
  caseSensitive?: boolean;              // Default: true
}
```

#### Smart Search Strategies (Applied in Order)
1. **Exact Match**: Direct string comparison
2. **Normalized Match**: After whitespace normalization
3. **Fuzzy Line Match**: Allow minor differences in individual lines
4. **Contextual Search**: Use surrounding lines to find approximate location
5. **Similarity Search**: Use string similarity algorithms (Levenshtein distance)
6. **Graceful Failure**: Clear error reporting when no suitable match found

#### Content Matching Algorithm
```typescript
class ContentMatcher {
  // Primary matching strategy
  findExactMatch(lines: string[], targetContent: string, startHint?: number): MatchResult
  
  // Fallback strategies
  findNormalizedMatch(lines: string[], targetContent: string, options: MatchingOptions): MatchResult
  findContextualMatch(lines: string[], targetContent: string, context: number): MatchResult
  findSimilarityMatch(lines: string[], targetContent: string, threshold: number): MatchResult[]
  
  // Automated resolution for search results
  selectBestMatch(candidates: MatchResult[], minConfidence?: number): MatchResult | null
  
  // User confirmation for ambiguous or low-confidence matches
  requiresUserConfirmation(match: MatchResult): boolean
}

interface MatchResult {
  startLine: number;
  endLine: number;
  confidence: number;        // 0-1 confidence score
  strategy: string;          // Which strategy found this match
  actualContent: string;     // What was actually found
  issues?: string[];         // Any issues detected (whitespace, case, etc.)
}
```

#### Error Recovery Strategies
1. **Line Number Drift Detection**: Detect when line numbers have shifted
2. **Content Change Detection**: Handle when original content has been modified
3. **Partial Match Recovery**: Apply changes to partially matching content
4. **User Confirmation**: Show differences and ask for confirmation when matches have lower confidence
5. **Confidence-Based Rejection**: Reject matches below minimum confidence threshold
6. **Graceful Failure**: Provide detailed error messages with suggested fixes when no matches found

#### Validation Enhancements
```typescript
interface ValidationResult {
  isValid: boolean;
  matches: MatchResult[];
  conflicts: ConflictInfo[];
  warnings: Warning[];
  suggestions: string[];
}

interface ConflictInfo {
  type: 'overlap' | 'content_mismatch' | 'line_drift';
  diffIndex1: number;
  diffIndex2?: number;
  description: string;
  suggestion: string;
}
```

### Line Number Management
- Work with 0-based line numbers internally
- Apply changes from bottom to top to avoid line number shifts
- **Smart line number adjustment** when fuzzy matching finds content at different locations
- **Drift compensation** for files that have been modified since diff creation

### Atomic Operations
- Create complete modified file first
- Only apply if user approves ALL changes
- Rollback support if something goes wrong
- **Validation checkpoint** before applying any changes

### Diff Generation
- Use a proper diff library for unified diff format
- Add section markers and descriptions as comments
- Ensure clean, readable diff output
- **Confidence indicators** showing match quality for each section

### Enhanced Error Handling
- Clear validation messages for overlapping sections
- Helpful error messages for line number issues
- **Fuzzy matching failure explanations** with suggested fixes
- **User confirmation prompts** for ambiguous or low-confidence matches
- **Automated resolution** for high-confidence matches
- Graceful handling of file access problems
- **Detailed logging** of matching strategies and results

### User Interaction Scope 🎯
**Essential User Interactions (Always Required):**
- **Diff Approval/Rejection**: User must accept or reject the proposed changes (core MCP workflow)
- **Low-Confidence Match Confirmation**: When fuzzy matching has low confidence, show what was found and ask for confirmation

**Automated Operations (No User Interaction):**
- **Search Strategy Selection**: Automatically tries multiple search strategies
- **High-Confidence Matching**: Automatic selection when confidence is above threshold
- **Error Handling**: Automatic failure with clear error messages when no matches found

**Removed Interactions (Outside MCP Tool Scope):**
- ❌ Manual line selection when all search strategies fail
- ❌ Interactive file browsing or content selection

## Example Usage

### Single Diff Section (Backward Compatible)
```typescript
await applyDiff({
  filePath: "src/myFile.ts",
  diffs: [{
    startLine: 10,
    endLine: 15,
    originalContent: "old code here...",
    newContent: "new code here...",
    description: "Fix bug in validation logic"
  }],
  description: "Bug fix in validation"
});
```

### Multiple Diff Sections
```typescript
await applyDiff({
  filePath: "src/largeFile.ts", 
  diffs: [
    {
      startLine: 5,
      endLine: 8,
      originalContent: "import { old } from 'old-lib';",
      newContent: "import { new } from 'new-lib';",
      description: "Update import statement"
    },
    {
      startLine: 45,
      endLine: 50,
      originalContent: "function oldImplementation() {...}",
      newContent: "function newImplementation() {...}",
      description: "Refactor core function"
    },
    {
      startLine: 120,
      endLine: 125,
      originalContent: "// TODO: implement this",
      newContent: "return this.processData(input);",
      description: "Implement TODO"
    }
  ],
  description: "Refactor authentication module"
});
```

### Fuzzy Matching Examples ⭐

#### Handling Whitespace Differences
```typescript
// Original content in file (with different indentation):
"    function validateInput(data) {"
"        if (!data) return false;"
"    }"

// Diff with normalized content (will still match):
{
  startLine: 15,
  endLine: 17,
  originalContent: "function validateInput(data) {\n  if (!data) return false;\n}",
  newContent: "function validateInput(data) {\n  if (!data || data.length === 0) return false;\n}",
  description: "Add length validation"
}
```

#### Content Drift Handling
```typescript
// When line numbers have shifted due to other changes:
await applyDiff({
  filePath: "src/utils.ts",
  diffs: [{
    startLine: 50,  // Original location
    endLine: 52,
    originalContent: "// TODO: optimize this\nreturn items.filter(x => x.active);",
    newContent: "// Optimized filtering with caching\nreturn this.cacheService.getActiveItems(items);",
    description: "Optimize filtering with cache"
  }],
  // Tool will automatically find content even if it moved to lines 48-50
  fuzzyOptions: {
    allowLineDrift: true,
    maxDriftLines: 10,
    contextLines: 2
  }
});
```

#### Multiple Matching Strategies
```typescript
await applyDiff({
  filePath: "src/components/Button.tsx",
  diffs: [{
    startLine: 25,
    endLine: 27,
    // Even if the exact content doesn't match, fuzzy matching will find similar content
    originalContent: "const handleClick = () => {\\n  onClick();\\n};",
    newContent: "const handleClick = useCallback(() => {\\n  onClick?.();\\n}, [onClick]);",
    description: "Add useCallback optimization"
  }],
  matchingOptions: {
    similarity: 0.8,           // 80% similarity threshold
    ignoreWhitespace: true,
    contextSearch: true
  }
});
```

## Benefits of This Approach

1. **Developer Efficiency**: Apply multiple related changes in one operation
2. **Better Context**: See all changes together for better decision making
3. **Atomic Updates**: All-or-nothing application prevents partial corrupted states
4. **Scalability**: Works well for both small tweaks and large refactors
5. **Backward Compatibility**: Single diff sections work exactly like before
6. **🆕 Robustness**: Handles real-world code variations and formatting differences
7. **🆕 Intelligence**: Smart matching reduces manual intervention
8. **🆕 Reliability**: Multiple fallback strategies ensure high success rates

## Development Approach

Since our current implementation doesn't have the socket-based extension architecture that Block uses, we'll implement a simpler but effective approach:

1. **Use VS Code's native diff viewer** directly from the MCP server
2. **Implement approval via VS Code's built-in UI** (Quick Pick, Information Messages, etc.)
3. **Leverage existing file tools** for safe file operations
4. **Add proper error handling and cleanup**

This approach will provide the core functionality without requiring a separate VS Code extension, making it easier to implement and maintain.

## Dependencies to Add
- `diff` npm package for generating unified diffs
- `string-similarity` or `fastest-levenshtein` for fuzzy string matching
- `fuzzyset` for advanced fuzzy text search capabilities
- Enhanced TypeScript types for the new interfaces
- Optional: `diff2html` for enhanced diff visualization

## Confidence Level: 9/10
High confidence due to:
- ✅ Clear understanding of MCP tool patterns from existing codebase
- ✅ VS Code has robust diff viewing capabilities  
- ✅ Similar implementations exist in the ecosystem
- ✅ Existing infrastructure supports this addition well
- ✅ Enhancement plan is well-structured and achievable

## Next Steps
1. Implement Phase 1 core functionality
2. Add diff library dependency
3. Test with various file types and scenarios
4. Verify diff display quality and user experience
5. Ensure proper integration with existing tools

---
*Implementation started on May 22, 2025*
*Based on analysis of Block's vscode-mcp repository*
