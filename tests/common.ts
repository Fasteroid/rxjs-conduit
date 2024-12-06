import { Observer } from "rxjs";

export function throwAny(errs: string[]){
    if(errs.length > 0) throw new Error("One or more exceptions were thrown:\n" + errs.join('\n'));
}

type ErrorEmission = [
    "error",
    any
]

type NextEmission<T> = [
    "next",
    T
]

type CompleteEmission = [
    "complete"
]

export type Emission<T> = ErrorEmission | NextEmission<T> | CompleteEmission;

export function assertEmissions<T>(
    expectedEmits: Emission<T>[],
    errors: string[],
    source: string = "default"
): Observer<T> {

    return {
        next: (x) => {

            let emission = expectedEmits.shift();
            if( emission === undefined ) {
                errors.push(`${source}: Next ran too many times ${getFailurePoint()}`);
                return;
            }

            if( x !== emission[1] || emission[0] !== "next" ){
                errors.push(`${source}: Expected ${emission[0]}(${emission[1]}) but got next(${x}) ${getFailurePoint()}`);
            }
        },

        complete: () => {
            let emission = expectedEmits.shift();
            if( emission === undefined ) {
                errors.push(`${source}: Complete ran too many times ${getFailurePoint()}`);
                return;
            }

            if( emission[0] !== "complete" ){
                errors.push(`${source}: Expected ${emission[0]}(${emission[1]}) but got complete() ${getFailurePoint()}`);
            }
        },

        error: (err) => {
            let emission = expectedEmits.shift();
            if( emission === undefined ) {
                errors.push(`${source}: Error ran too many times ${getFailurePoint()}`);
                return;
            }

            if( err !== emission[1] || emission[0] !== "next" ){
                errors.push(`${source}: Expected ${emission[0]}(${emission[1]}) but got error(${err}) ${getFailurePoint()}`);
            }
        }
    }
}

function getFailurePoint(): string {
    const stack = Error().stack || "";
    let lines = stack.split('\n');
    return lines[lines.length - 2].trim();
}