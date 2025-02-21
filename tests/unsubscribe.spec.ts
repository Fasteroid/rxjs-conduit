import test from "node:test";
import { Conduit } from "../src/vanilla";
import { throwAny } from "./common";
import { Observable, ReplaySubject, Subject } from "rxjs";

test("Unsubscribe", () => {
    const errors: string[] = [];

    const source = new Subject<number>();

    const conduit = Conduit.from(source);

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

    source.next(1);

    throwAny(errors);
});