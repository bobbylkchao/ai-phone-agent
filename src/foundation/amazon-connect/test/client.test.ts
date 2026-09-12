import { ConnectClient } from '@aws-sdk/client-connect'
import { amazonConnectClient, initAmazonConnectClient } from '../client'

jest.mock('@aws-sdk/client-connect', () => ({
  ConnectClient: jest.fn().mockImplementation((config) => ({ config })),
}))

describe('initAmazonConnectClient', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('is disabled unless explicitly enabled', () => {
    delete process.env.AMAZON_CONNECT_SDK_ENABLE

    initAmazonConnectClient()

    expect(ConnectClient).not.toHaveBeenCalled()
  })

  it('does not initialize with incomplete credentials', () => {
    process.env.AMAZON_CONNECT_SDK_ENABLE = 'true'
    delete process.env.AWS_REGION

    initAmazonConnectClient()

    expect(ConnectClient).not.toHaveBeenCalled()
  })

  it('initializes with the configured region and credentials', () => {
    process.env.AMAZON_CONNECT_SDK_ENABLE = 'true'
    process.env.AWS_REGION = 'us-east-1'
    process.env.AWS_ACCESS_KEY_ID = 'access'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret'

    initAmazonConnectClient()

    expect(ConnectClient).toHaveBeenCalledWith({
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'access',
        secretAccessKey: 'secret',
      },
    })
    expect(amazonConnectClient).toBeDefined()
  })
})
