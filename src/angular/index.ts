import { DestroyRef, inject } from '@angular/core';
import { map, OperatorFunction, Unsubscribable } from 'rxjs';
import type { Defined, ReadonlyConduitLike } from '../internal_types';
import { Cond2it, ReadonlyConduit } from '../vanilla';



export type NgReadonlyConduit<T> = ReadonlyConduitLike< NgConduit<T>, T >;

export class NgConduit<T> extends Cond2it<T> {

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
        let out = Cond2it.derived(sources, formula) as Cond2it<Result>;
        Object.setPrototypeOf(out, NgConduit.prototype); // really make this an NgConduit
        inject(DestroyRef).onDestroy(() => out.complete());
        return out as NgReadonlyConduit<Result>;
    }

    /**
     * @inheritdoc
     */
    public static override from<T>(...args: Parameters<typeof Cond2it.from<T>>): NgConduit<T> {
        let out = Cond2it.from(...args);
        Object.setPrototypeOf(out, NgConduit.prototype); // really make this an NgConduit
        inject(DestroyRef).onDestroy(() => (out as Cond2it<T>).complete());
        return out as NgConduit<T>;
    }

    /** 
     * Like {@linkcode Cond2it.bind}, but undoes it when the current component goes out of scope.
     */
    public static override bind<T1>(first: Cond2it<T1>, second: Cond2it<T1>): Unsubscribable;

    /** 
     * Like {@linkcode Cond2it.bind}, but undoes it when the current component goes out of scope.
     */
    public static override bind<T1, T2>(
        first: Cond2it<T1>, 
        second: Cond2it<T2>,             
        from: OperatorFunction<T1, T2>, 
        to: OperatorFunction<T2, T1>
    ): Unsubscribable;

    /** 
     * Like {@linkcode Cond2it.bind}, but undoes it when the current component goes out of scope.
     */
    public static override bind<T1, T2>(
        first: Cond2it<T1>, 
        second: Cond2it<T2>,           
        from: OperatorFunction<T1, T2> = map( v => v as unknown as T2 ),
        to:   OperatorFunction<T2, T1> = map( v => v as unknown as T1 )
    ): Unsubscribable {
        let out = Cond2it.prototype.bind.bind(first) (second, from, to); // legendary cursed syntax
        inject(DestroyRef).onDestroy(() => out.unsubscribe());
        return out;
    }

    /**
     * @inheritdoc
     */  
    public override inner<U, C extends Cond2it<U> | ReadonlyConduit<U> | undefined>( getter: (container: T) => C ): Defined<C> {
        let out = super.inner(getter);
        inject(DestroyRef).onDestroy(() => (out as Cond2it<U>).complete());
        return out as Defined<C>;
    }

}