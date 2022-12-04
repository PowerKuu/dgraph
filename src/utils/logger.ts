import colors from "colors"

export function log(staus:string, state:string, message:any) {
    console.log(`  [${colors.bold(state.toUpperCase())}](${colors.cyan(staus)}) -> ${(message)}`)
}

export function logBreak() {
    console.log("")
}


export function error(state:string, message:any, fatal:boolean = false) {
    log(colors.red("ERROR"), state, message)
    if (fatal) throw new Error()
}

export function info(state:string, message:any) {
    log(colors.yellow("INFO"), state, message)
}

export function success(state:string, message:any) {
    log(colors.green("SUCCESS"), state, message)
}
