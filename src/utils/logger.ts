import * as colors from "colors"

export function log(staus, state, message) {
    console.log(`(${staus}) [${colors.bold(state.toUpperCase())}] -> ${colors.bold(message)}`)
}

export function logBreak() {
    console.log("")
}

export function error(state:string, message:string, fatal:boolean = false) {
    log(colors.red("ERROR"), state, message)
    if (fatal) throw new Error()
}

export function info(state:string, message:string) {
    log(colors.yellow("INFO"), state, message)
}

export function success(state:string, message:string) {
    log(colors.green("SUCCESS"), state, message)
}
