function log10(bigint) {
    if (bigint < 0) return NaN;
    const s = bigint.toString(10);

    return s.length + Math.log10("0." + s.substring(0, 15))
}


module.exports = { log10 }