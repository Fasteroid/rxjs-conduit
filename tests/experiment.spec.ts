import { from } from "rxjs";
import { Conduit } from "../src/vanilla";
import test from "node:test";
import { throwAny } from "./common";

test("Derive x + 1", () => {
    const errors: string[] = [];

    let initial  = Array.from({length: 10}, (_, i) => i).map(v => v + Math.random());
    let expected = initial.map(v => v + 1);

    let x = new Conduit<number>();
    let y = new Conduit<number>(1);

    let derived = Conduit.derived({x, y}, ({x, y}) => x + y);

    derived.subscribe(value => {
        let expect = expected.shift();
        if( value !== expect ){
            errors.push(`Expected ${expect} but got ${value}`);
        }
    });

    x.splice( from(initial) ); // this has to come last, otherwise x will suck up the values before the derived conduit can subscribe!

    if( expected.length > 0 ){
        errors.push(`Didn't compute all the values!`);
    }

    x.complete();

    if( derived.sealed ){
        errors.push(`Derived conduit sealed before all sources completed`);
    }

    y.complete();

    if( !derived.sealed ){
        errors.push(`Derived conduit didn't seal after all sources completed`);
    }

    throwAny(errors);
})