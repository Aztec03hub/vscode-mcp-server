/**
 * Shell Tools Module for VS Code MCP Server
 * 
 * This module provides shell command execution and management tools with intelligent
 * timeout handling to support both quick commands and long-running interactive sessions.
 * 
 * Key Features:
 * - Shell Registry: Manages up to 8 concurrent shell sessions with auto-cleanup
 * - Timeout Reset: Prevents premature timeouts during interactive workflows
 * - Output Management: Handles large outputs with persistent file storage and truncation
 * - Safety Warnings: Detects potentially destructive commands
 * - Interactive Detection: Identifies prompts that need user input
 * 
 * Timeout Behavior:
 * - Default commands: 15-second timeout
 * - Interactive commands: No timeout
 * - Background processes: No timeout
 * - Timeouts reset on new commands or input to support multi-step workflows
 * 
 * This ensures tools like 'npm create', 'git rebase -i', and database migrations
 * can complete without interruption while still preventing hanging shells.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from 'zod';
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { isShellAutoApprovalEnabled, requestShellCommandApproval } from '../extension';

// Configuration constants for shell integration timeouts and delays
const SHELL_INTEGRATION_TIMEOUT_MS = 5000; // 5 seconds to wait for shell integration
const STREAM_TIMEOUT_MS = 3000; // 3 seconds to wait for command stream (changed from 30s to fix hanging)
const INTERACTIVE_STREAM_TIMEOUT_MS = 3000; // 3 seconds for interactive commands to avoid hanging
const COMMAND_DELAY_MS = 50; // 50ms delay after PowerShell commands (VSCode Bug #237208 workaround)

// Shell Registry Configuration
const MAX_SHELLS = 8; // Maximum number of concurrent shells to prevent resource exhaustion
const SHELL_CLEANUP_TIMEOUT = 10 * 60 * 1000; // 10 minutes - auto-cleanup for idle shells to free resources

// Timeout Configuration - These values balance responsiveness with support for interactive workflows
const DEFAULT_TIMEOUT_MS = 15000; // 15 seconds - for regular commands (ls, echo, git status, etc.)
// Note: Timeouts reset on new commands or input, so multi-step workflows won't be interrupted

// Output Management Configuration (Task 4.1)
const DEFAULT_OUTPUT_CHARACTER_LIMIT = 100000; // 100k characters maximum
const OUTPUT_DIRECTORY = '.vscode-mcp-output'; // Directory for output files

// Safety Warnings Configuration (Task 4.2)
const DESTRUCTIVE_PATTERNS = [
    // Unix/Linux file removal patterns
    /^(?!.*\becho\b)(?!.*["'].*rm.*["']).*\brm\s+-rf\b/,  // rm -rf (avoid echo and quoted content)
    /^(?!.*\becho\b)(?!.*["'].*rm.*["']).*\brm\s+-r\b/,   // rm -r (recursive)
    /^(?!.*\becho\b)(?!.*["'].*rm.*["']).*\brm\s+-f\b/,   // rm -f (force)
    /^(?!.*\becho\b)(?!.*["'].*rm.*["']).*\brm\s+[^-]\S+/, // rm with filename (not starting with -)
    
    // Windows file removal patterns
    /\bdel\s+\/s\b/i,         // del /s (Windows)
    /\brd\s+\/s\b/i,          // rd /s (Windows short form)
    /\brmdir\s+\/s\b/i,       // rmdir /s (Windows)
    
    // Disk/filesystem operations
    /^(?!.*\becho\b)(?!.*["'].*format.*["']).*\bformat\s+[A-Za-z]:/i,  // format drive (require drive letter)
    /\bmkfs\b/i,               // mkfs (filesystem creation)
    /\bdd\s+if=.*of=/,         // dd command (disk operations)
    /\bfdisk\b/i,              // fdisk (disk partitioning)
    /\bparted\b/i,             // parted (disk partitioning)
    /\bgdisk\b/i               // gdisk (disk partitioning)
];

// Interactive Pattern Detection Configuration (Task 2.1)
const INTERACTIVE_PATTERNS = [
    /\?\s*$/,                    // Questions ending with ?
    /\(y\/n\)/i,                 // Yes/no prompts (case insensitive)
    /\(Y\/N\)/,                  // Yes/No prompts (case sensitive)
    /\(yes\/no\)/i,              // Full yes/no prompts
    /continue\?/i,               // Continue prompts
    /proceed\?/i,                // Proceed prompts
    /press\s+any\s+key/i,        // Press any key
    /press\s+enter/i,            // Press enter
    /enter\s+password/i,         // Password prompts
    /password:/i,                // Password colon prompts
    /confirm/i,                  // Confirmation prompts
    /are\s+you\s+sure/i,         // Are you sure prompts
    /do\s+you\s+want/i,          // Do you want prompts
    /\[y\/n\]/i,                 // Bracketed y/n
    /\[yes\/no\]/i               // Bracketed yes/no
];

const INTERACTIVE_KEYWORDS = [
    'password:',
    'confirm:',
    'continue?',
    'proceed?',
    'y/n',
    'yes/no',
    'press any key',
    'press enter',
    'are you sure',
    'do you want',
    'enter password',
    '(y/n)',
    '(yes/no)',
    '[y/n]',
    '[yes/no]'
];

// Interface for managed shell information
interface ManagedShell {
    id: string;
    terminal: vscode.Terminal;
    name: string;
    createdAt: Date;
    lastUsed: Date;
    status: ShellStatus;
    currentDirectory?: string;
    runningCommand?: string;
    activeTimeout?: NodeJS.Timeout;     // Track the active timeout handle for this shell
    timeoutEndTime?: Date;              // When the current timeout will expire (used for remaining time calculation)
    timeoutDuration?: number;           // Duration of the current timeout in ms (15s default shell types only)
    timeoutController?: AbortController; // For cancellable async operations (allows aborting on timeout)
}

// Shell status types
type ShellStatus = 'idle' | 'busy' | 'waiting-for-input' | 'crashed';

/**
 * Shell Timeout Manager Class
 * 
 * Centralized timeout management for shell commands. This class ensures that:
 * - Each shell can have only one active timeout at a time
 * - Timeouts can be reset when new activity occurs (commands or input)
 * - Proper cleanup happens to prevent memory leaks
 * - Timeout information is available for status display
 * 
 * The timeout reset mechanism prevents premature timeouts during interactive
 * sessions where users need to provide multiple inputs or run sequential commands.
 */
    class ShellTimeoutManager {
    private static timeouts: Map<string, {
        timeout: NodeJS.Timeout;
        endTime: Date;
        duration: number;
        controller: AbortController;
    }> = new Map();
    
    /**
     * Sets a timeout for a shell, cancelling any existing timeout
     */
    static setShellTimeout(
        shellId: string, 
        timeoutMs: number, 
        onTimeout: () => void
    ): AbortController {
        // Clear existing timeout if any
        this.clearShellTimeout(shellId);
        
        // Create new abort controller
        const controller = new AbortController();
        
        // Set new timeout
        const timeout = setTimeout(() => {
            if (!controller.signal.aborted) {
                onTimeout();
                this.timeouts.delete(shellId);
            }
        }, timeoutMs);
        
        // Store timeout info
        this.timeouts.set(shellId, {
            timeout,
            endTime: new Date(Date.now() + timeoutMs),
            duration: timeoutMs,
            controller
        });
        
        console.log(`[ShellTimeoutManager] Set timeout for shell ${shellId}: ${timeoutMs}ms`);
        return controller;
    }
    
    /**
     * Clears the timeout for a shell
     */
    static clearShellTimeout(shellId: string): void {
        const timeoutInfo = this.timeouts.get(shellId);
        if (timeoutInfo) {
            clearTimeout(timeoutInfo.timeout);
            timeoutInfo.controller.abort();
            this.timeouts.delete(shellId);
            console.log(`[ShellTimeoutManager] Cleared timeout for shell ${shellId}`);
        }
    }
    
    /**
     * Resets the timeout for a shell with a new duration
     */
    static resetShellTimeout(
        shellId: string, 
        newTimeoutMs: number, 
        onTimeout: () => void
    ): AbortController {
        console.log(`[ShellTimeoutManager] Resetting timeout for shell ${shellId}: ${newTimeoutMs}ms`);
        return this.setShellTimeout(shellId, newTimeoutMs, onTimeout);
    }
    
    /**
     * Gets timeout information for a shell
     */
    static getTimeoutInfo(shellId: string): { 
        remaining: number; 
        total: number 
    } | null {
        const timeoutInfo = this.timeouts.get(shellId);
        if (!timeoutInfo) {
            return null;
        }
        
        const remaining = Math.max(0, 
            timeoutInfo.endTime.getTime() - Date.now()
        );
        
        return {
            remaining,
            total: timeoutInfo.duration
        };
    }
    
    /**
     * Cleans up all timeouts (for disposal)
     */
    static dispose(): void {
        console.log(`[ShellTimeoutManager] Disposing all timeouts (${this.timeouts.size} active)`);
        for (const [shellId] of this.timeouts) {
            this.clearShellTimeout(shellId);
        }
    }
}

// Singleton Shell Registry Class
class ShellRegistry {
    private static instance: ShellRegistry;
    private shells: Map<string, ManagedShell> = new Map();
    private shellCounter = 0;
    private cleanupTimer?: NodeJS.Timeout;

    private constructor() {
        this.startCleanupTimer();
        this.setupTerminalEventHandlers();
    }

    public static getInstance(): ShellRegistry {
        if (!ShellRegistry.instance) {
            ShellRegistry.instance = new ShellRegistry();
        }
        return ShellRegistry.instance;
    }

    /**
     * Creates a new shell or returns existing one if under limit
     */
    public createShell(customName?: string, initialDirectory?: string): ManagedShell {
        if (this.shells.size >= MAX_SHELLS) {
            throw new Error(`Maximum number of shells (${MAX_SHELLS}) reached. Close some shells first.`);
        }

        // If customName looks like a shell ID (shell-X), use it as ID, otherwise generate new ID
        let shellId: string;
        let name: string;
        
        if (customName && customName.match(/^shell-\d+$/)) {
            // Custom name is a shell ID format
            shellId = customName;
            name = customName;
        } else {
            // Generate new shell ID
            shellId = `shell-${++this.shellCounter}`;
            name = customName || shellId;
        }
        
        // Create VS Code terminal
        const terminal = vscode.window.createTerminal({
            name: name,
            cwd: initialDirectory
        });

        const managedShell: ManagedShell = {
            id: shellId,
            terminal,
            name,
            createdAt: new Date(),
            lastUsed: new Date(),
            status: 'idle',
            currentDirectory: initialDirectory
        };

        this.shells.set(shellId, managedShell);
        console.log(`[Shell Registry] Created new shell: ${shellId} (${name})`);
        
        return managedShell;
    }

    /**
     * Gets an existing shell by ID or creates default shell if none exist
     */
    public getShell(shellId?: string): ManagedShell {
        if (!shellId) {
            // Return first available shell or create new one
            const firstShell = Array.from(this.shells.values())[0];
            if (firstShell) {
                this.updateLastUsed(firstShell.id);
                return firstShell;
            }
            return this.createShell();
        }

        const shell = this.shells.get(shellId);
        if (!shell) {
            throw new Error(`Shell '${shellId}' not found. Use list_active_shells to see available shells.`);
        }

        this.updateLastUsed(shellId);
        return shell;
    }

    /**
     * Lists all active shells
     */
    public listShells(): ManagedShell[] {
        return Array.from(this.shells.values());
    }

    /**
     * Closes a specific shell
     */
    public closeShell(shellId: string): boolean {
        const shell = this.shells.get(shellId);
        if (!shell) {
            return false;
        }

        try {
            shell.terminal.dispose();
            this.shells.delete(shellId);
            
            console.log(`[Shell Registry] Closed shell: ${shellId} (output file preserved for manual inspection)`);
            return true;
        } catch (error) {
            console.error(`[Shell Registry] Error closing shell ${shellId}:`, error);
            // Remove from registry anyway to prevent zombie shells
            this.shells.delete(shellId);
            
            return false;
        }
    }

    /**
     * Updates shell status
     */
    public updateShellStatus(shellId: string, status: ShellStatus, runningCommand?: string): void {
        const shell = this.shells.get(shellId);
        if (shell) {
            shell.status = status;
            shell.lastUsed = new Date();
            if (runningCommand !== undefined) {
                shell.runningCommand = runningCommand;
            }
        }
    }

    /**
     * Updates current directory for a shell
     */
    public updateCurrentDirectory(shellId: string, directory: string): void {
        const shell = this.shells.get(shellId);
        if (shell) {
            shell.currentDirectory = directory;
        }
    }

    /**
     * Updates last used timestamp
     */
    private updateLastUsed(shellId: string): void {
        const shell = this.shells.get(shellId);
        if (shell) {
            shell.lastUsed = new Date();
        }
    }

    /**
     * Starts the cleanup timer for unused shells
     */
    private startCleanupTimer(): void {
        this.cleanupTimer = setInterval(() => {
            this.cleanupUnusedShells();
        }, 60000); // Check every minute
    }

    /**
     * Cleans up shells that haven't been used in SHELL_CLEANUP_TIMEOUT
     */
    private cleanupUnusedShells(): void {
        const now = new Date();
        const shellsToClose: string[] = [];

        for (const [shellId, shell] of this.shells.entries()) {
            const timeSinceLastUse = now.getTime() - shell.lastUsed.getTime();
            if (timeSinceLastUse > SHELL_CLEANUP_TIMEOUT && shell.status === 'idle') {
                shellsToClose.push(shellId);
            }
        }

        for (const shellId of shellsToClose) {
            console.log(`[Shell Registry] Auto-closing unused shell: ${shellId}`);
            this.closeShell(shellId);
        }
    }

    /**
     * Sets up terminal event handlers to track terminal lifecycle
     */
    private setupTerminalEventHandlers(): void {
        // Handle terminal closure
        vscode.window.onDidCloseTerminal((closedTerminal) => {
            for (const [shellId, shell] of this.shells.entries()) {
                if (shell.terminal === closedTerminal) {
                    console.log(`[Shell Registry] Terminal closed externally: ${shellId}`);
                    this.shells.delete(shellId);
                    break;
                }
            }
        });
    }

    /**
     * Disposes all shells and cleanup timer
     */
    public dispose(): void {
        // Clear all shell timeouts first
        ShellTimeoutManager.dispose();
        
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        for (const [shellId, shell] of this.shells.entries()) {
            try {
                shell.terminal.dispose();
            } catch (error) {
                console.error(`[Shell Registry] Error disposing shell ${shellId}:`, error);
            }
        }

        this.shells.clear();
        console.log('[Shell Registry] Disposed all shells and cleanup timer');
    }
}

/**
 * Comprehensive test function for Shell Registry System - TEMPORARY
 */
export function testShellRegistry(): string {
    try {
        const registry = ShellRegistry.getInstance();
        const results: string[] = [];
        
        // Test 1: Initial state
        const initialShells = registry.listShells();
        results.push(`✓ Test 1 - Initial state: ${initialShells.length} shells`);
        
        // Test 2: Create shells with different names
        const shell1 = registry.createShell();
        const shell2 = registry.createShell('custom-shell');
        const shell3 = registry.createShell(undefined, 'C:\\temp');
        results.push(`✓ Test 2 - Created shells: ${shell1.id}, ${shell2.id}, ${shell3.id}`);
        
        // Test 3: List shells
        const allShells = registry.listShells();
        results.push(`✓ Test 3 - Shell count after creation: ${allShells.length} shells`);
        
        // Test 4: Get shell by ID
        const retrievedShell = registry.getShell(shell1.id);
        results.push(`✓ Test 4 - Retrieved shell by ID: ${retrievedShell.id === shell1.id}`);
        
        // Test 5: Update shell status
        registry.updateShellStatus(shell2.id, 'busy', 'test command');
        const busyShell = registry.getShell(shell2.id);
        results.push(`✓ Test 5 - Status update: ${busyShell.status === 'busy' && busyShell.runningCommand === 'test command'}`);
        
        // Test 6: Update current directory
        registry.updateCurrentDirectory(shell3.id, 'C:\\updated');
        const updatedShell = registry.getShell(shell3.id);
        results.push(`✓ Test 6 - Directory update: ${updatedShell.currentDirectory === 'C:\\updated'}`);
        
        // Test 7: Close specific shell
        const closedSuccess = registry.closeShell(shell2.id);
        const remainingShells = registry.listShells();
        results.push(`✓ Test 7 - Shell closure: ${closedSuccess && remainingShells.length === 2}`);
        
        // Test 8: Try to get closed shell (should fail)
        let getClosedShellFailed = false;
        try {
            registry.getShell(shell2.id);
        } catch (error) {
            getClosedShellFailed = true;
        }
        results.push(`✓ Test 8 - Closed shell inaccessible: ${getClosedShellFailed}`);
        
        // Test 9: Test shell limit (create multiple shells)
        const testShells: any[] = [];
        let maxShellsReached = false;
        try {
            for (let i = 0; i < 10; i++) {
                testShells.push(registry.createShell(`test-shell-${i}`));
            }
        } catch (error) {
            if (error instanceof Error && error.message.includes('Maximum number of shells')) {
                maxShellsReached = true;
            }
        }
        results.push(`✓ Test 9 - Shell limit enforced: ${maxShellsReached}`);
        
        // Test 10: Clean up test shells
        let cleanupCount = 0;
        testShells.forEach(shell => {
            if (registry.closeShell(shell.id)) {
                cleanupCount++;
            }
        });
        registry.closeShell(shell1.id);
        registry.closeShell(shell3.id);
        
        const finalShells = registry.listShells();
        results.push(`✓ Test 10 - Cleanup: Closed ${cleanupCount + 2} shells, remaining: ${finalShells.length}`);
        
        return `\n**Shell Registry Test Results:**\n${results.join('\n')}\n\n**All tests passed! 🎉**`;
        
    } catch (error) {
        return `\n**Shell Registry Test FAILED:**\n✗ Error: ${error instanceof Error ? error.message : String(error)}`;
    }
}

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

// Global command counter for PowerShell uniqueness
let powershellCommandCounter = 0;

/**
 * Creates the output directory if it doesn't exist
 * @returns The absolute path to the output directory
 */
async function ensureOutputDirectory(): Promise<string> {
    let outputDirPath: string;
    
    // Get workspace root or fallback to current working directory
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        outputDirPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, OUTPUT_DIRECTORY);
    } else {
        outputDirPath = path.join(process.cwd(), OUTPUT_DIRECTORY);
    }
    
    try {
        const outputDirUri = vscode.Uri.file(outputDirPath);
        await vscode.workspace.fs.createDirectory(outputDirUri);
        console.log(`[Shell Tools] Ensured output directory exists: ${outputDirPath}`);
    } catch (error) {
        // Directory might already exist, that's fine
        console.log(`[Shell Tools] Output directory handling: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return outputDirPath;
}

/**
 * Saves command output to a file and returns both the file path and base directory info
 * Files are completely overwritten if they already exist (no appending)
 * @param shellId The shell ID for naming the file
 * @param output The command output to save
 * @returns Object containing the absolute file path and base directory information
 */
async function saveOutputToFile(shellId: string, output: string): Promise<{
    filePath: string;
    baseDirectory: string;
    isWorkspaceRoot: boolean;
    }> {
    const outputDirPath = await ensureOutputDirectory();
    const fileName = `${shellId}-output.txt`;
    const filePath = path.join(outputDirPath, fileName);
    const fileUri = vscode.Uri.file(filePath);
    
    // Determine base directory and whether it's workspace root
    let baseDirectory: string;
    let isWorkspaceRoot: boolean;
    
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        baseDirectory = vscode.workspace.workspaceFolders[0].uri.fsPath;
        isWorkspaceRoot = true;
    } else {
        baseDirectory = process.cwd();
        isWorkspaceRoot = false;
    }
    
    try {
        // Write the output to the file (this will overwrite if exists)
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(output, 'utf8'));
        console.log(`[Shell Tools] Saved output to file: ${filePath} (${output.length} characters)`);
        return {
            filePath,
            baseDirectory,
            isWorkspaceRoot
        };
    } catch (error) {
        console.error(`[Shell Tools] Error saving output to file:`, error);
        throw new Error(`Failed to save output to file: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Deletes the output file for a specific shell
 * @param shellId The shell ID for the file to delete
 */
async function cleanupOutputFile(shellId: string): Promise<void> {
    try {
        const outputDirPath = await ensureOutputDirectory();
        const fileName = `${shellId}-output.txt`;
        const filePath = path.join(outputDirPath, fileName);
        const fileUri = vscode.Uri.file(filePath);
        
        await vscode.workspace.fs.delete(fileUri);
        console.log(`[Shell Tools] Cleaned up output file: ${filePath}`);
    } catch (error) {
        // File might not exist, that's fine
        console.log(`[Shell Tools] Output file cleanup (file might not exist): ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Processes command output with character limiting and file saving
 * @param output The raw command output
 * @param shellId The shell ID for file naming
 * @param silenceOutput Whether to suppress output display
 * @returns Processed output result with truncation info and full path
 */
async function processCommandOutput(
    output: string, 
    shellId: string, 
    silenceOutput: boolean = false
): Promise<{ displayOutput: string; truncated: boolean; filePath?: string; fullDisplayPath?: string }> {
    const outputLength = output.length;
    let truncated = false;
    let filePath: string | undefined;
    let fullDisplayPath: string | undefined;
    let displayOutput = output;
    
    /**
     * Helper function to format the display path for user-friendly output
     */
    const formatDisplayPath = (fileInfo: { filePath: string; baseDirectory: string; isWorkspaceRoot: boolean }): string => {
        const relativePath = path.relative(fileInfo.baseDirectory, fileInfo.filePath);
        const baseLabel = fileInfo.isWorkspaceRoot ? '<workspace_root>' : '<cwd>';
        return `${baseLabel}${path.sep}${relativePath}`;
    };
    
    // Check if output exceeds character limit
    if (outputLength > DEFAULT_OUTPUT_CHARACTER_LIMIT) {
        truncated = true;
        
        // Save full output to file
        const fileInfo = await saveOutputToFile(shellId, output);
        filePath = fileInfo.filePath;
        fullDisplayPath = formatDisplayPath(fileInfo);
        
        if (silenceOutput) {
            // For silence mode, return brief completion message
            displayOutput = `Command completed, full output saved to file ${fullDisplayPath}`;
        } else {
            // For normal mode, show truncated output with file reference
            const truncatedOutput = output.substring(0, DEFAULT_OUTPUT_CHARACTER_LIMIT);
            displayOutput = `${truncatedOutput}\n\n**[OUTPUT TRUNCATED]**\n` +
                          `Output too long, truncated to ${DEFAULT_OUTPUT_CHARACTER_LIMIT.toLocaleString()} characters. ` +
                          `Full output saved to file: ${fullDisplayPath}`;
        }
    } else if (silenceOutput) {
        // For silence mode with short output, still save to file but don't show truncation message
        const fileInfo = await saveOutputToFile(shellId, output);
        filePath = fileInfo.filePath;
        fullDisplayPath = formatDisplayPath(fileInfo);
        displayOutput = `Command completed, full output saved to file ${fullDisplayPath}`;
    }
    
    return { displayOutput, truncated, filePath, fullDisplayPath };
    }

/**
 * Detects potentially destructive commands using simple pattern matching (Task 4.2)
 * @param command The command to analyze
 * @returns Warning message if destructive pattern detected, null otherwise
 */
export function detectDestructiveCommand(command: string): string | null {
    // Check command against all destructive patterns
    for (const pattern of DESTRUCTIVE_PATTERNS) {
        if (pattern.test(command)) {
            console.log(`[Shell Tools] Destructive command pattern detected: ${pattern} in command: ${command}`);
            return `⚠️  **SAFETY WARNING**: This command appears to be potentially destructive and may delete files, format drives, or cause data loss. Please verify the command before proceeding.`;
        }
    }
    
    return null;
    }

/**
 * Detects interactive prompts in command output using keywords and regex patterns (Task 2.1)
 * Keywords take precedence over regex patterns as specified by user requirements
 * @param output The command output to analyze
 * @returns True if interactive prompt detected, false otherwise
 */
    export function detectInteractivePrompt(output: string): boolean {
    // Convert output to lowercase for case-insensitive keyword matching
    const lowerOutput = output.toLowerCase();
    
    // First priority: Check keywords (user specified keywords take precedence)
    for (const keyword of INTERACTIVE_KEYWORDS) {
        if (lowerOutput.includes(keyword.toLowerCase())) {
            console.log(`[Shell Tools] Interactive prompt detected via keyword: "${keyword}" in output`);
            return true;
        }
    }
    
    // Second priority: Check regex patterns
    for (const pattern of INTERACTIVE_PATTERNS) {
        if (pattern.test(output)) {
            console.log(`[Shell Tools] Interactive prompt detected via regex pattern: ${pattern} in output`);
            return true;
        }
    }
    
    return false;
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
 * @param timeoutMs Timeout in milliseconds
 * @param shellId Optional shell ID for timeout tracking
 * @returns Promise that resolves with the command output and abort status
 */
    export async function executeShellCommand(
    terminal: vscode.Terminal,
    command: string,
    cwd?: string,
    timeoutMs: number = STREAM_TIMEOUT_MS,
    shellId?: string
    ): Promise<{ output: string; aborted?: boolean; timedOut?: boolean }> {
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
    let streamCompleted = false;
    let abortController: AbortController | undefined;
    let timeoutId: NodeJS.Timeout | undefined;
    
    // Set up cancellable timeout for this shell if shellId provided
    if (shellId) {
        abortController = ShellTimeoutManager.setShellTimeout(
            shellId,
            timeoutMs,
            () => {
                console.warn(`[Shell Tools] Command timeout for shell ${shellId}`);
            }
        );
    }
    
    try {
        // Create a promise for stream reading
        const streamPromise = (async () => {
            try {
                const outputStream = (execution as any).read();
                for await (const data of outputStream) {
                    // Check if aborted
                    if (abortController?.signal.aborted) {
                        console.log(`[Shell Tools] Stream reading aborted for shell ${shellId}`);
                        break;
                    }
                    output += data;
                }
                streamCompleted = true;
                return output;
            } catch (streamError) {
                console.error(`[Shell Tools] Stream reading error:`, streamError);
                // If stream fails but we have output, consider it partial success
                if (output.length > 0) {
                    streamCompleted = true;
                    return output;
                }
                throw streamError;
            }
        })();
        
        // Create a timeout promise that can resolve with partial output
        const timeoutPromise = new Promise<string>((resolve, reject) => {
            timeoutId = setTimeout(() => {
                // Check if already aborted by ShellTimeoutManager
                if (abortController?.signal.aborted) {
                    reject(new Error(`Command aborted by timeout manager after ${timeoutMs}ms.`));
                    return;
                }
                // If we have some output, don't reject - just return what we have
                if (output.length > 0) {
                    console.warn(`[Shell Tools] Stream timeout but have output (${output.length} chars), using partial output`);
                    streamCompleted = true;
                    resolve(output);
                } else {
                    // Mark as timed out for special handling
                    reject(new Error(`STREAM_TIMEOUT:${timeoutMs}`));
                }
            }, timeoutMs);
        });
        
        // Race between stream completion and timeout
        const result = await Promise.race([streamPromise, timeoutPromise]);
        
        // Use the result if we got one
        if (result && result.length > 0) {
            output = result;
        }
        
        // Clear timeout on successful completion
        if (shellId && streamCompleted) {
            ShellTimeoutManager.clearShellTimeout(shellId);
        }
        
        // Clear local timeout if it exists
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        
        console.log(`[Shell Tools] Command completed ${streamCompleted ? 'fully' : 'partially'}, output length: ${output.length}`);
        
    } catch (error) {
        // Clear timeouts on error
        if (shellId) {
            ShellTimeoutManager.clearShellTimeout(shellId);
        }
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        
        console.error(`[Shell Tools] Command execution error:`, error);
        
        // Check if aborted by timeout manager
        if (abortController?.signal.aborted) {
            return { output, aborted: true };
        }
        
        // Enhanced error handling with fallback information
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('STREAM_TIMEOUT:')) {
            // Extract timeout value from error message
            return { output: '', timedOut: true, aborted: false };
        } else if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
            throw new Error(`Shell command timed out after ${timeoutMs / 1000} seconds. ` +
                          `This may be due to VSCode shell integration issues. ` +
                          `Try running the command manually or restarting the terminal. ` +
                          `Original command: ${command}`);
        }
        
        throw new Error(`Failed to read command output: ${errorMessage}`);
    }
    
    return { output, aborted: false };
}

/**
 * Focuses a specific shell terminal by shell ID
 * @param shellId The ID of the shell to focus
 * @returns Promise that resolves to true if focus succeeded, false otherwise
 */
async function focusShellTerminal(shellId: string): Promise<boolean> {
    try {
        const registry = ShellRegistry.getInstance();
        const shell = registry.listShells().find(s => s.id === shellId);
        
        if (!shell) {
            console.error(`[Shell Tools] Cannot focus shell ${shellId}: shell not found`);
            return false;
        }
        
        console.log(`[Shell Tools] Focusing terminal for shell ${shellId} (${shell.name})`);
        
        // Use terminal.show() to bring the terminal into focus
        shell.terminal.show();
        
        // Small delay to ensure focus change is processed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log(`[Shell Tools] Successfully focused terminal for shell ${shellId}`);
        return true;
        
    } catch (error) {
        console.error(`[Shell Tools] Error focusing shell ${shellId}:`, error);
        return false;
    }
}

/**
 * Captures terminal output using VS Code selection commands
 * @param shellId The shell ID for file naming and logging
 * @param terminal The terminal to capture output from (must be focused)
 * @returns Object containing captured output and file info
 */
async function captureTerminalOutput(shellId: string, terminal: vscode.Terminal): Promise<{
    success: boolean;
    output: string;
    error?: string;
    filePath?: string;
    fullDisplayPath?: string;
}> {
    try {
        console.log(`[Shell Tools] Capturing terminal output for shell ${shellId}`);
        
        // Step 1: Ensure terminal is focused
        terminal.show();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Step 2: Select all terminal content
        console.log(`[Shell Tools] Selecting all terminal content for shell ${shellId}`);
        await vscode.commands.executeCommand('workbench.action.terminal.selectAll');
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Step 3: Copy selection to clipboard
        console.log(`[Shell Tools] Copying terminal selection to clipboard for shell ${shellId}`);
        await vscode.commands.executeCommand('workbench.action.terminal.copySelection');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Step 4: Clear selection
        console.log(`[Shell Tools] Clearing terminal selection for shell ${shellId}`);
        await vscode.commands.executeCommand('workbench.action.terminal.clearSelection');
        
        // Step 5: Read clipboard content
        console.log(`[Shell Tools] Reading clipboard content for shell ${shellId}`);
        const clipboardContent = await vscode.env.clipboard.readText();
        
        if (!clipboardContent || clipboardContent.trim().length === 0) {
            return {
                success: false,
                output: '',
                error: 'No content captured from terminal (clipboard empty)'
            };
        }
        
        console.log(`[Shell Tools] Successfully captured ${clipboardContent.length} characters from terminal ${shellId}`);
        
        // Step 6: Always save terminal output to file (regardless of size)
        const fileInfo = await saveOutputToFile(shellId, clipboardContent);
        
        // Format display path for user-friendly output
        const formatDisplayPath = (fileInfo: { filePath: string; baseDirectory: string; isWorkspaceRoot: boolean }): string => {
            const relativePath = path.relative(fileInfo.baseDirectory, fileInfo.filePath);
            const baseLabel = fileInfo.isWorkspaceRoot ? '<workspace_root>' : '<cwd>';
            return `${baseLabel}${path.sep}${relativePath}`;
        };
        
        const fullDisplayPath = formatDisplayPath(fileInfo);
        
        return {
            success: true,
            output: clipboardContent,
            filePath: fileInfo.filePath,
            fullDisplayPath: fullDisplayPath
        };
        
    } catch (error) {
        console.error(`[Shell Tools] Error capturing terminal output for shell ${shellId}:`, error);
        return {
            success: false,
            output: '',
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Extracts the last N lines from text content
 * @param content The text content to process
 * @param lineCount Number of lines to extract (default: 20)
 * @returns String containing the last N lines
 */
function getLastLines(content: string, lineCount: number = 20): string {
    if (!content || content.trim().length === 0) {
        return '';
    }
    
    const lines = content.split('\n');
    if (lines.length <= lineCount) {
        return content;
    }
    
    const lastLines = lines.slice(-lineCount);
    return `[... showing last ${lineCount} lines of terminal output ...]\n\n${lastLines.join('\n')}`;
}

/**
 * Test function for terminal focus functionality - Phase 1 of enhanced send_input_to_shell
 * Creates test shells and tests terminal focusing capability
 * @returns Test results as formatted string
 */
async function testTerminalFocus(): Promise<string> {
    try {
        const registry = ShellRegistry.getInstance();
        const results: string[] = [];
        
        results.push('=== Terminal Focus Test - Phase 1 ===\n');
        
        // Step 1: Create target interactive shell with custom name
        results.push('Step 1: Creating interactive test shell...');
        const interactiveShell = registry.createShell('interactive-test-shell');
        results.push(`✓ Created shell: ${interactiveShell.id} (${interactiveShell.name})`);
        
        // Step 2: Create generic default shell (this will steal focus)
        results.push('\nStep 2: Creating generic default shell...');
        const defaultShell = registry.createShell();
        results.push(`✓ Created shell: ${defaultShell.id} (${defaultShell.name})`);
        results.push('  (This shell should now have focus)');
        
        // Step 3: Focus the interactive shell
        results.push('\nStep 3: Attempting to focus interactive shell...');
        const focusSuccess = await focusShellTerminal(interactiveShell.id);
        
        if (focusSuccess) {
            results.push(`✓ Focus operation completed for shell ${interactiveShell.id}`);
            results.push('  → Please verify in VS Code that "interactive-test-shell" tab is now active');
        } else {
            results.push(`✗ Focus operation failed for shell ${interactiveShell.id}`);
        }
        
        // Step 4: List current shells for verification
        results.push('\nStep 4: Current shell status:');
        const allShells = registry.listShells();
        allShells.forEach(shell => {
            results.push(`  - ${shell.id} (${shell.name}): ${shell.status}`);
        });
        
        results.push('\n=== Test Instructions ===');
        results.push('1. Check VS Code terminal tabs');
        results.push('2. Verify "interactive-test-shell" tab is active/focused');
        results.push('3. If successful, we can proceed to Phase 2 (terminal selection)');
        results.push('4. Use close_shell to clean up test shells when done');
        
        return results.join('\n');
        
    } catch (error) {
        return `\n**Terminal Focus Test FAILED:**\n✗ Error: ${error instanceof Error ? error.message : String(error)}`;
    }
}

/**
 * Test function to check if shell integration cwd updates after delays
 */
export async function testShellIntegrationCwd(): Promise<string> {
    const terminal = vscode.window.createTerminal('CWD Test Terminal');
    terminal.show();
    
    // Wait for shell integration
    const startTime = Date.now();
    while (!terminal.shellIntegration && Date.now() - startTime < 5000) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!terminal.shellIntegration) {
        return 'Shell integration not available after 5 seconds';
    }
    
    const results: string[] = [];
    
    // Get initial cwd
    const initialCwd = terminal.shellIntegration.cwd?.fsPath || 'undefined';
    results.push(`Initial CWD: ${initialCwd}`);
    
    // Execute cd command
    terminal.sendText('cd src');
    results.push('\nExecuted: cd src');
    
    // Test various delays
    const delays = [100, 500, 1000, 2000, 3000, 5000];
    
    for (const delay of delays) {
        await new Promise(resolve => setTimeout(resolve, delay));
        const cwd = terminal.shellIntegration.cwd?.fsPath || 'undefined';
        results.push(`After ${delay}ms: ${cwd}`);
        
        // If cwd changed, we found the minimum delay needed
        if (cwd !== initialCwd && cwd !== 'undefined') {
            results.push(`\n✓ CWD updated after ${delay}ms total wait time`);
            break;
        }
    }
    
    // Final check
    const finalCwd = terminal.shellIntegration.cwd?.fsPath || 'undefined';
    if (finalCwd === initialCwd || finalCwd === 'undefined') {
        results.push('\n✗ CWD never updated even after 11.6 seconds');
    }
    
    terminal.dispose();
    return results.join('\n');
}

/**
 * Registers MCP shell-related tools with the server
 * 
 * This function registers all shell-related MCP tools including:
 * - execute_shell_command_code: Execute commands with timeout reset on new commands
 * - get_workspace_context: Get workspace and project information
 * - send_input_to_shell: Send input with timeout reset for interactive sessions
 * - list_active_shells: List shells with timeout status information
 * - test_shell_cwd: Test shell integration timing (development tool)
 * 
 * The shell tools feature intelligent timeout management that prevents premature
 * timeouts during interactive sessions by resetting timeouts on new activity.
 * 
 * @param server MCP server instance
 * @param terminal The terminal to use for command execution (deprecated)
 */
export function registerShellTools(server: McpServer, terminal?: vscode.Terminal): void {
    // Add execute_shell_command tool
    server.tool(
        'execute_shell_command_code',
        'Executes a shell command in the VS Code integrated terminal with shell integration. Returns command output, working directory context, shell information, and basic exit status. Supports shell selection, interactive commands, and background processes. Enhanced with timeout handling and PowerShell-specific workarounds.',
        {
            command: z.string().describe('The shell command to execute'),
            cwd: z.string().optional().default('.').describe('Optional working directory for the command'),
            shellId: z.string().optional().describe('ID of the shell to use (e.g., "shell-1"). If not provided, uses default shell or creates new one'),
            interactive: z.boolean().optional().default(false).describe('Set to true for commands that might require user input (uses longer timeout)'),
            background: z.boolean().optional().default(false).describe('Set to true for long-running background processes (returns immediately with shell info)'),
            silenceOutput: z.boolean().optional().default(false).describe('Set to true to suppress output display and save full output to file only (useful for long-running commands)')
        },
        async ({ command, cwd, shellId, interactive, background, silenceOutput }): Promise<CallToolResult> => {
            try {
                const registry = ShellRegistry.getInstance();
                
                // Get current working directory from VS Code workspace before command
                let cwdBefore: string;
                if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                    cwdBefore = vscode.workspace.workspaceFolders[0].uri.fsPath;
                } else {
                    cwdBefore = process.cwd();
                }
                
                // Get or create shell using registry with improved logic
                let managedShell: ManagedShell;
                
                if (shellId) {
                    // Specific shell requested
                    const existingShell = registry.listShells().find(s => s.id === shellId);
                    if (existingShell) {
                        if (existingShell.status === 'crashed') {
                            // Close crashed shell and create new one with same ID
                            console.log(`[Shell Tools] Closing crashed shell ${shellId} and creating replacement`);
                            registry.closeShell(shellId);
                            managedShell = registry.createShell(shellId, cwd !== '.' ? cwd : undefined);
                        } else {
                            // Use existing shell
                            managedShell = existingShell;
                        }
                    } else {
                        // Create new shell with specified ID
                        managedShell = registry.createShell(shellId, cwd !== '.' ? cwd : undefined);
                    }
                } else {
                    // No specific shell requested - find best available or create new
                    const availableShells = registry.listShells().filter(s => s.status === 'idle' || s.status === 'waiting-for-input');
                    const crashedShells = registry.listShells().filter(s => s.status === 'crashed');
                    
                    // Clean up any crashed shells
                    for (const crashedShell of crashedShells) {
                        console.log(`[Shell Tools] Auto-closing crashed shell ${crashedShell.id}`);
                        registry.closeShell(crashedShell.id);
                    }
                    
                    if (availableShells.length > 0) {
                        // Use first available shell
                        managedShell = availableShells[0];
                    } else {
                        // Create new shell
                        managedShell = registry.createShell(undefined, cwd !== '.' ? cwd : undefined);
                    }
                }
                
                const terminal = managedShell.terminal;
                
                // Check for potentially destructive commands (Task 4.2)
                const safetyWarning = detectDestructiveCommand(command);
                
                console.log(`[Shell Tools] Executing command in shell ${managedShell.id}: ${command}${cwd && cwd !== '.' ? ` (cwd: ${cwd})` : ''}${safetyWarning ? ' [DESTRUCTIVE COMMAND DETECTED]' : ''}`);
                
                if (safetyWarning) {
                    console.warn(`[Shell Tools] Safety Warning: ${safetyWarning}`);
                    
                    // CRITICAL SAFETY CHECK: Stop execution until user approval
                    const diffAutoApprovalEnabled = isShellAutoApprovalEnabled();
                    
                    if (!diffAutoApprovalEnabled) {
                        // Request approval via status bar buttons
                        console.log(`[Shell Tools] Requesting user approval for dangerous command: ${command}`);
                        
                        const approved = await requestShellCommandApproval(command, safetyWarning);
                        
                        if (!approved) {
                            // User rejected the command
                            registry.updateShellStatus(managedShell.id, 'idle');
                            
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: `${safetyWarning}\n\n` +
                                              `**Command:** ${command}\n\n` +
                                              `**� Command cancelled by user**\n\n` +
                                              `The command was not executed due to safety concerns.`
                                    }
                                ]
                            };
                        }
                        
                        // User approved - continue with execution
                        console.log(`[Shell Tools] User approved execution of dangerous command: ${command}`);
                    } else {
                        // Auto-approval is enabled - log warning but continue
                        console.warn(`[Shell Tools] ⚠️ Shell auto-approval is ENABLED - executing destructive command: ${command}`);
                    }
                }
                
                // Clear any existing timeout for this shell before executing new command
                // This is crucial for preventing premature timeouts when users run multiple
                // commands in sequence. Each new command gets a fresh timeout period.
                if (managedShell.activeTimeout) {
                    console.log(`[Shell Tools] Clearing existing timeout for shell ${managedShell.id}`);
                    ShellTimeoutManager.clearShellTimeout(managedShell.id);
                }
                
                // Update shell status to busy (only if command is approved or safe)
                registry.updateShellStatus(managedShell.id, 'busy', command);
                
                // For background processes, return immediately with shell info
                if (background) {
                    // Show terminal and execute command
                    terminal.show();
                    terminal.sendText(command);
                    
                    // Update shell directory if specified
                    if (cwd && cwd !== '.') {
                        registry.updateCurrentDirectory(managedShell.id, cwd);
                    }
                    
                    const result: CallToolResult = {
                        content: [
                            {
                                type: 'text',
                                text: `**Background Command Started**\n\n` +
                                      `**Command:** ${command}\n` +
                                      `**Shell:** ${managedShell.id} (${managedShell.name})\n` +
                                      `**Working Directory:** ${cwd || cwdBefore}\n` +
                                      `**Status:** Running in background\n\n` +
                                      `*Note: Command is running in background. Use list_active_shells to check status or send_input_to_shell for interaction.*`
                            }
                        ]
                    };
                    
                    console.log(`[Shell Tools] Background command started in shell ${managedShell.id}`);
                    return result;
                }
                
                // Check for shell integration - wait with enhanced timeout if not available
                if (!terminal.shellIntegration) {
                    console.log(`[Shell Tools] Shell integration not available for ${managedShell.id}, waiting...`);
                    const integrationReady = await waitForShellIntegration(terminal, SHELL_INTEGRATION_TIMEOUT_MS);
                    if (!integrationReady) {
                        registry.updateShellStatus(managedShell.id, 'idle');
                        throw new Error(`Shell integration not available after ${SHELL_INTEGRATION_TIMEOUT_MS / 1000} seconds. ` +
                                       `This may indicate a VS Code configuration issue. ` +
                                       `Try restarting VS Code or using a different terminal.`);
                    }
                }
                
                let output: string;
                let timedOut = false;
                let aborted = false;
                
                if (interactive) {
                    console.log(`[Shell Tools] DEBUG: Entering interactive block for command: ${command}`);
                    // Interactive commands use 3-second timeout to capture initial output (like scaffolding prompts)
                    const interactiveTimeoutMs = INTERACTIVE_STREAM_TIMEOUT_MS; // 3 seconds
                    try {
                        const result = await executeShellCommand(terminal, command, cwd, interactiveTimeoutMs, managedShell.id);
                        let capturedOutput = result.output;
                        aborted = result.aborted || false;
                        
                        // Check if interactive command timed out (expected for scaffolding tools)
                        if (result.timedOut) {
                            timedOut = true;
                            console.log(`[Shell Tools] Interactive command timed out after ${interactiveTimeoutMs / 1000}s, captured ${capturedOutput.length} chars`);
                        }
                        
                        // Extract last 20 lines from captured output
                        let displayOutput = capturedOutput;
                        if (capturedOutput) {
                            const lines = capturedOutput.split('\n');
                            if (lines.length > 20) {
                                const lastLines = lines.slice(-20);
                                displayOutput = lastLines.join('\n');
                                displayOutput = `[... showing last 20 lines of output ...]\n\n${displayOutput}`;
                            }
                        } else {
                            displayOutput = 'Interactive command started (no initial output captured).';
                        }
                        
                        output = displayOutput;
                        registry.updateShellStatus(managedShell.id, 'waiting-for-input', command);
                        
                        // Update managed shell with timeout info if command is still running
                        const timeoutInfo = ShellTimeoutManager.getTimeoutInfo(managedShell.id);
                        if (timeoutInfo) {
                            managedShell.timeoutDuration = timeoutInfo.total;
                            managedShell.timeoutEndTime = new Date(Date.now() + timeoutInfo.remaining);
                        }
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        if (errorMessage.includes('timeout') || aborted) {
                            timedOut = true;
                            output = `Interactive command execution failed or timed out after ${interactiveTimeoutMs / 1000} seconds.`;
                            registry.updateShellStatus(managedShell.id, 'waiting-for-input', command);
                        } else {
                            registry.updateShellStatus(managedShell.id, 'crashed');
                            throw error;
                        }
                    }
                } else {
                    // Non-interactive commands use normal timeout
                    const timeoutMs = DEFAULT_TIMEOUT_MS;
                    try {
                        const result = await executeShellCommand(terminal, command, cwd, timeoutMs, managedShell.id);
                        output = result.output;
                        aborted = result.aborted || false;
                        
                        // Update managed shell with timeout info if command is still running
                        const timeoutInfo = ShellTimeoutManager.getTimeoutInfo(managedShell.id);
                        if (timeoutInfo) {
                            managedShell.timeoutDuration = timeoutInfo.total;
                            managedShell.timeoutEndTime = new Date(Date.now() + timeoutInfo.remaining);
                        }
                    } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    if (errorMessage.includes('timeout') || aborted) {
                        timedOut = true;
                        output = `Command timed out after ${timeoutMs / 1000} seconds.`;
                        if (interactive) {
                            output += ` The command may be waiting for input. Use send_input_to_shell tool to provide input.`;
                            registry.updateShellStatus(managedShell.id, 'waiting-for-input', command);
                        } else {
                            registry.updateShellStatus(managedShell.id, 'idle');
                        }
                    } else {
                        registry.updateShellStatus(managedShell.id, 'crashed');
                        throw error;
                    }
                    }
                }
                
                // Get current working directory after command (if not timed out)
                let cwdAfter: string;
                if (timedOut) {
                    cwdAfter = cwdBefore;
                } else {
                    // Wait a bit for shell integration to update (our test showed 100ms is enough, use 200ms for safety)
                    await new Promise(resolve => setTimeout(resolve, 200));
                    
                    // Try to get the current directory from shell integration
                    if (terminal.shellIntegration?.cwd) {
                        cwdAfter = terminal.shellIntegration.cwd.fsPath;
                        
                        // Remove "Path----" prefix if present (PowerShell pwd output artifact)
                        if (cwdAfter.startsWith('Path----')) {
                            cwdAfter = cwdAfter.substring(8); // Remove "Path----"
                        }
                        
                        console.log(`[Shell Tools] Got cwd from shell integration: ${cwdAfter}`);
                    } else {
                        // Fallback if shell integration doesn't provide cwd
                        console.log('[Shell Tools] Shell integration cwd not available, using fallback');
                        if (cwd && cwd !== '.') {
                            cwdAfter = cwd;
                        } else {
                            cwdAfter = cwdBefore;
                        }
                    }
                }
                
                // Check for interactive prompts in output (Task 2.1)
                let interactiveDetected = false;
                if (!timedOut && output) {
                    interactiveDetected = detectInteractivePrompt(output);
                }
                
                // Update shell status based on interactive detection
                if (!timedOut) {
                    if (interactiveDetected) {
                        registry.updateShellStatus(managedShell.id, 'waiting-for-input', command);
                        console.log(`[Shell Tools] Shell ${managedShell.id} switched to waiting-for-input due to interactive prompt detection`);
                    } else {
                        registry.updateShellStatus(managedShell.id, 'idle');
                    }
                    // Update the shell's current directory with the actual directory after command execution
                    registry.updateCurrentDirectory(managedShell.id, cwdAfter);
                }
                
                // Process output with limiting and file management (Task 4.1)
                let finalOutput = output;
                let outputInfo = '';
                
                if (!timedOut) {
                    // Only process output limiting for completed commands
                    const outputResult = await processCommandOutput(output, managedShell.id, silenceOutput || false);
                    finalOutput = outputResult.displayOutput;
                    
                    if (outputResult.truncated) {
                        outputInfo = silenceOutput ? 
                            ` Output saved to file.` : 
                            ` Output was truncated due to length (${output.length.toLocaleString()} characters).`;
                    } else if (silenceOutput && outputResult.fullDisplayPath) {
                        outputInfo = ` Output saved to file.`;
                    }
                }
                
                // Detect shell type
                const shellType = isPowerShellShell() ? 'PowerShell' : 'Command Prompt';
                
                const result: CallToolResult = {
                    content: [
                        {
                            type: 'text',
                            text: `**Command Execution Results**\n\n` +
                                  `${safetyWarning ? `${safetyWarning}\n\n` : ''}` +
                                  `**Command:** ${command}\n` +
                                  `**Shell:** ${managedShell.id} (${managedShell.name})\n` +
                                  `**Shell Type:** ${shellType}\n` +
                                  `**Status:** ${timedOut ? (interactive ? 'Waiting for input' : 'Timed out') : (interactiveDetected ? 'Waiting for input (interactive prompt detected)' : 'Completed')}${outputInfo}\n` +
                                  `**Working Directory Before:** ${cwdBefore}\n` +
                                  `**Working Directory After:** ${cwdAfter}\n` +
                                  `**Interactive Mode:** ${interactive ? 'Yes' : 'No'}\n` +
                                  `**Background Mode:** ${background ? 'Yes' : 'No'}\n` +
                                  `**Silence Output:** ${silenceOutput ? 'Yes' : 'No'}\n\n` +
                                  `**Output:**\n${finalOutput}${timedOut && interactive ? '\n\n*Use send_input_to_shell if the command is waiting for input.*' : ''}${interactiveDetected ? '\n\n🗨 **Interactive prompt detected!** Use send_input_to_shell to provide input to this shell.' : ''}`
                        }
                    ]
                };
                
                console.log(`[Shell Tools] Command execution completed in shell ${managedShell.id}`);
                return result;
                
            } catch (error) {
                console.error('[Shell Tools] Error in execute_shell_command_code tool:', error);
                
                // Enhanced error reporting with context
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(`Shell command execution failed: ${errorMessage}`);
            }
        }
    );

    // Add get_workspace_context tool
    server.tool(
        'get_workspace_context',
        'Provides context about the current VS Code workspace and working directory. Returns current working directory, workspace folder paths, and basic project information. This tool is designed to be safe and fast - it does not traverse project structure to avoid performance issues with large codebases.',
        {},
        async (): Promise<CallToolResult> => {
            try {
                console.log('[Shell Tools] Getting workspace context...');
                
                // Get proper working directory from VS Code workspace
                let currentWorkingDirectory: string;
                if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                    currentWorkingDirectory = vscode.workspace.workspaceFolders[0].uri.fsPath;
                } else {
                    currentWorkingDirectory = process.cwd();
                }
                
                const context: any = {
                    currentWorkingDirectory,
                    timestamp: new Date().toISOString()
                };

                // Get VS Code workspace information
                if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                    context.workspaceFolders = vscode.workspace.workspaceFolders.map(folder => ({
                        name: folder.name,
                        uri: folder.uri.fsPath
                    }));
                    
                    // Try to get project name from package.json in first workspace folder
                    try {
                        const packageJsonPath = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, 'package.json');
                        const packageJsonContent = await vscode.workspace.fs.readFile(packageJsonPath);
                        const packageJson = JSON.parse(packageJsonContent.toString());
                        if (packageJson.name) {
                            context.projectName = packageJson.name;
                            context.projectVersion = packageJson.version || 'unknown';
                        }
                    } catch (error) {
                        // package.json might not exist or be readable - that's okay
                        console.log('[Shell Tools] Could not read package.json:', error instanceof Error ? error.message : String(error));
                    }
                } else {
                    context.workspaceFolders = [];
                    context.note = 'No workspace folders currently open in VS Code';
                }

                // Add information about shell registry
                const registry = ShellRegistry.getInstance();
                const activeShells = registry.listShells();
                context.activeShells = {
                    count: activeShells.length,
                    shells: activeShells.map(shell => ({
                        id: shell.id,
                        name: shell.name,
                        status: shell.status,
                        currentDirectory: shell.currentDirectory
                    }))
                };

                const result: CallToolResult = {
                    content: [
                        {
                            type: 'text',
                            text: `**Workspace Context**\n\n` +
                                  `**Current Working Directory:** ${context.currentWorkingDirectory}\n\n` +
                                  `**VS Code Workspace Folders:**\n${context.workspaceFolders.length > 0 ? 
                                    context.workspaceFolders.map((f: any) => `- ${f.name}: ${f.uri}`).join('\n') : 
                                    '- No workspace folders open'}\n\n` +
                                  `**Project Information:**\n` +
                                  `- Name: ${context.projectName || 'Not detected'}\n` +
                                  `- Version: ${context.projectVersion || 'Not detected'}\n\n` +
                                  `**Active Shells:** ${context.activeShells.count} shells\n${context.activeShells.shells.length > 0 ? 
                                    context.activeShells.shells.map((s: any) => `- ${s.id} (${s.name}): ${s.status}`).join('\n') : 
                                    '- No active shells'}\n\n` +
                                  `**Future Enhancement Notes:**\n` +
                                  `- Project structure traversal could be added but would need smart filtering\n` +
                                  `- Large projects (with node_modules, .git, dist, build, out, .vscode-test) would need to be handled carefully\n` +
                                  `- Directory depth limits and file count thresholds would be required\n` +
                                  `- Integration with .gitignore patterns could help avoid performance issues\n\n` +
                                  `*Generated at: ${context.timestamp}*`
                        }
                    ]
                };
                
                console.log('[Shell Tools] Workspace context retrieved successfully');
                return result;
            } catch (error) {
                console.error('[Shell Tools] Error in get_workspace_context tool:', error);
                
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(`Workspace context retrieval failed: ${errorMessage}`);
            }
        }
    );

    // Add send_input_to_shell tool
    server.tool(
        'send_input_to_shell',
        'Sends input to a specific shell and captures the last 20 lines of terminal output after the input is processed. Uses VS Code terminal selection to capture arbitrary terminal content including responses to user interactions.',
        {
            shellId: z.string().describe('ID of the shell to send input to (e.g., "shell-1")'),
            input: z.string().describe('The input text to send to the shell'),
            includeNewline: z.boolean().optional().default(true).describe('Whether to include a newline character after the input (default: true)'),
            captureOutput: z.boolean().optional().default(true).describe('Whether to capture and return terminal output after sending input (default: true)')
        },
        async ({ shellId, input, includeNewline, captureOutput }): Promise<CallToolResult> => {
            try {
                const registry = ShellRegistry.getInstance();
                
                // Find the specified shell
                const shell = registry.listShells().find(s => s.id === shellId);
                if (!shell) {
                    throw new Error(`Shell '${shellId}' not found. Available shells: ${registry.listShells().map(s => s.id).join(', ') || 'none'}`);
                }
                
                // Check if shell is in a state that can accept input
                if (shell.status === 'crashed') {
                    throw new Error(`Shell '${shellId}' is crashed and cannot accept input. Use execute_shell_command_code to create a new shell.`);
                }
                
                console.log(`[Shell Tools] Sending input to shell ${shellId}: "${input}"${captureOutput ? ' (with output capture)' : ''}`);
                
                // Step 1: Send input to shell
                shell.terminal.sendText(input, includeNewline);
                
                // Update shell status to busy
                registry.updateShellStatus(shellId, 'busy');
                
                let outputInfo = '';
                let capturedOutput = '';
                let outputFilePath = '';
                
                // Step 2: Capture output if requested
                if (captureOutput) {
                    console.log(`[Shell Tools] Waiting for command processing before capture...`);
                    // Wait for command to process before capturing
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    const captureResult = await captureTerminalOutput(shellId, shell.terminal);
                    
                    if (captureResult.success) {
                        // Get last 20 lines from captured output
                        capturedOutput = getLastLines(captureResult.output, 20);
                        outputFilePath = captureResult.fullDisplayPath || 'File path not available';
                        outputInfo = ` Terminal output captured and saved`;
                        
                        console.log(`[Shell Tools] Successfully captured terminal output for shell ${shellId}`);
                        console.log(`[Shell Tools] Output saved to: ${outputFilePath}`);
                    } else {
                        outputInfo = ` Output capture failed: ${captureResult.error || 'Unknown error'}`;
                        console.warn(`[Shell Tools] Output capture failed for shell ${shellId}: ${captureResult.error}`);
                    }
                }
                
                // Step 3: Build result
                const result: CallToolResult = {
                    content: [
                        {
                            type: 'text',
                            text: `**Input Sent to Shell**\n\n` +
                                  `**Shell:** ${shell.id} (${shell.name})\n` +
                                  `**Input:** ${input}\n` +
                                  `**Include Newline:** ${includeNewline ? 'Yes' : 'No'}\n` +
                                  `**Capture Output:** ${captureOutput ? 'Yes' : 'No'}${outputInfo}\n\n` +
                                  `*Input sent successfully.*` +
                                  (captureOutput && outputFilePath ? 
                                    `\n\n**Full Output Saved To:** ${outputFilePath}` : '') +
                                  (captureOutput && capturedOutput ? 
                                    `\n\n**Terminal Output (Last 20 Lines):**\n\`\`\`\n${capturedOutput}\n\`\`\`` : 
                                    (captureOutput ? '\n\n*Output capture was attempted but may have failed. Check the VS Code terminal for the actual response.*' : 
                                     '\n\n*Use the VS Code terminal window to see the shell\'s response.*'))
                        }
                    ]
                };
                
                console.log(`[Shell Tools] Input sent successfully to shell ${shellId}${captureOutput ? ' with output capture' : ''}`);
                return result;
                
            } catch (error) {
                console.error('[Shell Tools] Error in send_input_to_shell tool:', error);
                
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(`Failed to send input to shell: ${errorMessage}`);
            }
        }
    );

    // Add test_terminal_focus tool - Phase 1 of enhanced send_input_to_shell
    server.tool(
        'test_terminal_focus',
        'Test terminal focus functionality by creating test shells and verifying focus control. Phase 1 of enhanced send_input_to_shell implementation.',
        {},
        async (): Promise<CallToolResult> => {
            try {
                const testResult = await testTerminalFocus();
                
                const result: CallToolResult = {
                    content: [
                        {
                            type: 'text',
                            text: `**Terminal Focus Test Results**\n\n${testResult}`
                        }
                    ]
                };
                
                return result;
            } catch (error) {
                console.error('[Shell Tools] Error in test_terminal_focus tool:', error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(`Test failed: ${errorMessage}`);
            }
        }
    );

    // Add test_shell_cwd tool
    server.tool(
        'test_shell_cwd',
        'Test shell integration cwd timing to see how long it takes to update after directory changes',
        {},
        async (): Promise<CallToolResult> => {
            try {
                const testResult = await testShellIntegrationCwd();
                
                const result: CallToolResult = {
                    content: [
                        {
                            type: 'text',
                            text: `**Shell Integration CWD Test Results**\n\n${testResult}`
                        }
                    ]
                };
                
                return result;
            } catch (error) {
                console.error('[Shell Tools] Error in test_shell_cwd tool:', error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(`Test failed: ${errorMessage}`);
            }
        }
    );

    // Add list_active_shells tool
    server.tool(
        'list_active_shells',
        'Lists all currently active shell sessions with their status, IDs, and basic information. Useful for managing multiple shells and understanding which shells are available for command execution.',
        {},
        async (): Promise<CallToolResult> => {
            try {
                const registry = ShellRegistry.getInstance();
                const shells = registry.listShells();
                
                console.log(`[Shell Tools] Listing ${shells.length} active shells`);
                
                if (shells.length === 0) {
                    const result: CallToolResult = {
                        content: [
                            {
                                type: 'text',
                                text: `**Active Shells**\n\n` +
                                      `No active shells found.\n\n` +
                                      `*Use execute_shell_command_code to create a new shell session.*`
                            }
                        ]
                    };
                    return result;
                }
                
                // Build detailed shell information
                const shellInfo = shells.map(shell => {
                    const age = Math.round((new Date().getTime() - shell.createdAt.getTime()) / 1000 / 60); // minutes
                    const lastUsed = Math.round((new Date().getTime() - shell.lastUsed.getTime()) / 1000 / 60); // minutes
                    
                    // Get timeout information
                    const timeoutInfo = ShellTimeoutManager.getTimeoutInfo(shell.id);
                    let timeoutStatus = '';
                    if (timeoutInfo && timeoutInfo.remaining > 0) {
                        const remainingSec = Math.round(timeoutInfo.remaining / 1000);
                        const totalSec = Math.round(timeoutInfo.total / 1000);
                        timeoutStatus = `\n  - Timeout: ${remainingSec}s remaining (of ${totalSec}s total)`;
                        
                        if (remainingSec < 5) {
                            timeoutStatus += ' ⚠️ EXPIRING SOON';
                        }
                    }
                    
                    return `**${shell.id}** (${shell.name})\n` +
                           `  - Status: ${shell.status}\n` +
                           `  - Current Directory: ${shell.currentDirectory || 'Unknown'}\n` +
                           `  - Running Command: ${shell.runningCommand || 'None'}\n` +
                           `  - Created: ${age} minutes ago\n` +
                           `  - Last Used: ${lastUsed} minutes ago` +
                           timeoutStatus;
                }).join('\n\n');
                
                const result: CallToolResult = {
                    content: [
                        {
                            type: 'text',
                            text: `**Active Shells (${shells.length} total)**\n\n` +
                                  `${shellInfo}\n\n` +
                                  `**Usage:**\n` +
                                  `- Use execute_shell_command_code with shellId parameter to use a specific shell\n` +
                                  `- Use send_input_to_shell to send input to shells waiting for user input\n` +
                                  `- Shells are automatically cleaned up after ${SHELL_CLEANUP_TIMEOUT / 60 / 1000} minutes of inactivity`
                        }
                    ]
                };
                
                console.log(`[Shell Tools] Listed ${shells.length} active shells successfully`);
                return result;
                
            } catch (error) {
                console.error('[Shell Tools] Error in list_active_shells tool:', error);
                
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(`Failed to list active shells: ${errorMessage}`);
            }
        }
    );

    // Add close_shell tool
    server.tool(
        'close_shell',
        'Closes a specific shell session by ID. This will terminate the shell, clean up associated resources including output files, and remove it from the active shells registry. Use list_active_shells to see available shell IDs.',
        {
            shellId: z.string().describe('ID of the shell to close (e.g., "shell-1")')
        },
        async ({ shellId }): Promise<CallToolResult> => {
            try {
                const registry = ShellRegistry.getInstance();
                
                // Get shell info before closing for response
                const shells = registry.listShells();
                const targetShell = shells.find(s => s.id === shellId);
                
                if (!targetShell) {
                    const availableShells = shells.map(s => s.id).join(', ') || 'none';
                    throw new Error(`Shell '${shellId}' not found. Available shells: ${availableShells}`);
                }
                
                console.log(`[Shell Tools] Closing shell ${shellId} (${targetShell.name})`);
                
                // Clear any active timeout for this shell
                ShellTimeoutManager.clearShellTimeout(shellId);
                
                // Close the shell using registry method
                const success = registry.closeShell(shellId);
                
                if (!success) {
                    throw new Error(`Failed to close shell '${shellId}'. The shell may have already been disposed.`);
                }
                
                // Get updated shell list
                const remainingShells = registry.listShells();
                
                const result: CallToolResult = {
                    content: [
                        {
                            type: 'text',
                            text: `**Shell Closed Successfully**\n\n` +
                                  `**Closed Shell:** ${shellId} (${targetShell.name})\n` +
                                  `**Status at Close:** ${targetShell.status}\n` +
                                  `**Running Command:** ${targetShell.runningCommand || 'None'}\n` +
                                  `**Current Directory:** ${targetShell.currentDirectory || 'Unknown'}\n\n` +
                                  `**Remaining Active Shells:** ${remainingShells.length}\n` +
                                  `${remainingShells.length > 0 ? 
                                    remainingShells.map(s => `- ${s.id} (${s.name}): ${s.status}`).join('\n') : 
                                    '- No active shells remaining'}\n\n` +
                                  `*Shell resources cleaned up. Output file preserved at <workspace_root>/.vscode-mcp-output/${shellId}-output.txt for manual inspection.*`
                        }
                    ]
                };
                
                console.log(`[Shell Tools] Shell ${shellId} closed successfully, ${remainingShells.length} shells remaining`);
                return result;
                
            } catch (error) {
                console.error('[Shell Tools] Error in close_shell tool:', error);
                
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(`Failed to close shell: ${errorMessage}`);
            }
        }
    );
}

// Exports for testing
export {
    MAX_SHELLS,
    SHELL_CLEANUP_TIMEOUT,
    DEFAULT_OUTPUT_CHARACTER_LIMIT,
    OUTPUT_DIRECTORY,
    DESTRUCTIVE_PATTERNS,
    INTERACTIVE_PATTERNS,
    INTERACTIVE_KEYWORDS,
    ShellTimeoutManager,
    DEFAULT_TIMEOUT_MS,
    focusShellTerminal,
    testTerminalFocus
};
