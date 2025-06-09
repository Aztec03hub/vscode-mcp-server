import * as vscode from 'vscode';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from 'zod';
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createTwoFilesPatch } from 'diff';
import { distance } from 'fastest-levenshtein';
import { isDiffAutoApprovalEnabled } from '../extension';

// ===== Apply Diff Tool Interfaces =====

// Global cache for file content during batch operations
const fileContentCache = new Map<string, {
    content: string;
    lines: string[];
    timestamp: number;
}>;

// Cache TTL in milliseconds (5 seconds)
const CACHE_TTL = 5000;

interface DiffSection {
    startLine: number;     // 0-based line number
    endLine: number;       // 0-based line number (inclusive)
    search?: string;        // Content to search for (formerly originalContent)
    replace?: string;       // Content to replace with (formerly newContent)
    description?: string;  // Optional description for this section
    // Deprecated - for backward compatibility
    originalContent?: string;
    newContent?: string;
}

interface ApplyDiffArgs {
    filePath: string;
    description?: string;  // Overall description (moved up in parameter order)
    diffs: DiffSection[];  // Array of diff sections
    partialSuccess?: boolean; // Whether to apply successful diffs even if some fail
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
    matches: (MatchResult | null)[];
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

// ===== Structural Integrity Validation =====

/**
 * Represents structural elements that should be balanced
 */
interface StructuralElements {
    braces: { open: number; close: number; };           // { }
    parentheses: { open: number; close: number; };      // ( )
    brackets: { open: number; close: number; };         // [ ]
    singleQuotes: number;                               // '
    doubleQuotes: number;                               // "
    backticks: number;                                  // `
    blockComments: { open: number; close: number; };    // /* */
}

/**
 * Structural validation result
 */
interface StructuralValidationResult {
    isValid: boolean;
    warnings: StructuralWarning[];
    elementsBefore: StructuralElements;
    elementsAfter: StructuralElements;
    analysis: string;
}

/**
 * Represents a structural warning
 */
interface StructuralWarning {
    type: 'unbalanced_braces' | 'unbalanced_parentheses' | 'unbalanced_brackets' | 
          'unbalanced_quotes' | 'unclosed_string' | 'unclosed_comment' | 
          'syntax_error' | 'json_invalid';
    severity: 'low' | 'medium' | 'high';
    message: string;
    details?: string;
}

// ===== Structured Logging =====

/**
 * Log levels for structured logging
 */
enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error'
}

/**
 * Structured log entry
 */
interface LogEntry {
    timestamp: string;
    level: LogLevel;
    component: string;
    message: string;
    data?: any;
    duration?: number;
}

/**
 * Structured logger for apply_diff operations
 */
class StructuredLogger {
    private static entries: LogEntry[] = [];
    private static maxEntries = 1000;
    
    static log(level: LogLevel, component: string, message: string, data?: any, duration?: number): void {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            component,
            message,
            data,
            duration
        };
        
        this.entries.push(entry);
        
        // Trim old entries
        if (this.entries.length > this.maxEntries) {
            this.entries = this.entries.slice(-this.maxEntries);
        }
        
        // Output to console based on level
        const prefix = `[${component}]`;
        const fullMessage = duration ? `${message} (${duration}ms)` : message;
        
        switch (level) {
            case LogLevel.DEBUG:
                console.log(prefix, fullMessage, data || '');
                break;
            case LogLevel.INFO:
                console.info(prefix, fullMessage, data || '');
                break;
            case LogLevel.WARN:
                console.warn(prefix, fullMessage, data || '');
                break;
            case LogLevel.ERROR:
                console.error(prefix, fullMessage, data || '');
                break;
        }
    }
    
    static getEntries(filter?: { level?: LogLevel; component?: string; since?: Date }): LogEntry[] {
        let filtered = this.entries;
        
        if (filter?.level) {
            filtered = filtered.filter(e => e.level === filter.level);
        }
        if (filter?.component) {
            filtered = filtered.filter(e => e.component === filter.component);
        }
        if (filter?.since) {
            const sinceTime = filter.since.toISOString();
            filtered = filtered.filter(e => e.timestamp >= sinceTime);
        }
        
        return filtered;
    }
    
    static exportAsJson(): string {
        return JSON.stringify(this.entries, null, 2);
    }
    
    static clear(): void {
        this.entries = [];
    }
    
    /**
     * Get performance metrics for a component
     */
    static getPerformanceMetrics(component: string, since?: Date): {
        avgDuration: number;
        minDuration: number;
        maxDuration: number;
        count: number;
        successRate: number;
    } {
        const entries = this.getEntries({ component, since }).filter(e => e.duration !== undefined);
        
        if (entries.length === 0) {
            return { avgDuration: 0, minDuration: 0, maxDuration: 0, count: 0, successRate: 0 };
        }
        
        const durations = entries.map(e => e.duration!);
        const successCount = entries.filter(e => e.level !== LogLevel.ERROR).length;
        
        return {
            avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
            minDuration: Math.min(...durations),
            maxDuration: Math.max(...durations),
            count: entries.length,
            successRate: (successCount / entries.length) * 100
        };
    }
    
    /**
     * Track operation success/failure for reliability monitoring
     */
    static trackOperation(component: string, operation: string, success: boolean, duration?: number, details?: any): void {
        this.log(
            success ? LogLevel.INFO : LogLevel.ERROR,
            component,
            `${operation} ${success ? 'succeeded' : 'failed'}`,
            { operation, success, ...details },
            duration
        );
    }
}

// ===== Cache Management =====

/**
 * Get cached file content or read from disk
 */
async function getCachedFileContent(fileUri: vscode.Uri): Promise<{
    content: string;
    lines: string[];
}> {
    const cacheKey = fileUri.toString();
    const cached = fileContentCache.get(cacheKey);
    
    // Check if cache is valid
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[Cache] Using cached content for ${fileUri.fsPath}`);
        return {
            content: cached.content,
            lines: cached.lines
        };
    }
    
    // Read from disk
    console.log(`[Cache] Reading content from disk for ${fileUri.fsPath}`);
    try {
        const document = await vscode.workspace.openTextDocument(fileUri);
        const content = document.getText();
        const lines: string[] = [];
        
        for (let i = 0; i < document.lineCount; i++) {
            lines.push(document.lineAt(i).text);
        }
        
        // Update cache
        fileContentCache.set(cacheKey, {
            content,
            lines,
            timestamp: Date.now()
        });
        
        return { content, lines };
    } catch (error) {
        // File doesn't exist
        return { content: '', lines: [] };
    }
}

/**
 * Clear cache for a specific file
 */
export function clearFileCache(fileUri: vscode.Uri): void {
    const cacheKey = fileUri.toString();
    fileContentCache.delete(cacheKey);
    console.log(`[Cache] Cleared cache for ${fileUri.fsPath}`);
}

/**
 * Clear all expired cache entries
 */
function cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of fileContentCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            fileContentCache.delete(key);
        }
    }
}

// ===== Enhanced Diagnostics =====

/**
 * Detailed diagnostic information for failed matches
 */
interface DiagnosticInfo {
    expected: string;        // What we were searching for
    actualContent: string[]; // What we found at various locations  
    searchLocations: number[]; // Line numbers where we looked
    bestMatch?: {
        content: string;
        location: number;
        confidence: number;
        strategy: string;
    };
    attempts: ValidationAttempt[];
}

/**
 * Error levels for progressive disclosure
 */
enum ErrorLevel {
    SIMPLE = 1,    // Basic "not found" message
    DETAILED = 2,  // Show partial matches
    FULL = 3       // Complete diagnostic with all attempts
}

/**
 * Enhanced error with diagnostic information
 */
class ApplyDiffError extends Error {
    constructor(
        message: string,
        public diagnostics: DiagnosticInfo,
        public level: ErrorLevel = ErrorLevel.DETAILED
    ) {
        super(message);
        this.name = 'ApplyDiffError';
    }
    
    /**
     * Format error message based on error level
     */
    format(level?: ErrorLevel): string {
        const useLevel = level || this.level;
        const lines: string[] = [];
        
        // Header
        lines.push('Error: ' + this.message);
        lines.push('=' .repeat(60));
        
        switch (useLevel) {
            case ErrorLevel.SIMPLE:
                lines.push('\nCould not find the search content in the file.');
                lines.push('Suggestion: Check if the code has been modified or update line numbers.');
                break;
                
            case ErrorLevel.DETAILED:
                lines.push('\nExpected (search content):');
                lines.push('```');
                lines.push(this.diagnostics.expected);
                lines.push('```');
                
                if (this.diagnostics.bestMatch) {
                    lines.push(`\nBest match found at line ${this.diagnostics.bestMatch.location} (confidence: ${(this.diagnostics.bestMatch.confidence * 100).toFixed(1)}%):`);
                    lines.push('```');
                    lines.push(this.diagnostics.bestMatch.content);
                    lines.push('```');
                    lines.push(`\nMatch strategy: ${this.diagnostics.bestMatch.strategy}`);
                }
                
                lines.push('\nSuggestions:');
                lines.push('- Check if the code has been modified');
                lines.push('- Try using a smaller search pattern');
                lines.push('- Verify the line numbers are correct');
                break;
                
            case ErrorLevel.FULL:
                lines.push('\nExpected (search content):');
                lines.push('```');
                lines.push(this.diagnostics.expected);
                lines.push('```');
                
                lines.push('\nValidation attempts:');
                for (const attempt of this.diagnostics.attempts) {
                    lines.push(`\n  ${attempt.strategy.name} (Level ${attempt.strategy.level}):`);
                    if (attempt.result) {
                        lines.push(`    Result: Match found (confidence: ${(attempt.result.confidence * 100).toFixed(1)}%)`);
                    } else if (attempt.error) {
                        lines.push(`    Result: Error - ${attempt.error}`);
                    } else {
                        lines.push(`    Result: No match`);
                    }
                    lines.push(`    Duration: ${attempt.duration}ms`);
                }
                
                if (this.diagnostics.actualContent.length > 0) {
                    lines.push('\nContent found at searched locations:');
                    for (let i = 0; i < Math.min(3, this.diagnostics.actualContent.length); i++) {
                        lines.push(`\n  Line ${this.diagnostics.searchLocations[i]}:`);
                        lines.push('  ```');
                        lines.push('  ' + this.diagnostics.actualContent[i].split('\n').join('\n  '));
                        lines.push('  ```');
                    }
                }
                break;
        }
        
        return lines.join('\n');
    }
}

// ===== Parameter Compatibility Layer =====

/**
 * A normalized diff section with all required fields populated
 */
interface NormalizedDiffSection extends DiffSection {
    search: string;    // Always populated after normalization
    replace: string;   // Always populated after normalization
}

/**
 * Normalize diff sections to handle both old and new parameter names
 */
function normalizeDiffSections(diffs: DiffSection[]): NormalizedDiffSection[] {
    return diffs.map((diff, index) => {
        const normalized: DiffSection = { ...diff };
        
        // Handle backward compatibility
        if (diff.originalContent !== undefined && diff.search === undefined) {
            console.warn(`[apply_diff] Deprecation warning: 'originalContent' parameter in diff[${index}] is deprecated. Use 'search' instead.`);
            normalized.search = diff.originalContent;
        }
        if (diff.newContent !== undefined && diff.replace === undefined) {
            console.warn(`[apply_diff] Deprecation warning: 'newContent' parameter in diff[${index}] is deprecated. Use 'replace' instead.`);
            normalized.replace = diff.newContent;
        }
        
        // Use new names if not already set, handling empty strings correctly
        normalized.search = normalized.search !== undefined ? normalized.search : diff.originalContent;
        normalized.replace = normalized.replace !== undefined ? normalized.replace : diff.newContent;

        // Ensure required fields are present after setting defaults
        if (normalized.search === undefined) {
            throw new Error(`Diff section ${index} missing required 'search' parameter`);
        }
        if (normalized.replace === undefined) {
            throw new Error(`Diff section ${index} missing required 'replace' parameter`);
        }

        // Set final defaults for empty values
        normalized.search = normalized.search || '';
        normalized.replace = normalized.replace || '';
        
        // Normalize line endings to \n for consistency
        normalized.search = normalized.search.replace(/\r\n/g, '\n');
        normalized.replace = normalized.replace.replace(/\r\n/g, '\n');

        // Additional validation: for regular diffs (not endLine: -1), search and replace cannot both be empty
        if (diff.endLine !== -1 && normalized.search === '' && normalized.replace === '') {
            throw new Error(`Diff section ${index} cannot have both empty 'search' and 'replace' parameters for regular diffs`);
        }

        // Handle special case: endLine: -1 means replace from startLine to end of file
        if (diff.endLine === -1) {
            console.log(`[normalizeDiffSections] Diff ${index}: endLine: -1 detected - full file replacement from line ${diff.startLine}`);
            
            // For full file replacement, the search content should typically be empty
            // or represent the content being replaced from startLine to end
            if (normalized.search === undefined || normalized.search === '') {
                console.log(`[normalizeDiffSections] Diff ${index}: Full file replacement with empty search - will replace all content from line ${diff.startLine}`);
            }
        }

        return normalized as NormalizedDiffSection;
    });
}

// ===== Validation Hierarchy Implementation =====

/**
 * Represents a validation strategy with its configuration
 */
interface ValidationStrategy {
    name: string;
    level: number;
    description: string;
    execute: (matcher: ContentMatcher, lines: string[], targetContent: string, startHint?: number) => MatchResult | null;
}

/**
 * Represents an attempt to validate content
 */
interface ValidationAttempt {
    strategy: ValidationStrategy;
    result: MatchResult | null;
    duration: number;
    error?: string;
}

/**
 * Manages hierarchical validation strategies with progressive fallback
 */
class ValidationHierarchy {
    private strategies: ValidationStrategy[] = [];
    
    constructor() {
        this.initializeStrategies();
    }
    
    private initializeStrategies(): void {
        // Level 1: Strict Validation
        this.strategies.push({
            name: 'exact-match-at-hint',
            level: 1,
            description: 'Exact match at hinted line location',
            execute: (matcher, lines, targetContent, startHint) => {
                if (startHint !== undefined) {
                    // Try exact location first
                    const targetLines = targetContent.split('\n').length;
                    if (startHint + targetLines <= lines.length) {
                        const exactContent = lines.slice(startHint, startHint + targetLines).join('\n');
                        if (exactContent === targetContent) {
                            return {
                                startLine: startHint,
                                endLine: startHint + targetLines - 1,
                                confidence: 1.0,
                                strategy: 'exact-match-at-hint',
                                actualContent: exactContent,
                                issues: []
                            };
                        }
                    }
                }
                return null;
            }
        });
        
        this.strategies.push({
            name: 'exact-match-near-hint',
            level: 1,
            description: 'Exact match near hinted line (±5 lines)',
            execute: (matcher, lines, targetContent, startHint) => {
                if (startHint !== undefined) {
                    return matcher.findExactMatchWithRadius(lines, targetContent, startHint, 5);
                }
                return null;
            }
        });
        
        this.strategies.push({
            name: 'exact-match',
            level: 1,
            description: 'Character-for-character exact matching including whitespace',
            execute: (matcher, lines, targetContent, startHint) => {
                // Use hint-aware matching if hint provided
                if (startHint !== undefined) {
                    return matcher.findBestMatchWithHint(lines, targetContent, startHint);
                }
                return matcher.findExactMatch(lines, targetContent, startHint);
            }
        });
        
        // Level 2: Permissive Validation
        this.strategies.push({
            name: 'normalized-whitespace',
            level: 2,
            description: 'Whitespace-normalized matching (ignores leading/trailing whitespace)',
            execute: (matcher, lines, targetContent) => {
                return matcher.findNormalizedMatch(lines, targetContent, {
                    ignoreLeadingWhitespace: true,
                    ignoreTrailingWhitespace: true,
                    normalizeIndentation: true,
                    caseSensitive: true
                });
            }
        });
        
        this.strategies.push({
            name: 'case-insensitive',
            level: 2,
            description: 'Case-insensitive matching',
            execute: (matcher, lines, targetContent) => {
                return matcher.findNormalizedMatch(lines, targetContent, {
                    ignoreLeadingWhitespace: true,
                    ignoreTrailingWhitespace: true,
                    normalizeIndentation: true,
                    caseSensitive: false
                });
            }
        });
        
        // Level 3: Fuzzy Validation
        this.strategies.push({
            name: 'similarity-high',
            level: 3,
            description: 'High-confidence similarity matching (90%+)',
            execute: (matcher, lines, targetContent) => {
                const matches = matcher.findSimilarityMatch(lines, targetContent, 0.9);
                return matcher.selectBestMatch(matches, 0.9);
            }
        });
        
        this.strategies.push({
            name: 'similarity-medium',
            level: 3,
            description: 'Medium-confidence similarity matching (80%+)',
            execute: (matcher, lines, targetContent) => {
                const matches = matcher.findSimilarityMatch(lines, targetContent, 0.8);
                return matcher.selectBestMatch(matches, 0.8);
            }
        });
        
        this.strategies.push({
            name: 'similarity-low',
            level: 3,
            description: 'Low-confidence similarity matching (70%+)',
            execute: (matcher, lines, targetContent) => {
                const matches = matcher.findSimilarityMatch(lines, targetContent, 0.7);
                return matcher.selectBestMatch(matches, 0.7);
            }
        });
        
        this.strategies.push({
            name: 'contextual',
            level: 3,
            description: 'Contextual matching using surrounding code',
            execute: (matcher, lines, targetContent) => {
                return matcher.findContextualMatch(lines, targetContent, 3);
            }
        });
    }
    
    /**
     * Execute validation strategies in hierarchical order with early termination
     */
    async executeHierarchy(
        matcher: ContentMatcher,
        lines: string[],
        targetContent: string,
        startHint?: number,
        options?: {
            earlyTerminationConfidence?: number;  // Stop if confidence >= this value
            maxAttempts?: number;                 // Maximum strategies to try
        }
    ): Promise<{
        match: MatchResult | null;
        attempts: ValidationAttempt[];
        totalDuration: number;
        earlyTerminated: boolean;
    }> {
        const attempts: ValidationAttempt[] = [];
        const startTime = Date.now();
        let match: MatchResult | null = null;
        const earlyTerminationConfidence = options?.earlyTerminationConfidence ?? 0.95;
        const maxAttempts = options?.maxAttempts ?? this.strategies.length;
        let earlyTerminated = false;
        
        // Execute strategies in order until a match is found
        for (let i = 0; i < this.strategies.length && i < maxAttempts; i++) {
            const strategy = this.strategies[i];
            const attemptStart = Date.now();
            
            try {
                console.log(`[ValidationHierarchy] Trying strategy: ${strategy.name} (level ${strategy.level})`);
                const result = strategy.execute(matcher, lines, targetContent, startHint);
                
                attempts.push({
                    strategy,
                    result,
                    duration: Date.now() - attemptStart
                });
                
                if (result) {
                    match = result;
                    console.log(`[ValidationHierarchy] Match found with ${strategy.name} (confidence: ${result.confidence})`);
                    
                    // Early termination for high-confidence matches
                    if (result.confidence >= earlyTerminationConfidence) {
                        console.log(`[ValidationHierarchy] Early termination - confidence ${result.confidence} >= ${earlyTerminationConfidence}`);
                        earlyTerminated = true;
                        break;
                    }
                    
                    // For lower confidence, continue searching unless we're at level 3
                    if (strategy.level < 3) {
                        continue;
                    } else {
                        break;
                    }
                }
            } catch (error) {
                attempts.push({
                    strategy,
                    result: null,
                    duration: Date.now() - attemptStart,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        
        return {
            match,
            attempts,
            totalDuration: Date.now() - startTime,
            earlyTerminated
        };
    }
    
    /**
     * Get strategies by level
     */
    getStrategiesByLevel(level: number): ValidationStrategy[] {
        return this.strategies.filter(s => s.level === level);
    }
    
    /**
     * Generate a detailed report of validation attempts
     */
    generateReport(attempts: ValidationAttempt[]): string {
        const lines = ['Validation Hierarchy Report:'];
        lines.push('=' .repeat(50));
        
        for (const attempt of attempts) {
            lines.push(`\nStrategy: ${attempt.strategy.name} (Level ${attempt.strategy.level})`);
            lines.push(`Description: ${attempt.strategy.description}`);
            lines.push(`Duration: ${attempt.duration}ms`);
            
            if (attempt.result) {
                lines.push(`Result: MATCH FOUND`);
                lines.push(`  - Confidence: ${(attempt.result.confidence * 100).toFixed(1)}%`);
                lines.push(`  - Lines: ${attempt.result.startLine}-${attempt.result.endLine}`);
                if (attempt.result.issues && attempt.result.issues.length > 0) {
                    lines.push(`  - Issues: ${attempt.result.issues.join(', ')}`);
                }
            } else if (attempt.error) {
                lines.push(`Result: ERROR - ${attempt.error}`);
            } else {
                lines.push(`Result: NO MATCH`);
            }
        }
        
        return lines.join('\n');
    }
}

// ===== Structural Integrity Validation Implementation =====

/**
 * Validates structural integrity of code before and after modifications
 */
class StructuralValidator {
    /**
     * Count structural elements in content
     */
    private countElements(content: string): StructuralElements {
        const elements: StructuralElements = {
            braces: { open: 0, close: 0 },
            parentheses: { open: 0, close: 0 },
            brackets: { open: 0, close: 0 },
            singleQuotes: 0,
            doubleQuotes: 0,
            backticks: 0,
            blockComments: { open: 0, close: 0 }
        };
        
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let inBacktick = false;
        let inBlockComment = false;
        let inLineComment = false;
        let escapeNext = false;
        
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            const nextChar = content[i + 1];
            const prevChar = content[i - 1];
            
            // Handle escape sequences
            if (escapeNext) {
                escapeNext = false;
                continue;
            }
            if (char === '\\') {
                escapeNext = true;
                continue;
            }
            
            // Skip characters inside strings
            if (inSingleQuote || inDoubleQuote || inBacktick) {
                if (char === "'" && inSingleQuote) {
                    inSingleQuote = false;
                } else if (char === '"' && inDoubleQuote) {
                    inDoubleQuote = false;
                } else if (char === '`' && inBacktick) {
                    inBacktick = false;
                }
                continue;
            }
            
            // Skip characters inside comments
            if (inBlockComment) {
                if (char === '*' && nextChar === '/') {
                    elements.blockComments.close++;
                    inBlockComment = false;
                    i++; // Skip next char
                }
                continue;
            }
            if (inLineComment) {
                if (char === '\n') {
                    inLineComment = false;
                }
                continue;
            }
            
            // Handle comments
            if (char === '/' && nextChar === '*') {
                elements.blockComments.open++;
                inBlockComment = true;
                i++; // Skip next char
                continue;
            }
            if (char === '/' && nextChar === '/') {
                inLineComment = true;
                i++; // Skip next char
                continue;
            }
            
            // Handle strings
            if (char === "'") {
                elements.singleQuotes++;
                inSingleQuote = true;
            } else if (char === '"') {
                elements.doubleQuotes++;
                inDoubleQuote = true;
            } else if (char === '`') {
                elements.backticks++;
                inBacktick = true;
            }
            
            // Count structural elements
            switch (char) {
                case '{': elements.braces.open++; break;
                case '}': elements.braces.close++; break;
                case '(': elements.parentheses.open++; break;
                case ')': elements.parentheses.close++; break;
                case '[': elements.brackets.open++; break;
                case ']': elements.brackets.close++; break;
            }
        }
        
        return elements;
    }
    
    /**
     * Validate structural integrity
     */
    validateStructure(contentBefore: string, contentAfter: string, filePath: string): StructuralValidationResult {
        const elementsBefore = this.countElements(contentBefore);
        const elementsAfter = this.countElements(contentAfter);
        const warnings: StructuralWarning[] = [];
        
        // Check for unbalanced delimiters
        this.checkDelimiterBalance(elementsBefore, elementsAfter, warnings);
        
        // Check for unclosed strings and comments
        this.checkUnclosedElements(elementsAfter, warnings);
        
        // Language-specific validation
        const fileExtension = filePath.split('.').pop()?.toLowerCase();
        if (fileExtension) {
            this.performLanguageSpecificValidation(contentAfter, fileExtension, warnings);
        }
        
        // Generate analysis
        const analysis = this.generateAnalysis(elementsBefore, elementsAfter);
        
        return {
            isValid: warnings.filter(w => w.severity === 'high').length === 0,
            warnings,
            elementsBefore,
            elementsAfter,
            analysis
        };
    }
    
    /**
     * Check delimiter balance
     */
    private checkDelimiterBalance(
        before: StructuralElements,
        after: StructuralElements,
        warnings: StructuralWarning[]
    ): void {
        // Check braces
        if (after.braces.open !== after.braces.close) {
            warnings.push({
                type: 'unbalanced_braces',
                severity: 'high',
                message: `Unbalanced braces: ${after.braces.open} open, ${after.braces.close} close`,
                details: `Change from before: ${before.braces.open - before.braces.close} → ${after.braces.open - after.braces.close}`
            });
        }
        
        // Check parentheses
        if (after.parentheses.open !== after.parentheses.close) {
            warnings.push({
                type: 'unbalanced_parentheses',
                severity: 'high',
                message: `Unbalanced parentheses: ${after.parentheses.open} open, ${after.parentheses.close} close`,
                details: `Change from before: ${before.parentheses.open - before.parentheses.close} → ${after.parentheses.open - after.parentheses.close}`
            });
        }
        
        // Check brackets
        if (after.brackets.open !== after.brackets.close) {
            warnings.push({
                type: 'unbalanced_brackets',
                severity: 'high',
                message: `Unbalanced brackets: ${after.brackets.open} open, ${after.brackets.close} close`,
                details: `Change from before: ${before.brackets.open - before.brackets.close} → ${after.brackets.open - after.brackets.close}`
            });
        }
        
        // Check quotes (should be even)
        if (after.singleQuotes % 2 !== 0) {
            warnings.push({
                type: 'unbalanced_quotes',
                severity: 'medium',
                message: `Odd number of single quotes: ${after.singleQuotes}`,
                details: 'May indicate an unclosed string literal'
            });
        }
        if (after.doubleQuotes % 2 !== 0) {
            warnings.push({
                type: 'unbalanced_quotes',
                severity: 'medium',
                message: `Odd number of double quotes: ${after.doubleQuotes}`,
                details: 'May indicate an unclosed string literal'
            });
        }
        if (after.backticks % 2 !== 0) {
            warnings.push({
                type: 'unbalanced_quotes',
                severity: 'medium',
                message: `Odd number of backticks: ${after.backticks}`,
                details: 'May indicate an unclosed template literal'
            });
        }
    }
    
    /**
     * Check for unclosed elements
     */
    private checkUnclosedElements(elements: StructuralElements, warnings: StructuralWarning[]): void {
        // Check for unclosed block comments
        if (elements.blockComments.open > elements.blockComments.close) {
            warnings.push({
                type: 'unclosed_comment',
                severity: 'high',
                message: `Unclosed block comment detected`,
                details: `${elements.blockComments.open} /* found but only ${elements.blockComments.close} */`
            });
        }
    }
    
    /**
     * Perform language-specific validation
     */
    private performLanguageSpecificValidation(
        content: string,
        fileExtension: string,
        warnings: StructuralWarning[]
    ): void {
        switch (fileExtension) {
            case 'json':
                this.validateJSON(content, warnings);
                break;
            case 'ts':
            case 'tsx':
            case 'js':
            case 'jsx':
                this.validateJavaScriptTypeScript(content, warnings);
                break;
        }
    }
    
    /**
     * Validate JSON structure
     */
    private validateJSON(content: string, warnings: StructuralWarning[]): void {
        try {
            JSON.parse(content);
        } catch (error) {
            warnings.push({
                type: 'json_invalid',
                severity: 'high',
                message: 'Invalid JSON structure',
                details: error instanceof Error ? error.message : 'Unknown JSON parsing error'
            });
        }
    }
    
    /**
     * Basic validation for JavaScript/TypeScript
     */
    private validateJavaScriptTypeScript(content: string, warnings: StructuralWarning[]): void {
        // Check for common syntax patterns that might indicate issues
        const lines = content.split('\n');
        
        // Check for incomplete function declarations
        const functionPattern = /^\s*(async\s+)?function\s+\w+\s*\([^)]*$/;
        const arrowFunctionPattern = /^\s*(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*$/;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (functionPattern.test(line) || arrowFunctionPattern.test(line)) {
                // Check if next line has opening brace
                if (i + 1 < lines.length && !lines[i + 1].includes('{')) {
                    warnings.push({
                        type: 'syntax_error',
                        severity: 'low',
                        message: `Possible incomplete function declaration at line ${i + 1}`,
                        details: 'Function declaration may be missing its body'
                    });
                }
            }
        }
        
        // Check for trailing commas in inappropriate places (very basic)
        if (/,\s*}/.test(content) || /,\s*\]/.test(content)) {
            // This is actually valid in modern JS/TS, so just a low severity note
            warnings.push({
                type: 'syntax_error',
                severity: 'low',
                message: 'Trailing commas detected',
                details: 'While valid in modern JavaScript, ensure compatibility with your target environment'
            });
        }
    }
    
    /**
     * Generate analysis summary
     */
    private generateAnalysis(before: StructuralElements, after: StructuralElements): string {
        const changes: string[] = [];
        
        // Compare delimiters
        const braceChange = (after.braces.open - after.braces.close) - (before.braces.open - before.braces.close);
        const parenChange = (after.parentheses.open - after.parentheses.close) - (before.parentheses.open - before.parentheses.close);
        const bracketChange = (after.brackets.open - after.brackets.close) - (before.brackets.open - before.brackets.close);
        
        if (braceChange !== 0) {
            changes.push(`Brace balance changed by ${braceChange > 0 ? '+' : ''}${braceChange}`);
        }
        if (parenChange !== 0) {
            changes.push(`Parenthesis balance changed by ${parenChange > 0 ? '+' : ''}${parenChange}`);
        }
        if (bracketChange !== 0) {
            changes.push(`Bracket balance changed by ${bracketChange > 0 ? '+' : ''}${bracketChange}`);
        }
        
        // Quote changes
        const singleQuoteChange = after.singleQuotes - before.singleQuotes;
        const doubleQuoteChange = after.doubleQuotes - before.doubleQuotes;
        const backtickChange = after.backticks - before.backticks;
        
        if (singleQuoteChange !== 0) {
            changes.push(`Single quotes changed by ${singleQuoteChange > 0 ? '+' : ''}${singleQuoteChange}`);
        }
        if (doubleQuoteChange !== 0) {
            changes.push(`Double quotes changed by ${doubleQuoteChange > 0 ? '+' : ''}${doubleQuoteChange}`);
        }
        if (backtickChange !== 0) {
            changes.push(`Backticks changed by ${backtickChange > 0 ? '+' : ''}${backtickChange}`);
        }
        
        if (changes.length === 0) {
            return 'No structural changes detected';
        }
        
        return 'Structural changes: ' + changes.join(', ');
    }
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
        if (maxLength === 0) {
            return 1.0;
        }
        
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
        if (candidates.length === 0) {
            return null;
        }
        
        const validCandidates = candidates.filter(c => c.confidence >= minConfidence);
        if (validCandidates.length === 0) {
            return null;
        }
        
        // Sort by confidence (highest first)
        validCandidates.sort((a, b) => b.confidence - a.confidence);
        return validCandidates[0];
    }

    
    /**
     * Find exact match with expanding search radius from hint
     */
    findExactMatchWithRadius(lines: string[], targetContent: string, startHint: number, maxRadius: number = -1): MatchResult | null {
        const targetLines = targetContent.split('\n');
        const maxSearchRadius = maxRadius < 0 ? lines.length : maxRadius;
        
        // First try at exact hint location
        const hintMatch = this.findExactMatch(lines, targetContent, startHint);
        if (hintMatch && hintMatch.startLine === startHint) {
            return hintMatch;
        }
        
        // Try expanding radius
        for (let radius = 1; radius <= maxSearchRadius; radius++) {
            // Try before hint
            if (startHint - radius >= 0) {
                const beforeMatch = this.findExactMatch(lines.slice(0, startHint), targetContent, Math.max(0, startHint - radius));
                if (beforeMatch) {
                    return beforeMatch;
                }
            }
            
            // Try after hint
            if (startHint + radius < lines.length) {
                const afterMatch = this.findExactMatch(lines, targetContent, startHint + radius);
                if (afterMatch && afterMatch.startLine < startHint + radius + targetLines.length) {
                    return afterMatch;
                }
            }
        }
        
        return null;
    }
    
    /**
     * Find all occurrences of content in the file
     */
    findAllMatches(lines: string[], targetContent: string): MatchResult[] {
        const matches: MatchResult[] = [];
        const targetLines = targetContent.split('\n');
        
        for (let i = 0; i <= lines.length - targetLines.length; i++) {
            const match = this.findExactMatch(lines, targetContent, i);
            if (match && match.startLine === i) {
                matches.push(match);
                // Skip past this match
                i = match.endLine;
            }
        }
        
        return matches;
    }
    
    /**
     * Find best match considering line hints
     */
    findBestMatchWithHint(lines: string[], targetContent: string, startHint: number): MatchResult | null {
        // Find all exact matches
        const allMatches = this.findAllMatches(lines, targetContent);
        
        if (allMatches.length === 0) {
            return null;
        }
        
        if (allMatches.length === 1) {
            return allMatches[0];
        }
        
        // Multiple matches - choose closest to hint
        let bestMatch = allMatches[0];
        let bestDistance = Math.abs(allMatches[0].startLine - startHint);
        
        for (const match of allMatches) {
            const distance = Math.abs(match.startLine - startHint);
            if (distance < bestDistance) {
                bestMatch = match;
                bestDistance = distance;
            }
        }
        
        // Add warning about multiple matches
        if (!bestMatch.issues) {
            bestMatch.issues = [];
        }
        bestMatch.issues.push(`Found ${allMatches.length} identical matches. Using closest to line ${startHint}.`);
        
        return bestMatch;
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
    
    // Use cached content if available
    const { lines } = await getCachedFileContent(fileUri);
    const fileExists = lines.length > 0;
    
    if (!fileExists) {
        console.log(`[validateDiffSections] File ${filePath} does not exist. Treating as empty file for validation.`);
    }

    const matcher = new ContentMatcher();
    const matches: (MatchResult | null)[] = [];
    const conflicts: ConflictInfo[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Sort diffs by line number for processing
    const sortedDiffs = [...diffs].sort((a, b) => a.startLine - b.startLine);

    // Special handling for empty files (new or existing)
    if (lines.length === 0) {
        // For new files, we can only validate that diffs are for insertion at the beginning
        const normalizedDiffs = normalizeDiffSections(sortedDiffs);
        
        let currentLine = 0;
        for (let i = 0; i < normalizedDiffs.length; i++) {
            const diff = normalizedDiffs[i];
            
            // For new files, handle special cases
            if (diff.endLine === -1) {
                // Full file replacement on new file (equivalent to file creation)
                console.log(`[validateDiffSections] Diff ${i}: Full file replacement on new file`);
                matches.push({
                    startLine: 0,
                    endLine: 0,
                    confidence: 1.0,
                    strategy: 'new-file-full-replacement',
                    actualContent: '',
                    issues: []
                });
                continue;
            } else if ((diff.search === '' || diff.search.trim() === '') || (diff.startLine === 0 && diff.endLine === 0)) {
                // Normal insert for new files
                // Calculate how many lines this diff will add
                const linesToAdd = diff.replace.split('\n').length;
                
                matches.push({
                    startLine: currentLine,
                    endLine: currentLine,
                    confidence: 1.0,
                    strategy: 'new-file-insert',
                    actualContent: '',
                    issues: []
                });
                
                // Move current line position for next diff
                currentLine += linesToAdd;
            } else {
                conflicts.push({
                    type: 'content_mismatch',
                    diffIndex1: i,
                    description: `Cannot find content in new file: ${diff.search.substring(0, 50)}...`,
                    suggestion: 'For new files, use empty search content or set startLine/endLine to 0'
                });
            }
        }
        
        const isValid = conflicts.length === 0;
        return {
            isValid,
            matches,
            conflicts,
            warnings: lines.length === 0 ? ['Working with empty file'] : warnings,
            suggestions
        };
    }
    
    // Normalize diffs to handle backward compatibility
    const normalizedDiffs = normalizeDiffSections(sortedDiffs);
    
    // Create validation hierarchy
    const validationHierarchy = new ValidationHierarchy();
    
    // Validate each diff section
    for (let i = 0; i < normalizedDiffs.length; i++) {
        const diff = normalizedDiffs[i];
        console.log(`[validateDiffSections] Processing diff ${i}: lines ${diff.startLine}-${diff.endLine}`);

        // Special handling for endLine: -1 (full file replacement)
        if (diff.endLine === -1) {
            console.log(`[validateDiffSections] Diff ${i}: Processing full file replacement from line ${diff.startLine}`);
            
            // For full file replacement, create a match that covers from startLine to end of file
            const actualEndLine = Math.max(0, lines.length - 1);
            const actualContent = lines.slice(diff.startLine).join('\n');
            
            // If search content is empty or matches the actual content, it's valid
            // Normalize line endings for comparison
            const normalizedSearch = diff.search.replace(/\r\n/g, '\n');
            const normalizedActual = actualContent.replace(/\r\n/g, '\n');
            
            // For endLine: -1, validation should be more flexible:
            // 1. Empty search is always valid (full replacement)
            // 2. Non-empty search must match actual content from startLine to end
            const isEmptySearch = diff.search === '' || diff.search.trim() === '';
            let isContentMatch = normalizedSearch === normalizedActual;
            
            // If exact match fails, try normalized whitespace comparison
            if (!isContentMatch && !isEmptySearch) {
                const normalizedSearchWS = normalizedSearch.replace(/\s+/g, ' ').trim();
                const normalizedActualWS = normalizedActual.replace(/\s+/g, ' ').trim();
                isContentMatch = normalizedSearchWS === normalizedActualWS;
            }
            
            const isValid = isEmptySearch || isContentMatch;
            
            if (isValid) {
                matches.push({
                    startLine: diff.startLine,
                    endLine: actualEndLine,
                    confidence: 1.0,
                    strategy: 'full-file-replacement',
                    actualContent: actualContent,
                    issues: []
                });
                console.log(`[validateDiffSections] Diff ${i}: Full file replacement validated successfully (lines ${diff.startLine}-${actualEndLine})`);
                continue; // Skip normal validation for this diff
            } else {
                conflicts.push({
                    type: 'content_mismatch',
                    diffIndex1: i,
                    description: `Full file replacement search content doesn't match actual content from line ${diff.startLine}`,
                    suggestion: 'For full file replacement with endLine: -1, use empty search content or ensure search matches content from startLine to end'
                });
                matches.push(null);
                continue;
            }
        }

        // Use hierarchical validation for normal diffs
        const validationStart = Date.now();
        const validationResult = await validationHierarchy.executeHierarchy(
            matcher,
            lines,
            diff.search,
            diff.startLine
        );
        const validationDuration = Date.now() - validationStart;
        
        const match = validationResult.match;
        
        // Track validation performance
        StructuredLogger.trackOperation(
            'validateDiffSections',
            `diff_validation_${i}`,
            match !== null,
            validationDuration,
            {
                diffIndex: i,
                strategy: match?.strategy || 'none',
                confidence: match?.confidence || 0,
                earlyTerminated: validationResult.earlyTerminated
            }
        );
        
        // Log validation attempts if no match found
        if (!match) {
            console.log(`[validateDiffSections] No match found for diff ${i}`);
            console.log(validationHierarchy.generateReport(validationResult.attempts));
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
            if (match.confidence < 0.9) {
                warnings.push(`Diff ${i} found with ${match.strategy} strategy (confidence: ${match.confidence.toFixed(2)})`);
            }
        } else {
            // No match found - push null to maintain index alignment
            matches.push(null);
            
            // Collect diagnostic information
            const diagnostic: DiagnosticInfo = {
                expected: diff.search,
                actualContent: [],
                searchLocations: [],
                attempts: validationResult.attempts
            };

            // Find best partial matches for diagnostic
            const partialMatches: MatchResult[] = [];
            for (const attempt of validationResult.attempts) {
                if (attempt.result && attempt.result.confidence > 0.5) {
                    partialMatches.push(attempt.result);
                }
            }

            if (partialMatches.length > 0) {
                const best = partialMatches[0];
                diagnostic.bestMatch = {
                    content: best.actualContent,
                    location: best.startLine,
                    confidence: best.confidence,
                    strategy: best.strategy
                };
            }

            // Collect actual content at hint location
            if (diff.startLine < lines.length) {
                const endLine = Math.min(diff.endLine, lines.length - 1);
                diagnostic.actualContent.push(lines.slice(diff.startLine, endLine + 1).join('\n'));
                diagnostic.searchLocations.push(diff.startLine);
            }

            conflicts.push({
                type: 'content_mismatch',
                diffIndex1: i,
                description: `Could not find content for diff section ${i}`,
                suggestion: 'Check if the original content has been modified or update the diff section',
                diagnostic // Store diagnostic for later use
            } as ConflictInfo & { diagnostic: DiagnosticInfo });
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
    matches: (MatchResult | null)[],
    partialSuccess: boolean = false
): Promise<string> {
    console.log(`[createModifiedContent] Creating modified content with ${diffs.length} diff sections (partial mode: ${partialSuccess})`);
    
    if (!vscode.workspace.workspaceFolders) {
        throw new Error('No workspace folder is open');
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, filePath);
    
    // Get the original file content to preserve formatting
    let originalText = '';
    let lines: string[] = [];
    let lineEndings: string = '\n'; // Default to LF for consistency
    let fileExists = true;
    
    try {
        const document = await vscode.workspace.openTextDocument(fileUri);
        originalText = document.getText();
        
        // Detect line endings from original file only if file exists and has content
        if (originalText.length > 0) {
            const crlfCount = (originalText.match(/\r\n/g) || []).length;
            const lfCount = (originalText.match(/(?<!\r)\n/g) || []).length;
            lineEndings = crlfCount > lfCount ? '\r\n' : '\n';
        }
        
        // Get lines while preserving exact content
        for (let i = 0; i < document.lineCount; i++) {
            lines.push(document.lineAt(i).text);
        }
    } catch (error) {
        // File doesn't exist, start with empty content and use LF line endings
        console.log(`[createModifiedContent] File ${filePath} does not exist. Starting with empty content.`);
        lines = [];
        fileExists = false;
        lineEndings = '\n'; // Use LF for new files
    }
    
    // Normalize diffs to handle backward compatibility
    const normalizedDiffs = normalizeDiffSections(diffs);

    // Apply changes from bottom to top to avoid line number shifts
    // Exception: for new file insertions, apply top to bottom
    const hasNewFileInserts = matches.some(m => m && m.strategy === 'new-file-insert');
    
    // In partial success mode, filter out null matches (failed validations)
    const validChanges = matches
        .map((match, index) => ({ match, diff: normalizedDiffs[index], index }))
        .filter((item): item is { match: MatchResult; diff: NormalizedDiffSection; index: number } => item.match !== null);
    
    if (partialSuccess && validChanges.length < matches.length) {
        console.log(`[createModifiedContent] Partial success: applying ${validChanges.length} of ${matches.length} diffs`);
    }
    
    const sortedChanges = validChanges
        .sort((a, b) => hasNewFileInserts ? a.match.startLine - b.match.startLine : b.match.startLine - a.match.startLine);

    for (const { match, diff } of sortedChanges) {
        console.log(`[createModifiedContent] Applying change at lines ${match.startLine}-${match.endLine}`);
        
        // Split replacement content preserving original line endings
        const newLines = diff.replace.split(/\r?\n/);
        
        // For full file replacement (endLine: -1), use content as-is without indentation preservation
        let finalNewLines: string[];
        if (match.strategy === 'full-file-replacement' || match.strategy === 'new-file-full-replacement') {
            // Use replacement content exactly as provided
            finalNewLines = newLines;
        } else {
            // Preserve indentation from the original matched content for regular diffs
            let indentationToPreserve = '';
            if (match.startLine < lines.length && lines[match.startLine]) {
                // Extract leading whitespace from the first line being replaced
                const leadingWhitespace = lines[match.startLine].match(/^\s*/);
                if (leadingWhitespace) {
                    indentationToPreserve = leadingWhitespace[0];
                }
            }
            
            // Apply preserved indentation to new lines (except if it's already indented)
            finalNewLines = newLines.map((line, index) => {
                // Skip empty lines or lines that already have indentation
                if (line === '' || line.match(/^\s/) || index === 0) {
                    return line;
                }
                // Check if original content had this line indented
                const originalLineIndex = match.startLine + index;
                if (originalLineIndex <= match.endLine && originalLineIndex < lines.length) {
                    const originalIndent = lines[originalLineIndex].match(/^\s*/);
                    if (originalIndent && originalIndent[0]) {
                        // Use original line's indentation
                        return originalIndent[0] + line.trimStart();
                    }
                }
                // Otherwise, use the indentation from the first line
                return indentationToPreserve + line;
            });
        }
        
        // Special handling for new file insertions
        if (match.strategy === 'new-file-insert' && lines.length === 0) {
            // For empty files, just set the lines directly
            lines = finalNewLines;
        } else if (match.strategy === 'new-file-insert' || match.strategy === 'new-file-full-replacement') {
            // For subsequent insertions in new files, append
            lines.push(...finalNewLines);
        } else {
            // Normal replacement
            lines.splice(match.startLine, match.endLine - match.startLine + 1, ...finalNewLines);
        }
    }

    // Join with detected line endings to preserve file format
    // For new files, ensure consistent LF line endings unless original file had CRLF
    let result = lines.join(lineEndings);
    if (!fileExists && lineEndings === '\n') {
        // Normalize to LF for new files to ensure consistency
        result = result.replace(/\r\n/g, '\n');
    }
    return result;
}

/**
 * Show diff in VS Code and get user approval using Status Bar Buttons
 */
async function showDiffAndGetApproval(
    filePath: string,
    originalContent: string,
    modifiedContent: string,
    description: string,
    warnings: string[],
    matchResults?: (MatchResult | null)[]
): Promise<boolean> {
    console.log(`[showDiffAndGetApproval] Showing diff for ${filePath}`);
    
    // Show confidence display if match results are available (even with auto-approval)
    let confidenceButton: vscode.StatusBarItem | undefined;
    
    if (matchResults && matchResults.length > 0) {
        confidenceButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 997);
        
        // Calculate average confidence and format display
        const validMatches = matchResults.filter(m => m !== null);
        const avgConfidence = validMatches.reduce((sum, m) => sum + m.confidence, 0) / validMatches.length;
        const confidencePercent = (avgConfidence * 100).toFixed(1);
        
        // Determine confidence icon based on level
        let confidenceIcon = '$(check-all)'; // High confidence
        if (avgConfidence < 0.9) {
            confidenceIcon = '$(warning)'; // Medium confidence
        }
        if (avgConfidence < 0.8) {
            confidenceIcon = '$(alert)'; // Low confidence
        }
        
        confidenceButton.text = `${confidenceIcon} Match Confidence: ${confidencePercent}%`;
        
        // Build detailed tooltip
        const tooltipLines = ['Match Confidence Details:\n'];
        matchResults.forEach((match, index) => {
            if (match) {
                const percent = (match.confidence * 100).toFixed(1);
                const strategy = match.strategy.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                tooltipLines.push(`Diff ${index + 1}: ${percent}% (${strategy})`);
                if (match.issues && match.issues.length > 0) {
                    match.issues.forEach(issue => tooltipLines.push(`  - ${issue}`));
                }
            } else {
                tooltipLines.push(`Diff ${index + 1}: Failed to match`);
            }
        });
        
        confidenceButton.tooltip = tooltipLines.join('\n');
        confidenceButton.show();
        
        // Keep it visible for a few seconds if auto-approval is on
        if (isDiffAutoApprovalEnabled()) {
            setTimeout(() => {
                confidenceButton?.dispose();
            }, 5000); // Show for 5 seconds
        }
    }
    
    // Check if auto-approval is enabled
    if (isDiffAutoApprovalEnabled()) {
        console.log(`[showDiffAndGetApproval] Auto-approval is enabled, automatically approving diff`);
        vscode.window.showInformationMessage(`Auto-approved diff for ${filePath} (Auto-Approval Mode is ON)`);
        return true;
    }
    
    // Generate unique command IDs to avoid conflicts
    const commandId = Date.now().toString();
    const approveCommandId = `mcp.apply-diff.approve.${commandId}`;
    const rejectCommandId = `mcp.apply-diff.reject.${commandId}`;
    
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
    // confidenceButton is already declared above
    
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
        approveButton.command = approveCommandId;
        approveButton.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        approveButton.show();

        rejectButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 999);
        rejectButton.text = '$(x) Reject Changes';
        rejectButton.tooltip = 'Reject changes and keep original file';
        rejectButton.command = rejectCommandId;
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
        
        // Confidence button is already created above, no need to duplicate
        
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
            
            // Register approval command with unique ID
            approveCommand = vscode.commands.registerCommand(approveCommandId, () => {
                if (!resolved) {
                    resolved = true;
                    resolve(true);
                }
            });
            
            // Register rejection command with unique ID
            rejectCommand = vscode.commands.registerCommand(rejectCommandId, () => {
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
            confidenceButton?.dispose();
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
 * Main apply_diff function with improved progress feedback and file creation
 */
export async function applyDiff(args: ApplyDiffArgs): Promise<void> {
    console.log(`[applyDiff] Starting apply_diff for ${args.filePath} with ${args.diffs.length} diff sections`);
    const operationStart = Date.now();
    
    if (!vscode.workspace.workspaceFolders) {
        throw new Error('No workspace folder is open');
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, args.filePath);
    
    // Check if file exists
    let fileExists = false;
    try {
        await vscode.workspace.fs.stat(fileUri);
        fileExists = true;
    } catch (error) {
        // File doesn't exist
        console.log(`[applyDiff] File ${args.filePath} does not exist. Will create it.`);
    }
    
    // Show progress during validation
    const progressOptions = {
        location: vscode.ProgressLocation.Window,
        title: "Apply Diff",
        cancellable: false
    };
    
    return vscode.window.withProgress(progressOptions, async (progress) => {
        // Create file if it doesn't exist
        if (!fileExists) {
            progress.report({ increment: 0, message: "Creating new file..." });
            try {
                await createWorkspaceFile(args.filePath, '', false, false);
                console.log(`[applyDiff] Created new file: ${args.filePath}`);
            } catch (error) {
                console.error(`[applyDiff] Failed to create file: ${error}`);
                throw new Error(`Failed to create file ${args.filePath}: ${error}`);
            }
        }
        
        progress.report({ increment: 10, message: "Validating diff sections..." });
        
        // Validate diff sections
        const validation = await validateDiffSections(args.filePath, args.diffs);
        progress.report({ increment: 30, message: "Validation complete" });
        
        // Handle partial success mode
        if (!validation.isValid && args.partialSuccess) {
            // Check if we have any successful matches
            const successfulMatches = validation.matches.filter(m => m !== null);
            
            if (args.partialSuccess) {
                // In partial success mode, resolve conflicts by preferring higher confidence matches
                const conflictResolutions = new Map<number, boolean>(); // diffIndex -> shouldExclude
                
                // Process each conflict and decide which diff to keep
                validation.conflicts.forEach(c => {
                    const match1 = validation.matches[c.diffIndex1];
                    const match2 = c.diffIndex2 !== undefined ? validation.matches[c.diffIndex2] : null;
                    
                    if (match1 && match2) {
                        // Both matches exist - prefer the one with higher confidence
                        if (match1.confidence > match2.confidence) {
                            console.log(`[applyDiff] Conflict resolution: Keeping diff ${c.diffIndex1} (confidence ${match1.confidence.toFixed(2)}) over diff ${c.diffIndex2} (confidence ${match2.confidence.toFixed(2)})`);
                            if (c.diffIndex2 !== undefined) {
                                conflictResolutions.set(c.diffIndex2, true); // Exclude the lower confidence one
                            }
                        } else if (match2.confidence > match1.confidence) {
                            console.log(`[applyDiff] Conflict resolution: Keeping diff ${c.diffIndex2} (confidence ${match2.confidence.toFixed(2)}) over diff ${c.diffIndex1} (confidence ${match1.confidence.toFixed(2)})`);
                            conflictResolutions.set(c.diffIndex1, true); // Exclude the lower confidence one
                        } else {
                            // Equal confidence - prefer the first one (original behavior)
                            console.log(`[applyDiff] Conflict resolution: Keeping diff ${c.diffIndex1} over diff ${c.diffIndex2} (equal confidence ${match1.confidence.toFixed(2)})`);
                            if (c.diffIndex2 !== undefined) {
                                conflictResolutions.set(c.diffIndex2, true);
                            }
                        }
                    } else if (match1 && !match2) {
                        // Only first match exists - exclude the second
                        if (c.diffIndex2 !== undefined) {
                            conflictResolutions.set(c.diffIndex2, true);
                        }
                    } else if (!match1 && match2) {
                        // Only second match exists - exclude the first
                        conflictResolutions.set(c.diffIndex1, true);
                    } else {
                        // Neither match exists - exclude both
                        conflictResolutions.set(c.diffIndex1, true);
                        if (c.diffIndex2 !== undefined) {
                            conflictResolutions.set(c.diffIndex2, true);
                        }
                    }
                });

                // Apply the exclusions
                for (let i = 0; i < validation.matches.length; i++) {
                    if (validation.matches[i] && conflictResolutions.get(i)) {
                        console.warn(`[applyDiff] Excluding diff ${i} due to conflict resolution`);
                        validation.matches[i] = null;
                    }
                }

                const finalSuccessfulCount = validation.matches.filter(m => m !== null).length;

                console.log(`[applyDiff] Partial success mode: ${finalSuccessfulCount}/${args.diffs.length} diffs will be applied after conflict resolution`);

                // Log conflicts
                validation.conflicts.forEach(c => {
                    console.warn(`[applyDiff] Conflict: ${c.description}`);
                });

                // Add warning about partial application
                validation.warnings.push(
                    `Partial success: ${finalSuccessfulCount} of ${args.diffs.length} diffs will be applied. ` +
                    `${conflictResolutions.size} diffs excluded due to conflicts.`
                );

                if (finalSuccessfulCount === 0) {
                    // No successful matches after filtering conflicts
                    const error = new ApplyDiffError(
                        `No diffs could be applied successfully for ${args.filePath}. ` +
                        `All ${successfulMatches.length} validated diffs were excluded due to conflicts.`,
                        {} as DiagnosticInfo,
                        ErrorLevel.SIMPLE
                    );
                }
            } else {
                // No successful matches even in partial mode
                throw new Error(
                    `No diffs could be validated successfully for ${args.filePath}. ` +
                    `Even in partial success mode, at least one diff must be valid.`
                );
            }
        } else if (!validation.isValid) {
            // Normal mode - fail on any validation error
            const conflictWithDiagnostic = validation.conflicts.find(c => 
                (c as any).diagnostic !== undefined
            ) as (ConflictInfo & { diagnostic: DiagnosticInfo }) | undefined;
            
            if (conflictWithDiagnostic?.diagnostic) {
                const error = new ApplyDiffError(
                    `Validation failed for ${args.filePath}`,
                    conflictWithDiagnostic.diagnostic,
                    ErrorLevel.DETAILED
                );
                throw new Error(error.format());
            } else {
                // Fallback to simple error
                const errorMsg = `Validation failed for ${args.filePath}:\n` +
                    `Conflicts: ${validation.conflicts.map(c => c.description).join(', ')}\n` +
                    `Suggestions: ${validation.suggestions.join(', ')}`;
                throw new Error(errorMsg);
            }
        }
        
        progress.report({ increment: 20, message: "Preparing changes..." });
        
        // Create modified content
        let originalContent = '';
        try {
            originalContent = await vscode.workspace.openTextDocument(fileUri).then(doc => doc.getText());
        } catch (error) {
            // File might have just been created, so it's empty
            originalContent = '';
        }
        
        const modifiedContent = await createModifiedContent(args.filePath, args.diffs, validation.matches, args.partialSuccess);
        progress.report({ increment: 20, message: "Changes prepared" });
        
        // Perform structural integrity validation
        progress.report({ increment: 5, message: "Validating structural integrity..." });
        const structuralValidator = new StructuralValidator();
        const structuralValidation = structuralValidator.validateStructure(
            originalContent,
            modifiedContent,
            args.filePath
        );
        
        // Add structural warnings to existing warnings
        const allWarnings = [
            ...validation.warnings,
            ...structuralValidation.warnings.map(w => `[${w.severity.toUpperCase()}] ${w.message}${w.details ? ': ' + w.details : ''}`)
        ];
        
        // Log structural analysis
        console.log(`[applyDiff] Structural analysis: ${structuralValidation.analysis}`);
        if (structuralValidation.warnings.length > 0) {
            console.log(`[applyDiff] Structural warnings:`, structuralValidation.warnings);
        }
        
        // Show diff and get user approval
        progress.report({ increment: 5, message: "Showing diff preview..." });
        const approved = await showDiffAndGetApproval(
            args.filePath,
            originalContent,
            modifiedContent,
            args.description || 'Apply diff changes',
            allWarnings,
            validation.matches
        );
        
        if (!approved) {
            throw new Error('Changes were rejected by user');
        }
        
        progress.report({ increment: 10, message: "Applying changes..." });
        
        // Apply the changes
        await applyDiffToFile(args.filePath, modifiedContent);
        
        progress.report({ increment: 10, message: "Changes applied successfully!" });
        
        const totalDuration = Date.now() - operationStart;
        console.log(`[applyDiff] Successfully applied diff to ${args.filePath} in ${totalDuration}ms`);
        
        // Track overall operation success
        StructuredLogger.trackOperation(
            'applyDiff',
            'apply_diff_complete',
            true,
            totalDuration,
            {
                filePath: args.filePath,
                diffsCount: args.diffs.length,
                partialSuccess: args.partialSuccess || false,
                warningsCount: allWarnings.length
            }
        );
        
        // Log performance metrics periodically
        const metrics = StructuredLogger.getPerformanceMetrics('applyDiff');
        if (metrics.count % 10 === 0) {
            console.log(`[applyDiff] Performance metrics after ${metrics.count} operations:`, {
                avgDuration: `${metrics.avgDuration.toFixed(2)}ms`,
                successRate: `${metrics.successRate.toFixed(1)}%`
            });
        }
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
        `Use this tool to apply multiple diff sections to a file with advanced fuzzy matching capabilities. This is the preferred tool for making complex changes to existing files.
        
        Key Features:
        - Multiple diff sections in a single operation
        - Automatic file creation if file doesn't exist
        - Fuzzy matching handles whitespace differences, content drift, and formatting variations
        - Shows unified diff preview before applying changes
        - Atomic all-or-nothing application (or partial success mode)
        - Backward compatible with originalContent/newContent parameters
        - Partial success mode: apply successful diffs even if some fail
        - **Full file replacement**: Use endLine: -1 to replace entire file from startLine to end

        Best Practices:
        - Use for related changes that should be applied together
        - The tool will automatically find content even if line numbers have shifted
        - Handles whitespace and indentation differences gracefully
        - Shows confidence levels for fuzzy matches
        - Requires user approval before applying changes
        - For full file replacement, use startLine: 0, endLine: -1, empty search string

        Example usage:
        - Updating multiple import statements
        - Refactoring function signatures across a file
        - Adding multiple related code sections
        - Creating new files with initial content
        - **Full file replacement**: Replace entire file contents
        `,
        {
            filePath: z.string().describe('Path to the file to modify or create'),
            description: z.string().optional().describe('Overall description of the changes'),
            diffs: z.array(z.object({
                startLine: z.number().describe('Starting line number (0-based, hint for search)'),
                endLine: z.number().describe('Ending line number (0-based, hint for search). Use -1 to replace from startLine to end of file'),
                search: z.string().optional().describe('Content to search for (formerly originalContent)'),
                replace: z.string().optional().describe('Content to replace with (formerly newContent)'),
                description: z.string().optional().describe('Description of this change section'),
                // Backward compatibility
                originalContent: z.string().optional().describe('Deprecated: Use search instead'),
                newContent: z.string().optional().describe('Deprecated: Use replace instead')
            }).refine(data => {
                // Ensure either search or originalContent is provided (allowing empty string for new files)
                const hasSearch = data.search !== undefined || data.originalContent !== undefined;
                const hasReplace = data.replace !== undefined || data.newContent !== undefined;
                return hasSearch && hasReplace;
            }, {
                message: "Either 'search' or 'originalContent' must be provided, and either 'replace' or 'newContent' must be provided"
            })).describe('Array of diff sections to apply'),
            partialSuccess: z.boolean().optional().default(false).describe('Whether to apply successful diffs even if some fail')
        },
        async ({ filePath, diffs, description, partialSuccess }): Promise<CallToolResult> => {
            console.log(`[apply_diff] Tool called with filePath=${filePath}, ${diffs.length} diff sections, partialSuccess=${partialSuccess}`);
            
            try {
                await applyDiff({ filePath, diffs, description, partialSuccess });
                
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
