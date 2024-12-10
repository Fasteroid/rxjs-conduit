import test from "node:test";
import { Conduit } from "../src/vanilla";
import { ConduitDevExtensions, DevConduit, enableDevelopment } from "../src/tools/development";
import { throwAny } from "./common";


test("Development mode", () => {
    enableDevelopment();

    const errors: string[] = [];
    const conduit = new Conduit<void>() as DevConduit<void>;

    if( !conduit.ᚼisDevelopmentMode ){
        errors.push("Normal mixins are broken.");
    }

    if( !(Conduit as unknown as ConduitDevExtensions<any>).ᚼisDevelopmentMode ){
        errors.push("Static mixins are broken.");
    }

    throwAny(errors);
});


test("Development mode: stack traces", () => {
    enableDevelopment();

    function makeConduit(){
        return new Conduit<void>();
    }

    const errors: string[] = [];
    const conduit = makeConduit() as DevConduit<void>;

    conduit.complete();

    try {
        conduit.next();
    }
    catch(e){
        const err = String(e);
        if( !err.match(/Creation\s*at makeConduit/gm) ){
            errors.push("Origin was not properly set.");
        }
    }

    throwAny(errors);
});