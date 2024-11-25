import { Conduit } from '../src/vanilla';

class Machine {
    
    public readonly input1 = new Conduit<number>();
    public readonly input2 = new Conduit<number>();

    public readonly output = Conduit.derived({
        input1: this.input1,
        input2: this.input2,
    },
    ({input1, input2}) => {
        return input1 + input2;
    });

}

let garbageList: WeakRef<Machine>[] = [];

for( let i = 0; i < 1000; i++ ) {
    const machine = new Machine();

    garbageList.push(new WeakRef(machine));

    machine.output.subscribe( (value) => {
        console.log(value);
    });
    
    machine.input1.next(1);
    machine.input2.next(2);
}

setInterval( () => {
    let remain = garbageList.filter( (ref) => ref.deref() !== undefined );
    console.log(`${remain.length} objects remain`);
}, 1000);

/*
    Experiment conclusion: SAFE
    
    Claude 3.5 Sonnet reports that this chain of references is the unintuitive (and sometimes problematic) one:
      Subject's House →
      Subject (which references things in the house) →
      Subscription →
      Callback →
      Captured `this` (which is the Subject's House)

    Garbage is collected as long as it is globally inaccessible.

    This means as long as NOTHING in this circular reference chain is accessible when we're done,
    it's okay to let it simply go out of scope without unsubscribing.

    - The Machines aren't accessible after the loop besides from their WeakRefs, which won't stop them from being GC'd
    - The Machine subscriptions aren't kept anywhere external either
    - Neither are any of the conduits inside the Machine
    - Neither are any of the internal subscriptions

    So IN THEORY, this is safe to do, and the Machines will not leak memory.

    The setInterval log confirms this after a few seconds—the WeakRefs let go of their Machines because
    there are no other references.
*/