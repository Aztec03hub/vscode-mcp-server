export interface User {
    id: number;
    name: string;
}

export function createUser(name: string): User {
    return {
        id: Math.random(),
        name: name
    };
}

export function updateUser(user: User, name: string): User {
    return {
        ...user,
        name: name
    };
}