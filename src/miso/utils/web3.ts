import { BigNumber } from '@ethersproject/bignumber'

export const toDecimals = (value?: BigNumber | string | number, decimals = 18) => {
    if (!value) return '0'
    return (parseFloat(value.toString()) / 10 ** decimals).toFixed()
}
export const to18Decimals = (value?: string | number | BigNumber) => {
    if (!value) return '0'
    const TENPOW18 = 1e18
    return (parseFloat(value.toString()) * TENPOW18).toFixed()
}

export const toPrecision = (value: string | number | BigNumber, precision: number) => {
    return parseFloat(parseFloat(value.toString()).toPrecision(precision)).toString()
}

export const divNumbers = (a: any, b: any) => {
    if (!a || !b) return 0
    return parseFloat((parseFloat(a) / parseFloat(b)).toFixed(5))
}

export const subNumbers = (a: any, b: any) => {
    return parseFloat((parseFloat(a) - parseFloat(b)).toFixed(5))
}
