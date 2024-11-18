import { Unsubscribable, Observer, Subject, Subscription, Subscribable, take } from "rxjs";
import { SafeSubscriber } from "rxjs/internal/Subscriber";

export type ReadonlyConduit<T> = Omit< Conduit<T>, 'next' | 'error' | 'complete' | 'splice' >;

/**
 * A special extension of the RxJS {@linkcode Subject}, which preserves the last value emitted for late subscribers.
 * 
 * Can be used to create reactive variables, splice dependencies, and more.
 * 
 * Do NOT connect circularly or you will create an infinite loop.
 */
export class Conduit<T> extends Subject<T> {

    /** 
     * The {@link value} of a conduit that has not yet received one.
     */
    public static readonly EMPTY = Symbol('EMPTY');

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

    private sources: Set<Unsubscribable> = new Set();

    private static readonly OK = Symbol('OK');
    private _thrownError: any = Conduit.OK;

    /**
     * Creates a new conduit.
     * @param first an optional first value to pressurize the conduit with.
     */
    constructor(first?: T) {
        super();

        // pass first value immediately if provided - could be an explicit undefined so we check arguments.length
        if(arguments.length > 0) this.next(first!);
    }

    /**
     * Errors this conduit and {@link sealed | seals} it.
     * 
     * *This is a no-op if the conduit is already sealed.*
     */
    public override error(err: any): void {
        if( this.sealed ) return;
        this._thrownError = err;
        super.error(err);
        this.cleanup();
    }

    /**
     * Completes this conduit and {@link sealed | seals} it.  
     *
     * *This is a no-op if the conduit is already sealed.*
     */
    public override complete(): void {
        if( this.sealed ) return;
        super.complete();
        this.cleanup();
    }

    /**
     * Updates the value in this conduit and notifies all subscribers.
     *
     * ***This is a no-op if the conduit is sealed!***
     */
    public override next(value: T): void {
        if( this.sealed ){
            console.warn("Called .next() on a sealed conduit!  This is probably a mistake!!");
            return;
        }
        this._value = value;
        super.next(value);
    }

    /**
     * Unsubscribes everything connected to this conduit and {@link sealed | seals} it.  
     */
    public override unsubscribe(): void {
        super.unsubscribe();
        this.cleanup();
    }

    /**
     * Subscribes to this conduit.  
     * If this conduit {@link hasValue | has a value}, the new subscriber will receive it immediately.
     * @param callback - an {@link Observer | observer} or callback function
     * @returns the subscription
     */
    public override subscribe(callback: Partial<Observer<T>> | ((value: T) => void) | null | undefined): Subscription {
        const subscription = new SafeSubscriber(callback);

        if(this._thrownError !== Conduit.OK){
            subscription.error(this._thrownError); // error first if there is one
            return subscription;
        }

        if(this._value !== Conduit.EMPTY){
            subscription.next(this._value); // send the value if there is one
        }

        if( this.sealed ){
            subscription.unsubscribe(); // clean up immediately if we're sealed
            return subscription;
        }

        super.subscribe(subscription);

        return subscription;
    }

    /**
     * Gateway for clearing internal subscriptions.  
     * Call with no arguments to seal the conduit and clear all internal subscriptions.
     * @internal
     */
    protected cleanup(subscriber?: Unsubscribable): void {
        if( !subscriber ){
            this.sources.forEach( source => source.unsubscribe() );
            this.sources.clear();
            this._sealed = true;
        }
        else {
            subscriber.unsubscribe();
            this.sources.delete(subscriber);
        }
    }

    /**
     * #### Streams events from another {@link Subscribable} into this conduit.  
     * Returns self.
     * 
     * - Defaults to soft splice. &nbsp;If the source completes or errors, it will quietly disconnect from this conduit.
     * - {@link hard | Hard splice} will pass through errors and completions from the source.
     * - Splice subscriptions are automatically cleaned up when this conduit completes or errors.
     * - Doesn't work if this conduit is sealed.
     * @param source Any subscribable source of values.
     * @param hard   If true, passes through errors and completions from the source.
     * @returns self
     */
    public splice(source: Subscribable<T>, hard?: boolean): Conduit<T> {
        if( this.sealed ){
            console.warn("Attempted to splice into a sealed conduit!  This is probably a mistake!!");
            return this;
        }
        
        const subscriber = new SafeSubscriber<T>({
            next: (value) => {
                this.next(value);
            },
            error: (err) => {
                hard ? this.error(err) : this.cleanup(subscriber);
            },
            complete: () => {
                hard ? this.complete() : this.cleanup(subscriber);
            }
        });
        
        source.subscribe(subscriber); // see what it does (it might complete immediately and clean itself up)

        if( !subscriber.closed ){ // if it didn't complete immediately, we'll need to clean it up later
            this.sources.add(subscriber);
        }

        return this;
    }

    /**
     * Similar to {@link subscribe}, but it only runs once, then cleans up.
     * @param callback - an {@link Observer | observer} or callback function
     * @returns the subscription (but you probably won't need it)
     */
    public then(callback: Partial<Observer<T>> | ((value: T) => void) | null | undefined): Subscription {
        const subscriber = new SafeSubscriber(callback);
        return this.pipe( take(1) ).subscribe(subscriber);
    }

    /**
     * #### Creates a conduit whose value is derived using a formula and a set of source conduits.  
     * - Won't compute until all sources have values.
     * - Recomputes whenever a source changes.
     * - Completions and errors from its sources are passed through and will trigger cleanup.
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

        for( let source of sources_kv ){
            out.sources.add( source[1].subscribe({
                next: () => update(),
                complete: () => out.complete(), // should trigger cleanup
                error: (err) => out.error(err)  // should also trigger cleanup
            }) );
        }

        return out;
    }
    
}