import { Observer } from "rxjs";

export function throwAny(errs: string[]){
    if(errs.length > 0) throw new Error("One or more exceptions were thrown:\n" + errs.join('\n'));
}

export function addMissed(errs: string[], emissions: Emission<any>[], source: string = "default"){
    if( emissions.length > 0 ){
        let missed = emissions.map( (e) => `${source} missed emission:  \t${emissionToString(e)}` );
        errs.push(...missed);
    }
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

function emissionToString<T>(emission: Emission<T>): string {
    return `${emission[0]}` + `(${(emission[0] === 'complete' ? '' : emission[1])})`;
}


export function assertEmissions<T>(
    expectedEmits: Emission<T>[],
    errors: string[],
    source: string = "default"
): Observer<T> {

    return {
        next: (x) => {

            let expected = expectedEmits.shift();
            if( expected === undefined ) {
                errors.push(`${source}:  \tNext ran too many times ${getFailurePoint()}`);
                return;
            }

            if( x !== expected[1] || expected[0] !== "next" ){
                errors.push(`${source}:  \tExpected ${emissionToString(expected)} but got next(${x}) ${getFailurePoint()}`);
            }
        },

        complete: () => {
            let expected = expectedEmits.shift();
            if( expected === undefined ) {
                errors.push(`${source}:  \tComplete ran too many times ${getFailurePoint()}`);
                return;
            }

            if( expected[0] !== "complete" ){
                errors.push(`${source}:  \tExpected ${emissionToString(expected)} but got complete() ${getFailurePoint()}`);
            }
        },

        error: (err) => {
            let expected = expectedEmits.shift();
            if( expected === undefined ) {
                errors.push(`${source}:  \tError ran too many times ${getFailurePoint()}`);
                return;
            }

            if( err !== expected[1] || expected[0] !== "next" ){
                errors.push(`${source}:  \tExpected ${emissionToString(expected)} but got error(${err}) ${getFailurePoint()}`);
            }
        }
    }
}

function getFailurePoint(): string {
    const stack = Error().stack || "";
    let lines = stack.split('\n');
    return '  \t' + lines[lines.length - 2].trim();
}