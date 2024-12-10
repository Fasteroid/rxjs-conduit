import test from "node:test";
import { Conduit, Gate } from "../src/vanilla";
import { filter } from "rxjs";

test("Gates block infinite loops without filter", () => {
    const gate = new Gate();
    const a$ = new Conduit<number>();
    const b$ = new Conduit<number>();

    a$.subscribe( x => gate.run( () => b$.next(x) ) );
    b$.subscribe( x => gate.run( () => a$.next(x) ) );

    a$.next(1);
});

test("Gates block infinite loops with filter", () => {
    const gate = new Gate();
    const a$ = new Conduit<number>();
    const b$ = new Conduit<number>();

    a$.subscribe( x => gate.run( () => b$.next(x) ) );
    b$.pipe( filter(gate) ).subscribe( (x) => a$.next(x) );

    a$.next(1);
});