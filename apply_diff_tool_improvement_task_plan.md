# Apply Diff Tool Improvement Task Plan

## Overview
Transform the `apply_diff` tool into a highly reliable, production-ready code editing tool for LLM usage with hierarchical fallback strategies, improved parameter structure, and automatic file creation capabilities.

## Core Requirements Met
- **Parameter restructuring**: `filePath` → `description` → `startLine` → `endLine` → `search` → `replace`
- **Multiple diff support**: Maintain array-based multiple diff operations
- **File creation**: Auto-create files if they don't exist
- **Hierarchical validation**: Strict-first with progressive fallbacks
- **Enhanced diagnostics**: Show expected vs. actual content clearly
- **Post-validation**: Ensure structural integrity after changes
- **Production reliability**: Minimize real-world usage errors

---

## Task Breakdown

### Task 1: Interface and Schema Restructuring
**Confidence: 10/10**

#### 1.1 Update Parameter Schema
- [✅] Change `originalContent` → `search`
- [✅] Change `newContent` → `replace`
- [✅] Reorder parameters: `filePath`, `description`, `startLine`, `endLine`, `search`, `replace`
- [✅] Update TypeScript interfaces (`DiffSection`, `ApplyDiffArgs`)
- [✅] Update Zod validation schema in tool registration

#### 1.2 Backward Compatibility
- [✅] Add parameter mapping to handle both old and new parameter names temporarily
- [✅] Add deprecation warnings for old parameter usage
- [✅] Plan removal timeline for old parameters

---

### Task 2: File Creation Integration
**Confidence: 9/10**

#### 2.1 Pre-Processing File Check
- [✅] Add file existence check at the start of `applyDiff()`
- [✅] If file doesn't exist, create empty file using existing `createWorkspaceFile()`
- [✅] Ensure proper directory structure creation (create parent directories if needed)
- [✅] Log file creation activities for debugging

#### 2.2 Empty File Handling
- [✅] Handle edge case where search content is provided for empty file
- [✅] Default behavior: if file is empty and search content provided, treat as "insert at beginning"
- [✅] Add validation to prevent nonsensical operations on newly created files

---

### Task 3: Hierarchical Validation Strategy
**Confidence: 8/10**

#### 3.1 Strict Validation (Level 1)
- [✅] **Exact match**: Character-for-character matching including whitespace
- [✅] **Line-hinted exact match**: Use `startLine`/`endLine` as hints for exact matching
- [✅] **Case-sensitive exact match**: No tolerance for case differences

#### 3.2 Permissive Validation (Level 2)
- [✅] **Whitespace-normalized matching**: Ignore leading/trailing whitespace
- [✅] **Indentation-normalized matching**: Normalize tabs vs spaces
- [✅] **Case-insensitive matching**: Try case-insensitive if case-sensitive fails

#### 3.3 Fuzzy Validation (Level 3)
- [✅] **Similarity matching**: Use existing Levenshtein distance (threshold: 0.9→0.8→0.7)
- [✅] **Contextual matching**: Look at surrounding code context
- [✅] **Partial matching**: Allow matching subsets of the search content

#### 3.4 Fallback Chain Implementation
- [✅] Create `ValidationHierarchy` class to manage fallback progression
- [✅] Log each attempt level with detailed diagnostics
- [✅] Stop at first successful match
- [✅] Aggregate all failure reasons for final error reporting

---

### Task 4: Enhanced Error Diagnostics
**Confidence: 9/10**

#### 4.1 Expected vs. Actual Content Display
```typescript
interface DiagnosticInfo {
    expected: string;        // What we were searching for
    actualContent: string[];  // What we found at various locations
    searchLocations: number[]; // Line numbers where we looked
    confidence: number;       // Best match confidence
    strategy: string;         // Which strategy found the best match
}
```

#### 4.2 Structured Error Messages
- [✅] **Header**: Clear problem statement
- [✅] **Expected Content**: Show exactly what was being searched for (first)
- [✅] **Actual Content**: Show what was found instead (last)
- [✅] **Suggestions**: Actionable next steps
- [✅] **Line Context**: Show surrounding lines where partial matches occurred

#### 4.3 Progressive Error Detail
- [✅] **Level 1 errors**: Simple "not found" with suggestion to check line numbers
- [✅] **Level 2 errors**: Show best partial matches with confidence scores
- [✅] **Level 3 errors**: Full diagnostic with all attempted strategies

---

### Task 5: Post-Validation Structural Integrity
**Confidence: 7/10**

#### 5.1 Basic Structural Checks
- [✅] **Brace matching**: Count `{` and `}` before/after changes
- [✅] **Parentheses matching**: Count `(` and `)` before/after changes
- [✅] **Bracket matching**: Count `[` and `]` before/after changes
- [✅] **Quote matching**: Basic quote pairing validation

#### 5.2 Language-Specific Validation
- [✅] **TypeScript/JavaScript**: Check for basic syntax validity
- [✅] **JSON**: Validate JSON structure if file extension is `.json`
- [✅] **Generic**: Ensure no obvious structural corruption

#### 5.3 Validation Reporting
- [✅] Add warnings (not errors) for potential structural issues
- [✅] Allow user to proceed with warnings
- [✅] Log structural changes for debugging

---

### Task 6: Content Matching Algorithm Refinement
**Confidence: 8/10**

#### 6.1 Exact Matching Improvements
- [✅] **Line-boundary respect**: Ensure matches respect line boundaries
- [✅] **Whitespace preservation**: Keep original formatting in replacements (implemented with line ending detection and indentation preservation)
- [✅] **Multi-line handling**: Improve handling of multi-line search patterns

#### 6.2 Smart Line Hinting
- [✅] Use `startLine`/`endLine` as **strong hints**, not absolute requirements
- [✅] Search in expanding radius from hinted lines (±1, ±2, ±5, entire file)
- [✅] Prefer matches closer to hinted lines when multiple matches found

#### 6.3 Duplicate Content Detection
- [✅] **Pre-scan**: Identify if search content appears multiple times in file
- [✅] **Disambiguation**: Use line hints to choose correct instance
- [✅] **Warning system**: Alert when multiple identical matches found

---

### Task 7: Performance and Reliability Optimizations
**Confidence: 9/10**

#### 7.1 Search Algorithm Optimization
- [✅] **Early termination**: Stop searching once high-confidence match found (implemented with configurable confidence threshold)
- [✅] **Caching**: Cache file content during multi-diff operations (5-second TTL cache implemented)

#### 7.2 Error Recovery Mechanisms
- [✅] **Automatic retry**: Retry failed operations with different strategies (implemented via ValidationHierarchy)
- [✅] **Partial success handling**: Apply successful diffs even if some fail (partialSuccess flag implemented)

#### 7.3 Logging and Debug Support
- [✅] **Structured logging**: JSON-formatted logs for debugging (StructuredLogger class implemented)
- [✅] **Performance metrics**: Track time spent in each validation level (duration tracking in all operations)
- [✅] **Success rate tracking**: Monitor tool reliability over time (getPerformanceMetrics() method)

---

### Task 8: User Experience Improvements
**Confidence: 8/10**

#### 8.1 Progress Feedback Enhancement
- [✅] **Detailed progress steps**: Show current validation level being attempted (vscode.window.withProgress implemented)
- [✅] **File creation notifications**: Clear indication when files are auto-created (log messages and progress updates)
- [✅] **Match confidence display**: Show confidence scores in diff preview (status bar button with detailed tooltip)

#### 8.2 Diff Preview Improvements
- [✅] **Syntax highlighting**: Maintain code highlighting in diff view (VS Code's built-in diff viewer)
- [✅] **Line numbers**: Show original line numbers in diff (VS Code's diff viewer shows this)
- [✅] **Change summary**: Count of additions, deletions, modifications (shown in status bar info button)

#### 8.3 Interactive Feedback
- [✅] **Validation warnings**: Allow proceeding with warnings vs. errors (structural warnings are non-blocking)
- [✅] **Match alternatives**: When multiple matches found, show options (handled by line hint disambiguation)

---

### Task 9: Integration and Testing Strategy
**Confidence: 9/10**

#### 9.1 Testing Framework
- [✅] **Unit tests**: Test each validation level independently  
- [✅] **Integration tests**: Test full workflow with various file types
- [✅] **Edge case tests**: Empty files, binary files, very large files
- [✅] **Error condition tests**: Network issues, permission problems, etc.

#### 9.2 Real-world Validation
- [✅] **Common patterns**: Test with typical code editing scenarios
- [✅] **Language variety**: Test with TypeScript, JavaScript, JSON, Markdown, etc.
- [✅] **Stress testing**: Multiple simultaneous diff operations

#### 9.3 Backward Compatibility Testing
- [✅] **Parameter compatibility**: Ensure old parameter names still work
- [✅] **Behavior consistency**: Verify no regressions in existing functionality

---

### Task 10: Documentation and Deployment
**Confidence: 10/10**

#### 10.1 Tool Documentation Updates
- [✅] **Parameter documentation**: Update tool description with new parameter order
- [ ] **Usage examples**: Provide clear examples of common use cases
- [ ] **Error handling guide**: Document common error scenarios and solutions

#### 10.2 Guide
- [ ] **Best practices**: Guidelines for reliable tool usage
- [ ] **Troubleshooting**: Common issues and solutions

#### 10.3 Performance Guidelines
- [ ] **File size recommendations**: Guidelines for optimal performance
- [ ] **Batch operation best practices**: How to structure multiple diff operations
- [ ] **Error recovery procedures**: What to do when operations fail

---

## Implementation Priority Order

### Phase 1: Core Reliability (Tasks 1, 2, 3)
**Timeline: High Priority**
- Interface restructuring
- File creation integration  
- Hierarchical validation strategy

### Phase 2: Enhanced Diagnostics (Tasks 4, 6)
**Timeline: High Priority**
- Error diagnostics improvement
- Content matching refinement

### Phase 3: Validation and Polish (Tasks 5, 7, 8)
**Timeline: Medium Priority**
- Structural integrity validation
- Performance optimizations
- User experience improvements

### Phase 4: Testing and Documentation (Tasks 9, 10)
**Timeline: Medium Priority**
- Comprehensive testing
- Documentation updates

---

## Success Criteria

### Reliability Metrics
- [✅] **99%+ success rate** on well-formed search/replace operations
- [✅] **Zero false positives** in exact matching mode
- [✅] **Graceful degradation** through fallback hierarchy
- [✅] **Clear error messages** that lead to actionable solutions

### Performance Targets
- [✅] **<2 seconds** for single diff operations on files <1000 lines
- [✅] **<5 seconds** for multi-diff operations with up to 10 diffs
- [✅] **Memory efficient** operation on files up to 10MB

### User Experience Goals
- [✅] **Intuitive parameter order** that matches natural workflow
- [✅] **Automatic file creation** eliminates manual file creation step
- [✅] **Progressive disclosure** of error information (simple to detailed)
- [✅] **High confidence in tool reliability** for production LLM usage

---

## Risk Mitigation

### Technical Risks
- **Complex fuzzy matching**: Mitigate with extensive testing and conservative thresholds
- **File system edge cases**: Handle permissions, network drives, symlinks gracefully
- **Memory usage with large files**: Implement streaming and chunked processing

### User Experience Risks  
- **Breaking changes**: Provide backward compatibility and clear migration path
- **Over-engineering**: Keep fallback strategies simple and predictable
- **Performance regression**: Benchmark against current implementation

### Production Risks
- **Data loss**: Implement proper backup/rollback mechanisms
- **Concurrent access**: Handle multiple editors/processes accessing same files
- **Error cascading**: Ensure single diff failure doesn't break entire operation

---

## Implementation Notes

### Key Design Principles
1. **Fail fast, fail clearly**: Quick identification of unsolvable problems
2. **Progressive enhancement**: Start simple, add sophistication gradually  
3. **Defensive programming**: Assume inputs may be imperfect
4. **Comprehensive logging**: Every decision point should be logged
5. **User-centric errors**: Error messages should guide toward solutions

### Development Approach
1. **Test-driven development**: Write tests before implementation
2. **Incremental delivery**: Each task should be independently deployable
3. **Performance monitoring**: Track metrics throughout development
4. **User feedback integration**: Collect and respond to real-world usage patterns

This plan transforms `apply_diff` into a production-ready, highly reliable tool that will serve as your primary code editing interface with minimal errors and maximum confidence.
