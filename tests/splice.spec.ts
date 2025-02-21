import test from "node:test";
import { Conduit } from "../src/vanilla";
import { assertEmissions, Emission, throwAny } from "./common";
import { assert } from "console";



test("Splice", () => {
    const pusher   = new Conduit<number>(1);
    const receiver = new Conduit<number>();

    const errors: string[] = [];
    let ran = false;

    receiver.subscribe(value => {
        ran = true;
        if(value !== 1) errors.push(`Expected 1, got ${value}`);
    })

    receiver.splice(pusher);

    if( !ran ) errors.push("Receiver conduit didn't receive");

    pusher.complete();

    if( receiver.sealed ) errors.push("Soft-spliced receiver was closed by completion its source");

    throwAny(errors);
})

test("Splice multiple inputs", () => {

    const source1 = new Conduit<number>(1);
    const source2 = new Conduit<number>();

    let sum = 0;

    const receiver = new Conduit<number>();

    receiver.subscribe(value => {
        sum += value;
    })

    receiver.splice(source1);
    receiver.splice(source2);

    source2.next(2);
    source1.next(4);

    if( sum !== 7 ){
        throw new Error(`Checksum failed (got ${sum}; expected 7)`);
    }

});

test("splice chain", () => {

    const source = new Conduit<boolean>(true);

    let head = new Conduit<boolean>();
    let neck = head;

    const CHAIN_SIZE = 20;
    let   sum = 0;

    for(let i = 0; i < CHAIN_SIZE; i++){
        const tail = new Conduit<boolean>();

        tail.subscribe(() => {
            sum++;
        })

        neck.splice(tail);
        neck = tail;
    }

    neck.splice(source); // this should trigger all CHAIN_SIZE conduits

    if( sum !== CHAIN_SIZE ){
        throw new Error(`Checksum failed (got ${sum}; expected ${CHAIN_SIZE})`);
    }

})



test("completed spliced connection always unsplices", () => {

    const expected: Emission<number>[] = [
        ['next', 1],
        ['next', 2],
        ['complete']
    ];

    const errors: string[] = [];


    const instantlyCompleted = new Conduit<number>(1);
    instantlyCompleted.complete();

    const completedLater = new Conduit<number>();
    const receiver = new Conduit<number>();

    receiver.subscribe( assertEmissions(expected, errors, "main") )

    receiver.splice(completedLater);
    receiver.splice(instantlyCompleted);

    completedLater.next(2);
    completedLater.complete()

    // @ts-ignore(2341);
    assert(receiver.sources.size === 0, "all cold observables unspliced");

    receiver.complete();

    throwAny(errors);

})