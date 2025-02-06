import test from "node:test";
import { Conduit } from "../src/vanilla";
import { throwAny } from "./common";

test("Connect to completed conduit", () => {
    const errors: string[] = [];

    const conduit = new Conduit<string>("hi");
    conduit.complete();

    let next = false;
    let complete = false;
    let action = conduit.subscribe({ 
        next: value => {
            next = true;
            if(value !== "hi") errors.push(`Subscribe expected "hi", got ${value}`);
        },
        complete: () => {
            complete = true;
        }
    });

    conduit.next("bye");

    if( !next )           errors.push("Next didn't run");
    if( !complete )       errors.push("Complete didn't run");
    if( !action.closed ) errors.push("Callback subscription didn't close");

    throwAny(errors);
})
