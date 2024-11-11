import { DestroyRef, inject } from "@angular/core";
import { Conduit } from "../vanilla";

export class NgConduit<T> extends Conduit<T> {

    /**
     * Creates a new NgConduit.  It will cease to exist when the current component is destroyed.
     * @param first an optional first value to pressurize the conduit with.
     */
    constructor(first?: T) {
        super(...arguments);
        inject(DestroyRef).onDestroy(() => this.complete());
    }

}