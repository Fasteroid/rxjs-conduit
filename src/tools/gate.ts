const BLOCKED = Symbol("BLOCKED");

type _Gate = Omit<Gate, "open"> & {
    (): boolean
    open: boolean
}

type Gate = {
    (): boolean
    readonly open: boolean
    run<T>( this: Gate, section: () => T ): T | typeof BLOCKED
}

interface GateConstructor {
    new (): Gate;
    BLOCKED: typeof BLOCKED
}

/**
 * Creates a semaphore-like object which is callable and returns its value.
 * Can be passed directly to RxJS's {@linkcode filter} operator to gate an observable source.
 */
export const Gate: GateConstructor = (() => { 
    class Gate {

        public static readonly BLOCKED = BLOCKED;

        /**
         * Is the gate ready to run something?
         */
        public readonly open: boolean = true;

        /**
         * Runs the section if the gate isn't currently running anything else.
         * Returns the result or {@linkcode Gate.BLOCKED} if it didn't run.
         */
        public run<T>( this: _Gate, section: () => T ): T | typeof Gate.BLOCKED {
            if( this.open === false ) return BLOCKED;
            let result: T;
            this.open = false;
            try {
                result = section();
            }
            finally {
                this.open = true;
            }
            return result;
        }

        constructor(){
            let it: _Gate = Object.setPrototypeOf( (() => it.open), Gate.prototype ) // it is a gate
            it.open = true;
        
            return it
        }

    };

    Object.setPrototypeOf(Gate.prototype, Function); // it is a function

    return Gate as GateConstructor;
})()