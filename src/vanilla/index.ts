import { Unsubscribable, Observer, Subject, Subscription, Subscribable, take, Observable, SubjectLike, BehaviorSubject, takeWhile, map, filter } from "rxjs";
import { SafeSubscriber, Subscriber } from "rxjs/internal/Subscriber";
import { EMPTY_SUBSCRIPTION } from "rxjs/internal/Subscription";

export type ReadonlyConduit<T> = Omit< Conduit<T>, 'next' | 'error' | 'complete' | 'splice' | 'unsubscribe' | 'flush' | 'unsplice' >;

const PROXY_SOURCE = Symbol('PROXY');

type InternalSafeSubscriber<T> = SafeSubscriber<T> & {
    [PROXY_SOURCE]?: true;
}

/**
 * Configuration options for {@linkcode Conduit.splice}
 * @param hard - Tells the receiving conduit to complete when the source completes. &nbsp;False by default.
 * @param name - Can be used to overwrite (splice with the same name again) or {@link Conduit.unsplice | unsplice} an existing source.
 */
export type SourceConfig<T> = Partial<{
    hard: boolean;
    name: T;
}>

/**
 * A special kind of {@linkcode Subject}, which preserves the last value emitted for late subscribers.
 * Has many additional features to make it easier to work with reactive data.
 */
export class Conduit<T, SourceKey = any> extends Observable<T> implements SubjectLike<T> {

    /**
     * The {@link value} of a conduit that has not yet received one.
     */
    public static readonly EMPTY = Symbol('EMPTY');

    /**
     * The {@link error} of a conduit that has not yet errored.
     */
    protected static readonly OK = Symbol('OK');

    private static readonly DEFAULT_CONFIG: SourceConfig<any> = {
        hard: false
    }

    /**
     * The most recent value pushed through this conduit.
     * If nothing has been pushed yet, this will be equal to {@linkcode Conduit.EMPTY}.
     */
    public get value(): T | typeof Conduit.EMPTY { return this._value; }
    private _value: T | typeof Conduit.EMPTY = Conduit.EMPTY;

    /**
     * Conduits are sealed by {@linkcode complete}, {@linkcode error}, and {@linkcode unsubscribe}.
     * Once sealed, a conduit becomes a cold observable and will not accept new values.
     */
    public get sealed(): boolean { return this._sealed; }
    private _sealed = false;

    // so we can error anything that subscribes after we seal
    private _thrownError: any = Conduit.OK;

    // all sources that feed this conduit
    // all are unsubscribed when the conduit seals
    private sources:      Map< SourceKey,  Unsubscribable > = new Map();

    // all observers of this conduit
    // all are removed when unsubscribe() is called
    private destinations: Set< InternalSafeSubscriber<T> > = new Set();

    /**
     * Creates a new conduit.
     * @param first an optional first value to pressurize the conduit with.
     */
    constructor(first?: T) {
        super();

        // pass first value immediately if provided - could be an explicit undefined so we check arguments.length
        if(arguments.length > 0) this.next(first!);
    }

    private seal(): void {
        this.unsplice();
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
     * ***This is a no-op if the conduit is sealed!***
     */
    public next(value: T): void {
        if( this.sealed ){
            console.warn("Called .next() on a sealed conduit!  This is probably a mistake!!");
            return;
        }
        this._value = value;
        this.destinations.forEach( dest => {
            try {
                // possibility: change destinations to Set< CustomObserver<T> > and use a nullable method here to transmit source
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
    public inner<U>( getter: (container: T) => Conduit<U> ): Conduit<U> {

        let proxy  = new Conduit<U>();
        let actual = () => this.value !== Conduit.EMPTY ? getter(this.value) : undefined; // getter so we don't closure
        let gate   = new Gate(); // le mighty endlosschleifenverhinderer

        // pipe stuff from the proxy back to the actual... carefully.
        let feedback = proxy.pipe( filter( gate.open ) ).subscribe({
            next: (value) => {
                gate.run( () => actual()?.next(value) );
            },
            complete: () => {
                gate.run( () => this.unsplice(proxy as SourceKey) );
            },
            error: (err) => {
                gate.run( () => actual()?.error(err) );
            }
        });

        // autosplice the actual to the proxy whenever the container changes
        // okay to let this subscription leak since it's our overridden subscribe and it'll catch it for us
        this.subscribe({
            next: (container) => {
                this.unsplice(proxy as SourceKey);                           // unsplice the old one, using proxy as an identifier
                let managed = getter(container).pipe( filter( gate.open ) ); // only let values through when the gate is open

                let sub = managed.subscribe({                                // close the gate when any of this happens
                    next: (value) => {
                        gate.run( () => proxy.next(value) );
                    },
                    error: (err) => {
                        gate.run( () => proxy.error(err) );
                    }
                })

                this.sources.set(proxy as SourceKey, sub);                   // splice the new one
            },
            complete: () => {
                proxy.complete();
                feedback.unsubscribe();
            },
            error: (err) => {
                proxy.error(err);
                feedback.unsubscribe();
            }
        });

        return proxy;

    }

    /**
     * #### Adds a destination to this conduit.
     * If this conduit has a value, the new subscriber will receive it immediately.
     * @param callback - an {@link Observer | observer} or callback function``
     * @returns the subscription
     */
    public override subscribe(callback: Partial<Observer<T>> | ((value: T) => void) | null | undefined): Subscription {
        const destination = new SafeSubscriber<T>(callback) as InternalSafeSubscriber<T>;

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
        destination.add(() => this.destinations.delete(destination));

        return destination;
    }

    /**
     * Removes all destinations from this conduit without notifying them.
     */
    public unsubscribe(): void {
        this.destinations.clear();
    }

    /**
     * #### Adds a source {@link Subscribable} to this conduit.
     * Returns self.
     * - Passing the {@link SourceConfig.name | same name} will overwrite the old source.
     * - {@link SourceConfig.hard | Hard splices} will complete this conduit when the source completes.
     * - Errors are always passed through.
     * - Internal subscriptions will be cleaned up when this conduit is sealed.
     * - Doesn't work if this conduit is sealed.
     * @param source  Any subscribable source of values.
     * @param config  {@link SourceConfig | Configuration options for the splice.}
     * @returns self
     */
    public splice(source: Subscribable<T>, config: SourceConfig<SourceKey> = Conduit.DEFAULT_CONFIG): Conduit<T> {

        if( this.sealed ){
            console.warn("Attempted to splice into a sealed conduit!  This is probably a mistake!!");
            return this;
        }

        const hard = config.hard ?? false;

        // fun fact: new SafeSubscriber<T>(this) is just a hard splice!

        const subscriber = new SafeSubscriber<T>({
            next: (value) => {
                this.next(value);
            },
            error: (err) => {
                this.error(err);
            },
            complete: () => {
                hard ? this.complete() : this.unsplice(subscriber as SourceKey);
            }
        });

        let name: SafeSubscriber<T> | SourceKey = subscriber;

        source.subscribe(subscriber); // see what it does (it might complete immediately and clean itself up)

        if( !subscriber.closed ){ // if it didn't complete immediately, we'll need to clean it up later
            if( config.hasOwnProperty('name') ){ // if a name was provided, use it and try to replace the old one
                name = config.name;
                this.sources.get(name)?.unsubscribe();
            }

            this.sources.set(name as SourceKey, subscriber); // this cast is complete bullshit, but it's fine
        }

        return this;
    }

    /**
     * #### Removes a source from this conduit.
     * - Pass `name` to remove a named {@link splice} from this conduit.
     * - Pass nothing to remove *everything*.
     * @param name - the identifier of the splice to disconnect
     * @returns if it was successful
    */
    public unsplice(name?: SourceKey): boolean {
        if( arguments.length === 0 ){
            this.sources.forEach( source => source.unsubscribe() );
            this.sources.clear();
            return true;
        }
        else {
            this.sources.get(name!)?.unsubscribe();
            return this.sources.delete(name!);
        }
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
    public valueOrThrow(reason: any): T {
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
            out.sources.set(subscriber, subscriber);
        }

        return out;
    }

}

class Gate {
    private _open: boolean = true;

    public run<T>( section: () => T ): T {
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

    public readonly open = () => this._open;
}