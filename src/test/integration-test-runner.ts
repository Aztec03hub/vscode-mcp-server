#!/usr/bin/env node

/**
 * Manual Integration Test Runner for apply_diff
 * 
 * This script creates test scenarios and provides MCP commands
 * that can be used to manually test the apply_diff functionality.
 */

import * as fs from 'fs';
import * as path from 'path';

class IntegrationTestRunner {
    private testDir: string;
    
    constructor() {
        this.testDir = path.join(process.cwd(), 'integration-test-files');
        this.ensureTestDirectory();
    }

    private ensureTestDirectory(): void {
        if (!fs.existsSync(this.testDir)) {
            fs.mkdirSync(this.testDir, { recursive: true });
        }
    }

    /**
     * Create all test files
     */
    public setupTestFiles(): void {
        console.log('Setting up integration test files...\n');

        // Test 1: Simple single diff
        this.createTestFile('simple.ts', [
            'export class Calculator {',
            '    private result: number = 0;',
            '    ',
            '    add(value: number): void {',
            '        this.result += value;',
            '    }',
            '    ',
            '    getResult(): number {',
            '        return this.result;',
            '    }',
            '}'
        ]);

        // Test 2: Whitespace variation file
        this.createTestFile('whitespace.js', [
            'function   processData(input)   {',
            '\tconsole.log(  "Processing"  );',
            '\tconst   result   =   input   *   2;',
            '\treturn    result;',
            '}'
        ]);

        // Test 3: Multiple functions
        this.createTestFile('multiple.ts', [
            'export interface User {',
            '    id: number;',
            '    name: string;',
            '}',
            '',
            'export function createUser(name: string): User {',
            '    return {',
            '        id: Math.random(),',
            '        name: name',
            '    };',
            '}',
            '',
            'export function updateUser(user: User, name: string): User {',
            '    return {',
            '        ...user,',
            '        name: name',
            '    };',
            '}'
        ]);

        console.log(`Test files created in: ${this.testDir}\n`);
    }

    private createTestFile(filename: string, lines: string[]): void {
        const filepath = path.join(this.testDir, filename);
        fs.writeFileSync(filepath, lines.join('\n'));
        console.log(`Created: ${filename}`);
    }

    /**
     * Generate test scenarios with MCP commands
     */
    public generateTestScenarios(): void {
        console.log('=== APPLY_DIFF INTEGRATION TEST SCENARIOS ===\n');

        const scenarios = [
            {
                name: 'Test 1: Single Exact Match',
                description: 'Test exact content matching with a simple change',
                file: 'simple.ts',
                command: {
                    tool: 'apply_diff',
                    arguments: {
                        filePath: 'simple.ts',
                        diffs: [{
                            startLine: 1,
                            endLine: 1,
                            originalContent: '    private result: number = 0;',
                            newContent: '    private result: number = 100;',
                            description: 'Change initial value to 100'
                        }],
                        description: 'Update Calculator initial value'
                    }
                },
                expectedResult: 'Should find exact match and apply change'
            },
            {
                name: 'Test 2: Multiple Non-Overlapping Diffs',
                description: 'Apply multiple changes in one operation',
                file: 'simple.ts',
                command: {
                    tool: 'apply_diff',
                    arguments: {
                        filePath: 'simple.ts',
                        diffs: [
                            {
                                startLine: 1,
                                endLine: 1,
                                originalContent: '    private result: number = 0;',
                                newContent: '    private result: number = 50;',
                                description: 'Set initial value to 50'
                            },
                            {
                                startLine: 7,
                                endLine: 9,
                                originalContent: '    getResult(): number {\n        return this.result;\n    }',
                                newContent: '    getResult(): number {\n        console.log("Current result:", this.result);\n        return this.result;\n    }',
                                description: 'Add logging to getResult'
                            }
                        ],
                        description: 'Update initial value and add logging'
                    }
                },
                expectedResult: 'Should apply both changes atomically'
            },
            {
                name: 'Test 3: Fuzzy Whitespace Matching',
                description: 'Test fuzzy matching with whitespace differences',
                file: 'whitespace.js',
                command: {
                    tool: 'apply_diff',
                    arguments: {
                        filePath: 'whitespace.js',
                        diffs: [{
                            startLine: 0,
                            endLine: 4,
                            originalContent: 'function processData(input) {\n    console.log("Processing");\n    const result = input * 2;\n    return result;\n}',
                            newContent: 'function processData(input) {\n    console.log("Processing enhanced data");\n    const result = input * 3;\n    console.log("Result:", result);\n    return result;\n}',
                            description: 'Enhance processData function'
                        }],
                        description: 'Update function with enhanced logging'
                    }
                },
                expectedResult: 'Should match despite whitespace differences'
            },
            {
                name: 'Test 4: Content Drift Detection',
                description: 'Test finding content when line numbers have shifted',
                file: 'multiple.ts',
                command: {
                    tool: 'apply_diff',
                    arguments: {
                        filePath: 'multiple.ts',
                        diffs: [{
                            startLine: 5, // This might not be exact due to interface
                            endLine: 9,
                            originalContent: 'export function createUser(name: string): User {\n    return {\n        id: Math.random(),\n        name: name\n    };',
                            newContent: 'export function createUser(name: string): User {\n    return {\n        id: Date.now(),\n        name: name.trim()\n    };',
                            description: 'Improve createUser implementation'
                        }],
                        description: 'Use timestamp for ID and trim name'
                    }
                },
                expectedResult: 'Should find function even if line numbers shifted'
            },
            {
                name: 'Test 5: Overlapping Conflict (Should Fail)',
                description: 'Test detection of overlapping changes',
                file: 'simple.ts',
                command: {
                    tool: 'apply_diff',
                    arguments: {
                        filePath: 'simple.ts',
                        diffs: [
                            {
                                startLine: 3,
                                endLine: 5,
                                originalContent: '    add(value: number): void {\n        this.result += value;\n    }',
                                newContent: '    add(value: number): void {\n        this.result += value * 2;\n    }',
                                description: 'Double the added value'
                            },
                            {
                                startLine: 4,
                                endLine: 4,
                                originalContent: '        this.result += value;',
                                newContent: '        this.result += value * 3;',
                                description: 'Triple the added value'
                            }
                        ],
                        description: 'Conflicting changes to add method'
                    }
                },
                expectedResult: 'Should detect overlap and refuse to apply'
            },
            {
                name: 'Test 6: Content Not Found (Should Fail)',
                description: 'Test handling of non-existent content',
                file: 'simple.ts',
                command: {
                    tool: 'apply_diff',
                    arguments: {
                        filePath: 'simple.ts',
                        diffs: [{
                            startLine: 5,
                            endLine: 7,
                            originalContent: '    nonExistentMethod(): void {\n        // This does not exist\n    }',
                            newContent: '    newMethod(): void {\n        // This is new\n    }',
                            description: 'Replace non-existent method'
                        }],
                        description: 'Try to replace non-existent content'
                    }
                },
                expectedResult: 'Should report content not found with helpful message'
            }
        ];

        scenarios.forEach((scenario, index) => {
            console.log(`${scenario.name}`);
            console.log(`File: ${scenario.file}`);
            console.log(`Description: ${scenario.description}`);
            console.log(`Expected: ${scenario.expectedResult}`);
            console.log('\nMCP Command:');
            console.log(JSON.stringify(scenario.command, null, 2));
            console.log('\n' + '='.repeat(80) + '\n');
        });
    }

    /**
     * Create performance test file
     */
    public createPerformanceTest(): void {
        console.log('Creating performance test file...');
        
        const lines: string[] = [];
        lines.push('// Performance test file with many functions');
        lines.push('export class LargeClass {');
        
        // Generate many methods
        for (let i = 0; i < 100; i++) {
            lines.push(`    method${i}(value: number): number {`);
            lines.push(`        return value + ${i};`);
            lines.push('    }');
            lines.push('');
        }
        
        lines.push('}');
        
        const perfFile = path.join(this.testDir, 'performance.ts');
        fs.writeFileSync(perfFile, lines.join('\n'));
        
        console.log(`Performance test file created: performance.ts`);
        console.log(`Line count: ${lines.length}`);
        
        // Generate a performance test command
        console.log('\nPerformance Test Command:');
        const perfCommand = {
            tool: 'apply_diff',
            arguments: {
                filePath: 'performance.ts',
                diffs: [
                    {
                        startLine: 5,
                        endLine: 7,
                        originalContent: '    method1(value: number): number {\n        return value + 1;\n    }',
                        newContent: '    method1(value: number): number {\n        console.log("Method 1 called with:", value);\n        return value + 1;\n    }',
                        description: 'Add logging to method1'
                    },
                    {
                        startLine: 50,
                        endLine: 52,
                        originalContent: '    method25(value: number): number {\n        return value + 25;\n    }',
                        newContent: '    method25(value: number): number {\n        console.log("Method 25 called");\n        return value + 25;\n    }',
                        description: 'Add logging to method25'
                    }
                ],
                description: 'Add logging to multiple methods in large file'
            }
        };
        
        console.log(JSON.stringify(perfCommand, null, 2));
    }

    /**
     * Display testing instructions
     */
    public displayInstructions(): void {
        console.log('=== INTEGRATION TESTING INSTRUCTIONS ===\n');
        
        console.log('1. Ensure VS Code is running with the vscode-mcp-server extension');
        console.log('2. Ensure MCP server is running and connected');
        console.log('3. Open the integration-test-files folder in VS Code');
        console.log('4. Use your MCP client to send the commands above');
        console.log('5. Verify each test behaves as expected\n');
        
        console.log('Key things to verify:');
        console.log('✓ Diff preview appears in VS Code diff viewer');
        console.log('✓ User approval dialog shows with correct information');
        console.log('✓ Changes apply correctly when approved');
        console.log('✓ Changes are rejected when user cancels');
        console.log('✓ Error messages are helpful and actionable');
        console.log('✓ Fuzzy matching works for whitespace differences');
        console.log('✓ Conflicts are detected and reported clearly');
        console.log('✓ Performance is acceptable for large files\n');
        
        console.log('Testing workflow:');
        console.log('1. Run setupTestFiles() to create test files');
        console.log('2. Open VS Code in the test directory');
        console.log('3. Use generateTestScenarios() to get MCP commands');
        console.log('4. Send commands through your MCP client');
        console.log('5. Verify behavior matches expected results');
        console.log('6. Use createPerformanceTest() for performance testing\n');
    }

    /**
     * Clean up test files
     */
    public cleanup(): void {
        try {
            if (fs.existsSync(this.testDir)) {
                fs.rmSync(this.testDir, { recursive: true, force: true });
                console.log('Test files cleaned up.');
            }
        } catch (error) {
            console.error('Failed to clean up test files:', error);
        }
    }
}

// Main execution
if (require.main === module) {
    const runner = new IntegrationTestRunner();
    
    console.log('🚀 Apply Diff Integration Test Runner\n');
    
    const command = process.argv[2];
    
    switch (command) {
        case 'setup':
            runner.setupTestFiles();
            break;
        case 'scenarios':
            runner.generateTestScenarios();
            break;
        case 'performance':
            runner.createPerformanceTest();
            break;
        case 'cleanup':
            runner.cleanup();
            break;
        case 'all':
            runner.setupTestFiles();
            runner.generateTestScenarios();
            runner.createPerformanceTest();
            break;
        default:
            console.log('Available commands:');
            console.log('  setup      - Create test files');
            console.log('  scenarios  - Display test scenarios and MCP commands');
            console.log('  performance- Create performance test');
            console.log('  cleanup    - Remove test files');
            console.log('  all        - Run setup, scenarios, and performance');
            console.log('\nOr run without arguments to see instructions.');
            console.log('\nExample: npm run integration-test setup\n');
            runner.displayInstructions();
    }
}

export { IntegrationTestRunner };
