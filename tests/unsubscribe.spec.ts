import test from "node:test";
import { Conduit } from "../src/vanilla";
import { throwAny } from "./common";

test("Unsubscribe", () => {
    const errors: string[] = [];

    const conduit = new Conduit<number>();
    
    conduit.subscribe({
        next: () => {
            errors.push("Unsubscribed conduit received next");
        }
    })

    conduit.subscribe({
        complete: () => {
            errors.push("Unsubscribed conduit received complete");
        }
    })

    conduit.subscribe({
        error: () => {
            errors.push("Unsubscribed conduit received error");
        }
    })

    conduit.unsubscribe();

    conduit.next(1);

    throwAny(errors);
});