import test from "node:test";
import { Conduit } from "../src/vanilla";
import { throwAny } from "./common";

test("Await 42", () => {

    let   ran = false;
    const errors: string[] = [];

    const conduit = new Conduit<number>();
    
    const action = conduit.then( (value) => {
        ran = true;
        if(value !== 42) errors.push(`Expected 42, got ${value}`);
    });

    conduit.next(42);

    if( !ran )           errors.push("Callback didn't run");
    if( !action.closed ) errors.push("Callback subscription didn't close");

    throwAny(errors);
});
