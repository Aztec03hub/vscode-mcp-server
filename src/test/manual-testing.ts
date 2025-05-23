import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Manual test runner for apply_diff functionality
 * This script creates real test scenarios and allows manual verification
 */
export class ApplyDiffManualTester {
    private testDir: string;
    
    constructor() {
        this.testDir = path.join(__dirname, 'manual-test-files');
        this.ensureTestDirectory();
    }

    private ensureTestDirectory() {
        if (!fs.existsSync(this.testDir)) {
            fs.mkdirSync(this.testDir, { recursive: true });
        }
    }

    /**
     * Create test files for manual testing
     */
    public async setupTestFiles(): Promise<void> {
        // Test file 1: Simple function changes
        const simpleFile = path.join(this.testDir, 'simple-test.ts');
        const simpleContent = [
            'export class Calculator {',
            '    private result: number = 0;',
            '    ',
            '    add(value: number): void {',
            '        this.result += value;',
            '    }',
            '    ',
            '    subtract(value: number): void {',
            '        this.result -= value;',
            '    }',
            '    ',
            '    getResult(): number {',
            '        return this.result;',
            '    }',
            '    ',
            '    reset(): void {',
            '        this.result = 0;',
            '    }',
            '}'
        ].join('\n');
        
        fs.writeFileSync(simpleFile, simpleContent);

        // Test file 2: Whitespace variations
        const whitespaceFile = path.join(this.testDir, 'whitespace-test.js');
        const whitespaceContent = [
            'function   processData(input)   {',
            '\tconsole.log(  "Processing data"  );',
            '\tconst   result   =   input   *   2   ;',
            '\treturn    result;',
            '}',
            '',
            'const   helper   =   (x)   =>   {',
            '\treturn   x   +   1   ;',
            '};'
        ].join('\n');
        
        fs.writeFileSync(whitespaceFile, whitespaceContent);

        // Test file 3: Complex class with multiple methods
        const complexFile = path.join(this.testDir, 'complex-test.ts');
        const complexContent = [
            'interface UserData {',
            '    id: number;',
            '    name: string;',
            '    email: string;',
            '}',
            '',
            'export class UserManager {',
            '    private users: UserData[] = [];',
            '    private nextId: number = 1;',
            '    ',
            '    addUser(name: string, email: string): UserData {',
            '        const user: UserData = {',
            '            id: this.nextId++,',
            '            name: name,',
            '            email: email',
            '        };',
            '        this.users.push(user);',
            '        return user;',
            '    }',
            '    ',
            '    findUser(id: number): UserData | undefined {',
            '        return this.users.find(user => user.id === id);',
            '    }',
            '    ',
            '    updateUser(id: number, updates: Partial<UserData>): boolean {',
            '        const userIndex = this.users.findIndex(user => user.id === id);',
            '        if (userIndex === -1) {',
            '            return false;',
            '        }',
            '        this.users[userIndex] = { ...this.users[userIndex], ...updates };',
            '        return true;',
            '    }',
            '    ',
            '    deleteUser(id: number): boolean {',
            '        const userIndex = this.users.findIndex(user => user.id === id);',
            '        if (userIndex === -1) {',
            '            return false;',
            '        }',
            '        this.users.splice(userIndex, 1);',
            '        return true;',
            '    }',
            '    ',
            '    getAllUsers(): UserData[] {',
            '        return [...this.users];',
            '    }',
            '}'
        ].join('\n');
        
        fs.writeFileSync(complexFile, complexContent);

        console.log('Manual test files created in:', this.testDir);
    }

    /**
     * Test scenarios for manual verification
     */
    public getTestScenarios(): Array<{
        name: string;
        file: string;
        diffs: any[];
        description: string;
        expectedOutcome: string;
    }> {
        return [
            {
                name: 'Single Exact Match',
                file: 'simple-test.ts',
                diffs: [{
                    startLine: 1,
                    endLine: 1,
                    originalContent: '    private result: number = 0;',
                    newContent: '    private result: number = 100;',
                    description: 'Change initial value'
                }],
                description: 'Test exact content matching with single diff',
                expectedOutcome: 'Should find exact match and apply change successfully'
            },
            {
                name: 'Multiple Non-Overlapping Changes',
                file: 'simple-test.ts',
                diffs: [
                    {
                        startLine: 1,
                        endLine: 1,
                        originalContent: '    private result: number = 0;',
                        newContent: '    private result: number = 100;',
                        description: 'Change initial value'
                    },
                    {
                        startLine: 12,
                        endLine: 14,
                        originalContent: '    getResult(): number {\n        return this.result;\n    }',
                        newContent: '    getResult(): number {\n        console.log("Getting result:", this.result);\n        return this.result;\n    }',
                        description: 'Add logging to getResult'
                    }
                ],
                description: 'Test multiple diff sections in one operation',
                expectedOutcome: 'Should apply both changes atomically'
            },
            {
                name: 'Fuzzy Whitespace Matching',
                file: 'whitespace-test.js',
                diffs: [{
                    startLine: 0,
                    endLine: 4,
                    originalContent: 'function processData(input) {\n    console.log("Processing data");\n    const result = input * 2;\n    return result;\n}',
                    newContent: 'function processData(input) {\n    console.log("Processing enhanced data");\n    const result = input * 3;\n    return result;\n}',
                    description: 'Update function with whitespace differences'
                }],
                description: 'Test fuzzy matching with whitespace variations',
                expectedOutcome: 'Should match despite whitespace differences and apply changes'
            },
            {
                name: 'Content Drift Detection',
                file: 'complex-test.ts',
                diffs: [{
                    startLine: 10, // This might not be exact due to file structure
                    endLine: 17,
                    originalContent: '    addUser(name: string, email: string): UserData {\n        const user: UserData = {\n            id: this.nextId++,\n            name: name,\n            email: email\n        };\n        this.users.push(user);\n        return user;\n    }',
                    newContent: '    addUser(name: string, email: string): UserData {\n        const user: UserData = {\n            id: this.nextId++,\n            name: name.trim(),\n            email: email.toLowerCase()\n        };\n        this.users.push(user);\n        console.log("User added:", user);\n        return user;\n    }',
                    description: 'Enhance addUser method'
                }],
                description: 'Test finding content when line numbers may have shifted',
                expectedOutcome: 'Should find the method and apply enhancements'
            },
            {
                name: 'Overlapping Conflict Detection',
                file: 'simple-test.ts',
                diffs: [
                    {
                        startLine: 3,
                        endLine: 5,
                        originalContent: '    add(value: number): void {\n        this.result += value;\n    }',
                        newContent: '    add(value: number): void {\n        this.result += value * 2;\n    }',
                        description: 'Change add method'
                    },
                    {
                        startLine: 4,
                        endLine: 4,
                        originalContent: '        this.result += value;',
                        newContent: '        this.result += value * 3;',
                        description: 'Different change to same line'
                    }
                ],
                description: 'Test detection of overlapping changes',
                expectedOutcome: 'Should detect conflict and refuse to apply changes'
            },
            {
                name: 'Content Not Found',
                file: 'simple-test.ts',
                diffs: [{
                    startLine: 5,
                    endLine: 7,
                    originalContent: '    nonExistentMethod(): void {\n        // This method does not exist\n    }',
                    newContent: '    newMethod(): void {\n        // This is a new method\n    }',
                    description: 'Try to replace non-existent content'
                }],
                description: 'Test handling of content that cannot be found',
                expectedOutcome: 'Should report content not found error with suggestions'
            }
        ];
    }

    /**
     * Display test instructions for manual verification
     */
    public displayTestInstructions(): void {
        console.log('\n=== Apply Diff Manual Testing Instructions ===\n');
        
        console.log('1. First, run setupTestFiles() to create test files');
        console.log('2. Open the test files in VS Code');
        console.log('3. Use the MCP client to test each scenario');
        console.log('4. Verify the following behaviors:\n');
        
        const scenarios = this.getTestScenarios();
        scenarios.forEach((scenario, index) => {
            console.log(`Test ${index + 1}: ${scenario.name}`);
            console.log(`  File: ${scenario.file}`);
            console.log(`  Description: ${scenario.description}`);
            console.log(`  Expected: ${scenario.expectedOutcome}`);
            console.log(`  Diffs: ${scenario.diffs.length} section(s)`);
            console.log('');
        });

        console.log('Key things to verify:');
        console.log('- Diff preview shows correctly in VS Code');
        console.log('- User approval dialog appears');
        console.log('- Changes apply atomically (all or nothing)');
        console.log('- Fuzzy matching works for whitespace differences');
        console.log('- Conflicts are detected and reported');
        console.log('- Error messages are helpful and actionable');
        console.log('- Performance is acceptable for various file sizes');
    }

    /**
     * Generate MCP command examples for testing
     */
    public generateMCPCommands(): string[] {
        const scenarios = this.getTestScenarios();
        const commands: string[] = [];
        
        scenarios.forEach((scenario, index) => {
            const command = {
                tool: 'apply_diff',
                arguments: {
                    filePath: scenario.file,
                    diffs: scenario.diffs,
                    description: scenario.description
                }
            };
            
            commands.push(`// Test ${index + 1}: ${scenario.name}\n${JSON.stringify(command, null, 2)}\n`);
        });
        
        return commands;
    }

    /**
     * Performance test with large file
     */
    public async createPerformanceTestFile(): Promise<string> {
        const perfFile = path.join(this.testDir, 'performance-test.ts');
        
        // Generate a large TypeScript file
        const lines: string[] = [];
        lines.push('// Large file for performance testing');
        lines.push('export class LargeClass {');
        
        for (let i = 0; i < 500; i++) {
            lines.push(`    method${i}(): number {`);
            lines.push(`        return ${i};`);
            lines.push('    }');
            lines.push('');
        }
        
        lines.push('}');
        
        fs.writeFileSync(perfFile, lines.join('\n'));
        console.log(`Performance test file created: ${perfFile}`);
        console.log(`File size: ${fs.statSync(perfFile).size} bytes`);
        console.log(`Line count: ${lines.length}`);
        
        return perfFile;
    }
}

// Export an instance for easy use
export const manualTester = new ApplyDiffManualTester();

// If running directly, show instructions
if (require.main === module) {
    manualTester.displayTestInstructions();
}
