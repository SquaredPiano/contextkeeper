/**
 * Manual Test File for Reversible Patch System
 * 
 * This file contains intentional lint errors for testing the reversible patch system.
 * 
 * To test:
 * 1. Open this file in VS Code
 * 2. Wait for TypeScript/ESLint to show diagnostics
 * 3. Trigger idle improvements (wait 15 seconds) OR run autonomous agent
 * 4. Verify that fixes are applied with Undo/Keep prompts
 */

// Error 1: Unused variable
const unusedVariable = "This variable is never used";

// Error 2: Console.log (should be removed or commented)
console.log("Debug message that should be removed");

// Error 3: Missing semicolon
const x = 5 // Missing semicolon here

// Error 4: Type error (if TypeScript is strict)
let y: number = "this is a string"; // Type error

// Error 5: Unused import (if you import something)
// import { something } from './nowhere';

// Error 6: Any type (if noImplicitAny is enabled)
function testFunction(parameter) { // parameter has implicit any
    return parameter;
}

// Error 7: Missing return type
export function noReturnType() {
    return "test";
}

// Error 8: Unreachable code
function unreachable() {
    return "test";
    console.log("This will never run"); // Unreachable
}

// Error 9: Duplicate variable name
const duplicate = 1;
const duplicate = 2; // Duplicate identifier

// Error 10: Missing type annotation (if strict)
const implicitAny = { key: "value" };

// Test the fixes:
// 1. Apply fixes one by one
// 2. Choose "Keep" for some, "Undo" for others
// 3. Verify the file content matches your choices
// 4. Try undoing after manually editing the file

