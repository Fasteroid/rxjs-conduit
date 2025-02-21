import { Conduit } from "./vanilla";

export type ReadonlyConduitLike<C extends Conduit<T>, T> = Omit< C, 'next' | 'error' | 'complete' | 'splice' | 'unsubscribe' | 'flush' | 'bind' | 'seal' | 'next_safe' | 'completeWith' | 'completeWith_safe' >
