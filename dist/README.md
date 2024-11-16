# Conduits!

A special extension of RxJS Subjects, which remember the last value emitted to "catch up" any late subscribers.

## Dude just use signals???

- Angular's use of RxJS goes back further, so I'd rather use that. &nbsp;Computed signals are also too "magical" for me.
- I find this way of doing things more intuitive. &nbsp;If you prefer something else, do that and save yourself the dependency!

## Features

- 🔄 **Late Subscriber Catch-Up**: Never miss a value again!
- ✅ **Easy to Learn**: Probably easier to learn than RxJS, anyway.
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

const source = new Conduit<number>(42);

// Late subscribers will instantly receive a "catch-up" if the conduit has a value
source.subscribe(value => console.log(value + "a")); // -> 42a

// Conduits otherwise behave the same as a normal RxJS Subject
source.next(100); // -> 100a

// "catch-up" is always to the most recent value
source.subscribe(value => console.log(value + "b")); // -> 100b
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
    
    // create stress-free observavles that automatically complete when the component is destroyed!
    protected ticker$ = new NgConduit<number>();

    // learning the angular lifecycle is hard... but you don't have to with conduits!
    public child$: ReadonlyConduit<ChildComponent> = new NgConduit<ChildComponent>();
    
    @ViewChild
    protected set child(value: ChildComponent){ child$.next(value) }

    constructor(){
        // internal spliced subscriptions are cleaned up for you too!
        ticker$.splice( interval(1000) );
    }
}
```

### Value Peeking
```typescript
const conduit = new Conduit<string>('initial');

// Access the current value
console.log(conduit.value); // 'initial'

// And if there isn't a value yet...
const empty = new Conduit<string>();
console.log(empty.value); // Conduit.EMPTY
```

## API

### `new Conduit(first?: T)`
Creates a new conduit, optionally with an initial value.

### `Conduit.derived(sources, formula): ReadonlyConduit<T>`
Creates a conduit whose value is derived using a formula and a set of source conduits.

### `splice(source, hard?): Conduit`
Streams events from another subscribable into this conduit. &nbsp;Returns self.  
💡 Use hard splices to pass through errors and completions from the source!

### `hasValue: boolean`
True if the conduit is pressurized with a value.

### `value: T`
Returns the most recent value. &nbsp;Throws an exception if there is no pressure.

### `then(callback): Subscription`
Similar to `subscribe`, but it only runs once then cleans up the subscription.

## ⚠️ Important Notes

- Don't connect conduits in loops!
- NgConduits garbage collect themselves as needed.

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
