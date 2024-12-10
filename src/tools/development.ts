import { Conduit } from "../vanilla";

export type DevConduit<T> = Conduit<T> & Omit<ConduitDevExtensions<T>, "ᚼdevInit">;

const Old = {
    Instance: Object.defineProperties({}, Object.getOwnPropertyDescriptors(Conduit.prototype)) as Conduit<any>,
    Static:   Object.defineProperties({}, Object.getOwnPropertyDescriptors(Conduit)) as typeof Conduit
}


export function enableDevelopment(): void {
    // if( (Conduit as unknown as ConduitDevExtensions<any>).ᚼisDevelopmentMode ) return; // don't enable twice+
    console.log("Development mode enabled 🛠");
    redefineProperties(Conduit.prototype, ConduitDevExtensions.prototype); // instance properties
    redefineProperties(Conduit, ConduitDevExtensions);                     // static properties
}

export class ConduitDevExtensions<T> implements Partial< Conduit<T> > {

    // used for testing if development mode actually works correctly; don't touch
    public get ᚼisDevelopmentMode(): boolean { return true }
    static get ᚼisDevelopmentMode(): boolean { return true }

    public ᚼorigin!: string;
    public ᚼnextWarned?: boolean;

    protected ᚼdevInit(){
        // origin
        let origin = new Error().stack;
        if( origin )
            origin = origin.split("\n").slice(3).join("\n");

        this.ᚼorigin = origin ?? "    No stack trace available.";
    }

    public next(this: DevConduit<T>, value: T): void {
        if( this.sealed && !this.ᚼnextWarned ){
            this.ᚼnextWarned = true; // don't warn again
            throw new Error(`Called next on a sealed conduit\n\nCreation\n${this.ᚼorigin}`);
        }
        Old.Instance.next.call(this, value);
    }

    public complete(this: DevConduit<T>){
        Old.Instance.complete.call(this);
    }

}

(ConduitDevExtensions.prototype.next as any).lol = 1



function redefineProperties(target: any, source: any): void {
    const newProps = Object.getOwnPropertyDescriptors(source);
    for (const key in newProps) {
        if( key === "prototype" ){
            delete newProps[key]; // can't do this one
            continue;
        }
        delete target[key]; // delete collision so we can replace it
    }
    Object.defineProperties(target, newProps);
}