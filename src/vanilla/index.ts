import { Unsubscribable, Observer, ReplaySubject, Subscription, Subscribable, take, Observable, SubjectLike, OperatorFunction, map } from "rxjs";
import { SafeSubscriber } from "rxjs/internal/Subscriber";
import { EMPTY_SUBSCRIPTION } from "rxjs/internal/Subscription";
import { ReadonlyConduitLike } from "../readonly";

export type ReadonlyConduit<T> = ReadonlyConduitLike< Conduit<T>, T >

const PROXY_SOURCE = Symbol('PROXY');

type InternalSafeSubscriber<T> = SafeSubscriber<T> & {
    [PROXY_SOURCE]?: true;
}

function ifWritable<T>( conduit: Conduit<T> ): Conduit<T> | undefined {
    return conduit.sealed ? undefined : conduit;
}


/**
 * Similar to {@linkcode ReplaySubject}, but with more features.
 */
export class Conduit<T> extends Observable<T> implements SubjectLike<T> {

    /**
     * The {@link value} of a conduit that has not yet received one.
     */
    public static readonly EMPTY = Symbol('EMPTY');

    /**
     * The {@link error} of a conduit that has not yet errored.
     */
    protected static readonly OK = Symbol('OK');

    /**
     * The most recent value pushed through this conduit.
     * If nothing has been pushed yet, this will be equal to {@linkcode Conduit.EMPTY}.
     */
    public get value(): T | typeof Conduit.EMPTY { return this._value; }
    private _value: T | typeof Conduit.EMPTY = Conduit.EMPTY;

    /**
     * Conduits are sealed by {@linkcode complete} and {@linkcode error}.
     * Once sealed, a conduit becomes a cold observable and will not accept new values.
     */
    public get sealed(): boolean { return this._sealed; }
    private _sealed = false;

    // so we can error anything that subscribes after we seal
    private _thrownError: any = Conduit.OK;

    // all sources that feed this conduit
    // all are unsubscribed when the conduit seals
    private sources:      Set< Unsubscribable > = new Set();

    // all observers of this conduit
    // all are removed when unsubscribe() is called
    private destinations: Set< InternalSafeSubscriber<T> > = new Set();

    /**
     * Creates a new conduit.
     * @param first an optional first value to initialize the conduit with.
     */
    constructor(first?: T) {
        super();

        // pass first value immediately if provided - could be an explicit undefined so we check arguments.length
        if(arguments.length > 0) this.next(first!);
    }

    /**
     * Seals the conduit, turning it cold and preventing further changes.
     */
    public seal(): void {
        this.unsubscribe();
        this._sealed = true;
    }

    /**
     * Errors this conduit and {@link sealed | seals} it.
     * Passes the error to all observers of this conduit.
     *
     * *This is a no-op if the conduit is already sealed.*
     */
    public error(err: any): void {
        if( this.sealed ) return;
        this._thrownError = err;
        this.destinations.forEach( dest => {
            dest.error(err)
        } );
        this.destinations.clear();
        this.seal();
    }

    /**
     * Completes this conduit and {@link sealed | seals} it.
     * Passes the completion to all observers of this conduit.
     *
     * *This is a no-op if the conduit is already sealed.*
     */
    public complete(): void {
        if( this.sealed ) return;
        this.destinations.forEach( dest => {
            try {
                dest.complete();
            }
            catch (err) {
                dest.error(err);
            }
        });
        this.destinations.clear();
        this.seal();
    }

    /**
     * Updates the value in this conduit and notifies all subscribers.
     *
     * *This is a no-op if the conduit is sealed.*
     */
    public next(value: T): void {
        if( this.sealed ) return;
        this._value = value;
        this.destinations.forEach( dest => {
            try {
                dest.next(value);
            }
            catch (err) {
                dest.error(err);
            }
        });
    }

    /**
     * Same as {@linkcode next}, but only if the value is not undefined.  
     * Unfortunately needed since Angular sometimes *explicitly* sets undefined before the actual value you want
     * for things like ViewChild.
     */
    public next_safe(value: T): void {
        if( value === undefined ) return;
        this.next(value);
    }

    /**
     * A union of {@linkcode next} and {@linkcode complete}.
     */
    public completeWith(value: T){
        this.next(value);
        this.complete();
    }

    /**
     * Same as {@linkcode completeWith}, but only if the value is not undefined.  
     * Unfortunately needed since Angular sometimes *explicitly* sets undefined before the actual value you want
     * for things like ViewChild.
     */
    public completeWith_safe(value: T){
        if( value === undefined ) return;
        this.completeWith(value);
    }

    /**
     * #### Creates a special "proxy" conduit based on the {@link getter} and value(s) of this conduit.
     * The proxy is a read/write source identical to what the getter returns, even if the getter changes.
     * - Subscribe once and forget; the proxy re-splices itself to new sources as the getter changes.
     * - Writing to the proxy is the same as writing to what the getter returns.
     * - You can complete the proxy with no side effects to the proxy's source.
     * @param getter - how to fetch the inner source from the outer (this) conduit
     * @returns magic pointer
     */
    public inner<U>( getter: (container: T) => Conduit<U> ): Conduit<U>
    public inner<U>( getter: (container: T) => ReadonlyConduit<U> ): ReadonlyConduit<U>    
    public inner<U>( getter: (container: T) => Conduit<U> | ReadonlyConduit<U>): Conduit<U> | ReadonlyConduit<U> {

        let proxy    = new Conduit<U>();
        let gate     = new Gate();
        let feedforward: Subscription | undefined;

        let actual = () => this.value !== Conduit.EMPTY ? ifWritable( getter(this.value) as Conduit<U> ) : undefined; // getter since it will change

        // pipe stuff from the proxy back to the actual... carefully.
        let feedback = proxy.subscribe({
            next: (value) => {
                gate.run( () => actual()?.next(value) );
            },
            error: (err) => {
                gate.run( () => actual()?.error(err) );
            }
        });

        feedback.add( () => feedforward?.unsubscribe() ); // sever both directions when the proxy is done

        // autosplice the actual to the proxy whenever the container changes
        // okay to let this subscription leak since it's our overridden subscribe and it'll catch it for us
        this.subscribe({
            next: (container) => {
                feedforward?.unsubscribe();

                let inner = getter(container); // only let values through when the gate is open

                // pipe from the actual to the proxy... carefully.
                feedforward = inner.subscribe({
                    next: (value) => {
                        gate.run( () => proxy.next(value) );
                    },
                    complete: () => {
                        feedforward?.unsubscribe();
                    },
                    error: (err) => {
                        gate.run( () => proxy.error(err) );
                    }
                })
            },
            error: (err) => {
                proxy.error(err);
                feedback.unsubscribe();
            }
        });

        return proxy as Conduit<U> | ReadonlyConduit<U>;
    }

    /**
     * #### Adds a destination to this conduit.
     * If this conduit has a value, the new subscriber will receive it immediately.
     * @param callback - an {@link Observer | observer} or callback function
     * @returns the subscription
     */
    public override subscribe(callback: Partial<Observer<T>> | ((value: T) => void) | null | undefined): Subscription {
        const destination = new SafeSubscriber<T>(callback) as InternalSafeSubscriber<T>;
        destination.add(() => this.destinations.delete(destination));

        if(this._thrownError !== Conduit.OK){
            destination.error(this._thrownError); // error first if there is one
            return EMPTY_SUBSCRIPTION;
        }

        if(this._value !== Conduit.EMPTY){
            try {
                destination.next(this._value); // send the value if there is one
            }
            catch (err) {
                destination.error(err);
                return EMPTY_SUBSCRIPTION;
            }
        }

        if( this.sealed ){
            destination.complete();    // sealed and wasn't an error; therefore complete
            return EMPTY_SUBSCRIPTION;
        }

        this.destinations.add(destination);

        return destination;
    }

    /**
     * Removes all sources from the conduit, freeing anything it observes.
     */
    public unsubscribe(): void {
        this.sources.forEach( source => source.unsubscribe() );
        this.sources.clear();
    }

    /**
     * #### Adds a source {@link Subscribable} to this conduit.
     * - The splice undoes itself when the source completes or this conduit seals.
     * - Errors are always passed through.
     * @param source  Any subscribable source of values.
     * @returns self
     */
    public splice(source: Subscribable<T>): Unsubscribable {
        if( this.sealed ) throw new Error("Tried to splice into a sealed conduit!")

        const subscriber = new SafeSubscriber<T>({
            next: (value) => {
                this.next(value);
            },
            error: (err) => {
                this.error(err);
            },
            complete: () => {
                subscriber.unsubscribe();
                this.sources.delete(subscriber)
            }
        });

        source.subscribe(subscriber); // see what it does (it might complete immediately and clean itself up)

        if( !subscriber.closed ){ // if it didn't complete immediately, we'll need to clean it up later
            this.sources.add(subscriber); // this cast is complete bullshit, but it's fine
        }

        return subscriber;
    }

    /**
     * Resets this conduit to {@link Conduit.EMPTY | empty}.
     * Does not notify subscribers.
     */
    public flush(){
        this._value = Conduit.EMPTY;
    }

    /**
     * Similar to {@link subscribe}, but it only runs once, then cleans up.
     * @param callback - an {@link Observer | observer} or callback function
     * @returns the subscription (but you probably won't need it)
     */
    public then(callback: Partial<Observer<T>> | ((value: T) => void) | null | undefined): Subscription {
        const subscriber = new SafeSubscriber(callback);
        const sub = this.pipe( take(1) ).subscribe(subscriber);
        return sub;
    }


    // ----
        /** 
         * Creates a two-way binding.
         * @param that - will inherit the value from `this` when the binding initializes
         */
        public bind(that: Conduit<T>): Unsubscribable;
        
        /** 
         * Creates a two-way binding.
         * 
         * This overload lets you bind conduits of different types.
         * 
         * @param that - will inherit the value from `this` when the binding initializes
         */
        public bind<U>(
            that: Conduit<U>, 
            from: OperatorFunction<T, U>, 
            to: OperatorFunction<U, T>
        ): Unsubscribable;
    
        public bind<U>(
            that: Conduit<U>, 
            from: OperatorFunction<T, U> = map( v => v as unknown as U ),
            to:   OperatorFunction<U, T> = map( v => v as unknown as T )
        ): Unsubscribable {

            const sem = new Gate();
            const sub1 = this.pipe(from).subscribe( value => sem.run( () => that.next(value) ) )
            const sub2 = that.pipe(to).subscribe( value => sem.run( () => this.next(value) ) )
            
            const unsubscribable = { unsubscribe: () => {
                sub1.unsubscribe();
                sub2.unsubscribe();
                this.sources.delete(unsubscribable);
            }}
            this.sources.add(unsubscribable); // make sure to free the bind if we unsubscribe

            return unsubscribable;
        }
    // ----

    /**
     * Returns the conduit's {@link value}, or returns the {@link fallback} if it's empty.
     * @param fallback The value to return if this conduit is empty.
     */
    public valueOrDefault<X>(fallback: X): T | X {
        return this.value === Conduit.EMPTY ? fallback : this.value;
    }

    /**
     * Returns the conduit's {@link value}, or throws the {@link reason} if it's empty.
     * @param reason The error to throw if this conduit is empty.
     */
    public valueOrThrow(reason?: any): T {
        if( this.value === Conduit.EMPTY ) throw reason;
        return this.value;
    }

    /**
     * #### Creates a conduit whose value is derived using a formula and a set of source conduits.
     * - Won't compute until all sources have values.
     * - Recomputes whenever a source changes.
     * - Seals when all sources have completed, or if any source errors.
     * @param sources Variables to use in the formula
     * @param formula How to calculate the derived value
     * @returns The derived conduit
     */
    public static derived<
        Result,
        Sources extends {[k: string]: ReadonlyConduit<any>},
    >(
        sources: Sources,
        formula: (args: { [K in keyof Sources]: Sources[K] extends ReadonlyConduit<infer U> ? U : never }) => Result
    ):
    ReadonlyConduit<Result> {
        let out = new Conduit<Result>();

        let sources_kv = Object.entries(sources);

        let update = () => {
            if ( sources_kv.some(source => source[1].value === Conduit.EMPTY) ) return; // can't do anything until all sources have values
            let args = Object.fromEntries( sources_kv.map(source => [source[0], source[1].value]) ) as { [K in keyof Sources]: Sources[K] extends ReadonlyConduit<infer U> ? U : never };
            out.next( formula(args) );
        }

        let completeIfFinished = () => {
            // the latest we can run this is when the last source is about to complete, so we check for 1 left instead of 0
            if( sources_kv.filter(source => !(source[1].sealed)).length === 1 ){
                out.complete();
            }
        }

        for( let source of sources_kv ){
            let subscriber = source[1].subscribe({
                next: () => update(),
                complete: () => completeIfFinished(), // once all sources complete, we can complete since it can never change again
                error: (err) => out.error(err)        // any source error should immediately error this conduit
            })
            out.sources.add(subscriber)
        }

        return out;
    }

    /**
     * Creates a conduit from an {@linkcode Observable}.
     * ```typescript
     * new Conduit().splice(source)
     * ```
     */
    public static from<T>(source: Observable<T>): Conduit<T> {
        const c = new Conduit<T>();
        c.splice(source);
        return c;
    }

}

const BLOCKED = Symbol("BLOCKED");

/**
 * A semaphore-like helper class.
 */
export class Gate {

    public static readonly BLOCKED = BLOCKED;

    /**
     * Is the gate ready to run something?
     */
    public get open(){ return this._open; }
    private _open: boolean = true;

    /**
     * Runs the section if the gate isn't currently running anything else.
     * Returns the result or {@linkcode Gate.BLOCKED} if it didn't run.
     */
    public run<T>( section: () => T ): T | typeof Gate.BLOCKED {
        if( this._open === false ) return BLOCKED;
        let result: T;
        this._open = false;
        try {
            result = section();
        }
        finally {
            this._open = true;
        }
        return result;
    }

};
