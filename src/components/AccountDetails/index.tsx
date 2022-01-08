import React, { FC, useCallback } from 'react'
import { SUPPORTED_WALLETS, injected } from '../../config/wallets'

import { AppDispatch } from '../../state'
import Button from '../Button'
import Copy from './Copy'
import ExternalLink from '../ExternalLink'
import Image from 'next/image'
import { ExternalLink as LinkIcon } from 'react-feather'
import ModalHeader from '../ModalHeader'
import Transaction from './Transaction'
import Typography from '../Typography'
import { clearAllTransactions } from '../../state/transactions/actions'
import { getExplorerLink } from '../../functions/explorer'
import { shortenAddress } from '../../functions'
import { t } from '@lingui/macro'
import { useActiveWeb3React } from '../../hooks/useActiveWeb3React'
import { useDispatch } from 'react-redux'
import { useLingui } from '@lingui/react'

const WalletIcon: FC<{ size?: number; src: string; alt: string }> = ({ size, src, alt, children }) => {
  return (
    <div className="flex flex-row items-end justify-center mr-2 flex-nowrap md:items-center">
      <Image src={src} alt={alt} width={size} height={size} />
      {children}
    </div>
  )
}

function renderTransactions(transactions: string[]) {
  return (
    <div className="flex flex-col gap-2 flex-nowrap">
      {transactions.map((hash, i) => {
        return <Transaction key={i} hash={hash} />
      })}
    </div>
  )
}

interface AccountDetailsProps {
  toggleWalletModal: () => void
  pendingTransactions: string[]
  confirmedTransactions: string[]
  ENSName?: string
  openOptions: () => void
}

const AccountDetails: FC<AccountDetailsProps> = ({
  toggleWalletModal,
  pendingTransactions,
  confirmedTransactions,
  ENSName,
  openOptions,
}) => {
  const { i18n } = useLingui()
  const { chainId, account, connector } = useActiveWeb3React()
  const dispatch = useDispatch<AppDispatch>()

  function formatConnectorName() {
    const { ethereum } = window
    const isMetaMask = !!(ethereum && ethereum.isMetaMask)
    const name = Object.keys(SUPPORTED_WALLETS)
      .filter(
        (k) => {
          // TODO dumb hack - with more wallets improve this section
          if (k === 'WALLET_CONNECT' && connector.constructor.name === 'WalletConnectConnector') {
            return true
          }

          if (SUPPORTED_WALLETS[k].connector === connector && (connector !== injected || isMetaMask === (k === 'METAMASK'))) {
            return true
          }

          return false
        }
      )
      .map((k) => SUPPORTED_WALLETS[k].name)[0]
    return <div className="font-medium text-baseline text-secondary">Connected with {name}</div>
  }

  function getStatusIcon() {
    if (connector === injected) {
      return null
      // return <IconWrapper size={16}>{/* <Identicon /> */}</IconWrapper>
    } else if (connector.constructor.name === 'WalletConnectConnector') {
      return <WalletIcon src="/images/wallets/wallet-connect.svg" alt="Wallet Connect" size={16} />
    } else if (connector.constructor.name === 'WalletLinkConnector') {
      return <WalletIcon src="/images/wallets/coinbase.svg" alt="Coinbase" size={16} />
    } else if (connector.constructor.name === 'FortmaticConnector') {
      return <WalletIcon src="/images/wallets/formatic.png" alt="Fortmatic" size={16} />
    } else if (connector.constructor.name === 'PortisConnector') {
      return (
        <WalletIcon src="/images/wallets/portnis.png" alt="Portis" size={16}>
          <Button
            onClick={async () => {
              // casting as PortisConnector here defeats the lazyload purpose
              ;(connector as any).portis.showPortis()
            }}
          >
            Show Portis
          </Button>
        </WalletIcon>
      )
    } else if (connector.constructor.name === 'TorusConnector') {
      return <WalletIcon src="/images/wallets/torus.png" alt="Torus" size={16} />
    }
    return null
  }

  const clearAllTransactionsCallback = useCallback(() => {
    if (chainId) dispatch(clearAllTransactions({ chainId }))
  }, [dispatch, chainId])

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <ModalHeader title={i18n._(t`Account`)} onClose={toggleWalletModal} />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            {formatConnectorName()}
            <div className="flex space-x-3">
              {connector === injected &&
                connector.constructor.name !== 'WalletLinkConnector' &&
                connector.constructor.name !== 'BscConnector' &&
                connector.constructor.name !== 'KeystoneConnector' && (
                  <Button
                    variant="outlined"
                    color="gray"
                    size="xs"
                    onClick={() => {
                      console.log(connector);
                      ;(connector as any).handleClose()
                    }}
                  >
                    {i18n._(t`Disconnect`)}
                  </Button>
                )}
              <Button
                variant="outlined"
                color="gray"
                size="xs"
                onClick={() => {
                  openOptions()
                }}
              >
                {i18n._(t`Change`)}
              </Button>
            </div>
          </div>
          <div id="web3-account-identifier-row" className="flex flex-col justify-center space-y-3">
            {/*getStatusIcon()*/}
            {ENSName ? (
              <div className="bg-dark-800">
                <Typography>{ENSName}</Typography>
              </div>
            ) : (
              <div className="px-3 py-2 rounded bg-dark-800">
                <Typography>{account && shortenAddress(account)}</Typography>
              </div>
            )}
            <div className="flex items-center gap-2 space-x-3">
              {chainId && account && (
                <ExternalLink
                  color="blue"
                  startIcon={<LinkIcon size={16} />}
                  href={chainId && getExplorerLink(chainId, ENSName || account, 'address')}
                >
                  <Typography variant="sm">{i18n._(t`View on explorer`)}</Typography>
                </ExternalLink>
              )}
              {account && (
                <Copy toCopy={account}>
                  <Typography variant="sm">{i18n._(t`Copy Address`)}</Typography>
                </Copy>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Typography weight={700}>{i18n._(t`Recent Transactions`)}</Typography>
          <div>
            <Button variant="outlined" color="gray" size="xs" onClick={clearAllTransactionsCallback}>
              {i18n._(t`Clear all`)}
            </Button>
          </div>
        </div>
        {!!pendingTransactions.length || !!confirmedTransactions.length ? (
          <>
            {renderTransactions(pendingTransactions)}
            {renderTransactions(confirmedTransactions)}
          </>
        ) : (
          <Typography variant="sm" className="text-secondary">
            {i18n._(t`Your transactions will appear here...`)}
          </Typography>
        )}
      </div>
    </div>
  )
}

export default AccountDetails
