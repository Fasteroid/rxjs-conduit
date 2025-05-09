import test from "node:test";
import { Conduit } from "../src/vanilla";


test("Contravariance", () => {

    const a = new Conduit<number>(1);
    const b = new Conduit<number | undefined>(1);

    a.bind(b);
    b.bind(a)

});