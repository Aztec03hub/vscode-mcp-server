import * as vscode from 'vscode';
import { MCPServer } from './server';
import { listWorkspaceFiles } from './tools/file-tools';
import { applyDiff } from './tools/edit-tools';
import { logger } from './utils/logger';

// Re-export for testing purposes
export { MCPServer };

let mcpServer: MCPServer | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let sharedTerminal: vscode.Terminal | undefined;
// Server state - disabled by default
let serverEnabled: boolean = false;
// Auto-approval mode for apply_diff
let autoApprovalEnabled: boolean = false;
let autoApprovalStatusBar: vscode.StatusBarItem | undefined;
// Shell auto-approval mode - DANGEROUS when enabled
let shellAutoApprovalEnabled: boolean = false;
let shellAutoApprovalStatusBar: vscode.StatusBarItem | undefined;
// Main menu button for consolidated UI
let mainMenuButton: vscode.StatusBarItem | undefined;
// Test tooltip buttons
let testButton1: vscode.StatusBarItem | undefined;
let testButton2: vscode.StatusBarItem | undefined;
let testButton3: vscode.StatusBarItem | undefined;
let testButton4: vscode.StatusBarItem | undefined;
let testButton5: vscode.StatusBarItem | undefined;
// Click-to-activate test buttons
let testButtonA: vscode.StatusBarItem | undefined;
let testButtonAActive: boolean = false;
let testButtonB: vscode.StatusBarItem | undefined;
let testButtonBActive: boolean = false;
let testButtonC: vscode.StatusBarItem | undefined;
let testButtonD1: vscode.StatusBarItem | undefined;
let testButtonD2: vscode.StatusBarItem | undefined;
let testButtonE: vscode.StatusBarItem | undefined;
let testButtonF: vscode.StatusBarItem | undefined;
// Fine-grained test buttons
let testButtonA1: vscode.StatusBarItem | undefined;
let testButtonA2: vscode.StatusBarItem | undefined;
let testButtonB1: vscode.StatusBarItem | undefined;
let testButtonB2: vscode.StatusBarItem | undefined;
let testButtonC1: vscode.StatusBarItem | undefined;
let testButtonC2: vscode.StatusBarItem | undefined;
// New E.x test buttons for tooltip persistence with hover provider focus
let testButtonE1: vscode.StatusBarItem | undefined;
let testButtonE2: vscode.StatusBarItem | undefined;
let testButtonE3: vscode.StatusBarItem | undefined;

// Terminal name constant
const TERMINAL_NAME = 'MCP Shell Commands';

/**
 * Manages temporary status bar buttons for shell command approval
 */
class ShellApprovalManager {
    private acceptButton?: vscode.StatusBarItem;
    private rejectButton?: vscode.StatusBarItem;
    private pendingCommand?: string;
    private resolvePromise?: (approved: boolean) => void;
    private timeoutId?: NodeJS.Timeout;

    /**
     * Shows approval buttons and waits for user response
     * @param command The command to be executed
     * @param warning The safety warning message
     * @returns Promise that resolves to true if approved, false if rejected
     */
    async showApprovalButtons(command: string, warning: string): Promise<boolean> {
        // Clean up any existing buttons first
        this.cleanup();
        
        // Store the command for reference
        this.pendingCommand = command;
        
        // Create the approval buttons
        this.createApprovalButtons();
        
        // Set 30-second timeout for auto-reject
        this.timeoutId = setTimeout(() => {
            logger.warn('[ShellApprovalManager] Approval timeout - auto-rejecting command');
            this.handleRejection();
        }, 30000);
        
        // Return a promise that resolves when user makes a choice
        return new Promise<boolean>((resolve) => {
            this.resolvePromise = resolve;
        });
    }
    
    private createApprovalButtons() {
        // Accept button 
        // VS Code limitation: Only 3 background colors available for status bar items:
        // - errorBackground (red)
        // - warningBackground (yellow/orange) 
        // - prominentBackground (blue)
        // Using warningBackground for Accept as prominentBackground may not be visible in all themes
        this.acceptButton = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 
            101  // High priority to appear on the right
        );
        this.acceptButton.text = '✅ Accept';
        this.acceptButton.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        this.acceptButton.command = 'vscode-mcp-server.approveShellCommand';
        this.acceptButton.tooltip = `Execute the dangerous command: ${this.pendingCommand}`;
        this.acceptButton.show();
        
        // Reject button (red background)
        this.rejectButton = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 
            102  // Highest priority to appear rightmost
        );
        this.rejectButton.text = '❌ Reject';
        this.rejectButton.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        this.rejectButton.command = 'vscode-mcp-server.rejectShellCommand';
        this.rejectButton.tooltip = 'Cancel the dangerous command';
        this.rejectButton.show();
        
        logger.info(`[ShellApprovalManager] Showing approval buttons for command: ${this.pendingCommand}`);
    }
    
    handleApproval() {
        logger.info(`[ShellApprovalManager] Command approved: ${this.pendingCommand}`);
        this.cleanup();
        this.resolvePromise?.(true);
    }
    
    handleRejection() {
        logger.info(`[ShellApprovalManager] Command rejected: ${this.pendingCommand}`);
        this.cleanup();
        this.resolvePromise?.(false);
    }
    
    private cleanup() {
        // Dispose buttons
        this.acceptButton?.dispose();
        this.rejectButton?.dispose();
        this.acceptButton = undefined;
        this.rejectButton = undefined;
        
        // Clear timeout
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }
        
        // Clear pending command
        this.pendingCommand = undefined;
    }
}

// Create singleton instance
let shellApprovalManager: ShellApprovalManager | undefined;

/**
 * Gets or creates the shared terminal for the extension
 * @param context The extension context
 * @returns The shared terminal instance
 */
export function getExtensionTerminal(context: vscode.ExtensionContext): vscode.Terminal {
    // Check if a terminal with our name already exists
    const existingTerminal = vscode.window.terminals.find(t => t.name === TERMINAL_NAME);
    
    if (existingTerminal && existingTerminal.exitStatus === undefined) {
        // Reuse the existing terminal if it's still open
        logger.info('[getExtensionTerminal] Reusing existing terminal for shell commands');
        return existingTerminal;
    }
    
    // Create a new terminal if it doesn't exist or if it has exited
    sharedTerminal = vscode.window.createTerminal(TERMINAL_NAME);
    logger.info('[getExtensionTerminal] Created new terminal for shell commands');
    context.subscriptions.push(sharedTerminal);

    return sharedTerminal;
}

// Function to update status bar
function updateStatusBar(port: number) {
    if (!statusBarItem) {
        return;
    }

    if (serverEnabled) {
        statusBarItem.text = `$(server) MCP Server: ${port}`;
        statusBarItem.tooltip = `MCP Server running at localhost:${port} (Click to toggle)`;
        statusBarItem.backgroundColor = undefined;
    } else {
        statusBarItem.text = `$(server) MCP Server: Off`;
        statusBarItem.tooltip = `MCP Server is disabled (Click to toggle)`;
        // Use a subtle color to indicate disabled state
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
}

// Function to update auto-approval status bar
function updateAutoApprovalStatusBar() {
    if (!autoApprovalStatusBar) {
        return;
    }

    if (autoApprovalEnabled) {
        autoApprovalStatusBar.text = '$(pass-filled) Auto-Approve: ON';
        autoApprovalStatusBar.tooltip = 'Apply Diff Auto-Approval is ENABLED - diffs will be applied automatically without preview (Click to disable)';
        autoApprovalStatusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
        autoApprovalStatusBar.text = '$(circle-outline) Auto-Approve: OFF';
        autoApprovalStatusBar.tooltip = 'Apply Diff Auto-Approval is DISABLED - diffs require manual approval (Click to enable)';
        autoApprovalStatusBar.backgroundColor = undefined;
    }
}

// Function to update main menu button
function updateMainMenuButton() {
    if (!mainMenuButton) {
        return;
    }
    
    // Show server status in the button
    if (serverEnabled) {
        mainMenuButton.text = '$(server-process) MCP Server';
        mainMenuButton.backgroundColor = undefined;
    } else {
        mainMenuButton.text = '$(server) MCP Server';
        mainMenuButton.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
    
    // Show warning if any auto-approval is enabled
    if (autoApprovalEnabled || shellAutoApprovalEnabled) {
        mainMenuButton.text += ' $(warning)';
    }
    
    // Update tooltip with current status
    const tooltipLines = ['VS Code MCP Server Menu (Click to open)'];
    tooltipLines.push(`Server: ${serverEnabled ? 'Running' : 'Stopped'}`);
    tooltipLines.push(`Auto-Approve Diff: ${autoApprovalEnabled ? 'ON' : 'OFF'}`);
    tooltipLines.push(`Auto-Approve Shell: ${shellAutoApprovalEnabled ? 'ON ⚠️' : 'OFF'}`);
    mainMenuButton.tooltip = tooltipLines.join('\n');
}

// Function to update shell auto-approval status bar
function updateShellAutoApprovalStatusBar() {
    if (!shellAutoApprovalStatusBar) {
        return;
    }

    if (shellAutoApprovalEnabled) {
        shellAutoApprovalStatusBar.text = '$(shield) Shell Auto-Approve: ON';
        shellAutoApprovalStatusBar.tooltip = '⚠️ DANGEROUS: Shell commands execute automatically without safety checks! (Click to disable)';
        shellAutoApprovalStatusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else {
        shellAutoApprovalStatusBar.text = '$(shield) Shell Auto-Approve: OFF';
        shellAutoApprovalStatusBar.tooltip = 'Shell command safety checks are ENABLED - destructive commands require approval (Click to enable auto-approval)';
        shellAutoApprovalStatusBar.backgroundColor = undefined;
    }
}

// Function to toggle auto-approval mode
async function toggleAutoApproval(context: vscode.ExtensionContext) {
    autoApprovalEnabled = !autoApprovalEnabled;
    
    // Save state
    await context.globalState.update('autoApprovalEnabled', autoApprovalEnabled);
    
    // Update status bar
    updateAutoApprovalStatusBar();
    updateMainMenuButton();
    
    // Show warning when enabling
    if (autoApprovalEnabled) {
        const result = await vscode.window.showWarningMessage(
            'Auto-Approval Mode ENABLED: All apply_diff operations will be automatically approved without preview. This can be dangerous! Use only for testing.',
            { modal: true },
            'Keep Enabled',
            'Disable'
        );
        
        if (result === 'Disable') {
            autoApprovalEnabled = false;
            await context.globalState.update('autoApprovalEnabled', false);
            updateAutoApprovalStatusBar();
        }
    } else {
        vscode.window.showInformationMessage('Auto-Approval Mode disabled. Apply_diff operations will require manual approval.');
    }
}

// Function to toggle shell auto-approval mode
async function toggleShellAutoApproval(context: vscode.ExtensionContext) {
    shellAutoApprovalEnabled = !shellAutoApprovalEnabled;
    
    // Save state
    await context.globalState.update('shellAutoApprovalEnabled', shellAutoApprovalEnabled);
    
    // Update status bar
    updateShellAutoApprovalStatusBar();
    updateMainMenuButton();
    
    // Show strong warning when enabling
    if (shellAutoApprovalEnabled) {
        const result = await vscode.window.showWarningMessage(
            '🚨 DANGER: Shell Auto-Approval Mode ENABLED!\n\n' +
            'Destructive shell commands (rm -rf, format, etc.) will execute automatically WITHOUT confirmation!\n\n' +
            'This mode bypasses ALL safety checks and can cause irreversible damage to your system.\n\n' +
            'Only enable this if you fully understand the risks.',
            { modal: true },
            'I Understand - Keep Enabled',
            'Disable (Recommended)'
        );
        
        if (result !== 'I Understand - Keep Enabled') {
            shellAutoApprovalEnabled = false;
            await context.globalState.update('shellAutoApprovalEnabled', false);
            updateShellAutoApprovalStatusBar();
            vscode.window.showInformationMessage('Shell Auto-Approval Mode disabled. Safety checks remain active.');
        } else {
            // Show additional confirmation in output
            logger.warn('⚠️ SHELL AUTO-APPROVAL ENABLED - Destructive commands will execute without confirmation!');
        }
    } else {
        vscode.window.showInformationMessage('Shell Auto-Approval Mode disabled. Destructive commands will require approval.');
    }
}

// Test mode flag - set by tests to enable auto-approval
let testModeEnabled = false;

// Export function to enable test mode (for tests only)
export function enableTestMode(): void {
    testModeEnabled = true;
}

// Export function for other modules to check auto-approval status
export function isAutoApprovalEnabled(): boolean {
    // Auto-approve in test mode to prevent dialog timeouts
    if (testModeEnabled) {
        return true;
    }
    // Also check environment variables as backup
    if (process.env.NODE_ENV === 'test' || process.env.VSCODE_TEST === '1') {
        return true;
    }
    return autoApprovalEnabled;
}

// Export function for shell tools to check shell auto-approval status
export function isShellAutoApprovalEnabled(): boolean {
    // NEVER auto-approve shell commands in test mode for safety
    // Shell commands can be destructive, so require explicit enabling
    return shellAutoApprovalEnabled;
}

/**
 * Shows the main menu using QuickPick styled to look like GitHub Copilot menu
 */
async function showMainMenu(context: vscode.ExtensionContext): Promise<void> {
    const config = vscode.workspace.getConfiguration('vscode-mcp-server');
    const port = config.get<number>('port') || 3000;
    
    // Create menu items with icons and descriptions
    const items: vscode.QuickPickItem[] = [
        {
            label: `$(server) MCP Server: ${serverEnabled ? `Port ${port}` : 'Off'}`,
            description: serverEnabled ? 'Click to disable' : 'Click to enable',
            detail: serverEnabled ? `Running at http://localhost:${port}/mcp` : 'Server is currently disabled'
        },
        {
            label: `$(pass-filled) Auto-Approve (Diff): ${autoApprovalEnabled ? 'ON' : 'OFF'}`,
            description: 'Toggle automatic approval for diff operations',
            detail: autoApprovalEnabled ? '⚠️ Diffs will apply automatically' : 'Diffs require manual approval'
        },
        {
            label: `$(shield) Auto-Approve (Shell): ${shellAutoApprovalEnabled ? 'ON' : 'OFF'}`,
            description: 'Toggle automatic approval for shell commands',
            detail: shellAutoApprovalEnabled ? '🚨 DANGEROUS: Destructive commands will execute!' : 'Destructive commands require approval'
        },
        {
            label: '$(info) Show Server Info',
            description: 'Display current server information',
            detail: 'Shows server URL and status'
        },
        {
            label: '$(gear) Extension Settings',
            description: 'Open VS Code settings for this extension',
            detail: 'Configure port and other options'
        }
    ];
    
    const quickPick = vscode.window.createQuickPick();
    quickPick.title = 'VS Code MCP Server';
    quickPick.placeholder = 'Select an option';
    quickPick.items = items;
    quickPick.matchOnDetail = true;
    quickPick.matchOnDescription = true;
    
    quickPick.onDidChangeSelection(async selection => {
        if (selection[0]) {
            const selected = selection[0].label;
            
            if (selected.includes('MCP Server:')) {
                await toggleServerState(context);
            } else if (selected.includes('Auto-Approve (Diff)')) {
                await toggleAutoApproval(context);
            } else if (selected.includes('Auto-Approve (Shell)')) {
                await toggleShellAutoApproval(context);
            } else if (selected.includes('Show Server Info')) {
                vscode.commands.executeCommand('vscode-mcp-server.showServerInfo');
            } else if (selected.includes('Extension Settings')) {
                vscode.commands.executeCommand('workbench.action.openSettings', 'vscode-mcp-server');
            }
            
            quickPick.hide();
        }
    });
    
    quickPick.onDidHide(() => quickPick.dispose());
    quickPick.show();
}

// Export function for shell tools to request command approval
export async function requestShellCommandApproval(command: string, warning: string): Promise<boolean> {
    if (!shellApprovalManager) {
        logger.error('[requestShellCommandApproval] ShellApprovalManager not initialized');
        return false;
    }
    
    // Show warning in output channel
    vscode.window.showWarningMessage(
        `⚠️ Dangerous command detected: ${command}`,
        'View Output'
    ).then(selection => {
        if (selection === 'View Output') {
            logger.showChannel();
        }
    });
    
    // Log the warning
    logger.warn(`[Shell Command Approval] ${warning}`);
    logger.warn(`[Shell Command Approval] Command: ${command}`);
    
    // Show approval buttons and wait for response
    return shellApprovalManager.showApprovalButtons(command, warning);
}

// Function to toggle server state
async function toggleServerState(context: vscode.ExtensionContext): Promise<void> {
    logger.info(`[toggleServerState] Starting toggle operation - changing from ${serverEnabled} to ${!serverEnabled}`);
    
    serverEnabled = !serverEnabled;
    
    // Store state for persistence
    context.globalState.update('mcpServerEnabled', serverEnabled);
    
    const config = vscode.workspace.getConfiguration('vscode-mcp-server');
    const port = config.get<number>('port') || 3000;
    
    // Update status bar immediately to provide feedback
    updateStatusBar(port);
    updateMainMenuButton();
    
    if (serverEnabled) {
        // Start the server if it was disabled
        if (!mcpServer) {
            logger.info(`[toggleServerState] Creating MCP server instance`);
            const terminal = getExtensionTerminal(context);
            mcpServer = new MCPServer(port, terminal);
            mcpServer.setFileListingCallback(async (path: string, recursive: boolean) => {
                try {
                    return await listWorkspaceFiles(path, recursive);
                } catch (error) {
                    logger.error(`[toggleServerState] Error listing files: ${error instanceof Error ? error.message : String(error)}`);
                    throw error;
                }
            });
            mcpServer.setupTools();
            
            logger.info(`[toggleServerState] Starting server at ${new Date().toISOString()}`);
            const startTime = Date.now();
            
            await mcpServer.start();
            
            const duration = Date.now() - startTime;
            logger.info(`[toggleServerState] Server started successfully at ${new Date().toISOString()} (took ${duration}ms)`);
            
            vscode.window.showInformationMessage(`MCP Server enabled and running at http://localhost:${port}/mcp`);
        }
    } else {
        // Stop the server if it was enabled
        if (mcpServer) {
            // Show progress indicator
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Stopping MCP Server',
                cancellable: false
            }, async (progress) => {
                logger.info(`[toggleServerState] Stopping server at ${new Date().toISOString()}`);
                progress.report({ message: 'Closing connections...' });
                
                const stopTime = Date.now();
                if (mcpServer) {
                    await mcpServer.stop();
                }
                
                const duration = Date.now() - stopTime;
                logger.info(`[toggleServerState] Server stopped successfully at ${new Date().toISOString()} (took ${duration}ms)`);
                
                mcpServer = undefined;
            });
            
            vscode.window.showInformationMessage('MCP Server has been disabled');
        }
    }
    
    logger.info(`[toggleServerState] Toggle operation completed`);
}

export async function activate(context: vscode.ExtensionContext) {
    logger.info('Activating vscode-mcp-server extension');
    logger.showChannel(); // Show the output channel for easy access to logs

    try {
        // Get configuration
        const config = vscode.workspace.getConfiguration('vscode-mcp-server');
        const defaultEnabled = config.get<boolean>('defaultEnabled') ?? false;
        const port = config.get<number>('port') || 3000;

        // Load saved state or use configured default
        serverEnabled = context.globalState.get('mcpServerEnabled', defaultEnabled);
        autoApprovalEnabled = context.globalState.get('autoApprovalEnabled', false);
        shellAutoApprovalEnabled = context.globalState.get('shellAutoApprovalEnabled', false);
        
        logger.info(`[activate] Using port ${port} from configuration`);
        logger.info(`[activate] Server enabled: ${serverEnabled}`);
        logger.info(`[activate] Auto-approval enabled: ${autoApprovalEnabled}`);
        logger.info(`[activate] Shell auto-approval enabled: ${shellAutoApprovalEnabled}`);
        
        // Initialize the shell approval manager
        shellApprovalManager = new ShellApprovalManager();

        // Create main menu button (replacing individual status bars)
        mainMenuButton = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        mainMenuButton.command = 'vscode-mcp-server.showMainMenu';
        mainMenuButton.text = '$(gear) MCP Server';
        mainMenuButton.tooltip = 'VS Code MCP Server Menu';
        mainMenuButton.show();
        updateMainMenuButton(); // Set initial state
        context.subscriptions.push(mainMenuButton);
        
        // Still create the individual status bars but don't show them
        // (They're used for state management and by other functions)
        statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            99
        );
        statusBarItem.command = 'vscode-mcp-server.toggleServer';
        // Don't show: statusBarItem.show();
        updateStatusBar(port);
        
        autoApprovalStatusBar = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            98
        );
        autoApprovalStatusBar.command = 'vscode-mcp-server.toggleAutoApproval';
        // Don't show: autoApprovalStatusBar.show();
        updateAutoApprovalStatusBar();
        context.subscriptions.push(autoApprovalStatusBar);
        
        shellAutoApprovalStatusBar = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            97
        );
        shellAutoApprovalStatusBar.command = 'vscode-mcp-server.toggleShellAutoApproval';
        // Don't show: shellAutoApprovalStatusBar.show();
        updateShellAutoApprovalStatusBar();
        context.subscriptions.push(shellAutoApprovalStatusBar);
        
        // Test 1: Markdown command links in tooltip
        testButton1 = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            50
        );
        testButton1.text = '1';
        const tooltip1 = new vscode.MarkdownString();
        tooltip1.isTrusted = true; // Enable command URIs
        tooltip1.supportThemeIcons = true; // Enable $(icon) syntax
        tooltip1.value = `**Test 1: Command Links**\n\n` +
            `[$(server) Toggle Server](command:vscode-mcp-server.toggleServer)\n\n` +
            `[$(pass-filled) Toggle Diff Auto-Approve](command:vscode-mcp-server.toggleAutoApproval)\n\n` +
            `[$(shield) Toggle Shell Auto-Approve](command:vscode-mcp-server.toggleShellAutoApproval)\n\n` +
            `---\n\n` +
            `[$(gear) Open Settings](command:workbench.action.openSettings?["vscode-mcp-server"])`;
        testButton1.tooltip = tooltip1;
        testButton1.show();
        context.subscriptions.push(testButton1);
        
        // Test 2: HTML in markdown (if supported)
        testButton2 = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            49
        );
        testButton2.text = '2';
        const tooltip2 = new vscode.MarkdownString();
        tooltip2.isTrusted = true;
        tooltip2.supportHtml = true; // Try to enable HTML
        tooltip2.value = `**Test 2: HTML Content**\n\n` +
            `<div style="padding: 5px; border: 1px solid #007ACC; border-radius: 4px;">\n` +
            `  <label><input type="checkbox" checked> Auto-Approve Enabled</label><br>\n` +
            `  <button onclick="vscode.commands.executeCommand('vscode-mcp-server.toggleServer')">Toggle Server</button>\n` +
            `</div>\n\n` +
            `<hr style="border-color: #007ACC;">\n\n` +
            `<progress value="70" max="100">70%</progress>`;
        testButton2.tooltip = tooltip2;
        testButton2.show();
        context.subscriptions.push(testButton2);
        
        // Test 3: Unicode box drawing and progress bars
        testButton3 = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            48
        );
        testButton3.text = '3';
        const tooltip3 = new vscode.MarkdownString();
        tooltip3.isTrusted = true;
        tooltip3.value = `**Test 3: Unicode & Progress**\n\n` +
            `╭─ VS Code MCP Server ─────────────╮\n` +
            `│ ● Server: Running          │\n` +
            `│ ⚠ Auto-Approve: Enabled    │\n` +
            `╰────────────────────────────╯\n\n` +
            `**Progress Bars:**\n\n` +
            `Code completions: ████████░░ 80%\n\n` +
            `Chat messages:    ██░░░░░░░░ 20%\n\n` +
            `**Checkboxes:**\n\n` +
            `☑ Code Completions (all files)\n\n` +
            `☐ Code Completions (TypeScript)\n\n` +
            `☑ Next Edit Suggestions`;
        testButton3.tooltip = tooltip3;
        testButton3.show();
        context.subscriptions.push(testButton3);
        
        // Test 4: Markdown table with links
        testButton4 = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            47
        );
        testButton4.text = '4';
        const tooltip4 = new vscode.MarkdownString();
        tooltip4.isTrusted = true;
        tooltip4.supportThemeIcons = true;
        tooltip4.value = `**Test 4: Table Layout**\n\n` +
            `| Feature | Status | Action |\n` +
            `|:--------|:------:|:-------|\n` +
            `| $(server) MCP Server | ✅ Running | [Toggle](command:vscode-mcp-server.toggleServer) |\n` +
            `| $(pass-filled) Diff Auto | ❌ OFF | [Enable](command:vscode-mcp-server.toggleAutoApproval) |\n` +
            `| $(shield) Shell Auto | ⚠️ ON | [Disable](command:vscode-mcp-server.toggleShellAutoApproval) |\n\n` +
            `---\n\n` +
            `| $(info) [Server Info](command:vscode-mcp-server.showServerInfo) | $(gear) [Settings](command:workbench.action.openSettings) |\n` +
            `|:--|:--|`;
        testButton4.tooltip = tooltip4;
        testButton4.show();
        context.subscriptions.push(testButton4);
        
        // Test 5: Mixed content with code blocks and formatting
        testButton5 = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            46
        );
        testButton5.text = '5';
        const tooltip5 = new vscode.MarkdownString();
        tooltip5.isTrusted = true;
        tooltip5.supportThemeIcons = true;
        tooltip5.value = `**Test 5: Mixed Content**\n\n` +
            `---\n\n` +
            `\`\`\`json\n` +
            `{\n` +
            `  "server": "running",\n` +
            `  "port": 3000,\n` +
            `  "autoApprove": true\n` +
            `}\n` +
            `\`\`\`\n\n` +
            `> **Note:** This is a blockquote with *italic* and **bold** text\n\n` +
            `1. First item with $(check) icon\n` +
            `2. Second item with $(warning) icon\n` +
            `3. Third item with $(error) icon\n\n` +
            `[Click here](command:vscode-mcp-server.showServerInfo) to show server info\n\n` +
            `---\n\n` +
            `_Hover behavior test: Does this update on hover?_`;
        testButton5.tooltip = tooltip5;
        testButton5.show();
        context.subscriptions.push(testButton5);
        
        // Test A: Toggle tooltip content on click
        testButtonA = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            45
        );
        testButtonA.text = 'A';
        testButtonA.command = 'vscode-mcp-server.toggleTestA';
        
        // Register the toggle command
        const toggleTestACommand = vscode.commands.registerCommand(
            'vscode-mcp-server.toggleTestA',
            () => {
                testButtonAActive = !testButtonAActive;
                updateTestButtonA();
            }
        );
        context.subscriptions.push(toggleTestACommand);
        
        function updateTestButtonA() {
            const tooltipA = new vscode.MarkdownString();
            tooltipA.isTrusted = true;
            tooltipA.supportThemeIcons = true;
            tooltipA.supportHtml = true;
            
            if (testButtonAActive) {
                tooltipA.value = `<div style="border: 2px solid #007ACC; padding: 8px; border-radius: 4px;">\n` +
                    `<strong>🔵 ACTIVE MODE</strong><br><br>\n` +
                    `The tooltip is now activated!<br>\n` +
                    `Click button again to deactivate.<br><br>\n` +
                    `<span style="color: #007ACC;">Border should be blue when active</span>\n` +
                    `</div>`;
                if (testButtonA) {
                    testButtonA.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
                }
            } else {
                tooltipA.value = `<div style="border: 1px solid #666; padding: 8px; border-radius: 4px;">\n` +
                    `<strong>⚪ HOVER MODE</strong><br><br>\n` +
                    `Click the button to activate!<br>\n` +
                    `Tooltip will change appearance.<br><br>\n` +
                    `<span style="color: #666;">Border is gray in hover mode</span>\n` +
                    `</div>`;
                if (testButtonA) {
                    testButtonA.backgroundColor = undefined;
                }
            }
            
            if (testButtonA) {
                testButtonA.tooltip = tooltipA;
            }
        }
        
        updateTestButtonA();
        testButtonA.show();
        context.subscriptions.push(testButtonA);
        
        // Test B: Status bar item state changes
        testButtonB = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            44
        );
        testButtonB.text = 'B';
        testButtonB.command = 'vscode-mcp-server.toggleTestB';
        
        const toggleTestBCommand = vscode.commands.registerCommand(
            'vscode-mcp-server.toggleTestB',
            () => {
                testButtonBActive = !testButtonBActive;
                updateTestButtonB();
            }
        );
        context.subscriptions.push(toggleTestBCommand);
        
        function updateTestButtonB() {
            const tooltipB = new vscode.MarkdownString();
            tooltipB.isTrusted = true;
            tooltipB.supportHtml = true;
            
            if (testButtonBActive) {
                if (testButtonB) {
                    testButtonB.text = 'B•'; // Add bullet to show active
                    testButtonB.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
                    testButtonB.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
                }
                
                tooltipB.value = `<div style="background-color: #007ACC22; padding: 10px;">\n` +
                    `<h3>Status: ACTIVE ✓</h3>\n` +
                    `Button appearance changed!<br>\n` +
                    `- Text: B•<br>\n` +
                    `- Background: Blue<br>\n` +
                    `- Foreground: Prominent<br>\n` +
                    `</div>`;
            } else {
                if (testButtonB) {
                    testButtonB.text = 'B';
                    testButtonB.color = undefined;
                    testButtonB.backgroundColor = undefined;
                }
                
                tooltipB.value = `<div style="background-color: #66666622; padding: 10px;">\n` +
                    `<h3>Status: INACTIVE</h3>\n` +
                    `Click to activate and change:<br>\n` +
                    `- Button appearance<br>\n` +
                    `- Tooltip style<br>\n` +
                    `- Background color<br>\n` +
                    `</div>`;
            }
            
            if (testButtonB) {
                testButtonB.tooltip = tooltipB;
            }
        }
        
        updateTestButtonB();
        testButtonB.show();
        context.subscriptions.push(testButtonB);
        
        // Test C: Dynamic tooltip with timestamp
        testButtonC = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            43
        );
        testButtonC.text = 'C';
        testButtonC.command = 'vscode-mcp-server.clickTestC';
        
        let lastClickTime: Date | null = null;
        
        const clickTestCCommand = vscode.commands.registerCommand(
            'vscode-mcp-server.clickTestC',
            () => {
                lastClickTime = new Date();
                updateTestButtonC();
                // Try to keep tooltip open by re-showing the button
                if (testButtonC) {
                    testButtonC.hide();
                    setTimeout(() => {
                        if (testButtonC) {
                            testButtonC.show();
                        }
                    }, 10);
                }
            }
        );
        context.subscriptions.push(clickTestCCommand);
        
        function updateTestButtonC() {
            const tooltipC = new vscode.MarkdownString();
            tooltipC.isTrusted = true;
            tooltipC.supportHtml = true;
            
            const now = new Date();
            const isRecent = lastClickTime && (now.getTime() - lastClickTime.getTime()) < 5000;
            
            tooltipC.value = `<div style="border: 2px solid ${isRecent ? '#00AA00' : '#999999'}; padding: 10px;">\n` +
                `<strong>Dynamic Update Test</strong><br><br>\n` +
                `Current time: ${now.toLocaleTimeString()}<br>\n` +
                `Last clicked: ${lastClickTime ? lastClickTime.toLocaleTimeString() : 'Never'}<br><br>\n` +
                `${isRecent ? '<span style="color: #00AA00;">✓ Recently clicked (green border)</span>' : '<span style="color: #999999;">Click to update timestamp</span>'}\n` +
                `</div>`;
            
            if (testButtonC) {
                testButtonC.tooltip = tooltipC;
            }
        }
        
        // Update every second to show dynamic behavior
        setInterval(() => updateTestButtonC(), 1000);
        
        updateTestButtonC();
        testButtonC.show();
        context.subscriptions.push(testButtonC);
        
        // Test A.1: CSS classes with codicon and theme classes
        testButtonA1 = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            42
        );
        testButtonA1.text = 'A.1';
        testButtonA1.command = 'vscode-mcp-server.clickTestA1';
        
        let a1Active = false;
        const clickTestA1Command = vscode.commands.registerCommand(
            'vscode-mcp-server.clickTestA1',
            () => {
                a1Active = !a1Active;
                updateTestButtonA1();
            }
        );
        context.subscriptions.push(clickTestA1Command);
        
        function updateTestButtonA1() {
            const tooltipA1 = new vscode.MarkdownString();
            tooltipA1.isTrusted = true;
            tooltipA1.supportThemeIcons = true;
            tooltipA1.supportHtml = true;
            
            if (a1Active) {
                tooltipA1.value = `<div class="codicon codicon-check">\n` +
                    `<span class="codicon codicon-circle-filled"> ACTIVE</span>\n` +
                    `</div>\n\n` +
                    `<div class="monaco-editor">\n` +
                    `<span class="mtk1">Using VS Code internal classes:</span><br>\n` +
                    `<span class="mtk12">• codicon classes</span><br>\n` +
                    `<span class="mtk14">• monaco-editor classes</span><br>\n` +
                    `<span class="mtk16">• theme color classes</span>\n` +
                    `</div>`;
                if (testButtonA1) {
                    testButtonA1.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
                }
            } else {
                tooltipA1.value = `<div class="codicon codicon-circle-outline">\n` +
                    `<span class="codicon codicon-debug-pause"> INACTIVE</span>\n` +
                    `</div>\n\n` +
                    `<div class="markdown-body">\n` +
                    `Click to test CSS classes<br>\n` +
                    `Looking for blue borders\n` +
                    `</div>`;
                if (testButtonA1) {
                    testButtonA1.backgroundColor = undefined;
                }
            }
            
            if (testButtonA1) {
                testButtonA1.tooltip = tooltipA1;
            }
        }
        
        updateTestButtonA1();
        testButtonA1.show();
        context.subscriptions.push(testButtonA1);
        
        // Test A.2: Theme-aware CSS variables
        testButtonA2 = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            41
        );
        testButtonA2.text = 'A.2';
        testButtonA2.command = 'vscode-mcp-server.clickTestA2';
        
        let a2Active = false;
        const clickTestA2Command = vscode.commands.registerCommand(
            'vscode-mcp-server.clickTestA2',
            () => {
                a2Active = !a2Active;
                updateTestButtonA2();
            }
        );
        context.subscriptions.push(clickTestA2Command);
        
        function updateTestButtonA2() {
            const tooltipA2 = new vscode.MarkdownString();
            tooltipA2.isTrusted = true;
            tooltipA2.supportThemeIcons = true;
            tooltipA2.supportHtml = true;
            
            if (a2Active) {
                tooltipA2.value = `<div style="border: 2px solid var(--vscode-focusBorder); padding: 8px; background: var(--vscode-editor-background);">\n` +
                    `<strong style="color: var(--vscode-terminal-ansiBlue);">🔵 ACTIVE</strong><br><br>\n` +
                    `Testing CSS variables:<br>\n` +
                    `<span style="color: var(--vscode-terminal-ansiGreen);">✓ --vscode-focusBorder</span><br>\n` +
                    `<span style="color: var(--vscode-terminal-ansiYellow);">✓ --vscode-editor-background</span><br>\n` +
                    `<span style="color: var(--vscode-terminal-ansiCyan);">✓ --vscode-terminal colors</span>\n` +
                    `</div>`;
            } else {
                tooltipA2.value = `<div style="border: 1px solid var(--vscode-input-border); padding: 8px;">\n` +
                    `<strong>⚪ INACTIVE</strong><br><br>\n` +
                    `Click to test CSS variables<br>\n` +
                    `Should use theme colors\n` +
                    `</div>`;
            }
            
            if (testButtonA2) {
                testButtonA2.tooltip = tooltipA2;
                testButtonA2.backgroundColor = a2Active ? 
                    new vscode.ThemeColor('statusBarItem.prominentBackground') : 
                    undefined;
            }
        }
        
        updateTestButtonA2();
        testButtonA2.show();
        context.subscriptions.push(testButtonA2);
        
        // Test B.1: Webview panel approach
        testButtonB1 = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            40
        );
        testButtonB1.text = 'B.1';
        testButtonB1.command = 'vscode-mcp-server.openWebviewB1';
        
        let webviewPanelB1: vscode.WebviewPanel | undefined;
        
        const openWebviewB1Command = vscode.commands.registerCommand(
            'vscode-mcp-server.openWebviewB1',
            () => {
                if (webviewPanelB1) {
                    webviewPanelB1.reveal();
                    return;
                }
                
                // Create webview panel
                webviewPanelB1 = vscode.window.createWebviewPanel(
                    'mcpMenuB1',
                    'MCP Menu (B.1)',
                    vscode.ViewColumn.Beside,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true
                    }
                );
                
                webviewPanelB1.webview.html = getWebviewContentB1();
                
                // Handle disposal
                webviewPanelB1.onDidDispose(() => {
                    webviewPanelB1 = undefined;
                });
                
                // Handle messages from webview
                webviewPanelB1.webview.onDidReceiveMessage(
                    message => {
                        switch (message.command) {
                            case 'toggleServer':
                                vscode.commands.executeCommand('vscode-mcp-server.toggleServer');
                                break;
                            case 'close':
                                webviewPanelB1?.dispose();
                                break;
                        }
                    }
                );
            }
        );
        context.subscriptions.push(openWebviewB1Command);
        
        function getWebviewContentB1(): string {
            return `<!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        padding: 0;
                        margin: 0;
                        background: var(--vscode-dropdown-background);
                        color: var(--vscode-dropdown-foreground);
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                    }
                    .menu {
                        border: 1px solid var(--vscode-focusBorder);
                        border-radius: 4px;
                        padding: 4px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.16);
                    }
                    .menu-item {
                        padding: 4px 8px;
                        cursor: pointer;
                        border-radius: 2px;
                    }
                    .menu-item:hover {
                        background: var(--vscode-list-hoverBackground);
                    }
                    .close-btn {
                        float: right;
                        cursor: pointer;
                        opacity: 0.6;
                    }
                    .close-btn:hover {
                        opacity: 1;
                    }
                </style>
            </head>
            <body>
                <div class="menu">
                    <span class="close-btn" onclick="closeMenu()">×</span>
                    <div class="menu-item" onclick="toggleServer()">
                        🔄 Toggle Server
                    </div>
                    <div class="menu-item">
                        ✅ Auto-Approve: ON
                    </div>
                    <div class="menu-item">
                        🛡️ Shell Auto: OFF
                    </div>
                    <hr>
                    <div class="menu-item">
                        ℹ️ Server Info
                    </div>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    function toggleServer() {
                        vscode.postMessage({ command: 'toggleServer' });
                    }
                    function closeMenu() {
                        vscode.postMessage({ command: 'close' });
                    }
                </script>
            </body>
            </html>`;
        }
        
        testButtonB1.tooltip = 'Click to open webview menu panel';
        testButtonB1.show();
        context.subscriptions.push(testButtonB1);
        
        // Test C.1: Hover provider attempt
        testButtonC1 = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            39
        );
        if (testButtonC1) {
            testButtonC1.text = 'C.1​'; // Zero-width space for hover target
            testButtonC1.command = 'vscode-mcp-server.toggleTestC1';
        }
        
        let c1Active = false;
        const toggleTestC1Command = vscode.commands.registerCommand(
            'vscode-mcp-server.toggleTestC1',
            () => {
                c1Active = !c1Active;
                updateTestButtonC1();
            }
        );
        context.subscriptions.push(toggleTestC1Command);
        
        function updateTestButtonC1() {
            const tooltipC1 = new vscode.MarkdownString();
            tooltipC1.isTrusted = true;
            tooltipC1.supportThemeIcons = true;
            tooltipC1.supportHtml = true;
            
            // Try to make tooltip "sticky" with interactive content
            tooltipC1.value = `<div onmouseover="this.style.border='2px solid blue'" onmouseout="this.style.border='1px solid gray'" style="border: 1px solid gray; padding: 10px;">\n` +
                `<strong>${c1Active ? '🔵 ACTIVE' : '⚪ INACTIVE'}</strong><br><br>\n` +
                `Testing hover persistence:<br>\n` +
                `<a href="command:vscode-mcp-server.toggleServer">Toggle Server</a><br>\n` +
                `<a href="command:vscode-mcp-server.toggleAutoApproval">Toggle Auto-Approve</a><br>\n` +
                `<br>\n` +
                `<details>\n` +
                `<summary>More Options...</summary>\n` +
                `<a href="command:vscode-mcp-server.showServerInfo">Server Info</a><br>\n` +
                `<a href="command:workbench.action.openSettings">Settings</a>\n` +
                `</details>\n` +
                `</div>\n\n` +
                `<script>console.log('Script test');</script>`; // Test if scripts work
            
            if (testButtonC1) {
                testButtonC1.tooltip = tooltipC1;
                testButtonC1.backgroundColor = c1Active ? 
                    new vscode.ThemeColor('statusBarItem.prominentBackground') : 
                    undefined;
            }
        }
        
        updateTestButtonC1();
        if (testButtonC1) {
            testButtonC1.show();
            context.subscriptions.push(testButtonC1);
        }
        
        // Test C.2: Try to trigger hover state programmatically
        testButtonC2 = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            38
        );
        testButtonC2.text = 'C.2';
        testButtonC2.command = 'vscode-mcp-server.activateHoverC2';
        
        let c2HoverActive = false;
        const activateHoverC2Command = vscode.commands.registerCommand(
            'vscode-mcp-server.activateHoverC2',
            async () => {
                c2HoverActive = !c2HoverActive;
                
                // Try various methods to keep tooltip active
                if (c2HoverActive) {
                    // Method 1: Rapid show/hide to trigger hover
                    testButtonC2?.hide();
                    await new Promise(resolve => setTimeout(resolve, 1));
                    testButtonC2?.show();
                    
                    // Method 2: Focus the status bar area
                    await vscode.commands.executeCommand('workbench.action.focusStatusBar');
                    
                    // Method 3: Update tooltip continuously
                    const interval = setInterval(() => {
                        if (!c2HoverActive || !testButtonC2) {
                            clearInterval(interval);
                            return;
                        }
                        updateTestButtonC2WithTimestamp();
                    }, 100);
                }
                
                updateTestButtonC2WithTimestamp();
            }
        );
        context.subscriptions.push(activateHoverC2Command);
        
        function updateTestButtonC2WithTimestamp() {
            const tooltipC2 = new vscode.MarkdownString();
            tooltipC2.isTrusted = true;
            tooltipC2.supportThemeIcons = true;
            tooltipC2.supportHtml = true;
            
            const timestamp = new Date().toLocaleTimeString();
            
            tooltipC2.value = `<div style="padding: 10px; border: 2px solid ${c2HoverActive ? '#007ACC' : '#666666'};">\n` +
                `<h3>${c2HoverActive ? '🔵 HOVER ACTIVE' : '⚪ HOVER INACTIVE'}</h3>\n` +
                `<p>Timestamp: ${timestamp}</p>\n` +
                `<p>Trying to keep hover active via:</p>\n` +
                `<ul>\n` +
                `<li>Rapid show/hide</li>\n` +
                `<li>Focus status bar</li>\n` +
                `<li>Continuous updates</li>\n` +
                `</ul>\n` +
                `<p><a href="command:vscode-mcp-server.toggleServer">Test command link</a></p>\n` +
                `</div>`;
            
            if (testButtonC2) {
                testButtonC2.tooltip = tooltipC2;
                testButtonC2.backgroundColor = c2HoverActive ? 
                    new vscode.ThemeColor('statusBarItem.prominentBackground') : 
                    undefined;
            }
        }
        
        updateTestButtonC2WithTimestamp();
        testButtonC2.show();
        context.subscriptions.push(testButtonC2);
        
        // Test D.1: Multiple clickable areas to maintain focus
        testButtonD1 = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            37
        );
        testButtonD1.text = 'D.1';
        testButtonD1.command = 'vscode-mcp-server.clickTestD1';
        
        let d1ClickCount = 0;
        const clickTestD1Command = vscode.commands.registerCommand(
            'vscode-mcp-server.clickTestD1',
            () => {
                d1ClickCount++;
                updateTestButtonD1();
            }
        );
        context.subscriptions.push(clickTestD1Command);
        
        function updateTestButtonD1() {
            const tooltipD1 = new vscode.MarkdownString();
            tooltipD1.isTrusted = true;
            tooltipD1.supportThemeIcons = true;
            tooltipD1.supportHtml = true;
            
            // Create multiple nested clickable areas
            tooltipD1.value = `<div style="border: 2px solid #007ACC; padding: 4px;">\n` +
                `<div style="background: #007ACC22; padding: 8px; margin: 2px;">\n` +
                `<strong>Click Count: ${d1ClickCount}</strong>\n` +
                `</div>\n` +
                `<div style="padding: 4px;">\n` +
                `<table style="width: 100%;">\n` +
                `<tr>\n` +
                `<td style="padding: 4px; background: #00AA0022;">\n` +
                `<a href="command:vscode-mcp-server.toggleServer">$(server) Server</a>\n` +
                `</td>\n` +
                `<td style="padding: 4px; background: #AA000022;">\n` +
                `<a href="command:vscode-mcp-server.toggleAutoApproval">$(pass-filled) Auto</a>\n` +
                `</td>\n` +
                `</tr>\n` +
                `<tr>\n` +
                `<td style="padding: 4px; background: #AAAA0022;">\n` +
                `<a href="command:vscode-mcp-server.toggleShellAutoApproval">$(shield) Shell</a>\n` +
                `</td>\n` +
                `<td style="padding: 4px; background: #AA00AA22;">\n` +
                `<a href="command:vscode-mcp-server.showServerInfo">$(info) Info</a>\n` +
                `</td>\n` +
                `</tr>\n` +
                `</table>\n` +
                `</div>\n` +
                `<div style="text-align: center; padding: 4px; background: #66666622;">\n` +
                `<span style="font-size: 10px;">Multiple clickable areas for focus retention</span>\n` +
                `</div>\n` +
                `</div>`;
            
            if (testButtonD1) {
                testButtonD1.tooltip = tooltipD1;
            }
        }
        
        updateTestButtonD1();
        testButtonD1.show();
        context.subscriptions.push(testButtonD1);
        
        // Test D.2: Data attributes and tabindex
        testButtonD2 = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            36
        );
        testButtonD2.text = 'D.2';
        testButtonD2.command = 'vscode-mcp-server.clickTestD2';
        
        let d2Active = false;
        const clickTestD2Command = vscode.commands.registerCommand(
            'vscode-mcp-server.clickTestD2',
            () => {
                d2Active = !d2Active;
                updateTestButtonD2();
            }
        );
        context.subscriptions.push(clickTestD2Command);
        
        function updateTestButtonD2() {
            const tooltipD2 = new vscode.MarkdownString();
            tooltipD2.isTrusted = true;
            tooltipD2.supportThemeIcons = true;
            tooltipD2.supportHtml = true;
            
            // Try data attributes and focus-related attributes
            tooltipD2.value = `<div data-code="active" class="${d2Active ? 'active-tooltip' : 'inactive-tooltip'}" style="border: 2px solid ${d2Active ? '#007ACC' : '#666'}; padding: 10px;">\n` +
                `<h3>${d2Active ? 'ACTIVE STATE' : 'INACTIVE STATE'}</h3>\n` +
                `<div class="codicon codicon-server" data-href="command:vscode-mcp-server.toggleServer">\n` +
                `<a href="command:vscode-mcp-server.toggleServer">Toggle Server</a>\n` +
                `</div>\n` +
                `<br>\n` +
                `<div style="background: #007ACC22; padding: 8px;">\n` +
                `<p>Testing data attributes:</p>\n` +
                `<ul>\n` +
                `<li>data-code="active"</li>\n` +
                `<li>class with state</li>\n` +
                `<li>nested command links</li>\n` +
                `</ul>\n` +
                `</div>\n` +
                `<br>\n` +
                `<div style="display: flex; gap: 4px;">\n` +
                `<span style="flex: 1; background: #00AA0044; padding: 4px; text-align: center;">\n` +
                `<a href="command:vscode-mcp-server.toggleAutoApproval">Auto</a>\n` +
                `</span>\n` +
                `<span style="flex: 1; background: #AA000044; padding: 4px; text-align: center;">\n` +
                `<a href="command:vscode-mcp-server.toggleShellAutoApproval">Shell</a>\n` +
                `</span>\n` +
                `</div>\n` +
                `</div>`;
            
            if (testButtonD2) {
                testButtonD2.tooltip = tooltipD2;
                testButtonD2.backgroundColor = d2Active ? 
                    new vscode.ThemeColor('statusBarItem.prominentBackground') : 
                    undefined;
            }
        }
        
        updateTestButtonD2();
        testButtonD2.show();
        context.subscriptions.push(testButtonD2);
        
        // Test E.1: Hover Provider with Command-based Sticky Mode
        testButtonE1 = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            35
        );
        testButtonE1.text = 'E.1';
        testButtonE1.command = 'vscode-mcp-server.clickTestE1';
        
        // State management for sticky mode
        let e1StickyEnabled = false;
        let e1Active = false;
        
        // Register command to enable sticky mode
        const enableStickyModeCommand = vscode.commands.registerCommand(
            'vscode-mcp-server.enableStickyMode',
            () => {
                e1StickyEnabled = !e1StickyEnabled;
                updateTestButtonE1();
                vscode.window.showInformationMessage(
                    `Sticky mode ${e1StickyEnabled ? 'ENABLED' : 'DISABLED'} for E.1 tooltip`
                );
            }
        );
        context.subscriptions.push(enableStickyModeCommand);
        
        const clickTestE1Command = vscode.commands.registerCommand(
            'vscode-mcp-server.clickTestE1',
            () => {
                e1Active = !e1Active;
                updateTestButtonE1();
            }
        );
        context.subscriptions.push(clickTestE1Command);
        
        function updateTestButtonE1() {
            const tooltipE1 = new vscode.MarkdownString();
            tooltipE1.isTrusted = true;
            tooltipE1.supportThemeIcons = true;
            tooltipE1.supportHtml = true;
            
            // Create a tooltip that leverages command links to stay interactive
            tooltipE1.value = `<div style="border: 2px solid ${e1Active ? '#00FF00' : '#666666'}; padding: 10px;">\n` +
                `<h3>${e1Active ? '🟢 E.1 ACTIVE' : '⚪ E.1 INACTIVE'}</h3>\n` +
                `<p><strong>Hover Provider & Command-Based Sticky Test</strong></p>\n` +
                `\n` +
                `<div style="background: ${e1StickyEnabled ? '#00AA0022' : '#AA000022'}; padding: 8px; margin: 8px 0; border-radius: 4px;">\n` +
                `<p><strong>Sticky Mode: ${e1StickyEnabled ? 'ENABLED ✅' : 'DISABLED ❌'}</strong></p>\n` +
                `<a href="command:vscode-mcp-server.enableStickyMode" style="font-weight: bold;">\n` +
                `${e1StickyEnabled ? '🔄 Disable Sticky Mode' : '🔄 Enable Sticky Mode'}\n` +
                `</a>\n` +
                `</div>\n` +
                `\n` +
                `<p>Interactive Command Links (keeps tooltip open):</p>\n` +
                `<div style="background: #007ACC22; padding: 8px; margin: 8px 0;">\n` +
                `<a href="command:vscode-mcp-server.toggleServer">$(server) Toggle Server</a><br>\n` +
                `<a href="command:vscode-mcp-server.toggleAutoApproval">$(pass-filled) Toggle Auto-Approve</a><br>\n` +
                `<a href="command:vscode-mcp-server.showServerInfo">$(info) Show Server Info</a><br>\n` +
                `<a href="command:workbench.action.openSettings">$(gear) Open Settings</a>\n` +
                `</div>\n` +
                `\n` +
                `<details>\n` +
                `<summary style="cursor: pointer;">Advanced Options...</summary>\n` +
                `<div style="padding: 8px; margin-top: 4px;">\n` +
                `<a href="command:editor.action.showHover">Show Hover</a><br>\n` +
                `<a href="command:workbench.action.focusStatusBar">Focus Status Bar</a><br>\n` +
                `<a href="command:workbench.action.showCommands">Command Palette</a>\n` +
                `</div>\n` +
                `</details>\n` +
                `\n` +
                `<p style="font-size: 11px; margin-top: 8px;">\n` +
                `💡 Tip: Command links keep the tooltip interactive!\n` +
                `</p>\n` +
                `</div>`;
            
            if (testButtonE1) {
                testButtonE1.tooltip = tooltipE1;
                testButtonE1.backgroundColor = e1Active ? 
                    new vscode.ThemeColor('statusBarItem.prominentBackground') : 
                    undefined;
            }
        }
        
        updateTestButtonE1();
        testButtonE1.show();
        context.subscriptions.push(testButtonE1);
        
        // E.2: WebView Hover Experiment
        // Create a webview-based hover that can be more persistent
        let e2WebviewPanel: vscode.WebviewPanel | undefined;
        
        const testButtonE2 = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            34
        );
        testButtonE2.text = 'E.2';
        testButtonE2.command = 'vscode-mcp-server.openE2Webview';
        testButtonE2.tooltip = 'Click to open persistent webview hover';
        
        const openE2WebviewCommand = vscode.commands.registerCommand(
            'vscode-mcp-server.openE2Webview',
            () => {
                if (e2WebviewPanel) {
                    e2WebviewPanel.reveal();
                    return;
                }
                
                // Create a small webview panel that acts like a hover
                e2WebviewPanel = vscode.window.createWebviewPanel(
                    'e2HoverWebview',
                    'E.2 Persistent Hover',
                    {
                        viewColumn: vscode.ViewColumn.Beside,
                        preserveFocus: true
                    },
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true
                    }
                );
                
                e2WebviewPanel.webview.html = getE2WebviewContent();
                
                e2WebviewPanel.onDidDispose(() => {
                    e2WebviewPanel = undefined;
                });
                
                // Handle messages from webview
                e2WebviewPanel.webview.onDidReceiveMessage(
                    message => {
                        switch (message.command) {
                            case 'executeCommand':
                                vscode.commands.executeCommand(message.commandId);
                                break;
                            case 'close':
                                e2WebviewPanel?.dispose();
                                break;
                        }
                    }
                );
            }
        );
        context.subscriptions.push(openE2WebviewCommand);
        
        function getE2WebviewContent(): string {
            return `<!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        padding: 10px;
                        margin: 0;
                        background: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                    }
                    .hover-box {
                        border: 2px solid var(--vscode-focusBorder);
                        border-radius: 4px;
                        padding: 12px;
                        background: var(--vscode-editorHoverWidget-background);
                        box-shadow: 0 2px 8px rgba(0,0,0,0.16);
                    }
                    .command-link {
                        color: var(--vscode-textLink-foreground);
                        cursor: pointer;
                        text-decoration: none;
                        padding: 4px 0;
                        display: block;
                    }
                    .command-link:hover {
                        text-decoration: underline;
                    }
                    .section {
                        margin: 8px 0;
                        padding: 8px;
                        background: var(--vscode-editorWidget-background);
                        border-radius: 2px;
                    }
                    h3 {
                        margin-top: 0;
                    }
                    .close-btn {
                        float: right;
                        cursor: pointer;
                        opacity: 0.6;
                        font-size: 20px;
                        line-height: 20px;
                    }
                    .close-btn:hover {
                        opacity: 1;
                    }
                </style>
            </head>
            <body>
                <div class="hover-box">
                    <span class="close-btn" onclick="closeWebview()">&times;</span>
                    <h3>🟢 E.2: Persistent Webview Hover</h3>
                    <p>This webview acts as a persistent hover tooltip!</p>
                    
                    <div class="section">
                        <strong>Interactive Commands:</strong><br>
                        <a class="command-link" onclick="executeCommand('vscode-mcp-server.toggleServer')">🔄 Toggle Server</a>
                        <a class="command-link" onclick="executeCommand('vscode-mcp-server.toggleAutoApproval')">✅ Toggle Auto-Approve</a>
                        <a class="command-link" onclick="executeCommand('vscode-mcp-server.showServerInfo')">ℹ️ Show Server Info</a>
                    </div>
                    
                    <div class="section">
                        <strong>Features:</strong>
                        <ul>
                            <li>Stays open indefinitely</li>
                            <li>Fully interactive</li>
                            <li>Can execute VS Code commands</li>
                            <li>Styled like VS Code hovers</li>
                        </ul>
                    </div>
                    
                    <p style="font-size: 11px; opacity: 0.8; margin-top: 12px;">
                        💡 This demonstrates true persistence using webviews
                    </p>
                </div>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    function executeCommand(commandId) {
                        vscode.postMessage({
                            command: 'executeCommand',
                            commandId: commandId
                        });
                    }
                    
                    function closeWebview() {
                        vscode.postMessage({ command: 'close' });
                    }
                </script>
            </body>
            </html>`;
        }
        
        testButtonE2.show();
        context.subscriptions.push(testButtonE2);
        
        // E.3: Enhanced Tooltip with Multiple Command Sections
        // Test if having many command links creates a more "sticky" experience
        const testButtonE3 = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            33
        );
        testButtonE3.text = 'E.3';
        testButtonE3.command = 'vscode-mcp-server.clickTestE3';
        
        let e3MenuState = 'main'; // main, server, settings, advanced
        
        const clickTestE3Command = vscode.commands.registerCommand(
            'vscode-mcp-server.clickTestE3',
            () => {
                // Reset to main menu
                e3MenuState = 'main';
                updateTestButtonE3();
            }
        );
        context.subscriptions.push(clickTestE3Command);
        
        // Commands to navigate between menu states
        const e3NavigateCommands = [
            { id: 'vscode-mcp-server.e3GoToServer', state: 'server' },
            { id: 'vscode-mcp-server.e3GoToSettings', state: 'settings' },
            { id: 'vscode-mcp-server.e3GoToAdvanced', state: 'advanced' },
            { id: 'vscode-mcp-server.e3GoToMain', state: 'main' }
        ];
        
        e3NavigateCommands.forEach(({ id, state }) => {
            const cmd = vscode.commands.registerCommand(id, () => {
                e3MenuState = state;
                updateTestButtonE3();
            });
            context.subscriptions.push(cmd);
        });
        
        function updateTestButtonE3() {
            const tooltipE3 = new vscode.MarkdownString();
            tooltipE3.isTrusted = true;
            tooltipE3.supportThemeIcons = true;
            tooltipE3.supportHtml = true;
            
            let content = '';
            
            switch (e3MenuState) {
                case 'main':
                    content = `<div style="border: 2px solid #007ACC; padding: 10px;">\n` +
                        `<h3>🟢 E.3: Multi-Level Command Menu</h3>\n` +
                        `<p>Navigate through different sections using commands:</p>\n` +
                        `<div style="background: #007ACC22; padding: 8px; margin: 8px 0;">\n` +
                        `<a href="command:vscode-mcp-server.e3GoToServer">$(server) Server Options ➡️</a><br>\n` +
                        `<a href="command:vscode-mcp-server.e3GoToSettings">$(gear) Settings Menu ➡️</a><br>\n` +
                        `<a href="command:vscode-mcp-server.e3GoToAdvanced">$(beaker) Advanced Options ➡️</a>\n` +
                        `</div>\n` +
                        `<p style="font-size: 11px;">💡 Click any option to navigate</p>\n` +
                        `</div>`;
                    break;
                    
                case 'server':
                    content = `<div style="border: 2px solid #00AA00; padding: 10px;">\n` +
                        `<h3>$(server) Server Options</h3>\n` +
                        `<a href="command:vscode-mcp-server.e3GoToMain">← Back to Main</a><br><br>\n` +
                        `<div style="background: #00AA0022; padding: 8px;">\n` +
                        `<a href="command:vscode-mcp-server.toggleServer">$(server-process) Toggle Server</a><br>\n` +
                        `<a href="command:vscode-mcp-server.showServerInfo">$(info) Server Info</a><br>\n` +
                        `<a href="command:vscode-mcp-server.toggleAutoApproval">$(pass-filled) Toggle Auto-Approve</a>\n` +
                        `</div>\n` +
                        `</div>`;
                    break;
                    
                case 'settings':
                    content = `<div style="border: 2px solid #AA00AA; padding: 10px;">\n` +
                        `<h3>$(gear) Settings Menu</h3>\n` +
                        `<a href="command:vscode-mcp-server.e3GoToMain">← Back to Main</a><br><br>\n` +
                        `<div style="background: #AA00AA22; padding: 8px;">\n` +
                        `<a href="command:workbench.action.openSettings">$(settings-gear) Open Settings</a><br>\n` +
                        `<a href="command:workbench.action.openGlobalKeybindings">$(keyboard) Keyboard Shortcuts</a><br>\n` +
                        `<a href="command:workbench.action.selectTheme">$(color-mode) Color Theme</a>\n` +
                        `</div>\n` +
                        `</div>`;
                    break;
                    
                case 'advanced':
                    content = `<div style="border: 2px solid #AAAA00; padding: 10px;">\n` +
                        `<h3>$(beaker) Advanced Options</h3>\n` +
                        `<a href="command:vscode-mcp-server.e3GoToMain">← Back to Main</a><br><br>\n` +
                        `<div style="background: #AAAA0022; padding: 8px;">\n` +
                        `<a href="command:workbench.action.reloadWindow">$(refresh) Reload Window</a><br>\n` +
                        `<a href="command:workbench.action.showCommands">$(terminal) Command Palette</a><br>\n` +
                        `<a href="command:workbench.action.toggleDevTools">$(tools) Toggle DevTools</a>\n` +
                        `</div>\n` +
                        `</div>`;
                    break;
            }
            
            tooltipE3.value = content;
            
            if (testButtonE3) {
                testButtonE3.tooltip = tooltipE3;
            }
        }
        
        updateTestButtonE3();
        testButtonE3.show();
        context.subscriptions.push(testButtonE3);
        
        // Register a hover provider for the status bar area (experimental)
        // Note: This likely won't work for status bar items, but worth trying
        const hoverProvider = vscode.languages.registerHoverProvider(
            { scheme: '*', pattern: '**/*' }, // Try to match everything
            {
                provideHover(document, position, token) {
                    // This is a long shot - hover providers are meant for editor content
                    // But let's see if it affects anything
                    const hoverContent = new vscode.MarkdownString();
                    hoverContent.isTrusted = true;
                    hoverContent.supportThemeIcons = true;
                    hoverContent.supportHtml = true;
                    
                    hoverContent.value = `**MCP Server Hover Provider**\n\n` +
                        `This hover is provided by a registered hover provider.\n\n` +
                        `If you see this in the status bar area, it means the hover provider is working!\n\n` +
                        `[Toggle Server](command:vscode-mcp-server.toggleServer)\n\n` +
                        `[Show Info](command:vscode-mcp-server.showServerInfo)`;
                    
                    return new vscode.Hover(hoverContent);
                }
            }
        );
        context.subscriptions.push(hoverProvider);
        
        // Only start the server if enabled
        if (serverEnabled) {
            // Create the shared terminal
            const terminal = getExtensionTerminal(context);

            // Initialize MCP server with the configured port and terminal
            mcpServer = new MCPServer(port, terminal);

            // Set up file listing callback
            mcpServer.setFileListingCallback(async (path: string, recursive: boolean) => {
                try {
                    return await listWorkspaceFiles(path, recursive);
                } catch (error) {
                    logger.error(`Error listing files: ${error instanceof Error ? error.message : String(error)}`);
                    throw error;
                }
            });
            
            // Call setupTools after setting the callback
            mcpServer.setupTools();

            await mcpServer.start();
            logger.info('MCP Server started successfully');
        } else {
            logger.info('MCP Server is disabled by default');
        }
        
        // Update status bar after server state is determined
        updateStatusBar(port);

        // Register commands
        const showMainMenuCommand = vscode.commands.registerCommand(
            'vscode-mcp-server.showMainMenu',
            () => showMainMenu(context)
        );
        
        const toggleServerCommand = vscode.commands.registerCommand(
            'vscode-mcp-server.toggleServer', 
            () => toggleServerState(context)
        );

        const showServerInfoCommand = vscode.commands.registerCommand(
            'vscode-mcp-server.showServerInfo', 
            () => {
                if (serverEnabled) {
                    vscode.window.showInformationMessage(`MCP Server is running at http://localhost:${port}/mcp`);
                } else {
                    vscode.window.showInformationMessage('MCP Server is currently disabled. Click on the status bar item to enable it.');
                }
            }
        );
        
        const toggleAutoApprovalCommand = vscode.commands.registerCommand(
            'vscode-mcp-server.toggleAutoApproval',
            () => toggleAutoApproval(context)
        );
        
        const toggleShellAutoApprovalCommand = vscode.commands.registerCommand(
            'vscode-mcp-server.toggleShellAutoApproval',
            () => toggleShellAutoApproval(context)
        );
        
        // Register shell command approval/rejection commands
        const approveShellCommand = vscode.commands.registerCommand(
            'vscode-mcp-server.approveShellCommand',
            () => {
                if (shellApprovalManager) {
                    shellApprovalManager.handleApproval();
                }
            }
        );
        
        const rejectShellCommand = vscode.commands.registerCommand(
            'vscode-mcp-server.rejectShellCommand',
            () => {
                if (shellApprovalManager) {
                    shellApprovalManager.handleRejection();
                }
            }
        );
        
        // Add command to check auto-approval status (for tests)
        const isAutoApprovalEnabledCommand = vscode.commands.registerCommand(
            'vscode-mcp-server.isAutoApprovalEnabled',
            () => autoApprovalEnabled
        );
        
        // Add applyDiff command for testing purposes
        // This exposes the MCP tool as a VS Code command for automated testing
        const applyDiffCommand = vscode.commands.registerCommand(
            'mcp.applyDiff',
            async (args: { filePath: string; diffs: any[]; description?: string; partialSuccess?: boolean }) => {
                try {
                    // Call the applyDiff function directly
                    await applyDiff(args);
                    return true; // Return success
                } catch (error) {
                    // Re-throw the error so tests can catch it
                    throw error;
                }
            }
        );

        // Listen for configuration changes
        const configChangeListener = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('vscode-mcp-server.port')) {
                const newPort = vscode.workspace.getConfiguration('vscode-mcp-server').get<number>('port') || 3000;
                updateStatusBar(newPort);
                
                if (serverEnabled && mcpServer) {
                    vscode.window.showInformationMessage(
                        `Port configuration changed to ${newPort}. Please restart the server for changes to take effect.`
                    );
                }
            }
        });
        
        // Add all disposables to the context subscriptions
        context.subscriptions.push(
            statusBarItem,
            showMainMenuCommand,
            toggleServerCommand,
            showServerInfoCommand,
            toggleAutoApprovalCommand,
            toggleShellAutoApprovalCommand,
            approveShellCommand,
            rejectShellCommand,
            isAutoApprovalEnabledCommand,
            applyDiffCommand,
            configChangeListener,
            { dispose: async () => mcpServer && await mcpServer.stop() }
        );
    } catch (error) {
        logger.error(`Failed to start MCP Server: ${error instanceof Error ? error.message : 'Unknown error'}`);
        vscode.window.showErrorMessage(`Failed to start MCP Server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function deactivate() {
    if (mainMenuButton) {
        mainMenuButton.dispose();
        mainMenuButton = undefined;
    }
    
    // Dispose test buttons
    if (testButton1) {
        testButton1.dispose();
        testButton1 = undefined;
    }
    if (testButton2) {
        testButton2.dispose();
        testButton2 = undefined;
    }
    if (testButton3) {
        testButton3.dispose();
        testButton3 = undefined;
    }
    if (testButton4) {
        testButton4.dispose();
        testButton4 = undefined;
    }
    if (testButton5) {
        testButton5.dispose();
        testButton5 = undefined;
    }
    if (testButtonA) {
        testButtonA.dispose();
        testButtonA = undefined;
    }
    if (testButtonB) {
        testButtonB.dispose();
        testButtonB = undefined;
    }
    if (testButtonC) {
        testButtonC.dispose();
        testButtonC = undefined;
    }
    if (testButtonA1) {
        testButtonA1.dispose();
        testButtonA1 = undefined;
    }
    if (testButtonA2) {
        testButtonA2.dispose();
        testButtonA2 = undefined;
    }
    if (testButtonB1) {
        testButtonB1.dispose();
        testButtonB1 = undefined;
    }
    if (testButtonC1) {
        testButtonC1.dispose();
        testButtonC1 = undefined;
    }
    if (testButtonC2) {
        testButtonC2.dispose();
        testButtonC2 = undefined;
    }
    if (testButtonD1) {
        testButtonD1.dispose();
        testButtonD1 = undefined;
    }
    if (testButtonD2) {
        testButtonD2.dispose();
        testButtonD2 = undefined;
    }
    if (testButtonE1) {
        testButtonE1.dispose();
        testButtonE1 = undefined;
    }
    if (testButtonE2) {
        testButtonE2.dispose();
        testButtonE2 = undefined;
    }
    if (testButtonE3) {
        testButtonE3.dispose();
        testButtonE3 = undefined;
    }
    
    if (statusBarItem) {
        statusBarItem.dispose();
        statusBarItem = undefined;
    }
    
    if (autoApprovalStatusBar) {
        autoApprovalStatusBar.dispose();
        autoApprovalStatusBar = undefined;
    }
    
    if (shellAutoApprovalStatusBar) {
        shellAutoApprovalStatusBar.dispose();
        shellAutoApprovalStatusBar = undefined;
    }

    // Dispose the shared terminal
    if (sharedTerminal) {
        sharedTerminal.dispose();
        sharedTerminal = undefined;
    }

    if (!mcpServer) {
        return;
    }
    
    try {
        logger.info('Stopping MCP Server during extension deactivation');
        await mcpServer.stop();
        logger.info('MCP Server stopped successfully');
    } catch (error) {
        logger.error(`Error stopping MCP Server: ${error instanceof Error ? error.message : String(error)}`);
        throw error; // Re-throw to ensure VS Code knows about the failure
    } finally {
        mcpServer = undefined;
        // Dispose the logger
        logger.dispose();
    }
}