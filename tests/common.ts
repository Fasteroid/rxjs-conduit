export function throwAny(errs: string[]){
    if(errs.length > 0) throw new Error("One or more exceptions were thrown:\n" + errs.join('\n'));
}