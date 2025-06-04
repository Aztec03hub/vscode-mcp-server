# Shell Registry System - Quick Test Checklist

## 📝 **Basic Functionality Tests**

### ✅ **Quick Start Tests (5 minutes)**
- [ ] **Test 1:** Run `get_workspace_context` - should show 0 active shells
- [ ] **Test 2:** Run `execute_shell_command_code` with `{"command": "echo Hello"}` - should create shell-1
- [ ] **Test 3:** Run `get_workspace_context` again - should show 1 active shell
- [ ] **Test 4:** Run another command without shellId - should reuse shell-1
- [ ] **Test 5:** Run command with `{"command": "dir", "shellId": "shell-2"}` - should fail with error

### ✅ **Core Features Tests (10 minutes)**
- [ ] **Test 6:** Background command: `{"command": "ping google.com -t", "background": true}`
- [ ] **Test 7:** Interactive command: `{"command": "pause", "interactive": true}` - should timeout
- [ ] **Test 8:** Directory change: `{"command": "cd C:\\temp && echo %CD%", "cwd": "C:\\temp"}`
- [ ] **Test 9:** Create multiple shells by running commands without shellId
- [ ] **Test 10:** Try to create 9th shell - should fail with max limit error

### ✅ **Error Handling Tests (5 minutes)**
- [ ] **Test 11:** Invalid shellId: `{"command": "echo test", "shellId": "fake-shell"}`
- [ ] **Test 12:** Check error messages are helpful and suggest solutions
- [ ] **Test 13:** Verify `get_workspace_context` shows accurate shell status

## 📈 **Expected Results Summary**

### **Shell Creation:**
- ✅ Auto-generates shell-1, shell-2, etc.
- ✅ Maximum 8 shells enforced
- ✅ Clean error messages for invalid shells

### **Command Execution:**
- ✅ Regular commands complete with "Completed" status
- ✅ Background commands return immediately
- ✅ Interactive commands use longer timeout
- ✅ Working directory tracking works

### **Shell Management:**
- ✅ Shell status updates (idle, busy, waiting-for-input)
- ✅ Directory tracking per shell
- ✅ Integration with workspace context

### **Error Handling:**
- ✅ Clear error messages
- ✅ Helpful suggestions for resolution
- ✅ No crashes or unexpected behavior

## 🚀 **Quick Verification Commands**

```bash
# Test 1: Basic shell creation
get_workspace_context

# Test 2: First command (creates shell-1)
execute_shell_command_code {"command": "echo Hello World"}

# Test 3: Background process
execute_shell_command_code {"command": "ping google.com -t", "background": true}

# Test 4: Interactive command
execute_shell_command_code {"command": "pause", "interactive": true}

# Test 5: Check status
get_workspace_context
```

## 📝 **Test Results Log**

**Date:** _________  
**Tester:** _________  
**VS Code Version:** _________  
**Extension Version:** _________  

**Test Results:**
- [ ] All basic tests passed
- [ ] All core feature tests passed
- [ ] All error handling tests passed
- [ ] No unexpected errors or crashes
- [ ] Performance is acceptable

**Issues Found:**
- _________
- _________
- _________

**Overall Status:** ✅ PASS / ❌ FAIL

**Notes:**
_________
_________
_________

---

**Ready for Phase 2:** Yes / No  
**Next Steps:** _________
