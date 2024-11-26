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
                errors.push(`${source}: Next ran too many times`);
                return;
            }

            let matcher = emission[2] ?? ((a, b) => a === b);

            if( !matcher(x, emission[1]) || emission[0] !== "next" ){
                errors.push(`${source}: Expected ${emission[0]}(${emission[1]}) but got next(${x})`);
            }
            else {
                console.log(`${source}: next(${x})`);
            }
        },

        complete: () => {
            let emission = expectedEmits.shift();
            if( emission === undefined ) {
                errors.push(`${source}: Complete ran too many times`);
                return;
            }

            if( emission[0] !== "complete" ){
                errors.push(`${source}: Expected ${emission[0]}(${emission[1]}) but got complete()`);
            }
            else {
                console.log(`${source}: complete()`);
            }
        },

        error: (err) => {
            let emission = expectedEmits.shift();
            if( emission === undefined ) {
                errors.push(`${source}: Error ran too many times`);
                return;
            }

            let matcher = emission[2] ?? ((a, b) => a === b);

            if( !matcher(err, emission[1]) || emission[0] !== "next" ){
                errors.push(`${source}: Expected ${emission[0]}(${emission[1]}) but got error(${err})`);
            }
            else {
                console.log(`${source}: error(${err})`);
            }
        }
    }
}