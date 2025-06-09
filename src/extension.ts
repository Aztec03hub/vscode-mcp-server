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
let diffAutoApprovalEnabled: boolean = false;
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
// New experimental tooltip buttons
let testButtonA: vscode.StatusBarItem | undefined;
let testButtonB: vscode.StatusBarItem | undefined;
let testButtonC: vscode.StatusBarItem | undefined;
let testButtonD: vscode.StatusBarItem | undefined;
let testButtonE: vscode.StatusBarItem | undefined;
let testButtonF: vscode.StatusBarItem | undefined;
let testButtonG: vscode.StatusBarItem | undefined;
let testButtonH: vscode.StatusBarItem | undefined;


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
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
        statusBarItem.text = `$(server) MCP Server: Off`;
        statusBarItem.tooltip = `MCP Server is disabled (Click to toggle)`;
        // Use a subtle color to indicate disabled state
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }
}

// Function to update auto-approval status bar
function updateAutoApprovalStatusBar() {
    if (!autoApprovalStatusBar) {
        return;
    }

    if (diffAutoApprovalEnabled) {
        autoApprovalStatusBar.text = '$(pass-filled) Auto-Approve: ON';
        autoApprovalStatusBar.tooltip = 'Apply Diff Auto-Approval is ENABLED - diffs will be applied automatically without preview (Click to disable)';
        autoApprovalStatusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
        autoApprovalStatusBar.text = '$(circle-outline) Auto-Approve: OFF';
        autoApprovalStatusBar.tooltip = 'Apply Diff Auto-Approval is DISABLED - diffs require manual approval (Click to enable)';
        autoApprovalStatusBar.backgroundColor = undefined;
    }
}

// Function to generate the tooltip menu content
function generateTooltipMenu(): vscode.MarkdownString {
    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = true;
    tooltip.supportThemeIcons = true;
    
    // Get current port from configuration
    const config = vscode.workspace.getConfiguration('vscode-mcp-server');
    const port = config.get<number>('port') || 3000;
    
    let content = '**VS Code MCP Server**\n\n';
    
    // Server status line
    const serverIcon = serverEnabled ? '$(server-process)' : '$(server)';
    const serverStatus = serverEnabled ? `Running (Port: ${port})` : 'Inactive';
    const serverBg = serverEnabled ? 
        'var(--vscode-statusBarItem-warningBackground)' : 
        'var(--vscode-statusBarItem-errorBackground)';
    content += `- ${serverIcon} MCP Server: [<span style="background-color: ${serverBg}">**${serverStatus}**</span>](command:vscode-mcp-server.toggleServer)\n`;
    
    // Auto-Approve Diff line
    const diffStatus = diffAutoApprovalEnabled ? 'ON' : 'OFF';
    const diffBg = diffAutoApprovalEnabled ? 
        'var(--vscode-statusBarItem-warningBackground)' : 
        'var(--vscode-statusBarItem-errorBackground)';
    content += `- $(pass-filled) Auto-Approve Diff: [<span style="background-color: ${diffBg}">**${diffStatus}**</span>](command:vscode-mcp-server.toggleDiffAutoApproval)\n`;
    
    // Auto-Approve Shell line
    const shellStatus = shellAutoApprovalEnabled ? 'ON' : 'OFF';
    const shellBg = shellAutoApprovalEnabled ? 
        'var(--vscode-statusBarItem-warningBackground)' : 
        'var(--vscode-statusBarItem-errorBackground)';
    content += `- $(shield) Auto-Approve Shell: [<span style="background-color: ${shellBg}">**${shellStatus}**</span>](command:vscode-mcp-server.toggleShellAutoApproval)\n`;
    
    // Separator and additional actions
    content += '\n---\n\n';
    content += '[$(info) Show Server Info](command:vscode-mcp-server.showServerInfo) | ';
    content += '[$(gear) Extension Settings](command:workbench.action.openSettings?["vscode-mcp-server"])';
    
    tooltip.value = content;
    return tooltip;
}

// Function to update main menu button
function updateMainMenuButton() {
    if (!mainMenuButton) {
        return;
    }
    
    // Show server status in the button
    if (serverEnabled) {
        mainMenuButton.text = '$(server-process) MCP Server';
        mainMenuButton.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
        mainMenuButton.text = '$(server) MCP Server';
        mainMenuButton.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }
    
    // Show warning if any auto-approval is enabled
    if (diffAutoApprovalEnabled || shellAutoApprovalEnabled) {
        mainMenuButton.text += ' $(warning)';
    }
    
    // Update tooltip with the new menu format
    mainMenuButton.tooltip = generateTooltipMenu();
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
async function toggleDiffAutoApproval(context: vscode.ExtensionContext) {
    diffAutoApprovalEnabled = !diffAutoApprovalEnabled;
    
    // Save state
    await context.globalState.update('diffAutoApprovalEnabled', diffAutoApprovalEnabled);
    
    // Update status bar
    updateAutoApprovalStatusBar();
    updateMainMenuButton();
    
    // Show warning when enabling
    if (diffAutoApprovalEnabled) {
        const result = await vscode.window.showWarningMessage(
            'Auto-Approval Mode ENABLED: All apply_diff operations will be automatically approved without preview. This can be dangerous! Use only for testing.',
            { modal: true },
            'Keep Enabled',
            'Disable'
        );
        
        if (result === 'Disable') {
            diffAutoApprovalEnabled = false;
            await context.globalState.update('diffAutoApprovalEnabled', false);
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
export function isDiffAutoApprovalEnabled(): boolean {
    // Auto-approve in test mode to prevent dialog timeouts
    if (testModeEnabled) {
        return true;
    }
    // Also check environment variables as backup
    if (process.env.NODE_ENV === 'test' || process.env.VSCODE_TEST === '1') {
        return true;
    }
    return diffAutoApprovalEnabled;
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
            label: `$(pass-filled) Auto-Approve (Diff): ${diffAutoApprovalEnabled ? 'ON' : 'OFF'}`,
            description: 'Toggle automatic approval for diff operations',
            detail: diffAutoApprovalEnabled ? '⚠️ Diffs will apply automatically' : 'Diffs require manual approval'
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
                await toggleDiffAutoApproval(context);
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

    // State for experimental Button F
    let tooltipFVisible = false;

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
        diffAutoApprovalEnabled = context.globalState.get('diffAutoApprovalEnabled', false);
        shellAutoApprovalEnabled = context.globalState.get('shellAutoApprovalEnabled', false);
        
        logger.info(`[activate] Using port ${port} from configuration`);
        logger.info(`[activate] Server enabled: ${serverEnabled}`);
        logger.info(`[activate] Auto-approval enabled: ${diffAutoApprovalEnabled}`);
        logger.info(`[activate] Shell auto-approval enabled: ${shellAutoApprovalEnabled}`);
        
        // Initialize the shell approval manager
        shellApprovalManager = new ShellApprovalManager();

        // Create main menu button (replacing individual status bars)
        mainMenuButton = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        mainMenuButton.command = 'vscode-mcp-server.showStickyMenu';
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
        autoApprovalStatusBar.command = 'vscode-mcp-server.toggleDiffAutoApproval';
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
            `[$(pass-filled) Toggle Diff Auto-Approve](command:vscode-mcp-server.toggleDiffAutoApproval)\n\n` +
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
            `| $(pass-filled) Diff Auto | ❌ OFF | [Enable](command:vscode-mcp-server.toggleDiffAutoApproval) |\n` +
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
        
        // Experimental Button A: Focus-based Activation
        testButtonA = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            45
        );
        testButtonA.text = 'A';
        testButtonA.command = 'vscode-mcp-server.testButtonA';
        const tooltipA = new vscode.MarkdownString();
        tooltipA.isTrusted = true;
        tooltipA.supportThemeIcons = true;
        tooltipA.value = `**Button A: Focus-based Activation**\n\n` +
            `This button executes \`editor.action.showHover\` when clicked.\n\n` +
            `Testing if hover command works on status bar items.`;
        testButtonA.tooltip = tooltipA;
        testButtonA.show();
        context.subscriptions.push(testButtonA);
        
        // Experimental Button B: Tooltip with Input Element
        testButtonB = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            44
        );
        testButtonB.text = 'B';
        const tooltipB = new vscode.MarkdownString();
        tooltipB.isTrusted = true;
        tooltipB.supportHtml = true;
        tooltipB.value = `**Button B: Tooltip with Input Element**\n\n` +
            `<input type="text" autofocus placeholder="Type here..." style="width: 200px; padding: 4px;">\n\n` +
            `Testing if focusable input keeps tooltip open.`;
        testButtonB.tooltip = tooltipB;
        testButtonB.show();
        context.subscriptions.push(testButtonB);
        
        // Experimental Button C: Command Link Focus Chain
        testButtonC = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            43
        );
        testButtonC.text = 'C';
        const tooltipC = new vscode.MarkdownString();
        tooltipC.isTrusted = true;
        tooltipC.supportThemeIcons = true;
        tooltipC.value = `**Button C: Command Link Focus Chain**\n\n` +
            `[$(refresh) Refresh Tooltip](command:vscode-mcp-server.refreshTooltipC)\n\n` +
            `Click the command link to re-trigger the tooltip.\n\n` +
            `Updated: ${new Date().toLocaleTimeString()}`;
        testButtonC.tooltip = tooltipC;
        testButtonC.show();
        context.subscriptions.push(testButtonC);
        
        // Experimental Button D: Accessibility Focus
        testButtonD = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            42
        );
        testButtonD.text = 'D';
        const tooltipD = new vscode.MarkdownString();
        tooltipD.isTrusted = true;
        tooltipD.supportHtml = true;
        tooltipD.value = `**Button D: Accessibility Focus**\n\n` +
            `<div role="dialog" tabindex="0" aria-label="Persistent tooltip">\n` +
            `  <p>This tooltip has accessibility attributes.</p>\n` +
            `  <button tabindex="1">Focus Me</button>\n` +
            `</div>`;
        testButtonD.tooltip = tooltipD;
        testButtonD.show();
        context.subscriptions.push(testButtonD);
        
        // Experimental Button E: Mouse Event Attributes
        testButtonE = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            41
        );
        testButtonE.text = 'E';
        const tooltipE = new vscode.MarkdownString();
        tooltipE.isTrusted = true;
        tooltipE.supportHtml = true;
        tooltipE.value = `**Button E: Mouse Event Attributes**\n\n` +
            `<div onmouseover="return false" onmouseout="return false" onmouseleave="return false">\n` +
            `  <p>This area prevents mouse events from bubbling.</p>\n` +
            `  <p>Hover here to test persistence.</p>\n` +
            `</div>`;
        testButtonE.tooltip = tooltipE;
        testButtonE.show();
        context.subscriptions.push(testButtonE);
        
        // Experimental Button F: Toggle-based Tooltip
        testButtonF = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            40
        );
        testButtonF.text = 'F';
        testButtonF.command = 'vscode-mcp-server.toggleTooltipF';
        const updateTooltipF = () => {
            if (tooltipFVisible) {
                const tooltipF = new vscode.MarkdownString();
                tooltipF.isTrusted = true;
                tooltipF.value = `**Button F: Toggle-based Tooltip**\n\n` +
                    `Status: **Visible**\n\n` +
                    `Click button to hide tooltip.`;
                testButtonF!.tooltip = tooltipF;
            } else {
                testButtonF!.tooltip = 'Click to show persistent tooltip';
            }
        };
        updateTooltipF();
        testButtonF.show();
        context.subscriptions.push(testButtonF);
        
        // Experimental Button G: Focus Command After Show
        testButtonG = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            39
        );
        testButtonG.text = 'G';
        testButtonG.command = 'vscode-mcp-server.testButtonG';
        const tooltipG = new vscode.MarkdownString();
        tooltipG.isTrusted = true;
        tooltipG.value = `**Button G: Focus Command After Show**\n\n` +
            `Click button to set tooltip and execute focus command.\n\n` +
            `This tests programmatic focus after tooltip display.`;
        testButtonG.tooltip = tooltipG;
        testButtonG.show();
        context.subscriptions.push(testButtonG);
        
        // Test button H: Attempt programmatic tooltip locking
        testButtonH = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            38
        );
        testButtonH.text = 'H';
        testButtonH.command = 'vscode-mcp-server.testButtonH';
        const tooltipH = new vscode.MarkdownString();
        tooltipH.isTrusted = true;
        tooltipH.supportThemeIcons = true;
        tooltipH.value = `**Button H: Tooltip Lock (Ctrl+K Ctrl+I)**\n\n` +
            `This button executes the accessible hover command that locks tooltips.\n\n` +
            `When clicked, it simulates pressing **Ctrl+K Ctrl+I** which:\n\n` +
            `• Makes the tooltip "sticky" (won't disappear on mouse movement)\n` +
            `• Allows interaction with links in the tooltip\n` +
            `• Can be dismissed with ESC\n\n` +
            `[$(lock) Execute Lock Sequence](command:vscode-mcp-server.testButtonH)`;
        testButtonH.tooltip = tooltipH;
        testButtonH.show();
        context.subscriptions.push(testButtonH);


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
        const showStickyMenuCommand = vscode.commands.registerCommand(
            'vscode-mcp-server.showStickyMenu',
            async () => {
                // Execute the hover command to make tooltip sticky
                await vscode.commands.executeCommand('workbench.action.showHover');
            }
        );
        
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
        
        const toggleDiffAutoApprovalCommand = vscode.commands.registerCommand(
            'vscode-mcp-server.toggleDiffAutoApproval',
            () => toggleDiffAutoApproval(context)
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
        const isDiffAutoApprovalEnabledCommand = vscode.commands.registerCommand(
            'vscode-mcp-server.isDiffAutoApprovalEnabled',
            () => diffAutoApprovalEnabled
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
        
        // Register experimental button commands
        const testButtonACommand = vscode.commands.registerCommand(
            'vscode-mcp-server.testButtonA',
            async () => {
                // Execute showHover command
                await vscode.commands.executeCommand('editor.action.showHover');
            }
        );
        
        const refreshTooltipCCommand = vscode.commands.registerCommand(
            'vscode-mcp-server.refreshTooltipC',
            () => {
                if (testButtonC) {
                    const tooltipC = new vscode.MarkdownString();
                    tooltipC.isTrusted = true;
                    tooltipC.supportThemeIcons = true;
                    tooltipC.value = `**Button C: Command Link Focus Chain**\n\n` +
                        `[$(refresh) Refresh Tooltip](command:vscode-mcp-server.refreshTooltipC)\n\n` +
                        `Click the command link to re-trigger the tooltip.\n\n` +
                        `Updated: ${new Date().toLocaleTimeString()}`;
                    testButtonC.tooltip = tooltipC;
                }
            }
        );
        
        const toggleTooltipFCommand = vscode.commands.registerCommand(
            'vscode-mcp-server.toggleTooltipF',
            () => {
                tooltipFVisible = !tooltipFVisible;
                updateTooltipF();
            }
        );
        
        const testButtonGCommand = vscode.commands.registerCommand(
            'vscode-mcp-server.testButtonG',
            async () => {
                // Update tooltip first
                if (testButtonG) {
                    const tooltipG = new vscode.MarkdownString();
                    tooltipG.isTrusted = true;
                    tooltipG.value = `**Button G: Focus Command Executed**\n\n` +
                        `Focus command was executed at: ${new Date().toLocaleTimeString()}\n\n` +
                        `Check if tooltip stays visible.`;
                    testButtonG.tooltip = tooltipG;
                }
                // Execute focus command
                await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
            }
        );
        
        const testButtonHCommand = vscode.commands.registerCommand(
            'vscode-mcp-server.testButtonH',
            async () => {
                try {
                    // Execute the workbench.action.showHover command which is Ctrl+K Ctrl+I
                    await vscode.commands.executeCommand('workbench.action.showHover');
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to execute Ctrl+K Ctrl+I: ${error}`);
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
            showStickyMenuCommand,
            showMainMenuCommand,
            toggleServerCommand,
            showServerInfoCommand,
            toggleDiffAutoApprovalCommand,
            toggleShellAutoApprovalCommand,
            approveShellCommand,
            rejectShellCommand,
            isDiffAutoApprovalEnabledCommand,
            applyDiffCommand,
            testButtonACommand,
            refreshTooltipCCommand,
            toggleTooltipFCommand,
            testButtonGCommand,
            testButtonHCommand,
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
    if (testButtonD) {
        testButtonD.dispose();
        testButtonD = undefined;
    }
    if (testButtonE) {
        testButtonE.dispose();
        testButtonE = undefined;
    }
    if (testButtonF) {
        testButtonF.dispose();
        testButtonF = undefined;
    }
    if (testButtonG) {
        testButtonG.dispose();
        testButtonG = undefined;
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