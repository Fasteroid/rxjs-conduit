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
    innerField$: Conduit<number>;
}

test("Inner conduit subscribe works correctly", () => {
    let errors: string[] = []
    
    const outer$ = new Conduit<OuterValue>();

    const inner$ = outer$.inner( (x) => x.innerField$ );

    let expectedEmits: Emission<number>[] = [
        ["next", 1],
        ["next", 2],
        ["next", 3],
        ["next", 4],
    ]
    inner$.subscribe( assertEmissions(expectedEmits, errors) );

    let outer1: OuterValue = {
        innerField$: new Conduit(1)
    };

    let outer2: OuterValue = {
        innerField$: new Conduit(3)
    };

    // outer1.innerField$.subscribe( (x) => {
    //     console.log(`inner1: ${x}`);
    // } )

    outer$.next(outer1); // inner$ should emit 1
    outer1.innerField$.next(2);

    outer$.next(outer2);
    outer2.innerField$.next(4);

    if( expectedEmits.length > 0 ){
        errors.push(`${expectedEmits.length} emissions didn't happen`);
    }

    throwAny(errors);
});

test("Inner conduit next works correctly", () => {
    let errors: string[] = []
    
    const outer$ = new Conduit<OuterValue>();

    const inner$ = outer$.inner( (x) => x.innerField$ );

    const splice$ = new Conduit<number>();
    inner$.splice(splice$);

    let outer1: OuterValue = {
        innerField$: new Conduit(1)
    };

    let outer2: OuterValue = {
        innerField$: new Conduit(3)
    };

    let inner1expectations: Emission<number>[] = [
        ["next", 1],
        ["next", 2],
    ]
    outer1.innerField$.subscribe( assertEmissions(inner1expectations, errors, "inner1") );

    let inner2expectations: Emission<number>[] = [
        ["next", 3],
        ["next", 4],
    ]
    outer2.innerField$.subscribe( assertEmissions(inner2expectations, errors, "inner2") );

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