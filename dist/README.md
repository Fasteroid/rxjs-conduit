# Conduits!

A special extension of RxJS Subjects, which remember the last value emitted to "catch up" any late subscribers.

## Dude just use signals???

- Angular's [signals](https://angular.dev/guide/signals/) feel janky to me and I'd rather stick with tried n' tested RxJS methods.
- `Conduit.splice` offers a ton of flexibility—initialize things in any order and the conduits will work it out.

## Features

- 🔄 **Late Subscriber Catch-Up**: Never miss initialization again!
- 🔌 **Easy Chaining**: Connect conduits together to create reactive data flow networks
- 🎯 **Type-Safe**: Full TypeScript support!
- 🛠 **RxJS Compatible**: Extends RxJS Subject for seamless integration 

## Installation

```bash
npm install rxjs-conduit
```

## Usage

### Vanilla

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

### Angular
```ts
import { NgConduit } from 'rxjs-conduit/angular';
import { Component } from '@angular/core';
import { interval } from 'rxjs'

@Component({
    selector: 'app-example',
    templateUrl: './example.component.html',
    styleUrls: ['./example.component.scss']
})
export class ExampleComponent {

    protected ticker = new Conduit<number>();

    constructor(){
        ticker.splice( interval(1000) ); // no leak, automatically cleans up when component dies
    }

}
```

### Value Peeking (dangerous)

```typescript
const conduit = new Conduit<string>('initial');

// Check if the conduit has received a value
console.log(conduit.hasValue); // true

// Access the current value
console.log(conduit.value); // 'initial'

// Will throw if accessed before first value
const empty = new Conduit<string>();
console.log(empty.value); // Error: conduit has no value
```

## API

### `constructor(first?: T)`
Creates a new conduit, optionally with an initial value.

### `splice(other: Subscribable<T>): void`
Connects another observable source to this conduit.

### `hasValue: boolean`
Indicates whether the conduit has received at least one value.

### `value: T`
Returns the most recent value. Throws if accessed before any value is received.

### `subscribe(callback: Observer<T> | ((value: T) => void)): Subscription`
Subscribes to the conduit. If the conduit has a value, the subscriber immediately receives it.

### `complete(): void`
Completes the conduit and cleans up any spliced connections.

## ⚠️ Important Notes

- Don't connect conduits in loops!
- NgConduits garbage collect themselves as needed.

## License

MIT

