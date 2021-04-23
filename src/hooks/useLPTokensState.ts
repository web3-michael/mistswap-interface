import { ChainId, Token, TokenAmount } from '@sushiswap/sdk'
import { FACTORY_ADDRESS as UNI_FACTORY_ADDRESS } from '@uniswap/sdk'
import {
    useDashboard2Contract,
    useDashboardContract,
    usePancakeV1FactoryContract,
    useUniV2FactoryContract
} from 'hooks/useContract'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useActiveWeb3React } from '../hooks'
import LPToken from '../types/LPToken'

export interface LPTokensState {
    updateLPTokens: () => Promise<void>
    lpTokens: LPToken[]
    selectedLPToken?: LPToken
    setSelectedLPToken: (token?: LPToken) => void
    selectedLPTokenAllowed: boolean
    setSelectedLPTokenAllowed: (allowed: boolean) => void
    loading: boolean
    updatingLPTokens: boolean
}

const useLPTokensState = () => {
    const { account, chainId } = useActiveWeb3React()
    const factoryContract = useUniV2FactoryContract()
    const pancakeFactoryContract = usePancakeV1FactoryContract()
    const dashboardContract = useDashboardContract()
    const dashboard2Contract = useDashboard2Contract()
    const [lpTokens, setLPTokens] = useState<LPToken[]>([])
    const [selectedLPToken, setSelectedLPToken] = useState<LPToken>()
    const [selectedLPTokenAllowed, setSelectedLPTokenAllowed] = useState(false)
    const [loading, setLoading] = useState(true)
    const updatingLPTokens = useRef(false)

    const LP_TOKENS_LIMIT = chainId !== ChainId.BSC ? 300 : 10000

    console.log('LP_TOKENS_LIMIT:', LP_TOKENS_LIMIT)

    const updateLPTokens = useCallback(async () => {
        try {
            const length =
                chainId !== ChainId.BSC
                    ? await factoryContract?.allPairsLength()
                    : await pancakeFactoryContract?.allPairsLength()

            console.log({ length: length.toString() })

            const pages: number[] = []

            for (let i = 0; i < length; i += LP_TOKENS_LIMIT) pages.push(i)

            console.log('get expensive user lp call')
            const userLP = (
                await Promise.all(
                    pages.map(page =>
                        dashboardContract?.findPairs(
                            account,
                            chainId !== ChainId.BSC
                                ? UNI_FACTORY_ADDRESS
                                : '0xBCfCcbde45cE874adCB698cC183deBcF17952812',
                            page,
                            Math.min(page + LP_TOKENS_LIMIT, length.toNumber())
                        )
                    )
                )
            ).flat()

            const tokenDetails = (
                await dashboardContract?.getTokenInfo(
                    Array.from(new Set(userLP.reduce((a: any, b: any) => a.push(b.token, b.token0, b.token1) && a, [])))
                )
            ).reduce((acc: any, cur: any) => {
                acc[cur[0]] = cur
                return acc
            }, {})

            const balances = (
                await dashboardContract?.findBalances(
                    account,
                    userLP.map(pair => pair.token)
                )
            ).map((el: any) => el.balance)

            const userLPDetails = (
                await dashboard2Contract?.getPairsFull(
                    account,
                    userLP.map(pair => pair.token)
                )
            ).reduce((acc: any, cur: any) => {
                acc[cur[0]] = cur
                return acc
            }, {})

            const data = await Promise.all(
                userLP.map(async (pair, index) => {
                    const { totalSupply } = userLPDetails[pair.token]
                    const token = new Token(
                        chainId as ChainId,
                        tokenDetails[pair.token].token,
                        tokenDetails[pair.token].decimals,
                        tokenDetails[pair.token].symbol,
                        tokenDetails[pair.token].name
                    )
                    const tokenA = tokenDetails[pair.token0]
                    const tokenB = tokenDetails[pair.token1]

                    return {
                        address: pair.token,
                        decimals: token.decimals,
                        name: `${tokenA.symbol}-${tokenB.symbol} LP Token`,
                        symbol: `${tokenA.symbol}-${tokenB.symbol}`,
                        balance: new TokenAmount(token, balances[index]),
                        totalSupply,
                        tokenA: new Token(
                            chainId as ChainId,
                            tokenA.token,
                            tokenA.decimals,
                            tokenA.symbol,
                            tokenA.name
                        ),
                        tokenB: new Token(chainId as ChainId, tokenB.token, tokenB.decimals, tokenB.symbol, tokenB.name)
                    } as LPToken
                })
            )

            if (data) {
                setLPTokens(data)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
            updatingLPTokens.current = false
        }
    }, [
        chainId,
        factoryContract,
        pancakeFactoryContract,
        dashboardContract,
        account,
        dashboard2Contract,
        LP_TOKENS_LIMIT
    ])

    useEffect(() => {
        if (
            account &&
            factoryContract &&
            dashboard2Contract &&
            dashboardContract &&
            chainId &&
            !updatingLPTokens.current
        ) {
            updateLPTokens()
        }
    }, [account, dashboard2Contract, dashboardContract, factoryContract, chainId, updateLPTokens])

    return {
        updateLPTokens,
        lpTokens,
        selectedLPToken,
        setSelectedLPToken,
        selectedLPTokenAllowed,
        setSelectedLPTokenAllowed,
        loading,
        updatingLPTokens: updatingLPTokens.current
    }
}

export default useLPTokensState
