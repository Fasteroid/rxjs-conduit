import test from "node:test";
import { Conduit, Gate } from "../src/vanilla";
import { filter, map } from "rxjs";
import { throwAny } from "./common";

test("Gates stop infinite loop", () => {
    const gate = new Gate();
    const a$ = new Conduit<number>();
    const b$ = new Conduit<number>();

    a$.subscribe( x => gate.run( () => b$.next(x) ) );
    b$.subscribe( x => gate.run( () => a$.next(x) ) );

    a$.next(1);
});

test("Gate.bind works", () => {
    const errors: string[] = [];

    const a$ = new Conduit<number>();
    const b$ = new Conduit<number>();

    a$.bind(b$)

    a$.next(1);

    const c$ = new Conduit<string>("0.1");
    const d$ = new Conduit<number>(0);

    const bind = c$.bind(d$, map( v => parseFloat(v) ), map( v => v.toString() ))

    if( c$.value !== "0.1" ) { errors.push("first arg wasn't actually first") }

    c$.next("1")

    if( d$.value !== 1 ) { errors.push("binding 'to' conversion failed") }

    d$.next(2);

    if( c$.value !== '2') { errors.push("binding 'from' conversion failed") }

    bind.unsubscribe();
    d$.next(3);

    if( c$.value !== '2' ) { errors.push("binding didn't unsubscribe when told to") }

    throwAny(errors)
});