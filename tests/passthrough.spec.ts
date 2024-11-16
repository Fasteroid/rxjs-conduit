import test from "node:test";
import { Conduit } from "../src/vanilla";

test("Error passthrough behaviors", () => {

    const errors: string[] = [];

    const conduit = new Conduit<number>();

    conduit.next(1);

    conduit.error( new Error("Test error") );

    if( !conduit.sealed ){
        errors.push("Conduit was not sealed by error");
    }

    let ran = false;
    conduit.subscribe({
        next( ){
            errors.push("Error conduit received next in .subscribe() after it errored!");
        },
        error( ){
            ran = true;
        }
    });

    if( !ran ){
        errors.push("Error conduit didn't run error handler on subscription");
    }

});

test("Error passthrough on hard splice", () => {

    const errors: string[] = [];

    const pusher   = new Conduit<number>(1);
    const receiver = new Conduit<number>();

    receiver.splice(pusher, true);

    pusher.error( new Error("Test error") );

    if( !receiver.sealed ){
        errors.push("Receiver conduit was not sealed by error in hard-spliced source");
    }

    let ran = false;
    receiver.then({
        next: () => { errors.push("receiver.then() ran its next handler after error") },
        error: () => { ran = true }
    })

    if( !ran ){
        errors.push("receiver.then() didn't run its error handler");
    }

})

test("Error passthrough on soft splice", () => {

    const errors: string[] = [];

    const pusher   = new Conduit<number>(1);
    const receiver = new Conduit<number>();

    receiver.splice(pusher, false);

    let ran = false;
    receiver.subscribe({
        error: () => { ran = true }
    })

    pusher.error( new Error("Test error") );

    if( !receiver.sealed ){
        errors.push("Receiver conduit was sealed by error in soft-spliced source");
    }

    if( ran ){
        errors.push("Receiver conduit called error handler");
    }

})

test("Error passthrough on derived conduit", () => {

    const errors: string[] = [];

    const a = new Conduit<number>(1);
    const b = new Conduit<number>(2);

    const sum = Conduit.derived({a, b}, ({a, b}) => a + b);

    let ran = false;
    sum.subscribe({
        error: () => { ran = true }
    })

    a.error( new Error("Test error") );

    if( !ran ){
        errors.push("Derived conduit didn't run error handler when source a errored");
    }

});