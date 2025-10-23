import { Conduit, ReadonlyConduit } from './vanilla';

// @ts-ignore; somehow this is fine even though TS has no idea what I'm talking about here.
export type ReadonlyConduitLike<C extends Conduit<T, EMPTY>, T, EMPTY = true> = Omit< C, 'next' | 'error' | 'complete' | 'splice' | 'flush' | 'bind' | 'next_safe' | 'completeWith' | 'completeWith_safe' >

export type Defined<T> = T extends undefined ? never : T; 