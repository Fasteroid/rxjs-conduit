import test from "node:test";
import { Conduit } from "../src/vanilla";
import { throwAny } from "./common";

test("Hard-splice pressure source to empty conduit", () => {

    const pusher   = new Conduit<number>(1);
    const receiver = new Conduit<number>();

    const errors: string[] = [];
    let ran = false;

    receiver.subscribe(value => {
        ran = true;
        if(value !== 1) errors.push(`Expected 1, got ${value}`);
    })

    receiver.splice(pusher, true);

    if( !ran ) errors.push("Receiver conduit didn't receive");

    pusher.complete();

    if( !receiver.closed ) errors.push("Hard-spliced receiver was not closed by completion of its source");

    throwAny(errors);

});

test("Soft-splice pressure source to empty conduit", () => {
    const pusher   = new Conduit<number>(1);
    const receiver = new Conduit<number>();

    const errors: string[] = [];
    let ran = false;

    receiver.subscribe(value => {
        ran = true;
        if(value !== 1) errors.push(`Expected 1, got ${value}`);
    })

    receiver.splice(pusher, false);

    if( !ran ) errors.push("Receiver conduit didn't receive");

    pusher.complete();

    if( receiver.closed ) errors.push("Soft-spliced receiver was closed by completion its source");

    throwAny(errors);
})

test("Connect multiple sources to a conduit", () => {

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

test("Connect pressure source to chain of conduits", () => {

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
