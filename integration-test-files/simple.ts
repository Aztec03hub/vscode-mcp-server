export class Calculator {
    private result: number = 0;
    
    add(value: number): void {
        this.result += value;
    }
    
    getResult(): number {
        return this.result;
    }
}