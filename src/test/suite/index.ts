import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
    // Create the mocha test with extended timeout for shell integration
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 30000, // 30 seconds for shell integration tests
        slow: 15000     // Mark tests as slow if they take more than 15 seconds
    });

    const testsRoot = path.resolve(__dirname, '..');

    // Find test files
    const files = await glob('**/**.test.js', { cwd: testsRoot });
    
    console.log(`\n[Test Runner] Discovered ${files.length} test files:`);
    files.forEach(file => console.log(`  - ${file}`));
    console.log('\n');
    
    // Add files to the test suite
    files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

    return new Promise((resolve, reject) => {
        try {
            // Run the mocha test
            mocha.run((failures: number) => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        } catch (err) {
            console.error(err);
            reject(err);
        }
    });
}