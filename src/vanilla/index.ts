import { Unsubscribable, Observer, Subject, Subscription, Subscribable } from "rxjs";

/**
 * A special extension of the RxJS {@linkcode Subject}, which preserves the last value emitted for late subscribers.
 * 
 * Can be {@link splice | spliced}  with other conduits to create chains of automatic reactive data flow.
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
    private splices = new Set<Unsubscribable>();

    /**
     * Creates a new conduit.
     * @param first an optional first value to pressurize the conduit with.
     */
    constructor(first?: T) {
        super();

        // save snapshot on emit
        super.subscribe( snapshot => {
            this._hasValue = true;
            this._value  = snapshot
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
     * Pipes values from another {@link Subscribable} into this conduit.  
     * When this conduit completes, it will free the spliced connection.
     * @param other Any subscribable source of values.
     */
    public splice(other: Subscribable<T>): void {
        this.splices.add( 
            other.subscribe({
                next: value => this.next(value),
                error: error => this.error(error),
            })
        )
    }

    /**
     * Completes this conduit and cleans up spliced connections.
     */
    public override complete(): void {
        this.splices.forEach(sub => sub.unsubscribe());
        this.splices.clear();
        super.complete();
    }
    
}