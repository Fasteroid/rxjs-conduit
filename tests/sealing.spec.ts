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

test("Sealing last source of derived conduit seals it", () => {
    let errors: string[] = [];

    const source = new Conduit<number>();

    const derived = Conduit.derived({source}, ({source}) => source);

    source.complete();

    if( !derived.sealed ){
        errors.push("Derived conduit wasn't sealed by its last source completing");
    }
});

test("Sealing source conduit seals hard-spliced conduit", () => {

    let errors: string[] = [];

    const source = new Conduit<number>();

    const spliced = new Conduit<number>();

    spliced.splice(source, {hard: true});

    source.complete();

    if( !source.sealed ){
        errors.push("Hard-spliced conduit wasn't sealed by source conduit sealing");
    }

});

test("Sealing source conduit doesn't seal soft-spliced conduit", () => {

    let errors: string[] = [];

    const source = new Conduit<number>();

    const spliced = new Conduit<number>();

    spliced.splice(source, {hard: false});

    source.complete();

    if( source.sealed ){
        errors.push("Soft-spliced conduit was sealed by source conduit completion");
    }

});