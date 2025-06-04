# UX Improvements Plan: VS Code MCP Server Extension

## 🚨 CRITICAL ISSUE: Shell Safety Vulnerability

### **IMMEDIATE PRIORITY: Safety Approval System**

**Problem**: The current safety warning system shows warnings but **STILL EXECUTES dangerous commands**. This is a critical security vulnerability.

**Example**: When `format C:` was executed, it showed a warning but then actually attempted to format the C: drive. We were only saved by insufficient permissions.

**Current State (2025-06-04)**:
- `detectDestructiveCommand` function is working correctly and detecting patterns
- Commands are currently **BLOCKED** when detected (returns error message)
- Auto-approval check is hardcoded to `false` (placeholder)
- Shell auto-approval toggle is marked as completed but **NOT IMPLEMENTED**
- Only apply_diff auto-approval exists, not shell auto-approval

---

## 📋 COMPREHENSIVE TASK BREAKDOWN

### **Phase 1: Critical Safety Fix (IMMEDIATE)**

#### Task 1.1: Implement Shell Command Approval System
- **File**: `src/tools/shell-tools.ts`
- **Changes Needed**:
  ```typescript
  // Add approval check BEFORE command execution
  if (safetyWarning && !autoApprovalShellEnabled) {
      // Show status bar approval buttons and WAIT for response
      const approved = await showShellApprovalButtons(command, safetyWarning);
      // Only proceed if user explicitly approves
      if (!approved) {
          return createErrorResult("Command cancelled by user due to safety concerns");
      }
  }
  ```
  - **Integration**: Create new status bar approval system (different from apply_diff modal)
  - **Status**: ⬜ Not Started

#### Task 1.2: Shell Auto-Approval Toggle
  - **File**: `src/extension.ts`
  - **Status**: ✅ COMPLETED
  - **Implementation Steps**:
  1. Add `shellAutoApprovalEnabled` variable (default: false)
  2. Create shell auto-approval status bar item:
     ```typescript
     shellAutoApprovalStatusBar = vscode.window.createStatusBarItem(
         vscode.StatusBarAlignment.Right,
         98  // Priority next to other status bars
     );
     ```
  3. Add toggle command `vscode-mcp-server.toggleShellAutoApproval`
  4. Implement `toggleShellAutoApproval` function with modal warning
  5. Add persistence with `context.globalState`
  6. Export `isShellAutoApprovalEnabled()` function
  7. Update `shell-tools.ts` to import and use this function

#### Task 1.3: Status Bar Approval Buttons System
- **File**: `src/extension.ts`
- **Status**: ✅ COMPLETED
  - **Implementation Steps**:
  1. Create `ShellApprovalManager` class:
     ```typescript
     class ShellApprovalManager {
         private acceptButton?: vscode.StatusBarItem;
         private rejectButton?: vscode.StatusBarItem;
         private pendingCommand?: string;
         private resolvePromise?: (approved: boolean) => void;
         private timeoutId?: NodeJS.Timeout;
         
         async showApprovalButtons(command: string, warning: string): Promise<boolean>
         private createApprovalButtons()
         handleApproval()
         handleRejection()
         private cleanup()
     }
     ```
  2. Register commands:
     - `vscode-mcp-server.approveShellCommand`
     - `vscode-mcp-server.rejectShellCommand`
  3. Export `requestShellCommandApproval` function
  4. Update `shell-tools.ts` to:
     - Import approval function
     - Call when dangerous command detected
     - Wait for response before proceeding

#### Task 1.4: Safety Testing Protocol
- **Status**: ✅ COMPLETED
- **Testing Guide Created**: `SHELL_SAFETY_TESTING_GUIDE.md`
  - **Implementation**:
  - Comprehensive testing guide with 5 test scenarios
  - Step-by-step instructions for each test
  - Expected behaviors clearly documented
  - Troubleshooting section included
  - Safety notes and warnings emphasized
  - **Test Coverage**:
  1. Approval/Rejection flow testing
  2. 30-second timeout testing
  3. Shell auto-approval mode testing
  4. Safe command verification
  5. Multiple destructive pattern testing
- **Console Output**: Extension Host logs show detailed flow

---

### **Phase 2: Status Bar Menu System**

#### Task 2.1: Main Menu Button Design
**Target**: Single status bar button with popup menu (like GitHub Copilot)

**Design Specifications**:
```typescript
// Main button appearance
{
    text: "$(gear) VSCode MCP Server",
    alignment: vscode.StatusBarAlignment.Right,
    priority: 100,
    command: 'vscode-mcp-server.showMainMenu'
}
```
- **Status**: ⬜ Not Started

#### Task 2.2: Popup Menu Structure
```
┌─ VSCode MCP Server ─────────────────┐
│ $(server) MCP Server: Port 3000     │ ← Server status & toggle
│ $(pass-filled) Auto-Approve (Diff): ON  │ ← Diff approval toggle  
│ $(shield) Auto-Approve (Shell): OFF │ ← Shell approval toggle
│ $(info) Show Server Info            │ ← Info command
│ $(gear) Extension Settings          │ ← Settings link
└─────────────────────────────────────┘
```
- **Status**: ⬜ Not Started

#### Task 2.3: Menu Implementation
- **File**: `src/extension.ts`
- **Method**: `vscode.window.showQuickPick()` with custom QuickPickItems
- **Features**:
  - Real-time status updates
  - Visual indicators (icons, colors)
  - Tooltips for each option
- **Status**: ⬜ Not Started

---

### **Phase 3: Visual Design System**

#### Task 3.1: Icon Standardization
```typescript
// Icon mapping
const ICONS = {
    server: {
        active: "$(server-process)",     // Green when active
        inactive: "$(server)"            // Red when inactive
    },
    approval: {
        enabled: "$(pass-filled)",       // Warning color when enabled
        disabled: "$(circle-outline)"    // Default when disabled
    },
    shell: {
        safe: "$(terminal)",
        warning: "$(shield)",
        accept: "$(check)",              // Green checkmark for approval
        reject: "$(x)"                   // Red X for rejection
    },
    menu: "$(gear)"
}
```
- **Status**: ⬜ Not Started

#### Task 3.2: Color Scheme
```typescript
const COLORS = {
    serverActive: new vscode.ThemeColor('statusBarItem.prominentForeground'), // Green
    serverInactive: new vscode.ThemeColor('statusBarItem.errorBackground'), // Red
    approvalEnabled: new vscode.ThemeColor('statusBarItem.warningBackground'), // Orange
    approvalDisabled: undefined,
    danger: new vscode.ThemeColor('statusBarItem.errorBackground'), // Red
    shellAccept: new vscode.ThemeColor('statusBarItem.prominentBackground'), // Green accept button
    shellReject: new vscode.ThemeColor('statusBarItem.errorBackground') // Red reject button
}
```
- **Status**: ⬜ Not Started

#### Task 3.3: Status Bar Priorities
```typescript
// Right-aligned priority order (higher = more right)
{
    shellReject: 102,     // Rightmost when approval needed
    shellAccept: 101,     // Second from right when approval needed  
    mainMenu: 100,        // Normal rightmost position
    // Individual items removed (moved to menu)
    // Approval buttons only show temporarily during safety prompts
}
```
- **Status**: ⬜ Not Started

---

### **Phase 4: Enhanced UX Flows**

#### Task 4.1: Shell Command Approval Flow
```
User triggers destructive command
↓
Safety system detects threat
↓
Show status bar approval buttons:

Status Bar: [...other items]  [$(check) Accept] [$(x) Reject]  
                              ^green bg      ^red bg

MCP Server response:
"⚠️ SAFETY WARNING: Destructive command detected!
Command: format C:
Risk: May delete files, format drives

▶️ Use status bar buttons to Accept or Reject this command."

↓
If Accept clicked: Execute with warning display, remove buttons
If Reject clicked: Return error, no execution, remove buttons
Timeout (30s): Auto-reject, remove buttons
```
- **Status**: ⬜ Not Started

#### Task 4.2: Auto-Approval Warning Flow
```
User enables shell auto-approval
↓
Show warning modal:
┌─ Danger: Auto-Approval Enabled ──────┐
│ 🚨 Shell commands will execute        │
│    automatically without confirmation │
│                                       │
│ This includes destructive commands!   │
│ Use only for testing/development.     │
│                                       │
│ [Keep Enabled] [Disable]              │
└───────────────────────────────────────┘
```
- **Status**: ⬜ Not Started

#### Task 4.3: Server Status Integration
- **Active Server**: Green button with prominent foreground
- **Inactive Server**: Red background
- **Starting/Stopping**: Progress indicators
- **Error States**: Red background with error icon
- **Status**: ⬜ Not Started

---

### **Phase 5: Testing & Quality Assurance**

#### Task 5.1: Safety Testing Suite
```typescript
// Test categories
describe('Shell Safety System', () => {
    it('should block destructive commands without approval')
    it('should show approval dialog for dangerous commands')
    it('should execute safe commands without prompts')
    it('should respect auto-approval settings')
    it('should never execute commands when approval is denied')
})
```
- **Status**: ⬜ Not Started

#### Task 5.2: UX Component Testing
```typescript
describe('Status Bar Menu System', () => {
    it('should show main menu button')
    it('should open popup menu on click')
    it('should update menu items based on state')
    it('should toggle settings correctly')
    it('should maintain visual consistency')
})
```
- **Status**: ⬜ Not Started

#### Task 5.3: Integration Testing
- Test with real VS Code environment
- Verify all icon/color combinations
- Test across different VS Code themes
- Validate accessibility compliance
- **Status**: ⬜ Not Started

---

## 🔧 IMPLEMENTATION DETAILS

### **File Structure Changes**

```
src/
├── extension.ts (major refactor)
│   ├── Remove individual status bar items
│   ├── Add main menu system
│   ├── Add shell approval state management
│   ├── Add status bar approval buttons system
│   └── Implement popup menu logic
├── tools/shell-tools.ts (critical safety fix)
│   ├── Add approval check before execution
│   ├── Integrate with extension approval state
│   └── Enhance safety warning system
├── ui/ (new directory)
│   ├── menu-manager.ts (menu system)
│   ├── approval-buttons.ts (status bar approval UX)
│   └── status-indicators.ts (visual components)
    └── test/ui/ (new test directory)
    ├── menu.test.ts
    ├── approval-buttons.test.ts
    └── safety.test.ts
```

### **Key Dependencies**

```typescript
// Required VS Code APIs
import { 
    QuickPick, QuickPickItem, 
    StatusBarItem, StatusBarAlignment,
    ThemeColor, ProgressLocation,
    MessageOptions, MessageItem
} from 'vscode'
```

### **Implementation Order and Dependencies**

**CRITICAL**: Tasks must be implemented in this specific order due to dependencies:

1. **Task 1.2** (Shell Auto-Approval Toggle) - Foundation for approval system
    2. **Task 1.3** (Approval Buttons) - Depends on 1.2 for auto-approval check
    3. **Task 1.4** (Testing) - Requires 1.2 and 1.3 to be complete
    4. **Phase 2-5** - Can proceed after Phase 1 is complete

    ### **Code Integration Points**

    #### **Extension.ts Exports Required**:
        ```typescript
        // For shell-tools.ts to import
        export function isShellAutoApprovalEnabled(): boolean
        export async function requestShellCommandApproval(command: string, warning: string): Promise<boolean>
        ```

            #### **Shell-tools.ts Integration**:
        ```typescript
        import { isShellAutoApprovalEnabled, requestShellCommandApproval } from '../extension';

        // In execute_shell_command_code tool:
            if (safetyWarning) {
    const autoApprovalEnabled = isShellAutoApprovalEnabled();
    
    if (!autoApprovalEnabled) {
        const approved = await requestShellCommandApproval(command, safetyWarning);
        if (!approved) {
            registry.updateShellStatus(managedShell.id, 'idle');
            return createErrorResult("Command cancelled by user due to safety concerns");
        }
    }
    // If auto-approved or user approved, continue with execution
        }
        ```

---

## ⚡ EXECUTION TIMELINE

### **Immediate Implementation (Phase 1 - Critical Safety)**
**Must be completed in order:**
1. **Task 1.2**: Shell Auto-Approval Toggle (1-2 hours)
2. **Task 1.3**: Approval Buttons System (2-3 hours)
3. **Task 1.4**: Safety Testing (1 hour)

### **Week 1: Complete Phase 1 + Start Phase 2**
- **Day 1**: ⬜ Tasks 1.2 and 1.3 (Shell auto-approval + approval buttons)
- **Day 2**: ⬜ Task 1.4 (Safety testing) + Bug fixes
- **Day 3-4**: ⬜ Phase 2 - Main menu button design
- **Day 5**: ⬜ Phase 2 - Popup menu implementation

### **Week 2: Complete Phase 2 + Phase 3**
- **Day 1-2**: ⬜ Phase 2 - Menu integration and testing
- **Day 3-4**: ⬜ Phase 3 - Visual design system
- **Day 5**: ⬜ Phase 4 - Enhanced UX flows

### **Week 3: Polish & Testing**
- **Day 1-2**: ⬜ Phase 5 - Comprehensive testing
- **Day 3-4**: ⬜ Bug fixes and refinements
- **Day 5**: ⬜ Documentation and release prep

---

## 🎯 SUCCESS CRITERIA

### **Safety Requirements**
- ⬜ No destructive commands execute without explicit approval
- ⬜ Clear visual warnings for dangerous operations
- ⬜ Safe testing protocols in place
- ⬜ Comprehensive safety test coverage

### **UX Requirements**
- ⬜ Single, clean status bar button
- ⬜ Intuitive popup menu system
- ⬜ Consistent visual design
- ⬜ Responsive state management
- ⬜ Accessible interface design

### **Technical Requirements**
- ⬜ No breaking changes to existing functionality
- ⬜ Backward compatibility maintained
- ⬜ Performance impact minimized
- ⬜ Error handling robust
- ⬜ Test coverage > 90%

---

## 🚀 FUTURE ENHANCEMENTS

### **Advanced Safety Features**
- ⬜ Command whitelist/blacklist management
- ⬜ User-defined safety rules
- ⬜ Command history with risk assessment
- ⬜ Integration with external security tools

### **Enhanced Menu System**
- ⬜ Customizable menu layout
- ⬜ Keyboard shortcuts
- ⬜ Context-sensitive options
- ⬜ Recent commands history

### **Professional UX**
- ⬜ Custom icons and branding
- ⬜ Animation and transitions
- ⬜ Advanced tooltips
- ⬜ Help and documentation integration

---

## 📝 NOTES

- **Single Source of Truth**: This document is the authoritative plan for all UX improvements
- **Priority**: Safety fixes are non-negotiable and must be completed first
- **Testing**: All changes must be tested with safe commands only (`rm test-file.txt`)
- **Implementation Order**: Tasks 1.2 → 1.3 → 1.4 must be done sequentially
- **Compatibility**: Maintain support for existing MCP tool consumers
- **Documentation**: Update all relevant docs and help text
- **Code Review**: All safety-related changes require thorough review

---

*This plan addresses the critical safety vulnerability while establishing a foundation for a professional, scalable UX system.*