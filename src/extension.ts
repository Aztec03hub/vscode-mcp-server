import * as vscode from 'vscode';
import { MCPServer } from './server';
import { listWorkspaceFiles } from './tools/file-tools';
import { applyDiff } from './tools/edit-tools';
import { logger } from './utils/logger';

// Re-export for testing purposes
export { MCPServer };

let mcpServer: MCPServer | undefined;
let sharedTerminal: vscode.Terminal | undefined;
// Server state - disabled by default
let serverEnabled: boolean = false;
// Auto-approval mode for apply_diff
let diffAutoApprovalEnabled: boolean = false;
// Shell auto-approval mode - DANGEROUS when enabled
let shellAutoApprovalEnabled: boolean = false;
// Main menu button for consolidated UI
let mainMenuButton: vscode.StatusBarItem | undefined;

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

// Function to generate the tooltip menu content
function generateTooltipMenu(): vscode.MarkdownString {
    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = true;
    tooltip.supportThemeIcons = true;
    tooltip.supportHtml = true;

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

// Function to toggle auto-approval mode
async function toggleDiffAutoApproval(context: vscode.ExtensionContext) {
    diffAutoApprovalEnabled = !diffAutoApprovalEnabled;

    // Save state
    await context.globalState.update('diffAutoApprovalEnabled', diffAutoApprovalEnabled);

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
        }
    } else {
        vscode.window.showInformationMessage('Auto-Approval Mode disabled. Apply_diff operations will require manual approval.');
    }

    updateMainMenuButton();

    if (mainMenuButton) {
        mainMenuButton.hide();
        mainMenuButton.show();
    }
}

// Function to toggle shell auto-approval mode
async function toggleShellAutoApproval(context: vscode.ExtensionContext) {
    shellAutoApprovalEnabled = !shellAutoApprovalEnabled;

    // Save state
    await context.globalState.update('shellAutoApprovalEnabled', shellAutoApprovalEnabled);

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

            vscode.window.showInformationMessage('Shell Auto-Approval Mode disabled. Safety checks remain active.');
        } else {
            // Show additional confirmation in output
            logger.warn('⚠️ SHELL AUTO-APPROVAL ENABLED - Destructive commands will execute without confirmation!');
        }
    } else {
        vscode.window.showInformationMessage('Auto-Approval Mode disabled. Apply_diff operations will require manual approval.');
    }

    updateMainMenuButton();

    if (mainMenuButton) {
        mainMenuButton.hide();
        mainMenuButton.show();
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

    updateMainMenuButton();

    if (mainMenuButton) {
        mainMenuButton.hide();
        mainMenuButton.show();
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

        // Register commands
        const showStickyMenuCommand = vscode.commands.registerCommand(
            'vscode-mcp-server.showStickyMenu',
            async () => {
                // Execute the hover command to make tooltip sticky
                await vscode.commands.executeCommand('workbench.action.showHover', { focus: false });
            }
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

        // Listen for configuration changes
        const configChangeListener = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('vscode-mcp-server.port')) {
                const newPort = vscode.workspace.getConfiguration('vscode-mcp-server').get<number>('port') || 3000;

                if (serverEnabled && mcpServer) {
                    vscode.window.showInformationMessage(
                        `Port configuration changed to ${newPort}. Please restart the server for changes to take effect.`
                    );
                }
            }
        });

        // Add all disposables to the context subscriptions
        context.subscriptions.push(
            showStickyMenuCommand,
            toggleServerCommand,
            showServerInfoCommand,
            toggleDiffAutoApprovalCommand,
            toggleShellAutoApprovalCommand,
            approveShellCommand,
            rejectShellCommand,
            isDiffAutoApprovalEnabledCommand,
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