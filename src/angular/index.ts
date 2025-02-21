import { DestroyRef, inject } from "@angular/core";
import { Conduit, ReadonlyConduit } from "../vanilla";
import { map, Observable, OperatorFunction, SubjectLike, Unsubscribable } from "rxjs";
import { ReadonlyConduitLike } from "../readonly";

export type NgReadonlyConduit<T> = ReadonlyConduitLike< NgConduit<T>, T >;

export class NgConduit<T> extends Conduit<T> {

    /**
     * Creates a new NgConduit.  It will cease to exist when the current component is destroyed.
     * @param first an optional first value to initialize the conduit with.
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
    ): NgReadonlyConduit<Result> {
        let out = Conduit.derived(sources, formula) as Conduit<Result>;
        Object.setPrototypeOf(out, NgConduit.prototype);
        inject(DestroyRef).onDestroy(() => out.complete());
        return out as NgReadonlyConduit<Result>;
    }

    /**
     * @inheritdoc
     */
    public static override from<T>(source: Observable<T>): NgConduit<T> {
        let out = Conduit.from(source);
        Object.setPrototypeOf(out, NgConduit.prototype);
        inject(DestroyRef).onDestroy(() => (out as Conduit<T>).complete());
        return out as NgConduit<T>;
    }

    /**
     * @inheritdoc
     */  
    public override inner<U, C extends Conduit<U> | ReadonlyConduit<U>>( getter: (container: T) => C ): C {
        let out = super.inner(getter);
        Object.setPrototypeOf(out, NgConduit.prototype);
        inject(DestroyRef).onDestroy(() => (out as Conduit<U>).complete());
        return out as C;
    }

    /**
     * @inheritdoc
     */
    public override bind<U>(
        that: Conduit<U>, 
        from: OperatorFunction<T, U> = map( v => v as unknown as U ),
        to:   OperatorFunction<U, T> = map( v => v as unknown as T )
    ): Unsubscribable {
        const unsub = super.bind(that, from, to);
        inject(DestroyRef).onDestroy(() => unsub.unsubscribe());
        return unsub;
    }

}
