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
        super.subscribe(subscription) // returned subscription is the same one we just created

        if(this._thrownError !== Conduit.OK){
            subscription.error(this._thrownError); // error first if there is one
        }

        if(this._value !== Conduit.EMPTY){
            subscription.next(this._value); // send the value if there is one
        }

        if( this.sealed ){
            subscription.unsubscribe(); // clean up immediately if we're sealed
        }

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

    
    
}