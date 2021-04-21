import { BigNumber } from '@ethersproject/bignumber'
import { TransactionResponse } from '@ethersproject/providers'
import { Currency, currencyEquals, ETHER, TokenAmount, WETH } from '@sushiswap/sdk'
import UnsupportedCurrencyFooter from 'components/swap/UnsupportedCurrencyFooter'
import { useIsTransactionUnsupported } from 'hooks/Trades'
import React, { useCallback, useContext, useState } from 'react'
import { Plus } from 'react-feather'
import ReactGA from 'react-ga'
import { RouteComponentProps } from 'react-router-dom'
import { Text } from 'rebass'
import { ThemeContext } from 'styled-components'
import { ButtonError, ButtonLight, ButtonPrimary } from '../../components/ButtonLegacy'
import { BlueCard, LightCard } from '../../components/CardLegacy'
import { AutoColumn, ColumnCenter } from '../../components/Column'
import CurrencyInputPanel from '../../components/CurrencyInputPanel'
import DoubleCurrencyLogo from '../../components/DoubleLogo'
import { AddRemoveTabs } from '../../components/NavigationTabs'
import { MinimalPositionCard } from '../../components/PositionCard'
import Row, { RowBetween, RowFlat } from '../../components/Row'
import TransactionConfirmationModal, { ConfirmationModalContent } from '../../components/TransactionConfirmationModal'
import { PairState } from '../../data/Reserves'
import { useActiveWeb3React } from '../../hooks'
import { useCurrency } from '../../hooks/Tokens'
import { ApprovalState, useApproveCallback } from '../../hooks/useApproveCallback'
import useTransactionDeadline from '../../hooks/useTransactionDeadline'
import { useWalletModalToggle } from '../../state/application/hooks'
import { Field } from '../../state/mint/actions'
import { useDerivedMintInfo, useMintActionHandlers, useMintState } from '../../state/mint/hooks'
import { useTransactionAdder } from '../../state/transactions/hooks'
import { useIsExpertMode, useUserSlippageTolerance } from '../../state/user/hooks'
import { TYPE } from '../../theme'
import { calculateGasMargin, calculateSlippageAmount, getRouterAddress, getRouterContract } from '../../utils'
import { currencyId } from '../../utils/currencyId'
import { maxAmountSpend } from '../../utils/maxAmountSpend'
import { wrappedCurrency } from '../../utils/wrappedCurrency'
import { Dots, Wrapper } from '../Pool/styleds'
import { ConfirmAddModalBottom } from './ConfirmAddModalBottom'
import { PoolPriceBar } from './PoolPriceBar'
import Alert from '../../components/Alert'
import { Helmet } from 'react-helmet'

export default function AddLiquidity({
    match: {
        params: { currencyIdA, currencyIdB }
    },
    history
}: RouteComponentProps<{ currencyIdA?: string; currencyIdB?: string }>) {
    const { account, chainId, library } = useActiveWeb3React()
    const theme = useContext(ThemeContext)

    const currencyA = useCurrency(currencyIdA)
    const currencyB = useCurrency(currencyIdB)

    const oneCurrencyIsWETH = Boolean(
        chainId &&
            ((currencyA && currencyEquals(currencyA, WETH[chainId])) ||
                (currencyB && currencyEquals(currencyB, WETH[chainId])))
    )

    const toggleWalletModal = useWalletModalToggle() // toggle wallet when disconnected

    const expertMode = useIsExpertMode()

    // mint state
    const { independentField, typedValue, otherTypedValue } = useMintState()
    const {
        dependentField,
        currencies,
        pair,
        pairState,
        currencyBalances,
        parsedAmounts,
        price,
        noLiquidity,
        liquidityMinted,
        poolTokenPercentage,
        error
    } = useDerivedMintInfo(currencyA ?? undefined, currencyB ?? undefined)

    const { onFieldAInput, onFieldBInput } = useMintActionHandlers(noLiquidity)

    const isValid = !error

    // modal and loading
    const [showConfirm, setShowConfirm] = useState<boolean>(false)
    const [attemptingTxn, setAttemptingTxn] = useState<boolean>(false) // clicked confirm

    // txn values
    const deadline = useTransactionDeadline() // custom from users settings
    const [allowedSlippage] = useUserSlippageTolerance() // custom from users
    const [txHash, setTxHash] = useState<string>('')

    // get formatted amounts
    const formattedAmounts = {
        [independentField]: typedValue,
        [dependentField]: noLiquidity ? otherTypedValue : parsedAmounts[dependentField]?.toSignificant(6) ?? ''
    }

    // get the max amounts user can add
    const maxAmounts: { [field in Field]?: TokenAmount } = [Field.CURRENCY_A, Field.CURRENCY_B].reduce(
        (accumulator, field) => {
            return {
                ...accumulator,
                [field]: maxAmountSpend(currencyBalances[field])
            }
        },
        {}
    )

    const atMaxAmounts: { [field in Field]?: TokenAmount } = [Field.CURRENCY_A, Field.CURRENCY_B].reduce(
        (accumulator, field) => {
            return {
                ...accumulator,
                [field]: maxAmounts[field]?.equalTo(parsedAmounts[field] ?? '0')
            }
        },
        {}
    )

    // check whether the user has approved the router on the tokens
    const [approvalA, approveACallback] = useApproveCallback(parsedAmounts[Field.CURRENCY_A], getRouterAddress(chainId))
    const [approvalB, approveBCallback] = useApproveCallback(parsedAmounts[Field.CURRENCY_B], getRouterAddress(chainId))

    const addTransaction = useTransactionAdder()

    async function onAdd() {
        if (!chainId || !library || !account) return
        const router = getRouterContract(chainId, library, account)

        const { [Field.CURRENCY_A]: parsedAmountA, [Field.CURRENCY_B]: parsedAmountB } = parsedAmounts
        if (!parsedAmountA || !parsedAmountB || !currencyA || !currencyB || !deadline) {
            return
        }

        const amountsMin = {
            [Field.CURRENCY_A]: calculateSlippageAmount(parsedAmountA, noLiquidity ? 0 : allowedSlippage)[0],
            [Field.CURRENCY_B]: calculateSlippageAmount(parsedAmountB, noLiquidity ? 0 : allowedSlippage)[0]
        }

        let estimate,
            method: (...args: any) => Promise<TransactionResponse>,
            args: Array<string | string[] | number>,
            value: BigNumber | null
        if (currencyA === ETHER || currencyB === ETHER) {
            const tokenBIsETH = currencyB === ETHER
            estimate = router.estimateGas.addLiquidityETH
            method = router.addLiquidityETH
            args = [
                wrappedCurrency(tokenBIsETH ? currencyA : currencyB, chainId)?.address ?? '', // token
                (tokenBIsETH ? parsedAmountA : parsedAmountB).raw.toString(), // token desired
                amountsMin[tokenBIsETH ? Field.CURRENCY_A : Field.CURRENCY_B].toString(), // token min
                amountsMin[tokenBIsETH ? Field.CURRENCY_B : Field.CURRENCY_A].toString(), // eth min
                account,
                deadline.toHexString()
            ]
            value = BigNumber.from((tokenBIsETH ? parsedAmountB : parsedAmountA).raw.toString())
        } else {
            estimate = router.estimateGas.addLiquidity
            method = router.addLiquidity
            args = [
                wrappedCurrency(currencyA, chainId)?.address ?? '',
                wrappedCurrency(currencyB, chainId)?.address ?? '',
                parsedAmountA.raw.toString(),
                parsedAmountB.raw.toString(),
                amountsMin[Field.CURRENCY_A].toString(),
                amountsMin[Field.CURRENCY_B].toString(),
                account,
                deadline.toHexString()
            ]
            value = null
        }

        setAttemptingTxn(true)
        await estimate(...args, value ? { value } : {})
            .then(estimatedGasLimit =>
                method(...args, {
                    ...(value ? { value } : {}),
                    gasLimit: calculateGasMargin(estimatedGasLimit)
                }).then(response => {
                    setAttemptingTxn(false)

                    addTransaction(response, {
                        summary:
                            'Add ' +
                            parsedAmounts[Field.CURRENCY_A]?.toSignificant(3) +
                            ' ' +
                            currencies[Field.CURRENCY_A]?.getSymbol(chainId) +
                            ' and ' +
                            parsedAmounts[Field.CURRENCY_B]?.toSignificant(3) +
                            ' ' +
                            currencies[Field.CURRENCY_B]?.getSymbol(chainId)
                    })

                    setTxHash(response.hash)

                    ReactGA.event({
                        category: 'Liquidity',
                        action: 'Add',
                        label: [
                            currencies[Field.CURRENCY_A]?.getSymbol(chainId),
                            currencies[Field.CURRENCY_B]?.getSymbol(chainId)
                        ].join('/')
                    })
                })
            )
            .catch(error => {
                setAttemptingTxn(false)
                // we only care if the error is something _other_ than the user rejected the tx
                if (error?.code !== 4001) {
                    console.error(error)
                }
            })
    }

    const modalHeader = () => {
        return noLiquidity ? (
            <AutoColumn gap="20px">
                <LightCard mt="20px" borderRadius="20px">
                    <RowFlat>
                        <Text fontSize="48px" fontWeight={500} lineHeight="42px" marginRight={10}>
                            {currencies[Field.CURRENCY_A]?.getSymbol(chainId) +
                                '/' +
                                currencies[Field.CURRENCY_B]?.getSymbol(chainId)}
                        </Text>
                        <DoubleCurrencyLogo
                            currency0={currencies[Field.CURRENCY_A]}
                            currency1={currencies[Field.CURRENCY_B]}
                            size={30}
                        />
                    </RowFlat>
                </LightCard>
            </AutoColumn>
        ) : (
            <AutoColumn gap="20px">
                <RowFlat style={{ marginTop: '20px' }}>
                    <Text fontSize="48px" fontWeight={500} lineHeight="42px" marginRight={10}>
                        {liquidityMinted?.toSignificant(6)}
                    </Text>
                    <DoubleCurrencyLogo
                        currency0={currencies[Field.CURRENCY_A]}
                        currency1={currencies[Field.CURRENCY_B]}
                        size={30}
                    />
                </RowFlat>
                <Row>
                    <Text fontSize="24px">
                        {currencies[Field.CURRENCY_A]?.getSymbol(chainId) +
                            '/' +
                            currencies[Field.CURRENCY_B]?.getSymbol(chainId) +
                            ' Pool Tokens'}
                    </Text>
                </Row>
                <TYPE.italic fontSize={12} textAlign="left" padding={'8px 0 0 0 '}>
                    {`Output is estimated. If the price changes by more than ${allowedSlippage /
                        100}% your transaction will revert.`}
                </TYPE.italic>
            </AutoColumn>
        )
    }

    const modalBottom = () => {
        return (
            <ConfirmAddModalBottom
                price={price}
                currencies={currencies}
                parsedAmounts={parsedAmounts}
                noLiquidity={noLiquidity}
                onAdd={onAdd}
                poolTokenPercentage={poolTokenPercentage}
            />
        )
    }

    const pendingText = `Supplying ${parsedAmounts[Field.CURRENCY_A]?.toSignificant(6)} ${currencies[
        Field.CURRENCY_A
    ]?.getSymbol(chainId)} and ${parsedAmounts[Field.CURRENCY_B]?.toSignificant(6)} ${currencies[
        Field.CURRENCY_B
    ]?.getSymbol(chainId)}`

    const handleCurrencyASelect = useCallback(
        (currencyA: Currency) => {
            const newCurrencyIdA = currencyId(currencyA)
            if (newCurrencyIdA === currencyIdB) {
                history.push(`/add/${currencyIdB}/${currencyIdA}`)
            } else {
                history.push(`/add/${newCurrencyIdA}/${currencyIdB}`)
            }
        },
        [currencyIdB, history, currencyIdA]
    )
    const handleCurrencyBSelect = useCallback(
        (currencyB: Currency) => {
            const newCurrencyIdB = currencyId(currencyB)
            if (currencyIdA === newCurrencyIdB) {
                if (currencyIdB) {
                    history.push(`/add/${currencyIdB}/${newCurrencyIdB}`)
                } else {
                    history.push(`/add/${newCurrencyIdB}`)
                }
            } else {
                history.push(`/add/${currencyIdA ? currencyIdA : 'ETH'}/${newCurrencyIdB}`)
            }
        },
        [currencyIdA, history, currencyIdB]
    )

    const handleDismissConfirmation = useCallback(() => {
        setShowConfirm(false)
        // if there was a tx hash, we want to clear the input
        if (txHash) {
            onFieldAInput('')
        }
        setTxHash('')
    }, [onFieldAInput, txHash])

    const isCreate = history.location.pathname.includes('/create')

    const addIsUnsupported = useIsTransactionUnsupported(currencies?.CURRENCY_A, currencies?.CURRENCY_B)

    return (
        <>
            <Helmet>
                <title>Add Liquidity | Sushi</title>
            </Helmet>
            <div className="bg-dark-900 w-full max-w-2xl rounded">
                <AddRemoveTabs creating={isCreate} adding={true} />
                <Wrapper>
                    <TransactionConfirmationModal
                        isOpen={showConfirm}
                        onDismiss={handleDismissConfirmation}
                        attemptingTxn={attemptingTxn}
                        hash={txHash}
                        content={() => (
                            <ConfirmationModalContent
                                title={noLiquidity ? 'You are creating a pool' : 'You will receive'}
                                onDismiss={handleDismissConfirmation}
                                topContent={modalHeader}
                                bottomContent={modalBottom}
                            />
                        )}
                        pendingText={pendingText}
                    />
                    <AutoColumn gap="20px">
                        {noLiquidity ||
                            (isCreate ? (
                                <Alert
                                    message="When creating a pair you are the first liquidity provider. The ratio of tokens you add will set the price of this pool. Once you are happy with the rate, click supply to review."
                                    type="information"
                                />
                            ) : (
                                <Alert
                                    showIcon={false}
                                    message={
                                        <>
                                            <b>Tip:</b> When you add liquidity, you will receive pool tokens
                                            representing your position. These tokens automatically earn fees
                                            proportional to your share of the pool, and can be redeemed at any time.
                                        </>
                                    }
                                    type="information"
                                />
                            ))}
                        <CurrencyInputPanel
                            value={formattedAmounts[Field.CURRENCY_A]}
                            onUserInput={onFieldAInput}
                            onMax={() => {
                                onFieldAInput(maxAmounts[Field.CURRENCY_A]?.toExact() ?? '')
                            }}
                            onCurrencySelect={handleCurrencyASelect}
                            showMaxButton={!atMaxAmounts[Field.CURRENCY_A]}
                            currency={currencies[Field.CURRENCY_A]}
                            id="add-liquidity-input-tokena"
                            showCommonBases
                        />
                        <ColumnCenter>
                            <Plus size="16" color={theme.text2} />
                        </ColumnCenter>
                        <CurrencyInputPanel
                            value={formattedAmounts[Field.CURRENCY_B]}
                            onUserInput={onFieldBInput}
                            onCurrencySelect={handleCurrencyBSelect}
                            onMax={() => {
                                onFieldBInput(maxAmounts[Field.CURRENCY_B]?.toExact() ?? '')
                            }}
                            showMaxButton={!atMaxAmounts[Field.CURRENCY_B]}
                            currency={currencies[Field.CURRENCY_B]}
                            id="add-liquidity-input-tokenb"
                            showCommonBases
                        />
                        {currencies[Field.CURRENCY_A] &&
                            currencies[Field.CURRENCY_B] &&
                            pairState !== PairState.INVALID && (
                                <>
                                    <LightCard padding="0px" borderRadius={'20px'}>
                                        <RowBetween padding="1rem">
                                            <TYPE.subHeader fontWeight={500} fontSize={14}>
                                                {noLiquidity ? 'Initial prices' : 'Prices'} and pool share
                                            </TYPE.subHeader>
                                        </RowBetween>{' '}
                                        <LightCard padding="1rem" borderRadius={'20px'}>
                                            <PoolPriceBar
                                                currencies={currencies}
                                                poolTokenPercentage={poolTokenPercentage}
                                                noLiquidity={noLiquidity}
                                                price={price}
                                            />
                                        </LightCard>
                                    </LightCard>
                                </>
                            )}

                        {addIsUnsupported ? (
                            <ButtonPrimary disabled={true}>
                                <TYPE.main mb="4px">Unsupported Asset</TYPE.main>
                            </ButtonPrimary>
                        ) : !account ? (
                            <ButtonLight onClick={toggleWalletModal}>Connect Wallet</ButtonLight>
                        ) : (
                            <AutoColumn gap={'md'}>
                                {(approvalA === ApprovalState.NOT_APPROVED ||
                                    approvalA === ApprovalState.PENDING ||
                                    approvalB === ApprovalState.NOT_APPROVED ||
                                    approvalB === ApprovalState.PENDING) &&
                                    isValid && (
                                        <RowBetween>
                                            {approvalA !== ApprovalState.APPROVED && (
                                                <ButtonPrimary
                                                    onClick={approveACallback}
                                                    disabled={approvalA === ApprovalState.PENDING}
                                                    width={approvalB !== ApprovalState.APPROVED ? '48%' : '100%'}
                                                >
                                                    {approvalA === ApprovalState.PENDING ? (
                                                        <Dots>
                                                            Approving {currencies[Field.CURRENCY_A]?.getSymbol(chainId)}
                                                        </Dots>
                                                    ) : (
                                                        'Approve ' + currencies[Field.CURRENCY_A]?.getSymbol(chainId)
                                                    )}
                                                </ButtonPrimary>
                                            )}
                                            {approvalB !== ApprovalState.APPROVED && (
                                                <ButtonPrimary
                                                    onClick={approveBCallback}
                                                    disabled={approvalB === ApprovalState.PENDING}
                                                    width={approvalA !== ApprovalState.APPROVED ? '48%' : '100%'}
                                                >
                                                    {approvalB === ApprovalState.PENDING ? (
                                                        <Dots>
                                                            Approving {currencies[Field.CURRENCY_B]?.getSymbol(chainId)}
                                                        </Dots>
                                                    ) : (
                                                        'Approve ' + currencies[Field.CURRENCY_B]?.getSymbol(chainId)
                                                    )}
                                                </ButtonPrimary>
                                            )}
                                        </RowBetween>
                                    )}
                                <ButtonError
                                    onClick={() => {
                                        expertMode ? onAdd() : setShowConfirm(true)
                                    }}
                                    disabled={
                                        !isValid ||
                                        approvalA !== ApprovalState.APPROVED ||
                                        approvalB !== ApprovalState.APPROVED
                                    }
                                    error={
                                        !isValid &&
                                        !!parsedAmounts[Field.CURRENCY_A] &&
                                        !!parsedAmounts[Field.CURRENCY_B]
                                    }
                                >
                                    <Text fontSize={20} fontWeight={500}>
                                        {error ?? 'Supply'}
                                    </Text>
                                </ButtonError>
                            </AutoColumn>
                        )}
                    </AutoColumn>
                </Wrapper>
            </div>
            {!addIsUnsupported ? (
                pair && !noLiquidity && pairState !== PairState.INVALID ? (
                    <div className="w-full max-w-2xl flex flex-col mt-4">
                        <MinimalPositionCard showUnwrapped={oneCurrencyIsWETH} pair={pair} />
                    </div>
                ) : null
            ) : (
                <UnsupportedCurrencyFooter
                    show={addIsUnsupported}
                    currencies={[currencies.CURRENCY_A, currencies.CURRENCY_B]}
                />
            )}
        </>
    )
}
