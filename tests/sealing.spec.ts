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

test("Sealing last source of derived conduit closes it", () => {
    let errors: string[] = [];

    const conduit = new Conduit<number>();

    const derived = Conduit.derived({conduit}, ({conduit}) => conduit);

    let sub = derived.subscribe(() => {});

    conduit.complete();

    if( !sub.closed ){
        errors.push("Derived conduit wasn't closed by source conduit completion");
    }
});

test("Sealing source conduit closes hard-spliced conduit", () => {

    let errors: string[] = [];

    const conduit = new Conduit<number>();

    const spliced = new Conduit<number>();

    spliced.splice(conduit, {hard: true});

    let sub = spliced.subscribe(() => {});

    conduit.complete();

    if( !sub.closed ){
        errors.push("Hard-spliced conduit wasn't closed by source conduit completion");
    }

});

test("Sealing source conduit doesn't close soft-spliced conduit", () => {

    let errors: string[] = [];

    const conduit = new Conduit<number>();

    const spliced = new Conduit<number>();

    spliced.splice(conduit, {hard: false});

    let sub = spliced.subscribe(() => {});

    conduit.complete();

    if( sub.closed ){
        errors.push("Soft-spliced conduit was closed by source conduit completion");
    }

});