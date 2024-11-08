import { Observable, Observer, Subject, Subscription } from "rxjs";

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

    /**
     * Creates a new Conduit.
     * @param first an optional first value to pressurize the conduit with.
     */
    constructor(first?: T) {
        super();

        // save snapshot on emit
        super.subscribe( snapshot => {
            this._hasValue = true;
            this._value  = snapshot
        })

        // pass first value immediately if provided
        if(first !== undefined)
            this.next(first);
    }

    /**
     * Subscribes to this conduit.  
     * Subscribers will receive immediately if this conduit already has a value.
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
     * Feeds this conduit with the output of another observable.  This could be another conduit.
     * @note 
     * @param other Data source to splice into this conduit.
     */
    public splice(other: Observable<T>): void {
        other.subscribe( value => this.next(value) );
    }
    
}

export type ReadonlyConduit<T> = Omit< Conduit<T>, 'next' | 'error' | 'complete' | 'splice' >;