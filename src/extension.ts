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

// Terminal name constant
const TERMINAL_NAME = 'MCP Shell Commands';

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
        
        logger.info(`[activate] Using port ${port} from configuration`);
        logger.info(`[activate] Server enabled: ${serverEnabled}`);
        logger.info(`[activate] Auto-approval enabled: ${autoApprovalEnabled}`);

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