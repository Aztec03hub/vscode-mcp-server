# UX Improvements Plan: VS Code MCP Server Extension

## 🚨 CRITICAL ISSUE: Shell Safety Vulnerability

### **IMMEDIATE PRIORITY: Safety Approval System**

**Problem**: The current safety warning system shows warnings but **STILL EXECUTES dangerous commands**. This is a critical security vulnerability.

**Example**: When `format C:` was executed, it showed a warning but then actually attempted to format the C: drive. We were only saved by insufficient permissions.

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
- **Add**: `autoApprovalShellEnabled` state management
- **Add**: Status bar toggle (temporary, will be moved to menu in Phase 2)
- **Status**: ✅ COMPLETED

#### Task 1.3: Status Bar Approval Buttons System
- **File**: `src/extension.ts`
- **Implementation**:
  ```typescript
  // Approval button specifications
  const acceptButton = {
      text: "$(check) Accept",
      backgroundColor: new vscode.ThemeColor('statusBarItem.prominentBackground'), // Green
      command: 'vscode-mcp-server.approveShellCommand'
  };
  
  const rejectButton = {
      text: "$(x) Reject", 
      backgroundColor: new vscode.ThemeColor('statusBarItem.errorBackground'), // Red
      command: 'vscode-mcp-server.rejectShellCommand'
  };
  ```
- **Behavior**:
  - Show buttons when dangerous command detected
  - Auto-hide after 30 seconds (default reject)
  - Remove buttons immediately after user choice
  - Store pending command context for approval/rejection
- **Status**: ⬜ Not Started

#### Task 1.4: Safety Testing Protocol
- **Rule**: **NEVER test with real destructive commands**
- **Safe Testing**: Create temp files only: `echo "test" > temp.txt && rm temp.txt`
- **Add**: Test cases with mock commands in test suite
- **Status**: ⬜ Not Started

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

### **Status Bar Approval Button Implementation**

```typescript
// Approval button manager
class ShellApprovalManager {
    private acceptButton?: vscode.StatusBarItem;
    private rejectButton?: vscode.StatusBarItem;
    private pendingCommand?: string;
    private resolvePromise?: (approved: boolean) => void;
    private timeoutId?: NodeJS.Timeout;

    async showApprovalButtons(command: string, warning: string): Promise<boolean> {
        // Create temporary status bar buttons
        this.createApprovalButtons();
        this.pendingCommand = command;
        
        // Set 30-second timeout for auto-reject
        this.timeoutId = setTimeout(() => {
            this.handleRejection();
        }, 30000);
        
        // Return promise that resolves when user chooses
        return new Promise<boolean>((resolve) => {
            this.resolvePromise = resolve;
        });
    }
    
    private createApprovalButtons() {
        // Accept button (green)
        this.acceptButton = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 101
        );
        this.acceptButton.text = '$(check) Accept';
        this.acceptButton.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        this.acceptButton.command = 'vscode-mcp-server.approveShellCommand';
        this.acceptButton.tooltip = 'Execute the dangerous command';
        this.acceptButton.show();
        
        // Reject button (red)
        this.rejectButton = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 102
        );
        this.rejectButton.text = '$(x) Reject';
        this.rejectButton.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        this.rejectButton.command = 'vscode-mcp-server.rejectShellCommand';
        this.rejectButton.tooltip = 'Cancel the dangerous command';
        this.rejectButton.show();
    }
    
    handleApproval() {
        this.cleanup();
        this.resolvePromise?.(true);
    }
    
    handleRejection() {
        this.cleanup();
        this.resolvePromise?.(false);
    }
    
    private cleanup() {
        this.acceptButton?.dispose();
        this.rejectButton?.dispose();
        this.acceptButton = undefined;
        this.rejectButton = undefined;
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }
    }
}
```

---

## ⚡ EXECUTION TIMELINE

### **Week 1: Critical Safety (Phase 1)**
- **Day 1-2**: ⬜ Implement shell command approval system
- **Day 3**: ⬜ Add shell auto-approval toggle
- **Day 4-5**: ⬜ Create safety testing protocol and tests

### **Week 2: Menu System (Phase 2)**
- **Day 1-2**: ⬜ Design and implement main menu button
- **Day 3-4**: ⬜ Build popup menu system
- **Day 5**: ⬜ Integrate existing features into menu

### **Week 3: Polish & Testing (Phases 3-5)**
- **Day 1-2**: ⬜ Implement visual design system
- **Day 3**: ⬜ Enhance UX flows
- **Day 4-5**: ⬜ Comprehensive testing and bug fixes

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

- **Priority**: Safety fixes are non-negotiable and must be completed first
- **Testing**: All changes must be tested with safe commands only
- **Compatibility**: Maintain support for existing MCP tool consumers
- **Documentation**: Update all relevant docs and help text
- **Code Review**: All safety-related changes require thorough review

---

*This plan addresses the critical safety vulnerability while establishing a foundation for a professional, scalable UX system.*