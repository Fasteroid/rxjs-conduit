import test from "node:test";
import { Conduit } from "../src/vanilla";

test("Sealing conduit closes subscription", () => {

    let errors: string[] = [];

    const conduit = new Conduit<number>();

    let sub = conduit.subscribe(() => {})

    conduit.complete();

    if( !sub.closed ){
        errors.push("Subscription wasn't closed by conduit completion");
    }

});

test("Sealing conduit closes derived conduit", () => {

    let errors: string[] = [];

    const conduit = new Conduit<number>();

    const derived = Conduit.derived({conduit}, ({conduit}) => conduit);

    let sub = derived.subscribe(() => {});

    conduit.complete();

    if( !sub.closed ){
        errors.push("Derived conduit wasn't closed by source conduit completion");
    }

});

test("Sealing conduit closes spliced conduit", () => {

    let errors: string[] = [];

    const conduit = new Conduit<number>();

    const spliced = new Conduit<number>();

    spliced.splice(conduit, true);

    let sub = spliced.subscribe(() => {});

    conduit.complete();

    if( !sub.closed ){
        errors.push("Spliced conduit wasn't closed by source conduit completion");
    }

});