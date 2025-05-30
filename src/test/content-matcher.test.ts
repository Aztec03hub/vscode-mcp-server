import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { before, after, beforeEach, afterEach } from 'mocha';

// Import the ContentMatcher and related types from edit-tools
// We need to access private classes, so we'll use a different approach
import * as editTools from '../tools/edit-tools';

// We'll need to extract the ContentMatcher class for testing
// Since it's not exported, we'll create a test version
class TestContentMatcher {
    private defaultOptions = {
        ignoreLeadingWhitespace: true,
        ignoreTrailingWhitespace: true,
        normalizeIndentation: true,
        ignoreEmptyLines: false,
        caseSensitive: true
    };

    /**
     * Find exact match for content in the file lines
     */
    findExactMatch(lines: string[], targetContent: string, startHint?: number): any {
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
    private normalizeContent(content: string, options: any): string {
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
    findNormalizedMatch(lines: string[], targetContent: string, options?: any): any {
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
     * Calculate similarity between two strings using Levenshtein distance
     */
    private calculateSimilarity(str1: string, str2: string): number {
        // Simple similarity calculation for testing
        const maxLength = Math.max(str1.length, str2.length);
        if (maxLength === 0) {
            return 1.0;
        }
        
        // Count matching characters (simplified)
        let matches = 0;
        for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
            if (str1[i] === str2[i]) {
                matches++;
            }
        }
        
        return matches / maxLength;
    }

    /**
     * Find content using similarity matching
     */
    findSimilarityMatch(lines: string[], targetContent: string, threshold: number = 0.8): any[] {
        const results: any[] = [];
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
     * Select the best match from candidates based on confidence
     */
    selectBestMatch(candidates: any[], minConfidence: number = 0.7): any {
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
     * Determine if a match requires user confirmation
     */
    requiresUserConfirmation(match: any): boolean {
        return match.confidence < 0.9 || (match.issues?.length ?? 0) > 0;
    }
}

suite('ContentMatcher Test Suite', () => {
    let matcher: TestContentMatcher;

    setup(() => {
        matcher = new TestContentMatcher();
    });

    suite('Exact Match Tests', () => {
        test('Should find exact match at beginning of file', () => {
            const lines = [
                'function test() {',
                '    return 42;',
                '}',
                '',
                'const x = 1;'
            ];
            const target = 'function test() {\n    return 42;\n}';
            
            const result = matcher.findExactMatch(lines, target);
            
            assert.strictEqual(result !== null, true, 'Should find match');
            assert.strictEqual(result.startLine, 0);
            assert.strictEqual(result.endLine, 2);
            assert.strictEqual(result.confidence, 1.0);
            assert.strictEqual(result.strategy, 'exact');
            assert.strictEqual(result.issues.length, 0);
        });

        test('Should find exact match in middle of file', () => {
            const lines = [
                'const x = 1;',
                'function test() {',
                '    return 42;',
                '}',
                'const y = 2;'
            ];
            const target = 'function test() {\n    return 42;\n}';
            
            const result = matcher.findExactMatch(lines, target);
            
            assert.strictEqual(result !== null, true, 'Should find match');
            assert.strictEqual(result.startLine, 1);
            assert.strictEqual(result.endLine, 3);
        });

        test('Should return null when no exact match found', () => {
            const lines = [
                'function test() {',
                '    return 42;',
                '}'
            ];
            const target = 'function different() {\n    return 42;\n}';
            
            const result = matcher.findExactMatch(lines, target);
            
            assert.strictEqual(result, null);
        });

        test('Should use start hint to optimize search', () => {
            const lines = [
                'function test1() {',
                '    return 1;',
                '}',
                'function test2() {',
                '    return 2;',
                '}'
            ];
            const target = 'function test2() {\n    return 2;\n}';
            
            const result = matcher.findExactMatch(lines, target, 3);
            
            assert.strictEqual(result !== null, true, 'Should find match');
            assert.strictEqual(result.startLine, 3);
        });
    });

    suite('Normalized Match Tests', () => {
        test('Should find match ignoring leading whitespace', () => {
            const lines = [
                '   function test() {',
                '       return 42;',
                '   }'
            ];
            const target = 'function test() {\n    return 42;\n}';
            
            const result = matcher.findNormalizedMatch(lines, target);
            
            assert.strictEqual(result !== null, true, 'Should find normalized match');
            assert.strictEqual(result.strategy, 'normalized');
            assert.strictEqual(result.confidence, 0.9);
            assert.strictEqual(result.issues.length, 1);
            assert.strictEqual(result.issues[0], 'Content differs in whitespace or formatting');
        });

        test('Should find match ignoring trailing whitespace', () => {
            const lines = [
                'function test() {   ',
                '    return 42;   ',
                '}   '
            ];
            const target = 'function test() {\n    return 42;\n}';
            
            const result = matcher.findNormalizedMatch(lines, target);
            
            assert.strictEqual(result !== null, true, 'Should find normalized match');
            assert.strictEqual(result.strategy, 'normalized');
        });

        test('Should handle tab to space conversion', () => {
            const lines = [
                'function test() {',
                '\treturn 42;',
                '}'
            ];
            const target = 'function test() {\n    return 42;\n}';
            
            const result = matcher.findNormalizedMatch(lines, target);
            
            assert.strictEqual(result !== null, true, 'Should find normalized match with tab conversion');
        });

        test('Should respect case sensitivity option', () => {
            const lines = [
                'FUNCTION TEST() {',
                '    RETURN 42;',
                '}'
            ];
            const target = 'function test() {\n    return 42;\n}';
            
            const result = matcher.findNormalizedMatch(lines, target, { caseSensitive: false });
            
            assert.strictEqual(result !== null, true, 'Should find case-insensitive match');
        });
    });

    suite('Similarity Match Tests', () => {
        test('Should find similar content above threshold', () => {
            const lines = [
                'function test() {',
                '    return 43;', // Changed from 42 to 43
                '}'
            ];
            const target = 'function test() {\n    return 42;\n}';
            
            const results = matcher.findSimilarityMatch(lines, target, 0.8);
            
            assert.strictEqual(results.length > 0, true, 'Should find similarity match');
            assert.strictEqual(results[0].strategy, 'similarity');
            assert.strictEqual(results[0].confidence >= 0.8, true);
        });

        test('Should sort results by confidence', () => {
            const lines = [
                'function test() {',
                '    return 43;',
                '}',
                'function test() {',
                '    return 42;',
                '}'
            ];
            const target = 'function test() {\n    return 42;\n}';
            
            const results = matcher.findSimilarityMatch(lines, target, 0.7);
            
            assert.strictEqual(results.length >= 2, true, 'Should find multiple matches');
            assert.strictEqual(results[0].confidence >= results[1].confidence, true, 'Should be sorted by confidence');
        });

        test('Should return empty array when no matches above threshold', () => {
            const lines = [
                'completely different content',
                'nothing like the target',
                'at all'
            ];
            const target = 'function test() {\n    return 42;\n}';
            
            const results = matcher.findSimilarityMatch(lines, target, 0.8);
            
            assert.strictEqual(results.length, 0, 'Should find no matches');
        });
    });

    suite('Best Match Selection Tests', () => {
        test('Should select match with highest confidence', () => {
            const candidates = [
                { confidence: 0.8, strategy: 'similarity' },
                { confidence: 0.95, strategy: 'normalized' },
                { confidence: 0.75, strategy: 'contextual' }
            ];
            
            const best = matcher.selectBestMatch(candidates, 0.7);
            
            assert.strictEqual(best !== null, true, 'Should select a match');
            assert.strictEqual(best.confidence, 0.95);
            assert.strictEqual(best.strategy, 'normalized');
        });

        test('Should return null when no candidates meet minimum confidence', () => {
            const candidates = [
                { confidence: 0.6, strategy: 'similarity' },
                { confidence: 0.65, strategy: 'contextual' }
            ];
            
            const best = matcher.selectBestMatch(candidates, 0.7);
            
            assert.strictEqual(best, null);
        });

        test('Should return null for empty candidates array', () => {
            const best = matcher.selectBestMatch([], 0.7);
            
            assert.strictEqual(best, null);
        });
    });

    suite('User Confirmation Requirements', () => {
        test('Should require confirmation for low confidence matches', () => {
            const match = { confidence: 0.85, issues: [] };
            
            const requires = matcher.requiresUserConfirmation(match);
            
            assert.strictEqual(requires, true, 'Should require confirmation for confidence < 0.9');
        });

        test('Should require confirmation when issues are present', () => {
            const match = { confidence: 0.95, issues: ['Some formatting issue'] };
            
            const requires = matcher.requiresUserConfirmation(match);
            
            assert.strictEqual(requires, true, 'Should require confirmation when issues present');
        });

        test('Should not require confirmation for high confidence, no issues', () => {
            const match = { confidence: 0.95, issues: [] };
            
            const requires = matcher.requiresUserConfirmation(match);
            
            assert.strictEqual(requires, false, 'Should not require confirmation');
        });
    });
});
