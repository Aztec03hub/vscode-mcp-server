import * as vscode from 'vscode';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from 'zod';
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createTwoFilesPatch } from 'diff';
import { distance } from 'fastest-levenshtein';

// ===== Apply Diff Tool Interfaces =====

interface DiffSection {
    startLine: number;     // 0-based line number
    endLine: number;       // 0-based line number (inclusive)
    originalContent: string;
    newContent: string;
    description?: string;  // Optional description for this section
}

interface ApplyDiffArgs {
    filePath: string;
    diffs: DiffSection[];  // Array of diff sections
    description?: string;  // Overall description
}

interface MatchingOptions {
    ignoreLeadingWhitespace?: boolean;     // Default: true
    ignoreTrailingWhitespace?: boolean;    // Default: true
    normalizeIndentation?: boolean;        // Default: true
    ignoreEmptyLines?: boolean;           // Default: false
    caseSensitive?: boolean;              // Default: true
}

interface MatchResult {
    startLine: number;
    endLine: number;
    confidence: number;        // 0-1 confidence score
    strategy: string;          // Which strategy found this match
    actualContent: string;     // What was actually found
    issues?: string[];         // Any issues detected (whitespace, case, etc.)
}

interface ValidationResult {
    isValid: boolean;
    matches: MatchResult[];
    conflicts: ConflictInfo[];
    warnings: string[];
    suggestions: string[];
}

interface ConflictInfo {
    type: 'overlap' | 'content_mismatch' | 'line_drift';
    diffIndex1: number;
    diffIndex2?: number;
    description: string;
    suggestion: string;
}

// ===== Content Matching Implementation =====

class ContentMatcher {
    private defaultOptions: MatchingOptions = {
        ignoreLeadingWhitespace: true,
        ignoreTrailingWhitespace: true,
        normalizeIndentation: true,
        ignoreEmptyLines: false,
        caseSensitive: true
    };

    /**
     * Find exact match for content in the file lines
     */
    findExactMatch(lines: string[], targetContent: string, startHint?: number): MatchResult | null {
        const targetLines = targetContent.split('\n');
        const searchStart = startHint || 0;
        
        for (let i = searchStart; i <= lines.length - targetLines.length; i++) {
            let matches = true;
            for (let j = 0; j < targetLines.length; j++) {
                if (lines[i + j] !== targetLines[j]) {
                    matches = false;
                    break;
                }
            }
            
            if (matches) {
                return {
                    startLine: i,
                    endLine: i + targetLines.length - 1,
                    confidence: 1.0,
                    strategy: 'exact',
                    actualContent: lines.slice(i, i + targetLines.length).join('\n'),
                    issues: []
                };
            }
        }
        
        return null;
    }

    /**
     * Normalize content according to matching options
     */
    private normalizeContent(content: string, options: MatchingOptions): string {
        let normalized = content;
        
        if (options.ignoreLeadingWhitespace) {
            normalized = normalized.replace(/^\s+/gm, '');
        }
        if (options.ignoreTrailingWhitespace) {
            normalized = normalized.replace(/\s+$/gm, '');
        }
        if (options.normalizeIndentation) {
            // Convert all indentation to single spaces
            normalized = normalized.replace(/^\t+/gm, match => ' '.repeat(match.length * 4));
            normalized = normalized.replace(/^  +/gm, ' ');
        }
        if (options.ignoreEmptyLines) {
            normalized = normalized.replace(/^\s*$/gm, '');
        }
        if (!options.caseSensitive) {
            normalized = normalized.toLowerCase();
        }
        
        return normalized;
    }

    /**
     * Find normalized match for content
     */
    findNormalizedMatch(lines: string[], targetContent: string, options?: MatchingOptions): MatchResult | null {
        const opts = { ...this.defaultOptions, ...options };
        const normalizedTarget = this.normalizeContent(targetContent, opts);
        const targetLines = normalizedTarget.split('\n');
        
        for (let i = 0; i <= lines.length - targetLines.length; i++) {
            const actualContent = lines.slice(i, i + targetLines.length).join('\n');
            const normalizedActual = this.normalizeContent(actualContent, opts);
            
            if (normalizedActual === normalizedTarget) {
                const issues = [];
                if (actualContent !== targetContent) {
                    issues.push('Content differs in whitespace or formatting');
                }
                
                return {
                    startLine: i,
                    endLine: i + targetLines.length - 1,
                    confidence: 0.9,
                    strategy: 'normalized',
                    actualContent,
                    issues
                };
            }
        }
        
        return null;
    }

    /**
     * Find content using similarity matching
     */
    findSimilarityMatch(lines: string[], targetContent: string, threshold: number = 0.8): MatchResult[] {
        const results: MatchResult[] = [];
        const targetLines = targetContent.split('\n');
        
        for (let i = 0; i <= lines.length - targetLines.length; i++) {
            const actualContent = lines.slice(i, i + targetLines.length).join('\n');
            const similarity = this.calculateSimilarity(targetContent, actualContent);
            
            if (similarity >= threshold) {
                results.push({
                    startLine: i,
                    endLine: i + targetLines.length - 1,
                    confidence: similarity,
                    strategy: 'similarity',
                    actualContent,
                    issues: similarity < 0.95 ? ['Content has significant differences'] : []
                });
            }
        }
        
        return results.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Calculate similarity between two strings using Levenshtein distance
     */
    private calculateSimilarity(str1: string, str2: string): number {
        const maxLength = Math.max(str1.length, str2.length);
        if (maxLength === 0) return 1.0;
        
        const dist = distance(str1, str2);
        return 1.0 - (dist / maxLength);
    }

    /**
     * Find content using contextual search (looking at surrounding lines)
     */
    findContextualMatch(lines: string[], targetContent: string, contextLines: number = 2): MatchResult | null {
        const targetLines = targetContent.split('\n');
        
        // Try to find unique patterns in the target content
        for (let i = 0; i <= lines.length - targetLines.length; i++) {
            let contextScore = 0;
            
            // Check lines before
            for (let j = 1; j <= contextLines && i - j >= 0; j++) {
                const targetIndex = -j;
                if (targetIndex >= -targetLines.length) {
                    // We don't have context before target, but check if file context matches expectations
                    const similarity = this.calculateSimilarity(lines[i - j], '');
                    contextScore += similarity * 0.1;
                }
            }
            
            // Check the content itself
            const actualContent = lines.slice(i, i + targetLines.length).join('\n');
            const contentSimilarity = this.calculateSimilarity(targetContent, actualContent);
            contextScore += contentSimilarity * 0.8;
            
            // Check lines after
            for (let j = 1; j <= contextLines && i + targetLines.length + j < lines.length; j++) {
                // Similar logic for after context
                contextScore += 0.1;
            }
            
            if (contentSimilarity > 0.7) {
                return {
                    startLine: i,
                    endLine: i + targetLines.length - 1,
                    confidence: contentSimilarity,
                    strategy: 'contextual',
                    actualContent,
                    issues: contentSimilarity < 0.9 ? ['Content found using contextual matching'] : []
                };
            }
        }
        
        return null;
    }

    /**
     * Select the best match from candidates based on confidence
     */
    selectBestMatch(candidates: MatchResult[], minConfidence: number = 0.7): MatchResult | null {
        if (candidates.length === 0) return null;
        
        const validCandidates = candidates.filter(c => c.confidence >= minConfidence);
        if (validCandidates.length === 0) return null;
        
        // Sort by confidence (highest first)
        validCandidates.sort((a, b) => b.confidence - a.confidence);
        return validCandidates[0];
    }

    /**
     * Determine if a match requires user confirmation
     */
    requiresUserConfirmation(match: MatchResult): boolean {
        return match.confidence < 0.9 || (match.issues?.length ?? 0) > 0;
    }
}

// ===== Apply Diff Core Functions =====

/**
 * Validate diff sections for conflicts and prepare for application
 */
async function validateDiffSections(
    filePath: string,
    diffs: DiffSection[],
    options?: MatchingOptions
): Promise<ValidationResult> {
    console.log(`[validateDiffSections] Starting validation for ${diffs.length} diff sections`);
    
    if (!vscode.workspace.workspaceFolders) {
        throw new Error('No workspace folder is open');
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, filePath);
    
    // Check if file exists
    try {
        await vscode.workspace.fs.stat(fileUri);
    } catch (error) {
        return {
            isValid: false,
            matches: [],
            conflicts: [],
            warnings: [],
            suggestions: [`File does not exist: ${filePath}. The apply_diff tool only works on existing files.`]
        };
    }

    // Read the file content
    const document = await vscode.workspace.openTextDocument(fileUri);
    const lines = [];
    for (let i = 0; i < document.lineCount; i++) {
        lines.push(document.lineAt(i).text);
    }

    const matcher = new ContentMatcher();
    const matches: MatchResult[] = [];
    const conflicts: ConflictInfo[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Sort diffs by line number for processing
    const sortedDiffs = [...diffs].sort((a, b) => a.startLine - b.startLine);

    // Validate each diff section
    for (let i = 0; i < sortedDiffs.length; i++) {
        const diff = sortedDiffs[i];
        console.log(`[validateDiffSections] Processing diff ${i}: lines ${diff.startLine}-${diff.endLine}`);

        // Try multiple matching strategies
        let match = matcher.findExactMatch(lines, diff.originalContent, diff.startLine);
        
        if (!match) {
            match = matcher.findNormalizedMatch(lines, diff.originalContent, options);
        }
        
        if (!match) {
            match = matcher.findContextualMatch(lines, diff.originalContent);
        }
        
        if (!match) {
            const similarityMatches = matcher.findSimilarityMatch(lines, diff.originalContent, 0.7);
            match = matcher.selectBestMatch(similarityMatches, 0.7);
        }

        if (match) {
            matches.push(match);
            
            // Check for overlaps with previous matches
            for (let j = 0; j < i; j++) {
                const prevMatch = matches[j];
                if (prevMatch && (
                    (match.startLine <= prevMatch.endLine && match.endLine >= prevMatch.startLine)
                )) {
                    conflicts.push({
                        type: 'overlap',
                        diffIndex1: j,
                        diffIndex2: i,
                        description: `Diff sections ${j} and ${i} have overlapping line ranges`,
                        suggestion: 'Merge overlapping sections or adjust line ranges'
                    });
                }
            }
            
            // Add warnings for low confidence matches
            if (matcher.requiresUserConfirmation(match)) {
                warnings.push(`Diff ${i} found with ${match.strategy} strategy (confidence: ${match.confidence.toFixed(2)})`);
            }
        } else {
            conflicts.push({
                type: 'content_mismatch',
                diffIndex1: i,
                description: `Could not find content for diff section ${i}`,
                suggestion: 'Check if the original content has been modified or update the diff section'
            });
        }
    }

    const isValid = conflicts.length === 0;
    
    if (!isValid) {
        suggestions.push('Fix all conflicts before applying the diff');
    }
    
    if (warnings.length > 0) {
        suggestions.push('Review warnings - some matches required fuzzy matching');
    }

    return {
        isValid,
        matches,
        conflicts,
        warnings,
        suggestions
    };
}

/**
 * Create a temporary file with all diff sections applied
 */
async function createModifiedContent(
    filePath: string,
    diffs: DiffSection[],
    matches: MatchResult[]
): Promise<string> {
    console.log(`[createModifiedContent] Creating modified content with ${diffs.length} diff sections`);
    
    if (!vscode.workspace.workspaceFolders) {
        throw new Error('No workspace folder is open');
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, filePath);
    const document = await vscode.workspace.openTextDocument(fileUri);
    
    // Get all lines from the file
    const lines = [];
    for (let i = 0; i < document.lineCount; i++) {
        lines.push(document.lineAt(i).text);
    }

    // Apply changes from bottom to top to avoid line number shifts
    const sortedChanges = matches
        .map((match, index) => ({ match, diff: diffs[index] }))
        .sort((a, b) => b.match.startLine - a.match.startLine);

    for (const { match, diff } of sortedChanges) {
        console.log(`[createModifiedContent] Applying change at lines ${match.startLine}-${match.endLine}`);
        
        // Replace the matched lines with new content
        const newLines = diff.newContent.split('\n');
        lines.splice(match.startLine, match.endLine - match.startLine + 1, ...newLines);
    }

    return lines.join('\n');
}

/**
 * Show diff in VS Code and get user approval using Status Bar Buttons
 */
async function showDiffAndGetApproval(
    filePath: string,
    originalContent: string,
    modifiedContent: string,
    description: string,
    warnings: string[]
): Promise<boolean> {
    console.log(`[showDiffAndGetApproval] Showing diff for ${filePath}`);
    
    if (!vscode.workspace.workspaceFolders) {
        throw new Error('No workspace folder is open');
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, filePath);
    
    // Check if file exists to determine the flow
    const fileExists = await vscode.workspace.fs.stat(fileUri).then(() => true, () => false);
    
    // Create temporary files for diff
    const tempDir = require('os').tmpdir();
    const timestamp = Date.now();
    const originalTempPath = `apply-diff-original-${timestamp}.tmp`;
    const modifiedTempPath = `apply-diff-modified-${timestamp}.tmp`;
    
    // Status bar items for user approval
    let approveButton: vscode.StatusBarItem | undefined;
    let rejectButton: vscode.StatusBarItem | undefined;
    let infoButton: vscode.StatusBarItem | undefined;
    
    // Commands for approval actions
    let approveCommand: vscode.Disposable | undefined;
    let rejectCommand: vscode.Disposable | undefined;
    
    try {
        // Write temporary files
        const tempDirUri = vscode.Uri.file(require('os').tmpdir());
        const originalTempUri = vscode.Uri.joinPath(tempDirUri, originalTempPath);
        const modifiedTempUri = vscode.Uri.joinPath(tempDirUri, modifiedTempPath);
        
        await vscode.workspace.fs.writeFile(originalTempUri, new TextEncoder().encode(originalContent));
        await vscode.workspace.fs.writeFile(modifiedTempUri, new TextEncoder().encode(modifiedContent));
        
        // Show diff in VS Code
        let diffTitle = `Apply Diff: ${filePath}`;
        if (description) {
            diffTitle += ` - ${description}`;
        }
        
        // Open the diff view
        await vscode.commands.executeCommand(
            'vscode.diff',
            originalTempUri,
            modifiedTempUri,
            diffTitle
        );
        
        
        // Create status bar buttons
        approveButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
        approveButton.text = '$(check) Apply Changes';
        approveButton.tooltip = 'Apply all proposed changes to the file';
        approveButton.command = 'mcp.apply-diff.approve';
        approveButton.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        approveButton.show();

        rejectButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 999);
        rejectButton.text = '$(x) Reject Changes';
        rejectButton.tooltip = 'Reject changes and keep original file';
        rejectButton.command = 'mcp.apply-diff.reject';
        rejectButton.show();

        // Add info button showing file context
        infoButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 998);
        const diffCount = modifiedContent.split('\n').length - originalContent.split('\n').length;
        const statusText = fileExists ? 'Modifying' : 'Creating';
        const baseFileName = require('path').basename(filePath);
        infoButton.text = `$(info) ${statusText} ${baseFileName} (${Math.abs(diffCount)} line ${diffCount >= 0 ? 'additions' : 'deletions'})`;
        infoButton.tooltip = fileExists 
            ? `Reviewing changes to existing file: ${filePath}`
            : `Creating new file: ${filePath}`;
        infoButton.show();
        
        // Show warnings if any
        if (warnings.length > 0) {
            vscode.window.showWarningMessage(
                `Diff has ${warnings.length} warning(s). Review carefully before applying.`,
                { modal: false },
                'Show Details'
            ).then(choice => {
                if (choice === 'Show Details') {
                    vscode.window.showInformationMessage(warnings.join('\n'), { modal: false });
                }
            });
        }
        
        // Wait for user decision via status bar buttons
        const userChoice = await new Promise<boolean>((resolve) => {
            let resolved = false;
            
            // Register approval command
            approveCommand = vscode.commands.registerCommand('mcp.apply-diff.approve', () => {
                if (!resolved) {
                    resolved = true;
                    resolve(true);
                }
            });
            
            // Register rejection command
            rejectCommand = vscode.commands.registerCommand('mcp.apply-diff.reject', () => {
                if (!resolved) {
                    resolved = true;
                    resolve(false);
                }
            });
            
            // Optional: Auto-resolve after a timeout (e.g., 5 minutes)
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    console.log('[showDiffAndGetApproval] Auto-rejecting due to timeout');
                    resolve(false);
                }
            }, 5 * 60 * 1000); // 5 minutes timeout
        });
        
        return userChoice;
        
    } finally {
        // Clean up status bar buttons and commands
        try {
            approveButton?.dispose();
            rejectButton?.dispose();
            infoButton?.dispose();
            approveCommand?.dispose();
            rejectCommand?.dispose();
        } catch (error) {
            console.warn('[showDiffAndGetApproval] Failed to dispose UI elements:', error);
        }
        
        // Close diff view properly - Enhanced tab detection
        try {
            // Find and close the diff tab using multiple patterns
            const tabs = vscode.window.tabGroups.all.flatMap(group => group.tabs);
            const baseFileName = require('path').basename(filePath);
            const diffTab = tabs.find(tab => {
                const label = tab.label;
                return (
                    label.includes(baseFileName) && (
                        label.includes('Original ↔ LLM Changes') ||
                        label.includes('New File Creation') ||
                        label.includes('Apply Diff:') ||
                        label.includes('(Editable)')
                    )
                );
            });
            
            if (diffTab) {
                await vscode.window.tabGroups.close(diffTab);
                console.log('[showDiffAndGetApproval] Closed diff tab');
            } else {
                console.log('[showDiffAndGetApproval] No matching diff tab found to close');
            }
        } catch (error) {
            console.warn('[showDiffAndGetApproval] Failed to close diff tab:', error);
        }
        
        // Clean up temporary files
        try {
            const tempDirUri = vscode.Uri.file(tempDir);
            await vscode.workspace.fs.delete(vscode.Uri.joinPath(tempDirUri, originalTempPath));
            await vscode.workspace.fs.delete(vscode.Uri.joinPath(tempDirUri, modifiedTempPath));
            console.log('[showDiffAndGetApproval] Cleaned up temporary files');
        } catch (error) {
            console.warn('[showDiffAndGetApproval] Failed to clean up temp files:', error);
        }
    }
}

/**
 * Apply the diff changes to the file
 */
async function applyDiffToFile(
    filePath: string,
    modifiedContent: string
): Promise<void> {
    console.log(`[applyDiffToFile] Applying changes to ${filePath}`);
    
    if (!vscode.workspace.workspaceFolders) {
        throw new Error('No workspace folder is open');
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, filePath);
    
    // Create a WorkspaceEdit to replace the entire file content
    const workspaceEdit = new vscode.WorkspaceEdit();
    
    // Get the current document
    const document = await vscode.workspace.openTextDocument(fileUri);
    const fullRange = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length)
    );
    
    workspaceEdit.replace(fileUri, fullRange, modifiedContent);
    
    // Apply the edit
    const success = await vscode.workspace.applyEdit(workspaceEdit);
    
    if (success) {
        console.log(`[applyDiffToFile] Changes applied successfully to ${filePath}`);
        
        // Save the document
        await document.save();
        console.log(`[applyDiffToFile] Document saved`);
        
        // Show the document
        await vscode.window.showTextDocument(document);
    } else {
        throw new Error(`Failed to apply changes to ${filePath}`);
    }
}

/**
 * Main apply_diff function with improved progress feedback
 */
export async function applyDiff(args: ApplyDiffArgs): Promise<void> {
    console.log(`[applyDiff] Starting apply_diff for ${args.filePath} with ${args.diffs.length} diff sections`);
    
    // Show progress during validation
    const progressOptions = {
        location: vscode.ProgressLocation.Window,
        title: "Apply Diff",
        cancellable: false
    };
    
    return vscode.window.withProgress(progressOptions, async (progress) => {
        progress.report({ increment: 0, message: "Validating diff sections..." });
        
        // Validate diff sections
        const validation = await validateDiffSections(args.filePath, args.diffs);
        progress.report({ increment: 30, message: "Validation complete" });
        
        if (!validation.isValid) {
            const errorMsg = `Validation failed for ${args.filePath}:\\n` +
                `Conflicts: ${validation.conflicts.map(c => c.description).join(', ')}\\n` +
                `Suggestions: ${validation.suggestions.join(', ')}`;
            throw new Error(errorMsg);
        }
        
        progress.report({ increment: 20, message: "Preparing changes..." });
        
        // Create modified content
        const originalContent = await vscode.workspace.openTextDocument(
            vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, args.filePath)
        ).then(doc => doc.getText());
        
        const modifiedContent = await createModifiedContent(args.filePath, args.diffs, validation.matches);
        progress.report({ increment: 20, message: "Changes prepared" });
        
        // Show diff and get user approval
        progress.report({ increment: 10, message: "Showing diff preview..." });
        const approved = await showDiffAndGetApproval(
            args.filePath,
            originalContent,
            modifiedContent,
            args.description || 'Apply diff changes',
            validation.warnings
        );
        
        if (!approved) {
            throw new Error('Changes were rejected by user');
        }
        
        progress.report({ increment: 10, message: "Applying changes..." });
        
        // Apply the changes
        await applyDiffToFile(args.filePath, modifiedContent);
        
        progress.report({ increment: 10, message: "Changes applied successfully!" });
        
        console.log(`[applyDiff] Successfully applied diff to ${args.filePath}`);
    });
}

/**
 * Creates a new file in the VS Code workspace using WorkspaceEdit
 * @param workspacePath The path within the workspace to the file
 * @param content The content to write to the file
 * @param overwrite Whether to overwrite if the file exists
 * @param ignoreIfExists Whether to ignore if the file exists
 * @returns Promise that resolves when the edit operation completes
 */
export async function createWorkspaceFile(
    workspacePath: string,
    content: string,
    overwrite: boolean = false,
    ignoreIfExists: boolean = false
): Promise<void> {
    console.log(`[createWorkspaceFile] Starting with path: ${workspacePath}, overwrite: ${overwrite}, ignoreIfExists: ${ignoreIfExists}`);
    
    if (!vscode.workspace.workspaceFolders) {
        throw new Error('No workspace folder is open');
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const workspaceUri = workspaceFolder.uri;
    
    // Create URI for the target file
    const fileUri = vscode.Uri.joinPath(workspaceUri, workspacePath);
    console.log(`[createWorkspaceFile] File URI: ${fileUri.fsPath}`);

    try {
        // Create a WorkspaceEdit
        const workspaceEdit = new vscode.WorkspaceEdit();
        
        // Convert content to Uint8Array
        const contentBuffer = new TextEncoder().encode(content);
        
        // Add createFile operation to the edit
        workspaceEdit.createFile(fileUri, {
            contents: contentBuffer,
            overwrite: overwrite,
            ignoreIfExists: ignoreIfExists
        });
        
        // Apply the edit
        const success = await vscode.workspace.applyEdit(workspaceEdit);
        
        if (success) {
            console.log(`[createWorkspaceFile] File created successfully: ${fileUri.fsPath}`);
            
            // Open the document to trigger linting
            const document = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(document);
            console.log(`[createWorkspaceFile] File opened in editor`);
        } else {
            throw new Error(`Failed to create file: ${fileUri.fsPath}`);
        }
    } catch (error) {
        console.error('[createWorkspaceFile] Error:', error);
        throw error;
    }
}

/**
 * Replaces specific lines in a file in the VS Code workspace
 * @param workspacePath The path within the workspace to the file
 * @param startLine The start line number (0-based, inclusive)
 * @param endLine The end line number (0-based, inclusive)
 * @param content The new content to replace the lines with
 * @param originalCode The original code for validation
 * @returns Promise that resolves when the edit operation completes
 */
export async function replaceWorkspaceFileLines(
    workspacePath: string,
    startLine: number,
    endLine: number,
    content: string,
    originalCode: string
): Promise<void> {
    console.log(`[replaceWorkspaceFileLines] Starting with path: ${workspacePath}, lines: ${startLine}-${endLine}`);
    
    if (!vscode.workspace.workspaceFolders) {
        throw new Error('No workspace folder is open');
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const workspaceUri = workspaceFolder.uri;
    
    // Create URI for the target file
    const fileUri = vscode.Uri.joinPath(workspaceUri, workspacePath);
    console.log(`[replaceWorkspaceFileLines] File URI: ${fileUri.fsPath}`);

    try {
        // Open the document (or get it if already open)
        const document = await vscode.workspace.openTextDocument(fileUri);
        
        // Validate line numbers
        if (startLine < 0 || startLine >= document.lineCount) {
            throw new Error(`Start line ${startLine} is out of range (0-${document.lineCount-1})`);
        }
        if (endLine < startLine || endLine >= document.lineCount) {
            throw new Error(`End line ${endLine} is out of range (${startLine}-${document.lineCount-1})`);
        }
        
        // Get the current content of the lines
        const currentLines = [];
        for (let i = startLine; i <= endLine; i++) {
            currentLines.push(document.lineAt(i).text);
        }
        const currentContent = currentLines.join('\n');
        
        // Compare with the provided original code
        if (currentContent !== originalCode) {
            throw new Error(`Original code validation failed. The current content does not match the provided original code.`);
        }
        
        // Create a range for the lines to replace
        const startPos = new vscode.Position(startLine, 0);
        const endPos = new vscode.Position(endLine, document.lineAt(endLine).text.length);
        const range = new vscode.Range(startPos, endPos);
        
        // Get the active text editor or show the document
        let editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.toString() !== fileUri.toString()) {
            editor = await vscode.window.showTextDocument(document);
        }
        
        // Apply the edit
        const success = await editor.edit((editBuilder) => {
            editBuilder.replace(range, content);
        });
        
        if (success) {
            console.log(`[replaceWorkspaceFileLines] Lines replaced successfully`);
            
            // Save the document to persist changes
            await document.save();
            console.log(`[replaceWorkspaceFileLines] Document saved`);
        } else {
            throw new Error(`Failed to replace lines in file: ${fileUri.fsPath}`);
        }
    } catch (error) {
        console.error('[replaceWorkspaceFileLines] Error:', error);
        throw error;
    }
}

/**
 * Registers MCP edit-related tools with the server
 * @param server MCP server instance
 */
export function registerEditTools(server: McpServer): void {
    // Add create_file tool
    server.tool(
        'create_file_code',
        'Use this tool to create new files in the VS Code workspace. This should be the primary tool for creating new files or making large changes when working with the codebase. The tool provides two optional parameters to handle existing files: \'overwrite\' (replace existing files) and \'ignoreIfExists\' (skip creation if file exists). When implementing new features, prefer creating files in appropriate locations based on the project\'s structure and conventions. Always verify the path doesn\'t already exist with list_files first unless you specifically want to overwrite it.',
        {
            path: z.string().describe('The path to the file to create'),
            content: z.string().describe('The content to write to the file'),
            overwrite: z.boolean().optional().default(false).describe('Whether to overwrite if the file exists'),
            ignoreIfExists: z.boolean().optional().default(false).describe('Whether to ignore if the file exists')
        },
        async ({ path, content, overwrite = false, ignoreIfExists = false }): Promise<CallToolResult> => {
            console.log(`[create_file] Tool called with path=${path}, overwrite=${overwrite}, ignoreIfExists=${ignoreIfExists}`);
            
            try {
                console.log('[create_file] Creating file');
                await createWorkspaceFile(path, content, overwrite, ignoreIfExists);
                
                const result: CallToolResult = {
                    content: [
                        {
                            type: 'text',
                            text: `File ${path} created successfully`
                        }
                    ]
                };
                console.log('[create_file] Successfully completed');
                return result;
            } catch (error) {
                console.error('[create_file] Error in tool:', error);
                throw error;
            }
        }
    );

    // Add replace_lines_code tool
    server.tool(
        'replace_lines_code',
        `Use this tool to selectively replace specific lines of code in a file. The tool implements several safety features:
        
            1. Line number validation - Ensures start and end lines are within valid range
            2. Content verification - Requires original code to match exactly before making changes
            3. Atomic operations - Changes are applied as a single edit operation
        
        Best practices:
            - Verify line numbers match your intended target using read_file if you are unsure.
            - If this tool fails, use a targeted call to read_file_code to check the specific lines you want to modify.
            - Use for targeted changes when modifying specific sections of large files
            - Consider using create_file_code instead for complete or near-complete file rewrites
            - This tool should be preferred for small to medium changes to existing files.
            `,
        {
            path: z.string().describe('The path to the file to modify'),
            startLine: z.number().describe('The start line number (0-based, inclusive)'),
            endLine: z.number().describe('The end line number (0-based, inclusive)'),
            content: z.string().describe('The new content to replace the lines with'),
            originalCode: z.string().describe('The original code for validation - must match exactly')
        },
        async ({ path, startLine, endLine, content, originalCode }): Promise<CallToolResult> => {
            console.log(`[replace_lines_code] Tool called with path=${path}, startLine=${startLine}, endLine=${endLine}`);
            
            try {
                console.log('[replace_lines_code] Replacing lines');
                await replaceWorkspaceFileLines(path, startLine, endLine, content, originalCode);
                
                const result: CallToolResult = {
                    content: [
                        {
                            type: 'text',
                            text: `Lines ${startLine}-${endLine} in file ${path} replaced successfully`
                        }
                    ]
                };
                console.log('[replace_lines_code] Successfully completed');
                return result;
            } catch (error) {
                console.error('[replace_lines_code] Error in tool:', error);
                throw error;
            }
        }
    );

    // Add apply_diff tool
    server.tool(
        'apply_diff',
        `Use this tool to apply multiple diff sections to an existing file with advanced fuzzy matching capabilities. This is the preferred tool for making complex changes to existing files.
        
        Key Features:
        - Multiple diff sections in a single operation
        - Fuzzy matching handles whitespace differences, content drift, and formatting variations
        - Shows unified diff preview before applying changes
        - Atomic all-or-nothing application
        - Only works on existing files (validation enforced)
        
        Best Practices:
        - Use for related changes that should be applied together
        - The tool will automatically find content even if line numbers have shifted
        - Handles whitespace and indentation differences gracefully
        - Shows confidence levels for fuzzy matches
        - Requires user approval before applying changes
        
        Example usage:
        - Updating multiple import statements
        - Refactoring function signatures across a file
        - Adding multiple related code sections
        `,
        {
            filePath: z.string().describe('Path to the existing file to modify'),
            diffs: z.array(z.object({
                startLine: z.number().describe('Starting line number (0-based, hint for search)'),
                endLine: z.number().describe('Ending line number (0-based, hint for search)'),
                originalContent: z.string().describe('Original content to find and replace'),
                newContent: z.string().describe('New content to replace with'),
                description: z.string().optional().describe('Description of this change section')
            })).describe('Array of diff sections to apply'),
            description: z.string().optional().describe('Overall description of the changes')
        },
        async ({ filePath, diffs, description }): Promise<CallToolResult> => {
            console.log(`[apply_diff] Tool called with filePath=${filePath}, ${diffs.length} diff sections`);
            
            try {
                await applyDiff({ filePath, diffs, description });
                
                const sectionsText = diffs.length === 1 ? 'section' : 'sections';
                const result: CallToolResult = {
                    content: [
                        {
                            type: 'text',
                            text: `Successfully applied ${diffs.length} diff ${sectionsText} to ${filePath}${description ? ` - ${description}` : ''}`
                        }
                    ]
                };
                console.log('[apply_diff] Successfully completed');
                return result;
            } catch (error) {
                console.error('[apply_diff] Error in tool:', error);
                throw error;
            }
        }
    );
}
