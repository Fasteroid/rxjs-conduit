import test from "node:test";
import { Conduit } from "../src/vanilla";
import { assertEmissions, throwAny } from "./common";
import { SafeSubscriber } from "rxjs/internal/Subscriber";
import { Observer } from "rxjs";

/**
 * ```
 *     let outer$ = new Conduit<OuterValue>();
 *     let inner$ = outer$.inner( (x) => x.innerField$ )
 *
 * Stuff a conduit from outer$.inner() should do:
 * - when outer$ changes, inner$ should emit outer$.value.innerField$.value
 * - when inner$ is written to, the current outer$.value.innerField$ should do the same thing
 * - no infinite loops!
 */

type OuterValue = {
    innerField$: Conduit<number>;
}

test("Inner conduit subscribe works correctly", () => {
    let errors: string[] = []
    
    const outer$ = new Conduit<OuterValue>();

    const inner$ = outer$.inner( (x) => x.innerField$ );

    let expectedEmits: Emission[] = [
        ["next", 1],
        ["next", 2],
        ["next", 3],
        ["next", 4],
    ]
    inner$.subscribe( assertEmissions(expectedEmits, errors) );

    let outer1: OuterValue = {
        innerField$: new Conduit(1)
    };

    let outer2: OuterValue = {
        innerField$: new Conduit(3)
    };

    outer1.innerField$.subscribe( (x) => {
        console.log(`inner1: ${x}`);
    } )

    outer$.next(outer1); // inner$ should emit 1
    outer1.innerField$.next(2);

    outer$.next(outer2);
    outer2.innerField$.next(4);

    if( expectedEmits.length > 0 ){
        errors.push(`${expectedEmits.length} emissions didn't happen`);
    }

    throwAny(errors);
});

type Emission = [name: string, value: any]

// test("Inner conduit next works correctly", () => {
//     let errors: string[] = []
    
//     const outer$ = new Conduit<OuterValue>();

//     const inner$ = outer$.inner( (x) => x.innerField$ );

//     let outer1: OuterValue = {
//         innerField$: new Conduit(1)
//     };

//     let outer2: OuterValue = {
//         innerField$: new Conduit(3)
//     };

//     let inner1expectations: Emission[] = [
//         ["next", 1],
//         ["next", 2],
//     ]
//     outer1.innerField$.subscribe( assertEmissions(inner1expectations, errors, "inner1") );

//     let inner2expectations: Emission[] = [
//         ["next", 3],
//         ["next", 4],
//     ]
//     outer2.innerField$.subscribe( assertEmissions(inner2expectations, errors, "inner2") );

//     outer$.next(outer1);
//     inner$.next(2);      // gets sent to the proxy source, which then sends back to inner, etc... infinite loop.
//     outer$.next(outer2);
//     inner$.next(4);

//     if( inner1expectations.length > 0 ){
//         errors.push(`${inner1expectations.length} emissions on inner1 didn't happen`);
//     }

//     if( inner2expectations.length > 0 ){
//         errors.push(`${inner2expectations.length} emissions on inner2 didn't happen`);
//     }

//     throwAny(errors);
// });