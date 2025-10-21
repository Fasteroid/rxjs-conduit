import test from "node:test";
import { Conduit } from "../src/vanilla";


test("Contravariance", () => {

    const a = new Conduit<number>(1);
    const b = new Conduit<number | undefined>(1);

    // these should both be invalid bindings
    a.bind(b);
    b.bind(a)

});

test("Contravariance - don't choke on generic class", () => {

    class Evil<T> {
        public that$ = new Conduit<T>();
        public this$ = new Conduit<T>();

        constructor() {
            // these should work
            this.that$.bind(this.this$);
            this.this$.bind(this.that$);
        }
    }

});