import { DestroyRef, inject } from "@angular/core";
import { Conduit, ReadonlyConduit } from "../vanilla";
import { SubjectLike } from "rxjs";

export class NgConduit<T, SourceKey = any> extends Conduit<T, SourceKey> {

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
        Sources extends {[k: string]: ReadonlyConduit<any>}
    >( 
        sources: Sources,
        formula: (args: { [K in keyof Sources]: Sources[K] extends ReadonlyConduit<infer U> ? U : never }) => Result
    ): ReadonlyConduit<Result> {
        let out = Conduit.derived(sources, formula) as Conduit<Result>;
        inject(DestroyRef).onDestroy(() => out.complete());
        return out as ReadonlyConduit<Result>;
    }

    /**
     * @inheritdoc
     */
    public override inner<U, C extends (Conduit<U> | ReadonlyConduit<U>)>( getter: (container: T) => C ): C {
        let out = super.inner(getter);
        inject(DestroyRef).onDestroy(() => (out as Conduit<U>).complete()); // won't complete what it points to, but will stop emitting... also the cast is a
        return out;
    }

}