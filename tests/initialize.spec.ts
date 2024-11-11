import test from "node:test";
import { Conduit } from "../src/vanilla";

test("Initialize with explicit undefined", () => {
    const conduit = new Conduit<undefined>(undefined);
    
    let triggered = false;

    conduit.subscribe(value => {
        triggered = (value === undefined);
    });

    if( !triggered ){
        throw new Error("Late subscription didn't receive the value.");
    }
});

test("Initialize with a number", () => {
    const conduit = new Conduit<number>(1);
    
    let triggered = false;

    conduit.subscribe(value => {
        triggered = (value === 1);
    });

    if( !triggered ){
        throw new Error("Late subscription didn't receive the value.");
    }
});