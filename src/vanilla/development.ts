import type { Conduit } from ".";

export class ConduitDevExtensions<T> {
    get isDevelopmentMode(): boolean { return true }
}

export type DevConduit<T> = Conduit<T> & ConduitDevExtensions<T>;