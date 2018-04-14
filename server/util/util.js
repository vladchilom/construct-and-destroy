'use strict'

exports.randomInRange = function (from, to) {
    return Math.floor(Math.random() * (to - from)) + from
}
