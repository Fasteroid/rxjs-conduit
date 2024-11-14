import test from "node:test";
import { Conduit } from "../src/vanilla";
import { from } from "rxjs";

test("Derive 1 + 1", () => {

    const a = new Conduit<number>(1);
    const b = new Conduit<number>(1);

    const sum = Conduit.derived({a, b}, ({a, b}) => a + b);

    let success = false;

    sum.subscribe(value => {
        success = (value === 2);
    })

    if( !success ){
        throw new Error("1+1 didn't equal 2");
    }

});

test("Derive (1 + 2) * (3 + 4)", () => {

    let succ1 = false;
    let succ2 = false;
    let succ3 = false;

    const one = new Conduit<number>(1);
    const two = new Conduit<number>();

    const three = new Conduit<number>();
    const four  = new Conduit<number>(4);

    const sum1 = Conduit.derived({one, two}, ({one, two}) => one + two);

    sum1.subscribe(value => {
        succ1 = (value === (1 + 2));
    });

    two.next(2);

    const sum2 = Conduit.derived({three, four}, ({three, four}) => three + four);

    sum2.subscribe(value => {
        succ2 = (value === (3 + 4));
    });

    const final = Conduit.derived({sum1, sum2}, ({sum1, sum2}) => sum1 * sum2);

    final.subscribe(value => {
        succ3 = (value === (1 + 2) * (3 + 4));
    })

    three.next(3);

    if( !succ1 || !succ2 || !succ3 ){
        throw new Error(`Failed some calculations. (1 + 2) ${succ1 ? 'passed' : 'failed'} (3 + 4): ${succ2 ? 'passed' : 'failed'}; (1 + 2) * (3 + 4) ${succ3 ? 'passed' : 'failed'}}`);
    }

});

test("Derive x + 1", () => {

    let initial  = Array.from({length: 10}, (_, i) => i).map(v => v + Math.random());
    let expected = initial.map(v => v + 1);

    let x = new Conduit<number>();

    let derived = Conduit.derived({x}, ({x}) => x + 1);

    derived.subscribe(value => {
        let expect = expected.shift();
        if( value !== expect ){
            throw new Error(`Expected ${expect} but got ${value}`);
        }
    });

    x.splice( from(initial) ); // this has to come last, otherwise x will suck up the values before the derived conduit can subscribe!

    if( expected.length > 0 ){
        throw new Error(`Didn't compute all the values!`);
    }

})