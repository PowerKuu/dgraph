const colors = require("colors")

function log(staus, state, message) {
    console.log(`(${staus}) [${colors.bold(state.toUpperCase())}] -> ${colors.bold(message)}`)
}


function error(state, message, fatal = false) {
    log(colors.red("ERROR"), state, message)
    if (fatal) throw new Error()
}

function info(state, message) {
    log(colors.yellow("INFO"), state, message)
}

function success(state, message) {
    log(colors.green("SUCCESS"), state, message)
}

exports.error = error
exports.info = info
exports.success = success