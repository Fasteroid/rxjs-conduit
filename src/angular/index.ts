import { DestroyRef, inject } from '@angular/core';
import { map, OperatorFunction, Unsubscribable } from 'rxjs';
import type { Defined, ReadonlyConduitLike } from '../internal_types';
import { Conduit, ReadonlyConduit } from '../vanilla';



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
        Object.setPrototypeOf(out, NgConduit.prototype); // really make this an NgConduit
        inject(DestroyRef).onDestroy(() => out.complete());
        return out as NgReadonlyConduit<Result>;
    }

    /**
     * @inheritdoc
     */
    public static override from<T>(...args: Parameters<typeof Conduit.from<T>>): NgConduit<T> {
        let out = Conduit.from(...args);
        Object.setPrototypeOf(out, NgConduit.prototype); // really make this an NgConduit
        inject(DestroyRef).onDestroy(() => (out as Conduit<T>).complete());
        return out as NgConduit<T>;
    }

    /**
     * @inheritdoc
     */  
    public override inner<U, C extends Conduit<U> | ReadonlyConduit<U> | undefined>( getter: (container: T) => C ): Defined<C> {
        let out = super.inner(getter);
        inject(DestroyRef).onDestroy(() => (out as Conduit<U>).complete());
        return out as Defined<C>;
    }

}