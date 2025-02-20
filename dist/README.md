# Conduits!

RxJS Replay Subjects with additional functionality

## Dude just use signals???

- Angular's use of RxJS goes back further, and signals still aren't supported everywhere yet.
- Some applications are still better-suited for RxJS.

## Features

- 🔄 **Late Subscriber Catch-Up**: Never miss a value again!
- 💪 **Flexible**: Easy to use even with minimal planning done in advance!
- 🎯 **Type-Safe**: Full TypeScript support!
- 🛠 **Framework Compatible**: Use the subclasses like `NgConduit` for easy cleanup on component destruction!

## Installation

```bash
npm install rxjs-conduit
```

## Usage

### Basic Vanilla Usage
```ts
import { Conduit } from 'rxjs-conduit/vanilla';

const source = new Conduit<string>();

// Use .then for single-shot observations that auto-unsubscribe
source.then(value => console.log(`${value} world`));

source.next("hello"); // "hello world"
source.next("hi");

// Late subscriptions get updated with the last event
source.subscribe(value => console.log(`${value} npm!`)); // "hi npm!"

source.next("bye"); // "bye npm!"
source.complete();
```

### Angular Integration
```ts
import { Component, ViewChild, Input } from '@angular/core';
import { interval } from 'rxjs'

// NgConduit injects a DestroyRef, and knows when to clean itself up!
import { NgConduit } from 'rxjs-conduit/angular';

type Thing = {
    data$: Conduit<string>
}

@Component({
    selector: 'app-thing-view',
    templateUrl: './thing-view.component.html',
    styleUrls: ['./thing-view.component.scss']
})
export class ThingViewComponent {

    /*
        Ever tried to access something only for Angular to be like,
        > "that's not ready in this lifecycle hook yet!!!"
        Hook a setter to a conduit and never worry again.
    */
    @ViewChild(ChildComponent)
        protected set child(c: ChildComponent){ _child$.next(c); }
        protected get child(){ return _child$.value as ChildComponent }
    private _child$ = new NgConduit<ChildComponent>();

    /*
        In one case, I needed nested reactivity on an Angular input.
        For this, .inner() is a fantastic tool.
    */
    @Input()
        public set thing(t: Thing){ this._thing$.next(t) }
        public get thing(){ return this._thing$.value as Thing }
    private _thing$ = new NgConduit<Thing>();

    // use this as normal, it will update both sources
    protected thingData$ = _thing$.inner( (thing) => thing.data$ );

    constructor(){
        // This will run as soon as Angular decides to set up the child
        _child$.then( child => child.doSomething() );
    }
}

```

## API: `Conduit`
###### (Things that `Subject` can already do are omitted.)

### `new Conduit(first?: T)`
Creates a new conduit, optionally with an initial value.

### `Conduit.derived(sources, formula): ReadonlyConduit`
Creates a conduit whose value is derived using a formula and a set of source conduits.  
Completes when all sources complete and errors if *any* source errors.

### `subscribe(observer): Subscription`
Adds a subscription to this conduit, which will receive reactive updates.

### `inner(getter): Conduit`
Creates a special "proxy" conduit based on the getter and value(s) of this conduit.

### `then(callback): Subscription`
Similar to `subscribe`, but it only runs once then cleans up the subscription.

### `unsubscribe(): void`
Removes all subscribers to this conduit without notifying them.

### `splice(source, config?): Conduit`
Adds a source to this conduit, which will feed it values reactively until it completes. &nbsp;Returns self.  

### `unsplice(name?): boolean`
Disconnects a previous spliced source from this conduit, if it was named.  
Pass no name to unsplice everything.

### `sealed: boolean`
True after it completes or errors.

### `value: T`
Returns the most recent value, or `Conduit.EMPTY` if there isn't one yet.

### `valueOrDefault(fallback): T`
Returns the conduit's value, or returns the fallback if it's empty.

### `valueOrThrow(reason): T`
Returns the conduit's value, or throws the reason if it's empty.

### `flush(): void`
Sets the conduit back to `Conduit.EMPTY` without notifying subscribers.

## Bonus API: `Gate`

### `new Gate()`
Creates a semaphore.

### `run(section): T`
Runs the section if the gate isn't currently running anything else.  
Returns the result, or `Gate.BLOCKED` if it didn't run.

### `open: boolean`
Is the gate ready to run something?

### `Gate.bind(first, second, conversions...): Unsubscribable`
Creates a two-way binding between a pair of conduits.


## License

MIT License.

Copyright © 2025; Fasteroid

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
