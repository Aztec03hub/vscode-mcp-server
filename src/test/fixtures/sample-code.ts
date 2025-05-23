// Sample TypeScript file for testing apply_diff
export class TestClass {
    private value: number = 0;
    
    constructor(initialValue: number) {
        this.value = initialValue;
    }
    
    public getValue(): number {
        return this.value;
    }
    
    public setValue(newValue: number): void {
        this.value = newValue;
    }
    
    public increment(): void {
        this.value++;
    }
    
    public decrement(): void {
        this.value--;
    }
}

export function helperFunction(input: string): string {
    return input.toLowerCase();
}

export const CONSTANT_VALUE = 42;
