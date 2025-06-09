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

**FINAL DESIGN DECISION**: Use tooltip-based menu with sticky behavior and clickable status spans.

#### Task 2.1: Tooltip Menu Implementation
**Final Design**: List-based tooltip menu with colored status spans
- ✅ Single status bar button with rich tooltip menu
- ✅ Sticky tooltip behavior using `workbench.action.showHover`
- ✅ Clickable colored spans for toggling states
  - ✅ Visual status indicators with background colors

**Implementation Details**:
    ```markdown
**VS Code MCP Server**

- $(server-process) MCP Server: [<span style="background-color: var(--vscode-statusBarItem-warningBackground)">**Running (Port: 3000)**</span>](command:vscode-mcp-server.toggleServer)
- $(pass-filled) Auto-Approve Diff: [<span style="background-color: var(--vscode-statusBarItem-errorBackground)">**OFF**</span>](command:vscode-mcp-server.toggleDiffAutoApproval)
- $(shield) Auto-Approve Shell: [<span style="background-color: var(--vscode-statusBarItem-errorBackground)">**OFF**</span>](command:vscode-mcp-server.toggleShellAutoApproval)

---

[$(info) Show Server Info](command:vscode-mcp-server.showServerInfo) | [$(gear) Extension Settings](command:workbench.action.openSettings?["vscode-mcp-server"])
```

  - **Status**: ⬜ Not Started

  #### Task 2.2: Tooltip Behavior Implementation
  - **Status**: ⬜ Not Started
- **Requirements**:
  - Automatic sticky tooltip on hover (using `workbench.action.showHover`)
  - No user-facing sticky toggle or information
  - Blue pixel border indicates sticky mode
  - ESC key dismisses tooltip
  
#### Task 2.3: Visual State Management
- **Status**: ⬜ Not Started
- **Color Scheme**:
  - Yellow/Warning background: Active/On states
  - Red/Error background: Inactive/Off states
- **Dynamic Updates**:
  - Server icon changes: `$(server-process)` when running, `$(server)` when inactive
  - Port number shown when server is running
  - Status text: "Running (Port: XXXX)" vs "Inactive", "ON" vs "OFF"

---

### **Phase 3: Visual Design System**

#### Task 3.1: Icon Standardization
```typescript
// Icon mapping
const ICONS = {
    server: {
        active: "$(server-process)",     // When server is running
        inactive: "$(server)"            // When server is stopped
    },
    approval: {
        diff: "$(pass-filled)",          // For diff auto-approval
        shell: "$(shield)"               // For shell auto-approval
    },
    actions: {
        info: "$(info)",                 // Server info
        settings: "$(gear)",             // Extension settings
        accept: "$(check)",              // Approval accept button
        reject: "$(x)"                   // Approval reject button
    }
    }
```
- **Status**: ⬜ Not Started

#### Task 3.2: Color Scheme
```typescript
// Simplified color scheme based on final design
const TOOLTIP_COLORS = {
    active: 'var(--vscode-statusBarItem-warningBackground)',    // Yellow - Active/On states
    inactive: 'var(--vscode-statusBarItem-errorBackground)',    // Red - Inactive/Off states
    }

    // Status bar button colors (for approval buttons)
    const BUTTON_COLORS = {
    accept: new vscode.ThemeColor('statusBarItem.warningBackground'),  // Yellow accept button
    reject: new vscode.ThemeColor('statusBarItem.errorBackground')     // Red reject button
}
```
- **Status**: ⬜ Not Started

#### Task 3.3: Tooltip Menu Implementation
```typescript
// Main status bar button with tooltip menu
interface TooltipMenuState {
    serverEnabled: boolean;
    serverPort: number;
    diffAutoApprovalEnabled: boolean;
    shellAutoApprovalEnabled: boolean;
    }

// Generate dynamic tooltip content
function generateTooltipMenu(state: TooltipMenuState): vscode.MarkdownString {
    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = true;
    tooltip.supportThemeIcons = true;
    
    // Build menu content with dynamic states
    let content = '**VS Code MCP Server**\n\n';
    
    // Server status line
    const serverIcon = state.serverEnabled ? '$(server-process)' : '$(server)';
    const serverStatus = state.serverEnabled ? 
        `Running (Port: ${state.serverPort})` : 'Inactive';
    const serverBg = state.serverEnabled ? 
        'var(--vscode-statusBarItem-warningBackground)' : 
        'var(--vscode-statusBarItem-errorBackground)';
    
    content += `- ${serverIcon} MCP Server: [<span style="background-color: ${serverBg}">**${serverStatus}**</span>](command:vscode-mcp-server.toggleServer)\n`;
    
    // Similar for other menu items...
    
    tooltip.value = content;
    return tooltip;
}
```
- **Status**: ⬜ Not Started

#### Task 3.4: Status Bar Button Appearance
```typescript
// Main menu button configuration
mainMenuButton = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100  // Priority
);

// Dynamic button text based on state
function updateMainMenuButton() {
    if (!mainMenuButton) return;
    
    // Show server status in button
    if (serverEnabled) {
        mainMenuButton.text = '$(server-process) MCP Server';
        mainMenuButton.backgroundColor = undefined;
    } else {
        mainMenuButton.text = '$(server) MCP Server';
        mainMenuButton.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
    
    // Add warning indicator if any auto-approval is enabled
    if (diffAutoApprovalEnabled || shellAutoApprovalEnabled) {
        mainMenuButton.text += ' $(warning)';
    }
    
    // Set tooltip with full menu
    mainMenuButton.tooltip = generateTooltipMenu(currentState);
    
    // Command to make tooltip sticky on click
    mainMenuButton.command = 'vscode-mcp-server.showStickyMenu';
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

   #### **Extension.ts Exports Required**
    ```typescript
    // For shell-tools.ts to import
    export function isShellAutoApprovalEnabled(): boolean
    export async function requestShellCommandApproval(command: string, warning: string): Promise<boolean>
    ```

   #### **Shell-tools.ts Integration**
    ```typescript
    import { isShellAutoApprovalEnabled, requestShellCommandApproval } from '../extension';

    // In execute_shell_command_code tool:
        if (safetyWarning) {
const diffAutoApprovalEnabled = isShellAutoApprovalEnabled();

if (!diffAutoApprovalEnabled) {
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

## 📄 KEY IMPLEMENTATION NOTES

### **Tooltip Menu Behavior**
1. **Sticky by Default**: When user hovers over the main menu button, automatically execute `workbench.action.showHover` to make tooltip sticky
2. **No User Choice**: Do not inform users about sticky behavior or provide toggle - it's automatic
3. **Visual Indicator**: Blue pixel border shows when tooltip is in sticky mode
4. **Dismissal**: Users can press ESC to close the tooltip

### **Color Logic**
- **Yellow Background** (`statusBarItem.warningBackground`): Used for all ACTIVE/ON states
  - Server running
  - Auto-approval enabled (both diff and shell)
- **Red Background** (`statusBarItem.errorBackground`): Used for all INACTIVE/OFF states
  - Server stopped
  - Auto-approval disabled

### **Clickable Status Spans**
- Each colored status span is wrapped in a command link
- Clicking the colored area toggles the respective feature
- Visual feedback through immediate color change

### **Status Bar Button States**
- **Normal**: Shows server icon and "MCP Server" text
- **Warning**: Adds `$(warning)` icon when any auto-approval is enabled
- **Background Color**: Yellow when server is stopped (to draw attention)

---

## 🐛 EXECUTION TIMELINE

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
