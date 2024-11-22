import test from "node:test";
import { Conduit } from "../src/vanilla";
import { throwAny } from "./common";

test("Splice replacement works", () => {

    let errors: string[] = [];

    const source1 = new Conduit<number>(1);
    const source2 = new Conduit<number>();

    const receiver = new Conduit<number>();

    let ran = false;
    receiver.then( (value) => {
        if( value !== 1 ) errors.push(`First value should have been 1, but instead it was ${value}`);
        ran = true;
    })

    receiver.splice(source1, {name: "a"});

    if( !ran ) errors.push("First .then(...) didn't run");
    ran = false;

    receiver.splice(source2, {name: "b"});

    receiver.unsplice("b");

    source2.next(2);

    receiver.then( (value) => {
        if( value !== 1 ) errors.push(`unsplice("b") didn't work; source2 should have been removed`);
        ran = true;
    })

    if( !ran ) errors.push("Second .then(...) didn't run");
    ran = false;

    receiver.splice(source2, {name: "a"});

    receiver.then( (value) => {
        if( value !== 2 ) errors.push(`source2 didn't replace source1`);
        ran = true;
    })

    if( !ran ) errors.push("Third .then(...) didn't run");
    ran = false;

    receiver.unsplice();

    source2.next(3);

    receiver.then( (value) => {
        if( value === 3 ) errors.push(`unsplice() didn't work; everything should have been removed`);
        ran = true;
    })

    if( !ran ) errors.push("Fourth .then(...) didn't run");

    throwAny(errors);

});
