import { Unsubscribable, Observer, Subject, Subscription, Subscribable } from "rxjs";
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
     * Has this conduit received a value yet?
     */
    public get hasValue(): boolean { return this._hasValue; }
    private _hasValue: boolean = false;

    /**
     * The most recent value pushed through this conduit.
     * @throws if accessed before the first value is emitted.
     */
    public get value(): T { 
        if(!this._hasValue) throw new Error('Conduit has no value.');
        return this._value!;
    }
    private _value: T | undefined = undefined;

    // Recommended by Claude.ai for cleaning up spliced connections
    private inputs = new Set<Unsubscribable>();

    private cleanupInput(sub: Unsubscribable){
        sub.unsubscribe();
        this.inputs.delete(sub);
    }

    /**
     * Creates a new conduit.
     * @param first an optional first value to pressurize the conduit with.
     */
    constructor(first?: T) {
        super();

        super.subscribe({
            // save snapshot on emit
            next: (snapshot) => {
                this._hasValue = true;
                this._value  = snapshot;
            },

            // clean up when we're done
            complete: () => this.cleanup(),
            error:    () => this.cleanup()
        })

        // pass first value immediately if provided - could be an explicit undefined so we check arguments.length
        if(arguments.length > 0) this.next(first!);
    }

    /**
     * Subscribes to this conduit.  
     * If this conduit {@link hasValue | has a value}, the new subscriber will receive it immediately.
     * @param callback 
     * @returns subscription
     */
    public override subscribe(callback: Partial<Observer<T>> | ((value: T) => void) | null | undefined): Subscription {
        const observer = callback instanceof Function ? { next: callback } : callback;

        if( observer === null || observer === undefined ) return Subscription.EMPTY;

        if(this._hasValue && observer.next){ // we missed the last emit, so we need to catch up
            observer.next(this._value!);
        }

        return super.subscribe(observer);
    }

    /**
     * #### Streams events from another {@link Subscribable} into this conduit.  
     * Returns self.
     * 
     * - Defaults to soft splice. &nbsp;If the source completes or errors, it will quietly disconnect from this conduit.
     * - {@link hard | Hard splice} will pass through errors and completions from the source.
     * - Splice subscriptions are automatically cleaned up when this conduit completes or errors.
     * @param source Any subscribable source of values.
     * @param hard   If true, passes through errors and completions from the source.
     * @returns
     */
    public splice(source: Subscribable<T>, hard?: boolean): Conduit<T> {
        
        const subscriber = new SafeSubscriber<T>({
            next: (value) => {
                this.next(value);
            },
            error: (err) => {
                hard ? this.error(err) : this.cleanupInput(subscriber);
            },
            complete: () => {
                hard ? this.complete() : this.cleanupInput(subscriber);
            }
        });
        source.subscribe(subscriber);

        if( !subscriber.closed ){
            this.inputs.add(subscriber); // clean up later
        }

        return this;
    }

    /** 
     * Callback for when this conduit goes out of scope
    */
    protected cleanup(){
        this.inputs.forEach(sub => sub.unsubscribe());
        this.inputs.clear();
    }
    
    /**
     * #### Creates a conduit whose value is derived using a formula and a set of source conduits.  
     * - Won't compute until all sources have values.
     * - Recomputes whenever a source changes.
     * - Completions and errors from its sources are passed through and will trigger cleanup.
     * @param sources Variables to use in the formula
     * @param formula How to calculate the derived value
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
            if (sources_kv.some(source => !source[1].hasValue)) return; // can't do anything until all sources have values
            let args = Object.fromEntries( sources_kv.map(source => [source[0], source[1].value]) ) as { [K in keyof Sources]: Sources[K] extends ReadonlyConduit<infer U> ? U : never };
            out.next( formula(args) );
        }

        for( let source of sources_kv ){
            out.inputs.add( source[1].subscribe({
                next: () => update(),
                complete: () => out.complete(), // will trigger cleanup; see line 42
                error: (err) => out.error(err)
            }) );
        }

        return out;
    }
    
}