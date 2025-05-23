# 🔧 Complete Installation & Testing Guide for Apply Diff Extension

## Overview

This guide will help you install the updated vscode-mcp-server extension with the new `apply_diff` feature, replacing your existing installation.

## Prerequisites

- **Node.js** and **npm** installed
- **VS Code** installed
- **Original vscode-mcp-server extension** currently installed (will be replaced)

## Part 1: Compile and Package the Extension

### Step 1: Navigate to Project Directory

```bash
cd C:\Users\plafayette\workspace\github_projects\vscode-mcp-server
```

### Step 2: Install Dependencies (if not already done)

```bash
npm install
```

### Step 3: Compile TypeScript Code

```bash
npm run compile
```

This compiles all TypeScript files in the `src` directory to JavaScript in the `out` directory.

### Step 4: Package Extension into VSIX File

```bash
npx vsce package
```

This creates `vscode-mcp-server-0.0.4.vsix` in the project root.

**✅ Expected Output:** 
```
DONE Packaged: C:\Users\plafayette\workspace\github_projects\vscode-mcp-server\vscode-mcp-server-0.0.4.vsix (6800 files, 13.62 MB)
```

## Part 2: Install the Updated Extension

### Step 5: Uninstall the Original Extension

1. **Open VS Code**
2. **Go to Extensions** (Ctrl+Shift+X)
3. **Search for "vscode-mcp-server"**
4. **Click the gear icon** next to the extension
5. **Select "Uninstall"**
6. **Restart VS Code** when prompted

### Step 6: Install the New Extension from VSIX

**Method 1: Using VS Code UI (Recommended)**

1. **Open VS Code**
2. **Go to Extensions** (Ctrl+Shift+X)
3. **Click the "..." menu** in the Extensions view
4. **Select "Install from VSIX..."**
5. **Navigate to:** `C:\Users\plafayette\workspace\github_projects\vscode-mcp-server\`
6. **Select:** `vscode-mcp-server-0.0.4.vsix`
7. **Click "Install"**
8. **Restart VS Code** when prompted

**Method 2: Using Command Line**

```bash
cd C:\Users\plafayette\workspace\github_projects\vscode-mcp-server
code --install-extension vscode-mcp-server-0.0.4.vsix
```

### Step 7: Verify Installation

1. **Open VS Code**
2. **Go to Extensions** (Ctrl+Shift+X)
3. **Search for "vscode-mcp-server"**
4. **Verify version shows "0.0.4"**
5. **Check that it shows "Installed"**

## Part 3: Set Up Testing Environment

### Step 8: Create Test Files

Navigate to the extension directory and create test files:

```bash
cd C:\Users\plafayette\workspace\github_projects\vscode-mcp-server
node out/test/integration-test-runner.js setup
```

**Expected Output:**
```
🚀 Apply Diff Integration Test Runner

Setting up integration test files...

Created: simple.ts
Created: whitespace.js
Created: multiple.ts
Test files created in: C:\Users\plafayette\workspace\github_projects\vscode-mcp-server\integration-test-files
```

### Step 9: Configure VS Code Workspace

1. **Open VS Code**
2. **File → Open Folder**
3. **Select:** `C:\Users\plafayette\workspace\github_projects\vscode-mcp-server`
4. **Verify you can see:**
   - `integration-test-files/` folder
   - `simple.ts`, `whitespace.js`, `multiple.ts` files

### Step 10: Start the MCP Server

1. **Open Command Palette** (Ctrl+Shift+P)
2. **Type:** "MCP Server"
3. **Select:** "Toggle MCP Server" or check status bar
4. **Verify server starts** (status bar should show server info)

## Part 4: Verify Apply Diff Installation

### Step 11: Check Available Tools

The new extension should register these tools:
- `create_file_code`
- `replace_lines_code` 
- **`apply_diff`** ← New tool!

You can verify this by checking your MCP client's available tools list.

### Step 12: Test Basic Functionality

Try this simple test with your MCP client:

**Test Command:**
```json
{
  "tool": "apply_diff",
  "arguments": {
    "filePath": "integration-test-files/simple.ts",
    "diffs": [{
      "startLine": 1,
      "endLine": 1,
      "originalContent": "    private result: number = 0;",
      "newContent": "    private result: number = 100;",
      "description": "Change initial value to 100"
    }],
    "description": "Test apply_diff installation"
  }
}
```

**Expected Behavior:**
1. VS Code diff viewer opens
2. Shows change from `= 0;` to `= 100;`
3. User approval dialog appears
4. Change applies when approved

## Part 5: Complete Testing Suite

### Step 13: Run All Test Scenarios

Get complete test scenarios:

```bash
cd C:\Users\plafayette\workspace\github_projects\vscode-mcp-server
node out/test/integration-test-runner.js scenarios
```

This will output all test commands you can use with your MCP client.

### Step 14: Performance Testing

Create performance test files:

```bash
node out/test/integration-test-runner.js performance
```

## Troubleshooting

### Extension Not Installing
- **Check VS Code version:** Must be 1.99.0 or higher
- **Restart VS Code:** Close completely and reopen
- **Check file path:** Ensure VSIX file exists in correct location

### MCP Server Not Starting
- **Check extension status:** Look for errors in VS Code output panel
- **Verify port configuration:** Check MCP Server settings
- **Restart extension:** Disable and re-enable the extension

### Apply Diff Tool Not Available
- **Verify extension version:** Should be 0.0.4
- **Check MCP connection:** Ensure client is connected to server
- **Review server logs:** Look for tool registration messages

### Test Files Not Working
- **Check file paths:** Use relative paths from workspace root
- **Verify file contents:** Ensure original content matches exactly
- **Reset test files:** Run setup command again

## Success Indicators

You'll know everything is working when:

✅ **Extension installed:** Version 0.0.4 shows in Extensions view  
✅ **MCP server running:** Status bar shows server information  
✅ **Apply_diff available:** Tool appears in your MCP client  
✅ **Test files created:** integration-test-files folder exists  
✅ **Basic test works:** Simple diff command opens VS Code diff viewer  

## Quick Verification Checklist

- [ ] Original extension uninstalled
- [ ] New extension (v0.0.4) installed  
- [ ] VS Code restarted
- [ ] MCP server running
- [ ] Test files created
- [ ] Workspace opened in VS Code
- [ ] Basic apply_diff test works

## What's New in This Version

🎉 **New `apply_diff` Tool Features:**
- **Multiple diff sections** in single operation
- **Fuzzy matching** handles whitespace differences
- **Content drift detection** finds moved content
- **Conflict detection** prevents overlapping changes
- **VS Code integration** with diff preview and user approval
- **Atomic changes** - all or nothing application
- **Comprehensive error handling** with helpful messages

## Next Steps

Once installed and verified:

1. **Try all test scenarios** from the integration test runner
2. **Test with real files** in your projects
3. **Experiment with fuzzy matching** by creating files with different whitespace
4. **Test error conditions** to see helpful error messages
5. **Use in production** for complex code changes

**🚀 You're now ready to use the powerful new `apply_diff` functionality!**

---

**Need Help?**
- Check `MANUAL_TESTING_GUIDE.md` for detailed testing scenarios
- Review `TESTING_COMPLETE_SUMMARY.md` for feature overview
- Look at `integration-test-files/` for example usage
