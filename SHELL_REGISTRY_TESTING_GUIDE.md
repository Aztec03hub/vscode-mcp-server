# Shell Registry System Testing Guide

## Overview
This guide provides comprehensive testing procedures for the Shell Registry System implemented in Phase 1.

## Testing Environment Requirements
- VS Code with the vscode-mcp-server extension loaded
- MCP client connected to the extension
- Access to the shell tools via MCP protocol

## Test Categories

### 🔧 **Test Category 1: Basic Shell Management**

#### Test 1.1: Get Workspace Context
**Command:** `get_workspace_context`
**Expected Results:**
- Returns current working directory
- Shows VS Code workspace folders
- Displays project information from package.json
- Shows 0 active shells initially
- Includes future enhancement notes

#### Test 1.2: Create First Shell
**Command:** `execute_shell_command_code`
**Parameters:**
```json
{
  "command": "echo Hello World"
}
```
**Expected Results:**
- Creates shell-1 automatically
- Shows shell type (PowerShell/Command Prompt)
- Returns working directory before/after
- Shows "Completed" status
- Command executes successfully

#### Test 1.3: Verify Shell Creation
**Command:** `get_workspace_context`
**Expected Results:**
- Shows 1 active shell (shell-1)
- Shell status should be "idle"
- Shell name should be "shell-1"

### 🔀 **Test Category 2: Multiple Shell Management**

#### Test 2.1: Create Named Shell
**Command:** `execute_shell_command_code`
**Parameters:**
```json
{
  "command": "dir",
  "shellId": "my-custom-shell"
}
```
**Expected Results:**
- Creates new shell with custom name
- Should fail with error about shell not existing
- Error message should list available shells

#### Test 2.2: Create Shell with Directory
**Command:** `execute_shell_command_code`
**Parameters:**
```json
{
  "command": "pwd",
  "cwd": "C:\\temp"
}
```
**Expected Results:**
- Uses existing shell or creates new one
- Changes to specified directory
- Shows directory change in before/after context

#### Test 2.3: Test Shell Limit
**Procedure:** Create multiple shells by running commands without shellId
**Expected Results:**
- Should allow up to 8 shells maximum
- 9th shell creation should fail with "Maximum number of shells" error

### ⏱️ **Test Category 3: Interactive and Background Commands**

#### Test 3.1: Background Process
**Command:** `execute_shell_command_code`
**Parameters:**
```json
{
  "command": "ping google.com -t",
  "background": true
}
```
**Expected Results:**
- Returns immediately with "Background Command Started"
- Shows shell ID and status
- Command runs in terminal in background
- Note about using list_active_shells to check status

#### Test 3.2: Interactive Command
**Command:** `execute_shell_command_code`
**Parameters:**
```json
{
  "command": "npm create svelte@latest test-project",
  "interactive": true
}
```
**Expected Results:**
- Uses 45-second timeout instead of 15-second
- If command prompts for input, should timeout with "waiting for input" message
- Should suggest using send_input_to_shell tool

#### Test 3.3: Regular Command Timeout
**Command:** `execute_shell_command_code`
**Parameters:**
```json
{
  "command": "timeout 20",
  "interactive": false
}
```
**Expected Results:**
- Should timeout after 15 seconds
- Status should show "Timed out"
- Shell should return to "idle" status

### 🔄 **Test Category 4: Shell Status and Lifecycle**

#### Test 4.1: Shell Status During Execution
**Procedure:**
1. Start a long-running command in background
2. Immediately call `get_workspace_context`
**Expected Results:**
- Shell should show "busy" status during execution
- Should show the running command
- After completion, should return to "idle"

#### Test 4.2: Directory Tracking
**Command:** `execute_shell_command_code`
**Parameters:**
```json
{
  "command": "cd C:\\Windows && echo %CD%",
  "shellId": "shell-1"
}
```
**Expected Results:**
- Shell's currentDirectory should update to C:\\Windows
- Subsequent calls should remember the directory
- get_workspace_context should show updated directory

#### Test 4.3: Shell Auto-Cleanup
**Procedure:**
1. Create several shells
2. Wait 5+ minutes without using them
3. Check shell status
**Expected Results:**
- Unused shells should be automatically closed
- Only recently used shells should remain
- get_workspace_context should show reduced shell count

### ⚠️ **Test Category 5: Error Handling**

#### Test 5.1: Invalid Shell ID
**Command:** `execute_shell_command_code`
**Parameters:**
```json
{
  "command": "echo test",
  "shellId": "nonexistent-shell"
}
```
**Expected Results:**
- Clear error message about shell not found
- Lists available shells
- Does not create the shell with that name

#### Test 5.2: Shell Integration Failure
**Procedure:** Test with terminal that doesn't support shell integration
**Expected Results:**
- Graceful error handling
- Informative error message about shell integration
- Suggestions for resolution

#### Test 5.3: Maximum Shells Exceeded
**Procedure:** Try to create 9th shell
**Expected Results:**
- Clear error message about maximum limit
- Suggestion to close unused shells
- No shell created

### 📊 **Test Category 6: Integration Testing**

#### Test 6.1: Workspace Context Integration
**Command:** `get_workspace_context`
**Expected Results:**
- Shows accurate count of active shells
- Lists all shell IDs and their status
- Correlates with actual shell state

#### Test 6.2: Cross-Shell Communication
**Procedure:**
1. Set environment variable in shell-1
2. Try to access it from shell-2
**Expected Results:**
- Each shell should have independent environment
- Variables set in one shell should not affect others

#### Test 6.3: Shell Persistence
**Procedure:**
1. Create shells and run commands
2. Restart VS Code
3. Check shell status
**Expected Results:**
- Shells should not persist across VS Code restarts
- Fresh start with no active shells
- Clean slate for new session

## 📝 **Expected Test Results Summary**

### ✅ **Success Indicators:**
- All shells create with proper auto-generated IDs (shell-1, shell-2, etc.)
- Maximum 8 shells enforced
- Auto-cleanup after 5 minutes of inactivity
- Proper status tracking (idle, busy, waiting-for-input, crashed)
- Working directory tracking per shell
- Interactive vs background command differentiation
- Clean error messages with helpful suggestions
- Integration with workspace context tool

### ⚠️ **Potential Issues to Watch For:**
- Shell integration not available in certain terminals
- Memory leaks from unclosed shells
- Race conditions in shell status updates
- Directory tracking inconsistencies
- Timeout handling edge cases
- Cross-platform shell type detection issues

## 🚀 **Next Steps After Testing**
Once all tests pass, we'll be ready to proceed with:
- Phase 2: Interactive Command Support
- Advanced shell management tools
- Output limiting and safety features

---

**Test Status:** Ready for execution
**Estimated Testing Time:** 30-45 minutes for complete test suite
**Prerequisites:** Working VS Code extension with MCP client connection
