import test from "node:test";
import { Conduit } from "../src/vanilla";
import { DevConduit } from "../src/vanilla/development";

Conduit.enableDevelopment();

test("Development mode works", () => {
    const conduit = new Conduit<void>() as DevConduit<void>;

    if( !conduit.isDevelopmentMode ){
        throw new Error("Conduit is not a DevConduit.");
    }
});