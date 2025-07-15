import { Conduit, ReadonlyConduit } from './vanilla';

export type ReadonlyConduitLike<C extends Conduit<T>, T> = Omit< C, 'next' | 'error' | 'complete' | 'splice' | 'flush' | 'bind' | 'next_safe' | 'completeWith' | 'completeWith_safe' >
export type Defined<T> = T extends undefined ? never : T; 