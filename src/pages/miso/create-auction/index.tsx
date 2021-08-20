import { ExclamationCircleIcon as ExclamationCircleIconOutline } from '@heroicons/react/outline'
import { ExclamationCircleIcon as ExclamationCircleIconSolid } from '@heroicons/react/solid'
import { Token } from '@sushiswap/sdk'
import Head from 'next/head'
import React from 'react'

import Button from '../../../components/Button'
import ExternalLink from '../../../components/ExternalLink'
import Image from '../../../components/Image'
import Input from '../../../components/Miso/Input'
import Radio from '../../../components/Miso/Radio'
import TokenSelect from '../../../components/Miso/TokenSelect'
import { MISO_MARKET_ADDRESS } from '../../../constants/miso'
import { useActiveWeb3React } from '../../../hooks/useActiveWeb3React'
import Layout from '../../../layouts/Miso'
import childrenWithProps from '../../../layouts/Miso/children'
import Divider from '../../../layouts/Miso/divider'
import { useTokenAllowance, useTokenBalance } from '../../../state/wallet/hooks'

import dutchAuction from '../../../../public/images/miso/create-auction/miso-dutch-auction.svg'
import crowdsale from '../../../../public/images/miso/create-auction/miso-crowdsale.svg'
import batchAuction from '../../../../public/images/miso/create-auction/miso-batch-auction.svg'

function CreateAuction({ pageIndex, movePage }) {
  const { account, chainId } = useActiveWeb3React()

  const [auctionType, setAuctionType] = React.useState('Dutch Auction')

  const [token, selectToken] = React.useState<Token>(null)
  const [tokenAllowance, setTokenAllowance] = React.useState('')
  const [tokenAmount, setTokenAmount] = React.useState('')
  const balance = useTokenBalance(account ?? undefined, token)
  const allowance = useTokenAllowance(account ?? undefined, MISO_MARKET_ADDRESS[chainId], token)

  return (
    <>
      <Head>
        <title>MISO | Sushi</title>
        <meta key="description" name="description" content="MISO by Sushi, an initial Sushi offering on steroids ..." />
      </Head>
      <div>
        {pageIndex === 0 && (
          <div>
            <div className="flex flex-row items-start bg-[#A755DD2B] mt-2 p-3 rounded">
              <ExclamationCircleIconSolid className="w-12 mt-1 mr-2 text-[#A755DD]" aria-hidden="true" />
              <div>
                Choose which type of auction you’d like to hold. Each of the three types has their own unique
                characteristics, so choose the one you think is most appropriate for your project. Need more information
                on what these mean, and which is best for you? Read our documentation
                <ExternalLink href="https://instantmiso.gitbook.io/miso/markets/markets">
                  <span className="text-blue"> here</span>
                </ExternalLink>
                .
              </div>
            </div>
            <div className="grid grid-cols-3 gap-5 mt-5 mb-16">
              <div>
                <div className="pl-10">
                  <Image src={dutchAuction} height={64} alt="Fixed" />
                </div>
                <Radio
                  label="Dutch Auction"
                  selected={auctionType === 'Dutch Auction'}
                  onSelect={(label) => setAuctionType(label)}
                  className="my-5"
                />
                <div>The price is set at a higher value per token than expected and descends linearly over time.</div>
                <div className="flex flex-row items-start mt-3">
                  <ExclamationCircleIconOutline className="w-6 mr-2 mt-1" aria-hidden="true" />
                  <div>Great for a completely novel item’s true price discovery</div>
                </div>
              </div>
              <div>
                <div className="pl-10">
                  <Image src={crowdsale} height={64} alt="Mintable" />
                </div>
                <Radio
                  label="Crowdsale"
                  selected={auctionType === 'Crowdsale'}
                  onSelect={(label) => setAuctionType(label)}
                  className="my-5"
                />
                <div>
                  A set amount of tokens are divided amongst all the contributors to the Market event, weighted
                  according to their contribution to the pool.
                </div>
                <div className="flex flex-row items-start mt-3">
                  <ExclamationCircleIconOutline className="w-6 mr-2 mt-1" aria-hidden="true" />
                  <div>Great for projects looking to ensure that everyone taking part is rewarded</div>
                </div>
              </div>
              <div>
                <div className="pl-10">
                  <Image src={batchAuction} height={64} alt="Sushi" />
                </div>
                <Radio
                  label="Batch Auction"
                  selected={auctionType === 'Batch Auction'}
                  onSelect={(label) => setAuctionType(label)}
                  className="my-5"
                />
                <div>A fixed price and a fixed set of tokens.</div>
                <div className="flex flex-row items-start mt-3">
                  <ExclamationCircleIconOutline className="w-6 mr-2 mt-1" aria-hidden="true" />
                  <div>Great when the token price is already known or has been decided on previously</div>
                </div>
              </div>
            </div>
            <Divider />
            <div className="flex justify-between mt-5">
              <Button color="gray" disabled className="w-[133px]">
                Previous
              </Button>
              <Button color="blue" className="w-[133px]" onClick={() => movePage(pageIndex + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
        {pageIndex === 1 && (
          <div>
            <div className="mb-16">
              <TokenSelect onTokenSelect={(token) => selectToken(token)} />
              <Input
                label="Auction Token Allowance*"
                value={tokenAllowance}
                type="digit"
                placeholder="Enter the amount of token you would like to launch."
                alert="Enter the amount that you would like to allocate for MISO auctions. If you plan to set up post auction liquidity launcher, you can also include the allowance here."
                hint={
                  <span>
                    <b>Note</b>: Your auction token amount must be higher than or equal to token balance.
                  </span>
                }
                trailing={<span>Your Token Balance: {balance ? balance.toSignificant(4) : 'N/A'}</span>}
                onUserInput={(input) => setTokenAllowance(input)}
              />
              <Input
                label="Auction Token Amount*"
                value={tokenAmount}
                type="digit"
                placeholder="Enter the amount of token you would like to auction."
                alert="This will be the number of tokens you will put into the auction contract. Please consider this carefully."
                hint={
                  <span>
                    <b>Note</b>: Token amount must be lower or equal to allowance.
                  </span>
                }
                trailing={
                  <span>
                    {token
                      ? `Your Token Allowance: ${allowance ? allowance.toSignificant(4) : 'N/A'} ${token.symbol}`
                      : ''}
                  </span>
                }
                onUserInput={(input) => setTokenAmount(input)}
              />
            </div>
            <Divider />
            <div className="flex justify-between mt-5">
              <Button color="gray" className="w-[133px]" onClick={() => movePage(pageIndex - 1)}>
                Previous
              </Button>
              <Button color="blue" className="w-[133px]" onClick={() => movePage(pageIndex + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

const CreateAuctionLayout = ({ children }) => {
  const [pageIndex, movePage] = React.useState(0)

  return (
    <Layout
      navs={[
        { link: '/miso', name: 'MISO Launchpad' },
        { link: '/miso/create-auction', name: 'Create Auction' },
      ]}
      title={{
        heading: 'Create Auction',
        content: 'Follow the instructions below, and deploy your auction with your token.',
      }}
      tabs={[
        { heading: 'SELECT AUCTION TYPE', content: 'Decide on the type of auction' },
        { heading: 'SET PARAMETERS', content: 'Set up required auction parameters' },
        { heading: 'REVIEW', content: 'Deploy your auction' },
      ]}
      active={pageIndex}
    >
      {childrenWithProps(children, { pageIndex, movePage })}
    </Layout>
  )
}
CreateAuction.Layout = CreateAuctionLayout

export default CreateAuction
