"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUser = createUser;
exports.updateUser = updateUser;
function createUser(name) {
    return {
        id: Math.random(),
        name: name
    };
}
function updateUser(user, name) {
    return {
        ...user,
        name: name
    };
}
//# sourceMappingURL=multiple.js.map