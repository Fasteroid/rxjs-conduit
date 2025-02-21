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
     * Like {@linkcode Conduit.bind}, but undoes it when the current component goes out of scope.
     */
    public static override bind<T1>(first: Conduit<T1>, second: Conduit<T1>): Unsubscribable;

    /** 
     * Like {@linkcode Conduit.bind}, but undoes it when the current component goes out of scope.
     */
    public static override bind<T1, T2>(
        first: Conduit<T1>, 
        second: Conduit<T2>,             
        from: OperatorFunction<T1, T2>, 
        to: OperatorFunction<T2, T1>
    ): Unsubscribable;

    /** 
     * Like {@linkcode Conduit.bind}, but undoes it when the current component goes out of scope.
     */
    public static override bind<T1, T2>(
        first: Conduit<T1>, 
        second: Conduit<T2>,           
        from: OperatorFunction<T1, T2> = map( v => v as unknown as T2 ),
        to:   OperatorFunction<T2, T1> = map( v => v as unknown as T1 )
    ): Unsubscribable {
        return Conduit.prototype.bind.bind(first)(second, from, to); // legendary cursed syntax
    }

    /**
     * @inheritdoc
     */  
    public override inner<U, C extends Conduit<U> | ReadonlyConduit<U>>( getter: (container: T) => C ): C {
        let out = super.inner(getter);
        inject(DestroyRef).onDestroy(() => (out as Conduit<U>).complete());
        return out as C;
    }

}