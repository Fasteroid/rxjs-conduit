import test from "node:test";
import { Conduit } from "../src/vanilla";
import { assertEmissions, Emission, throwAny } from "./common";
import { SafeSubscriber } from "rxjs/internal/Subscriber";
import { Observer } from "rxjs";

/**
 * ```
 *     let outer$ = new Conduit<OuterValue>();
 *     let inner$ = outer$.inner( (x) => x.innerField$ )
 *
 * Stuff a conduit from outer$.inner() should do:
 * - when outer$ changes, inner$ should emit outer$.value.innerField$.value
 * - when inner$ is written to, the current outer$.value.innerField$ should do the same thing
 * - no infinite loops!
 */

type OuterValue = {
    source$: Conduit<number>;
}

test("Inner conduit subscribe works correctly", () => {
    let errors: string[] = []
    
    const outer$ = new Conduit<OuterValue>();

    const inner$ = outer$.inner( (x) => x.source$ );

    let expectedEmits: Emission<number>[] = [
        ["next", 1],
        ["next", 2],
        ["next", 3],
        ["next", 4],
    ]
    inner$.subscribe( assertEmissions(expectedEmits, errors) );

    let outer1: OuterValue = {
        source$: new Conduit(1)
    };

    let outer2: OuterValue = {
        source$: new Conduit(3)
    };

    // outer1.innerField$.subscribe( (x) => {
    //     console.log(`inner1: ${x}`);
    // } )

    outer$.next(outer1); // inner$ should emit 1
    outer1.source$.next(2);

    outer$.next(outer2);
    outer2.source$.next(4);

    if( expectedEmits.length > 0 ){
        errors.push(`${expectedEmits.length} emissions didn't happen`);
    }

    throwAny(errors);
});

test("Inner conduit next works correctly", () => {
    let errors: string[] = []
    
    const outer$ = new Conduit<OuterValue>();

    const inner$ = outer$.inner( (x) => x.source$ );

    const splice$ = new Conduit<number>();
    inner$.splice(splice$);

    let outer1: OuterValue = {
        source$: new Conduit(1)
    };

    let outer2: OuterValue = {
        source$: new Conduit(3)
    };

    let inner1expectations: Emission<number>[] = [
        ["next", 1],
        ["next", 2],
    ]
    outer1.source$.subscribe( assertEmissions(inner1expectations, errors, "inner1") );

    let inner2expectations: Emission<number>[] = [
        ["next", 3],
        ["next", 4],
    ]
    outer2.source$.subscribe( assertEmissions(inner2expectations, errors, "inner2") );

    outer$.next(outer1);
    splice$.next(2);      // gets sent to the proxy source, which then sends back to inner, etc... infinite loop.
    outer$.next(outer2);
    inner$.next(4);

    if( inner1expectations.length > 0 ){
        errors.push(`${inner1expectations.length} emissions on inner1 didn't happen`);
    }

    if( inner2expectations.length > 0 ){
        errors.push(`${inner2expectations.length} emissions on inner2 didn't happen`);
    }

    throwAny(errors);
});

type Player = {
    name: string,
    health$: Conduit<number>
}

type GameServer = {
    name: string,
    spectating$: Conduit<Player>
}

test("Inner conduit chains work", () => {
    let errors: string[] = []
    

    const fasteroid = { name: "fasteroid", health$: new Conduit(100) }
    const spanky    = { name: "spanky",    health$: new Conduit<number>()   }
    const popbob    = { name: "popbob",    health$: new Conduit(19)  }
    const fitmc     = { name: "fitmc",     health$: new Conduit(20)  }

    const server1: GameServer = {
        name: "e2 beyond infinity",
        spectating$: new Conduit<Player>()
    }

    const server2: GameServer = {
        name: "2b2t",
        spectating$: new Conduit(popbob)
    }

    const servers$ = new Conduit<GameServer>(server1);

    const innerSpectating$ = servers$.inner( (x) => x.spectating$ );
    const innerSpectatingX: Emission<Player>[] = [
        ["next", fasteroid],
        ["next", spanky],
        ["next", popbob],
        ["next", fitmc],
    ]
    innerSpectating$.subscribe( assertEmissions(innerSpectatingX, errors, "innerSpectating") );
    // innerSpectating$.subscribe( ply => {
    //     console.log(`Spectating ${ply.name}`);
    // })

    const innerSpectatorHp$ = innerSpectating$.inner( (x) => x.health$ );
    const innerSpectatorHpX: Emission<number>[] = [
        ["next", 100], // start observing fasteroid
        ["next", 90],  // damage fasteroid

                       // switch to spanky (he hasn't spawned in yet)
        ["next", 100], // spanky spawns in with full health

        ["next", 19],  // switch to 2b2t, observe popbob
        ["next", 1],   // popbob almost blows himself up

        ["next", 20],  // switch to fitmc
        ["next", 19],   // a noob punches him for 1 damage
    ]
    innerSpectatorHp$.subscribe( assertEmissions(innerSpectatorHpX, errors, "innerSpectatorHp") );
    // innerSpectatorHp$.subscribe( hp => {
    //     console.log(`HP is ${hp}`);
    // })

    const spankyHealthX: Emission<number>[] = [
        ["next", 100],
    ]
    spanky.health$.subscribe( assertEmissions(spankyHealthX, errors, "spankyHealth") );

    server1.spectating$.next(fasteroid); // start observing fasteroid
    innerSpectatorHp$.next(90);          // damage fasteroid
    innerSpectating$.next(spanky);       // switch to spanky
    innerSpectatorHp$.next(100);         // spanky spawns in with full health

    server1.spectating$.complete();      // what will this do?

    servers$.next(server2);              // switch to 2b2t, this will immediately observe popbob
    popbob.health$.next(1);              // popbob almost blows himself up
    innerSpectating$.next(fitmc);        // switch to fitmc
    innerSpectatorHp$.next(19);          // a noob punches him for 1 damage

    if( innerSpectatorHpX.length > 0 ){
        errors.push(`${innerSpectatorHpX.length} emissions on innerPlayer1health didn't happen`);
    }

    if( innerSpectatingX.length > 0 ){
        errors.push(`${innerSpectatingX.length} emissions on innerPlayers didn't happen`);
    }

    if( spankyHealthX.length > 0 ){
        errors.push(`${spankyHealthX.length} emissions on spankyHealth didn't happen`);
    }

    throwAny(errors);
});

test("Inner conduit completions 1", async () => {

    let errors: string[] = []
    
    const outer$ = new Conduit<OuterValue>();

    const proxy$ = outer$.inner( (x) => x.source$ );

    let outer1: OuterValue = {
        source$: new Conduit(1)
    };

    let outer2: OuterValue = {
        source$: new Conduit(5)       
    }

    let outer3: OuterValue = {
        source$: new Conduit(9)       
    }

    let proxyX: Emission<number>[] = [
        ["next", 1],
        ["next", 2],
        ["next", 3],
        ["next", 5],
        ["next", 6],
        ["complete"],
    ]

    let source1X: Emission<number>[] = [
        ["next", 1],
        ["next", 2],
        ["complete"]
    ]

    let source2X: Emission<number>[] = [
        ["next", 5],
        ["next", 6],
        ["next", 7],
    ]

    // EVENTS are as follows:
    // proxy, source1, source2

    proxy$.subscribe( assertEmissions(proxyX, errors, "inner") );              // _, _, _
    outer1.source$.subscribe( assertEmissions(source1X, errors, "source 1") ); // _, 1, _
    outer2.source$.subscribe( assertEmissions(source2X, errors, "source 2") ); // _, _, 5

    outer$.next(outer1);       // 1, _, _
    outer1.source$.next(2);    // 2, 2, _

    outer1.source$.complete(); 
    proxy$.next(3);            // 3, _, _ (write-back is a no-op)
    outer1.source$.next(4)     // _, _, _ (also a no-op)

    outer$.next(outer2)        // 5, _, 5

    outer$.complete()
    outer$.next(outer3)        // _, _, _ (no-op since outer$ is sealed)

    proxy$.next(6)             // 6, _, 6

    proxy$.complete();

    outer2.source$.next(7)     // _, _, 7 (write-forward is a no-op)
    proxy$.next(8);            // _, _, _ (no-op)

    if( proxyX.length > 0 ){
        errors.push(`${proxyX.length} emissions on inner didn't happen`);
    }

    if( source1X.length > 0 ){
        errors.push(`${source1X.length} emissions on source 1 didn't happen`);
    }

    throwAny(errors);
});

test("Inner conduit completions 2", async () => {

    let errors: string[] = []
    
    const outer$ = new Conduit<OuterValue>();

    let outer1: OuterValue = {
        source$: new Conduit()
    };

    let proxyX: Emission<number>[] = [
        ["next", 1],
        ["next", 2]
    ]

    let sourceX: Emission<number>[] = [
        ["next", 1],
        ["next", 2]
    ]

    let outerX: Emission<OuterValue>[] = [
        ["next", outer1],
        ["complete"]
    ]

    outer$.subscribe( assertEmissions(outerX, errors, "outer") );     

    const proxy$ = outer$.inner( (outer) => outer.source$ )

    outer$.completeWith(outer1);

    proxy$.subscribe( assertEmissions(proxyX, errors, "proxy") );
    outer1.source$.subscribe( assertEmissions(sourceX, errors, "source") );

    proxy$.next(1);
    outer1.source$.next(2);

    throwAny(errors);
});