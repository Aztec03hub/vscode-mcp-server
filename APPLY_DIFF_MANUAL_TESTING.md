# Apply Diff Tool Manual Testing Guide

## Overview

This guide provides manual test scenarios for the enhanced `apply_diff` tool. These tests complement the automated test suite and provide real-world usage scenarios through the MCP interface.

## Prerequisites

1. Ensure the MCP server is running (check status bar)
2. Auto-Approval Mode should be OFF for manual testing (to see the confidence display)
3. Have a test workspace with some TypeScript/JavaScript files

## Test Scenarios

### 1. Basic Exact Match Test

**Setup**: Create a file `test-exact.ts` with:
```typescript
function hello() {
    console.log("Hello, world!");
}

function goodbye() {
    console.log("Goodbye!");
}
```

**Test**: Apply a simple change
```json
{
    "filePath": "test-exact.ts",
    "diffs": [{
        "startLine": 1,
        "endLine": 1,
        "search": "    console.log(\"Hello, world!\");",
        "replace": "    console.log(\"Hello, TypeScript!\");"
    }]
}
```

**Expected**:
- Confidence display shows 100% (green check icon)
- Change is applied exactly

### 2. Whitespace Tolerance Test

**Setup**: Create a file `test-whitespace.ts` with inconsistent indentation:
```typescript
function process() {
  const data = [];
  for (let i = 0; i < 10; i++) {
    data.push(i);
  }
}
```

**Test**: Search with different whitespace
```json
{
    "filePath": "test-whitespace.ts",
    "diffs": [{
        "startLine": 2,
        "endLine": 4,
        "search": "for (let i = 0; i < 10; i++) {\n        data.push(i);\n    }",
        "replace": "for (const item of Array(10).keys()) {\n        data.push(item);\n    }"
    }]
}
```

**Expected**:
- Confidence display shows ~90% (yellow warning icon)
- Tool finds match despite whitespace differences
- Original indentation is preserved

### 3. Case Sensitivity Test

**Setup**: Create a file `test-case.ts` with:
```typescript
const MyVariable = "test";
const myvariable = "another";
```

**Test**: Search with wrong case
```json
{
    "filePath": "test-case.ts",
    "diffs": [{
        "startLine": 0,
        "endLine": 0,
        "search": "const myvariable = \"test\";",
        "replace": "const MyVariable = \"updated\";"
    }]
}
```

**Expected**:
- Confidence display shows ~85-90% (yellow warning icon)
- Finds the first line (case-insensitive match)
- Shows "Content differs in case" in tooltip

### 4. Multiple Diffs Test

**Setup**: Create a file `test-multi.ts` with:
```typescript
import { Component } from '@angular/core';

@Component({
    selector: 'app-test',
    template: '<h1>Test</h1>'
})
export class TestComponent {
    title = 'test';
    
    constructor() {}
    
    ngOnInit() {
        console.log('initialized');
    }
}
```

**Test**: Apply multiple changes
```json
{
    "filePath": "test-multi.ts",
    "description": "Refactor component to use signals",
    "diffs": [
        {
            "startLine": 0,
            "endLine": 0,
            "search": "import { Component } from '@angular/core';",
            "replace": "import { Component, signal } from '@angular/core';"
        },
        {
            "startLine": 7,
            "endLine": 7,
            "search": "    title = 'test';",
            "replace": "    title = signal('test');"
        },
        {
            "startLine": 11,
            "endLine": 13,
            "search": "    ngOnInit() {\n        console.log('initialized');\n    }",
            "replace": "    ngOnInit() {\n        console.log('Component initialized with title:', this.title());\n    }"
        }
    ]
}
```

**Expected**:
- Confidence display shows average confidence across all diffs
- Tooltip shows individual confidence for each diff
- All changes applied in correct order

### 5. File Creation Test

**Test**: Create a new file
```json
{
    "filePath": "new-component.ts",
    "description": "Create new Angular component",
    "diffs": [{
        "startLine": 0,
        "endLine": 0,
        "search": "",
        "replace": "import { Component } from '@angular/core';\n\n@Component({\n    selector: 'app-new',\n    template: '<p>New component works!</p>'\n})\nexport class NewComponent {\n    // Component logic here\n}"
    }]
}
```

**Expected**:
- File is created automatically
- Shows "Creating new file" in status
- No confidence issues (100% for new file)

### 6. Structural Validation Test

**Setup**: Create a file `test-structure.ts` with:
```typescript
function calculate(x: number, y: number) {
    if (x > 0) {
        return x + y;
    }
    return y;
}
```

**Test**: Apply change that creates unbalanced braces
```json
{
    "filePath": "test-structure.ts",
    "diffs": [{
        "startLine": 2,
        "endLine": 2,
        "search": "        return x + y;",
        "replace": "        if (y > 0) {\n            return x + y;\n        // Missing closing brace"
    }]
}
```

**Expected**:
- Structural warning appears about unbalanced braces
- Warning is shown but doesn't block the change
- User can review and decide whether to proceed

### 7. Line Hint Disambiguation Test

**Setup**: Create a file `test-duplicate.ts` with duplicate content:
```typescript
function process(data) {
    // Process the data
    return data;
}

function transform(data) {
    // Process the data
    return data;
}
```

**Test**: Change the second occurrence
```json
{
    "filePath": "test-duplicate.ts",
    "diffs": [{
        "startLine": 6,
        "endLine": 6,
        "search": "    // Process the data",
        "replace": "    // Transform the data"
    }]
}
```

**Expected**:
- Tool uses line hint to select correct occurrence
- Tooltip mentions "Found 2 identical matches. Using closest to line 6."

### 8. Partial Success Mode Test

**Setup**: Create a file `test-partial.ts` with:
```typescript
class UserService {
    getUsers() {
        return [];
    }
    
    addUser(user) {
        // Add user
    }
}
```

**Test**: Apply multiple diffs with one invalid
```json
{
    "filePath": "test-partial.ts",
    "partialSuccess": true,
    "diffs": [
        {
            "startLine": 1,
            "endLine": 3,
            "search": "    getUsers() {\n        return [];\n    }",
            "replace": "    async getUsers() {\n        return await this.fetchUsers();\n    }"
        },
        {
            "startLine": 5,
            "endLine": 7,
            "search": "    deleteUser(id) {\n        // Delete user\n    }",
            "replace": "    async deleteUser(id: string) {\n        // Delete user by ID\n    }"
        },
        {
            "startLine": 5,
            "endLine": 7,
            "search": "    addUser(user) {\n        // Add user\n    }",
            "replace": "    async addUser(user: User) {\n        // Add new user\n    }"
        }
    ]
}
```

**Expected**:
- First and third diffs succeed
- Second diff fails (content not found)
- Warning shows "Partial success: 2 of 3 diffs applied"
- Changes are still applied for successful diffs

### 9. Performance Test with Large File

**Setup**: Create a large file with 1000+ lines

**Test**: Apply change near the end of file with line hint
```json
{
    "filePath": "large-file.ts",
    "diffs": [{
        "startLine": 950,
        "endLine": 950,
        "search": "// Target line content",
        "replace": "// Updated content"
    }]
}
```

**Expected**:
- Fast execution due to line hint optimization
- Early termination shown in console logs
- Performance metrics logged

### 10. Backward Compatibility Test

**Test**: Use old parameter names
```json
{
    "filePath": "test-compat.ts",
    "diffs": [{
        "startLine": 0,
        "endLine": 0,
        "originalContent": "const old = true;",
        "newContent": "const updated = true;"
    }]
}
```

**Expected**:
- Deprecation warnings in console
- Change still applies correctly
- Confidence display works normally

## Observing the Confidence Display

1. **Location**: Right side of status bar, appears after "Apply Changes" and "Reject Changes" buttons
2. **Icons**:
   - `$(check-all)` (✓✓) = High confidence (≥90%)
   - `$(warning)` (⚠) = Medium confidence (80-90%)
   - `$(alert)` (⚡) = Low confidence (<80%)
3. **Tooltip**: Hover to see detailed breakdown per diff
4. **Auto-hide**: If auto-approval is ON, display shows for 5 seconds

## Tips for Manual Testing

1. **Turn OFF Auto-Approval** to see the full diff preview and confidence display
2. **Check Console Logs** (Developer Tools > Console) for detailed validation output
3. **Use Line Hints** for better performance and accuracy
4. **Test Edge Cases** like empty files, files without newlines, etc.
5. **Monitor Performance** using the StructuredLogger metrics in console

## Reporting Issues

When reporting issues from manual testing:

1. Include the exact JSON used for the test
2. Copy any console error messages
3. Note the confidence percentage and strategy shown
4. Describe expected vs actual behavior
5. Include file content before and after (if relevant)
