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

        // Create server status bar item
        statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        statusBarItem.command = 'vscode-mcp-server.toggleServer';
        statusBarItem.show();
        updateStatusBar(port);
        
        // Create auto-approval status bar item
        autoApprovalStatusBar = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            99
        );
        autoApprovalStatusBar.command = 'vscode-mcp-server.toggleAutoApproval';
        autoApprovalStatusBar.show();
        updateAutoApprovalStatusBar();
        context.subscriptions.push(autoApprovalStatusBar);
        
        // Create shell auto-approval status bar item
        shellAutoApprovalStatusBar = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            98  // Priority next to other status bars
        );
        shellAutoApprovalStatusBar.command = 'vscode-mcp-server.toggleShellAutoApproval';
        shellAutoApprovalStatusBar.show();
        updateShellAutoApprovalStatusBar();
        context.subscriptions.push(shellAutoApprovalStatusBar);
        
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