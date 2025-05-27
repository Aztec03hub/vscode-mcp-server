import * as vscode from 'vscode';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from 'zod';
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// Configuration constants for shell integration timeouts and delays
const SHELL_INTEGRATION_TIMEOUT_MS = 5000; // 5 seconds to wait for shell integration
const STREAM_TIMEOUT_MS = 30000; // 30 seconds to wait for command stream
const COMMAND_DELAY_MS = 50; // 50ms delay after PowerShell commands (VSCode Bug #237208 workaround)

// Global command counter for PowerShell uniqueness
let powershellCommandCounter = 0;

/**
 * Detects if the current shell is PowerShell based on VS Code configuration
 * @returns true if the current shell is PowerShell
 */
function isPowerShellShell(): boolean {
    const defaultWindowsShellProfile = vscode.workspace
        .getConfiguration('terminal.integrated.defaultProfile')
        .get('windows');
    
    return process.platform === 'win32' &&
           (defaultWindowsShellProfile === null ||
            (defaultWindowsShellProfile as string)?.toLowerCase().includes('powershell'));
}

/**
 * Modifies a command for PowerShell to include uniqueness counter and delay workaround
 * @param command The original command
 * @returns Modified command with PowerShell-specific workarounds
 */
function enhanceCommandForPowerShell(command: string): string {
    let enhancedCommand = command;
    
    // Add uniqueness counter (Roo/PS Workaround pattern)
    enhancedCommand += ` ; "(MCP/PS Workaround: ${powershellCommandCounter++})" > $null`;
    
    // Add delay to prevent race conditions (VSCode Bug #237208)
    enhancedCommand += ` ; start-sleep -milliseconds ${COMMAND_DELAY_MS}`;
    
    return enhancedCommand;
}

/**
 * Waits for shell integration to become available with enhanced timeout handling
 * @param terminal The terminal to wait for
 * @param timeout Maximum time to wait in milliseconds
 * @returns Promise that resolves to true if shell integration became available
 */
async function waitForShellIntegration(terminal: vscode.Terminal, timeout = SHELL_INTEGRATION_TIMEOUT_MS): Promise<boolean> {
    if (terminal.shellIntegration) {
        return true;
    }

    return new Promise<boolean>(resolve => {
        const timeoutId = setTimeout(() => {
            disposable.dispose();
            console.warn(`[Shell Tools] Shell integration timeout after ${timeout}ms`);
            resolve(false);
        }, timeout);

        const disposable = vscode.window.onDidChangeTerminalShellIntegration(e => {
            if (e.terminal === terminal && terminal.shellIntegration) {
                clearTimeout(timeoutId);
                disposable.dispose();
                console.log('[Shell Tools] Shell integration became available');
                resolve(true);
            }
        });
    });
}

/**
 * Executes a shell command using terminal shell integration with enhanced timeout handling
 * @param terminal The terminal with shell integration
 * @param command The command to execute
 * @param cwd Optional working directory for the command
 * @returns Promise that resolves with the command output
 */
export async function executeShellCommand(
    terminal: vscode.Terminal,
    command: string,
    cwd?: string
): Promise<{ output: string }> {
    terminal.show();
    
    // Build full command including cd if cwd is specified
    let fullCommand = command;
    if (cwd) {
        if (cwd === '.' || cwd === './') {
            fullCommand = `${command}`;
        } else {
            const quotedPath = cwd.includes(' ') ? `"${cwd}"` : cwd;
            fullCommand = `cd ${quotedPath} && ${command}`;
        }
    }
    
    // Apply PowerShell-specific enhancements if needed
    if (isPowerShellShell()) {
        fullCommand = enhanceCommandForPowerShell(fullCommand);
        console.log(`[Shell Tools] Enhanced PowerShell command with counter ${powershellCommandCounter - 1}`);
    }
    
    // Execute the command using shell integration API
    const execution = terminal.shellIntegration!.executeCommand(fullCommand);
    
    // Capture output using the stream with timeout handling
    let output = '';
    
    try {
        // Create a promise for stream reading with timeout
        const streamPromise = (async () => {
            const outputStream = (execution as any).read();
            for await (const data of outputStream) {
                output += data;
            }
            return output;
        })();
        
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Command stream timeout after ${STREAM_TIMEOUT_MS}ms. This may indicate a shell integration issue.`));
            }, STREAM_TIMEOUT_MS);
        });
        
        // Race between stream completion and timeout
        await Promise.race([streamPromise, timeoutPromise]);
        
        console.log(`[Shell Tools] Command completed successfully, output length: ${output.length}`);
        
    } catch (error) {
        console.error(`[Shell Tools] Command execution error:`, error);
        
        // Enhanced error handling with fallback information
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('timeout')) {
            throw new Error(`Shell command timed out after ${STREAM_TIMEOUT_MS / 1000} seconds. ` +
                          `This may be due to VSCode shell integration issues. ` +
                          `Try running the command manually or restarting the terminal. ` +
                          `Original command: ${command}`);
        }
        
        throw new Error(`Failed to read command output: ${errorMessage}`);
    }
    
    return { output };
}

/**
 * Registers MCP shell-related tools with the server
 * @param server MCP server instance
 * @param terminal The terminal to use for command execution
 */
export function registerShellTools(server: McpServer, terminal?: vscode.Terminal): void {
    // Add execute_shell_command tool
    server.tool(
        'execute_shell_command_code',
        'Executes a shell command in the VS Code integrated terminal with shell integration. Returns both the command output and exit code. This is useful for running CLI commands, build operations, git commands, or any other shell operations. Note: This tool requires shell integration to be available in the terminal. Includes enhanced timeout handling and PowerShell-specific workarounds for improved reliability.',
        {
            command: z.string().describe('The shell command to execute'),
            cwd: z.string().optional().default('.').describe('Optional working directory for the command')
        },
        async ({ command, cwd }): Promise<CallToolResult> => {
            try {
                if (!terminal) {
                    throw new Error('Terminal not available');
                }
                
                console.log(`[Shell Tools] Executing command: ${command}${cwd && cwd !== '.' ? ` (cwd: ${cwd})` : ''}`);
                
                // Check for shell integration - wait with enhanced timeout if not available
                if (!terminal.shellIntegration) {
                    console.log('[Shell Tools] Shell integration not immediately available, waiting...');
                    const shellIntegrationAvailable = await waitForShellIntegration(terminal);
                    if (!shellIntegrationAvailable) {
                        throw new Error(
                            `Shell integration not available in terminal after ${SHELL_INTEGRATION_TIMEOUT_MS / 1000} seconds. ` +
                            'This may indicate a terminal configuration issue. ' +
                            'Try restarting VS Code or checking your terminal settings.'
                        );
                    }
                }
                
                const startTime = Date.now();
                const { output } = await executeShellCommand(terminal, command, cwd);
                const executionTime = Date.now() - startTime;
                
                console.log(`[Shell Tools] Command execution completed in ${executionTime}ms`);
                
                const result: CallToolResult = {
                    content: [
                        {
                            type: 'text',
                            text: `Command: ${command}\n\nOutput:\n${output}`
                        }
                    ]
                };
                return result;
            } catch (error) {
                console.error('[Shell Tools] Error in execute_shell_command_code tool:', error);
                
                // Enhanced error reporting with context
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(`Shell command execution failed: ${errorMessage}`);
            }
        }
    );
}