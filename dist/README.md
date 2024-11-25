# Conduits!

A special kind of RxJS Subject, which preserves the last value emitted for late subscribers.  

## Dude just use signals???

- Angular's use of RxJS goes back further, so I'd rather use that. &nbsp;Computed signals are also too "magical" for me.
- I find this way of doing things more intuitive. &nbsp;If you prefer something else, do that and save yourself the dependency!

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
import { NgConduit } from 'rxjs-conduit/angular';
import type { ReadonlyConduit } from 'rxjs-conduit/vanilla';
import { Component, ViewChild } from '@angular/core';
import { interval } from 'rxjs'

@Component({
    selector: 'app-example',
    templateUrl: './example.component.html',
    styleUrls: ['./example.component.scss']
})
export class ExampleComponent {

    /*
        NgConduit injects DestroyRef so it can unsubscribe
        itself when the component is destroyed.
    */
    private _child$ = new NgConduit<ChildComponent>();    
    
    /*
        Remembering when in the Angular component lifecycle decorated
        values like this initialize is error-prone for beginners.

        With a conduit and a setter, this becomes asynchronous code
        until it initializes properly.
    */
    @ViewChild(ChildComponent)
        protected set child(value: ChildComponent){ 
            _child$.next(value);
        }
        protected get child(){ 
            return _child$.value as ChildComponent // slightly unsafe!
        }

    constructor(){
        _child$.then( child => child.doSomething() );
    }

}
```

## API

### `new Conduit(first?: T)`
Creates a new conduit, optionally with an initial value.

### `Conduit.derived(sources, formula): ReadonlyConduit`
Creates a conduit whose value is derived using a formula and a set of source conduits.  
Completes when all sources complete and errors if *any* source errors.

### `subscribe(observer): Subscription`
Adds a subscription to this conduit, which will receive reactive updates.

### `then(callback): Subscription`
Similar to `subscribe`, but it only runs once then cleans up the subscription.

### `unsubscribe(): void`
Removes all subscribers to this conduit without notifying them.

### `splice(source, config?): Conduit`
Adds a source to this conduit, which will feed it values reactively. &nbsp;Returns self.  

### `unsplice(name?): boolean`
Disconnects a previous spliced source from this conduit, if it was named.  
Pass no name to unsplice everything.

### `sealed: boolean`
True after it completes or errors.

### `value: T`
Returns the most recent value, or `Conduit.EMPTY` if there isn't one yet.

### `valueOrDefault(fallback): T`
Returns the conduit's value, but returns the fallback instead if it's empty.

### `valueOrThrow(reason): T`
Returns the conduit's value, but throws the reason instead if it's empty.

### `flush(): void`
Sets the conduit back to `Conduit.EMPTY` without notifying subscribers.

## ⚠️ Important Notes

- This is my first package!
- I might push breaking changes without warning!
- I'm still learning, so I make zero guarantee of things working correctly!
## License

MIT License.

Copyright © 2024; Fasteroid

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
