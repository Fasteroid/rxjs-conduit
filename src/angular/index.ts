import { DestroyRef, inject } from "@angular/core";
import { Conduit, ReadonlyConduit } from "../vanilla";

export class NgConduit<T> extends Conduit<T> {

    /**
     * Creates a new NgConduit.  It will cease to exist when the current component is destroyed.
     * @param first an optional first value to pressurize the conduit with.
     */
    constructor(first?: T) {
        super(...arguments);
        inject(DestroyRef).onDestroy(() => this.complete());
    }

    /**
     * @inheritdoc
     */
    public static override derived<
        Result, 
        Sources extends {[k: string]: Conduit<any>}
    >( 
        sources: Sources,
        formula: (args: { [K in keyof Sources]: Sources[K] extends Conduit<infer U> ? U : never }) => Result
    ): ReadonlyConduit<Result> {
        let out = Conduit.derived(sources, formula) as Conduit<Result>; // TODO: this cast is a bit of a hack
        inject(DestroyRef).onDestroy(() => out.complete());
        return out as ReadonlyConduit<Result>;
    }

}