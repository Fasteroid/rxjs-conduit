import { Unsubscribable, Observer, Subject, Subscription, Subscribable, take } from "rxjs";
import { SafeSubscriber } from "rxjs/internal/Subscriber";

export type ReadonlyConduit<T> = Omit< Conduit<T>, 'next' | 'error' | 'complete' | 'splice' >;

/**
 * Configuration options for {@linkcode Conduit.splice}
 * @param hard - Tells the receiving conduit to complete when the source completes. &nbsp;False by default.
 * @param name - Can be used to overwrite (splice with the same name again) or {@link Conduit.unsplice | unsplice} an existing source.
 */
export type SpliceConfig = Partial<{
    hard: boolean;
    name: any;
}>

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

    private sources: Map<any, Unsubscribable> = new Map();

    private static readonly OK = Symbol('OK');
    private _thrownError: any = Conduit.OK;

    private static readonly DEFAULT_CONFIG: SpliceConfig = {
        hard: false
    }

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
            subscription.unsubscribe();            // remove
            return subscription;
        }

        if(this._value !== Conduit.EMPTY){
            subscription.next(this._value); // send the value if there is one
        }

        if( this.sealed ){
            subscription.complete();    // sealed and wasn't an error; therefore complete
            subscription.unsubscribe(); // remove
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
     * - Passing the {@link SpliceConfig.name | same name} will overwrite the old source.
     * - {@link SpliceConfig.hard | Hard splices} will complete this conduit when the source completes.
     * - Errors are always passed through.
     * - Internal subscriptions will be cleaned up when this conduit is sealed.
     * - Doesn't work if this conduit is sealed.
     * @param source  Any subscribable source of values.
     * @param config  {@link SpliceConfig | Configuration options for the splice.}
     * @returns self
     */
    public splice(source: Subscribable<T>, config: SpliceConfig = Conduit.DEFAULT_CONFIG): Conduit<T> {
        
        if( this.sealed ){
            console.warn("Attempted to splice into a sealed conduit!  This is probably a mistake!!");
            return this;
        }

        const hard = config.hard ?? false;
        
        const subscriber = new SafeSubscriber<T>({
            next: (value) => {
                this.next(value);
            },
            error: (err) => {
                this.error(err);
            },
            complete: () => {
                hard ? this.complete() : this.cleanup(subscriber);
            }
        });
        
        let name = subscriber;

        source.subscribe(subscriber); // see what it does (it might complete immediately and clean itself up)

        if( !subscriber.closed ){ // if it didn't complete immediately, we'll need to clean it up later
            if( config.hasOwnProperty('name') ){ // if a name was provided, use it and try to replace the old one
                name = config.name;
                this.sources.get(name)?.unsubscribe();
            }

            this.sources.set(name, subscriber);
        }

        return this;
    }

    /**
     * Disconnects a named {@link splice | spliced} source from this conduit, if it exists.
     * @param name - the identifier of the splice to disconnect
     * @returns if it was successful
    */
    public unsplice(name: any): boolean {
        let it = this.sources.get(name);
        if( it ){
            it.unsubscribe();
            this.sources.delete(name);
            return true;
        }
        return false;
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