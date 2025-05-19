import test from "node:test";
import { Conduit } from "../src/vanilla";
import { NgConduit } from "../src/angular";

test("Contravariance", () => {

    const a = new Conduit<number>(1);
    const b = new Conduit<number | undefined>(1);

    const na = new NgConduit<number>(1);
    const nb = new NgConduit<number | undefined>(1);

    // all of these should be invalid
    a.bind(b);
    b.bind(a);

    NgConduit.bind(na, nb)

});